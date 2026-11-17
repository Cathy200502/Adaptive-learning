const mongoose = require('mongoose');
const Question = require('../models/Question');
const Topic = require('../models/Topic');
const TutorSession = require('../models/TutorSession');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const tutor = require('../services/tutorService');
const { loadTutorExclusions } = require('../services/questionPool');

/**
 * POST /api/tutor/lesson  { questionId, selectedAnswer, previousToken? }
 * Starts the loop for a wrong answer, or - when previousToken is supplied and
 * the learner did not understand - a simpler lesson at the next level.
 */
exports.lesson = asyncHandler(async (req, res) => {
  const { questionId, selectedAnswer, previousToken } = req.body;
  if (!mongoose.isValidObjectId(questionId)) throw ApiError.badRequest('That question id is not valid');
  if (!Number.isInteger(selectedAnswer)) throw ApiError.badRequest('selectedAnswer must be a number');

  const question = await Question.findById(questionId);
  if (!question) throw ApiError.notFound('That question no longer exists');
  if (selectedAnswer < 0 || selectedAnswer >= question.options.length) throw ApiError.badRequest('That option does not exist');
  if (selectedAnswer === question.correctAnswer) throw ApiError.badRequest('That answer was correct - there is nothing to review');

  let level = 1;
  let previousMisconception = '';
  let sid = tutor.newSid();
  if (previousToken) {
    const prev = tutor.openSession(previousToken);
    if (!prev || prev.uid !== String(req.user._id) || prev.qid !== String(question._id)) {
      throw ApiError.badRequest('This tutoring session has expired. Start again from the question.');
    }
    level = prev.level + 1;
    previousMisconception = prev.misconception;
    sid = prev.sid;
  }

  if (level > tutor.MAX_LEVEL) {
    return res.json({
      exhausted: true,
      message: 'This one is tricky. Read the topic details and resources, then try the topic again - you can always come back to it in Mistake Review.',
      topicLink: `/topics/${question.course}/${question.topic}`
    });
  }

  const topic = await Topic.findOne({ course: question.course, slug: question.topic }).lean();
  const bank = await Question.find({ course: question.course, topic: question.topic }).lean();
  // Bank questions already asked in the quiz, or already used as a reassessment, are off limits.
  const excludeIds = await loadTutorExclusions(req.user._id, question.course, question.topic);
  const { lesson, source } = await tutor.buildLesson({
    course: question.course, topic, question, selectedAnswer, level, previousMisconception, bank, excludeIds
  });

  const sessionToken = tutor.sealSession({
    sid, userId: req.user._id, questionId: question._id, level,
    misconception: lesson.misconception, practice: lesson.practice, reassessment: lesson.reassessment
  });

  await TutorSession.findOneAndUpdate(
    { sid },
    {
      $set: { misconception: lesson.misconception, source, level, practiceCorrect: null, reassessCorrect: null, understood: false },
      // remember a bank question used as the reassessment so the normal quiz skips it
      ...(lesson._fallbackQuestionId ? { $addToSet: { reassessedQuestions: lesson._fallbackQuestionId } } : {}),
      $setOnInsert: { user: req.user._id, course: question.course, topic: question.topic, question: question._id }
    },
    { upsert: true }
  );

  res.json({
    level,
    maxLevel: tutor.MAX_LEVEL,
    source,
    sessionToken,
    misconception: lesson.misconception,
    explanation: lesson.explanation,
    example: lesson.example,
    practice: tutor.publicQuestion(lesson.practice),
    reassessment: tutor.publicQuestion(lesson.reassessment)
  });
});

/**
 * POST /api/tutor/check  { sessionToken, step: 'practice'|'reassess', selectedAnswer }
 * Grades the mini practice or the reassessment. Passing the reassessment means
 * the learner understood; failing it means the client should ask for a simpler lesson.
 */
exports.check = asyncHandler(async (req, res) => {
  const { sessionToken, step, selectedAnswer } = req.body;
  if (!['practice', 'reassess'].includes(step)) throw ApiError.badRequest('step must be practice or reassess');
  if (!Number.isInteger(selectedAnswer) || selectedAnswer < 0 || selectedAnswer > 3) throw ApiError.badRequest('Choose an option first');

  const session = tutor.openSession(sessionToken);
  if (!session || session.uid !== String(req.user._id)) throw ApiError.badRequest('This tutoring session has expired. Start again from the question.');

  const key = session.keys[step];
  if (key === null || key === undefined) throw ApiError.badRequest('That step is not part of this lesson');

  const correct = selectedAnswer === key;
  const update = step === 'practice' ? { practiceCorrect: correct } : { reassessCorrect: correct, understood: correct };
  await TutorSession.updateOne({ sid: session.sid }, { $set: update });

  const canSimplify = session.level < tutor.MAX_LEVEL;
  res.json({
    correct,
    correctAnswer: key,
    explanation: session.explain[step],
    ...(step === 'reassess' ? { understood: correct, canSimplify, level: session.level } : {})
  });
});

/** GET /api/tutor/stats - how often the tutor loop ends in "understood". */
exports.stats = asyncHandler(async (req, res) => {
  const sessions = await TutorSession.find({ user: req.user._id }).select('understood reassessCorrect level').lean();
  const finished = sessions.filter((s) => s.reassessCorrect !== null);
  res.json({
    sessions: sessions.length,
    understood: finished.filter((s) => s.understood).length,
    needed_simpler: sessions.filter((s) => s.level > 1).length
  });
});
