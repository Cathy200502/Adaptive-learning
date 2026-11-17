const mongoose = require('mongoose');
const Question = require('../models/Question');
const Topic = require('../models/Topic');
const UserProgress = require('../models/UserProgress');
const QuizAttempt = require('../models/QuizAttempt');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const engine = require('../services/adaptiveEngine');
const { selectableBank } = require('../services/questionPool');
const { buildLearningPath, notify, touchStreak } = require('../services/progressService');

const publicProgress = (p) => ({
  mastery: p.mastery,
  elo: p.elo,
  difficulty: p.difficulty,
  attempts: p.attempts,
  correctAnswers: p.correctAnswers,
  wrongAnswers: p.wrongAnswers,
  consecutiveCorrect: p.consecutiveCorrect,
  consecutiveWrong: p.consecutiveWrong,
  completed: p.completed,
  accuracy: p.attempts ? Math.round((p.correctAnswers / p.attempts) * 100) : 0
});

async function getOrCreateProgress(userId, course, topic) {
  let progress = await UserProgress.findOne({ user: userId, course, topic });
  if (!progress) {
    progress = await UserProgress.create({
      user: userId, course, topic, difficulty: engine.config.startLevel, elo: engine.config.elo.initial
    });
  }
  return progress;
}

/**
 * What this learner has answered in this topic during the CURRENT round.
 * QuizAttempt is the source of truth, so this also works for progress recorded
 * before rounds existed. Attempts from before `since` (the start of the round,
 * set when the learner presses "Practise again") are ignored here - they stay
 * in the database for Mistake Review and statistics.
 */
async function loadHistory(userId, course, topic, since = null) {
  const filter = { user: userId, course, topic };
  if (since) filter.createdAt = { $gte: since };
  const attempts = await QuizAttempt.find(filter).select('question correct').lean();
  return { ...engine.summariseAttempts(attempts), roundAttempts: attempts.length };
}

/** Loads a topic and makes sure the learner is allowed to practise it. */
async function loadUnlockedTopic(userId, course, topicSlug) {
  const topic = await Topic.findOne({ course, slug: topicSlug }).lean();
  if (!topic) throw ApiError.notFound('That topic does not exist');

  // Topics unlock in order, so a locked topic cannot be started.
  const path = await buildLearningPath(userId, course);
  const entry = path.find((t) => t.slug === topicSlug);
  if (!entry?.unlocked) throw ApiError.forbidden('Finish the previous topic to unlock this one');
  return topic;
}

/** How far through the topic's question bank the learner is. */
function bankStats(bank, correctIds) {
  const inBank = new Set(bank.map((q) => String(q._id)));
  const answeredCorrectly = correctIds.filter((id) => inBank.has(id)).length;
  return { bankSize: bank.length, answeredCorrectly, remaining: bank.length - answeredCorrectly };
}

/** The topic that follows `slug` in the learning path, if any. */
async function nextTopicAfter(userId, course, slug) {
  const path = await buildLearningPath(userId, course);
  const index = path.findIndex((t) => t.slug === slug);
  return index >= 0 && path[index + 1] ? { name: path[index + 1].name, slug: path[index + 1].slug } : null;
}

/**
 * A learner who has answered EVERY question in a topic correctly has finished
 * it, even if the normal mastery gate (attempts / mastery score) was never
 * reached. Without this, small question banks could never be completed once
 * correct answers stop repeating, and the next topic would stay locked.
 */
function markCleared(progress) {
  progress.completed = true;
  progress.completedAt = progress.completedAt || new Date();
  progress.mastery = Math.max(progress.mastery, engine.config.mastery.threshold);
}

/** GET /api/quiz/question?course=java&topic=arrays */
exports.nextQuestion = asyncHandler(async (req, res) => {
  const course = String(req.query.course || req.user.selectedCourse).toLowerCase();
  const topicSlug = String(req.query.topic || '').toLowerCase();
  if (!topicSlug) throw ApiError.badRequest('Pick a topic to practise');

  const topic = await loadUnlockedTopic(req.user._id, course, topicSlug);

  const progress = await getOrCreateProgress(req.user._id, course, topicSlug);
  const fullBank = await Question.find({ course, topic: topicSlug });
  // Questions the AI tutor already used for a reassessment are never asked again this round.
  const bank = await selectableBank(fullBank, req.user._id, course, topicSlug);
  if (!fullBank.length) {
    return res.status(200).json({
      question: null,
      progress: publicProgress(progress),
      topic: { name: topic.name, slug: topic.slug },
      message: 'No questions have been added for this topic yet.'
    });
  }

  const history = await loadHistory(req.user._id, course, topicSlug, progress.roundStartedAt);
  const stats = bankStats(bank, history.correctIds);

  const question = engine.selectQuestion(bank, {
    elo: progress.elo,
    correctIds: history.correctIds,
    missedIds: history.missedIds,
    recentIds: progress.recentQuestions
  });

  // Nothing left: every question in this topic has been answered correctly.
  if (!question) {
    const wasCompleted = progress.completed;
    if (!wasCompleted) {
      markCleared(progress);
      await progress.save();
    }
    const nextTopic = await nextTopicAfter(req.user._id, course, topicSlug);
    if (!wasCompleted) {
      await notify(
        req.user._id,
        'mastery',
        `Topic mastered: ${topic.name}`,
        nextTopic ? `Next topic unlocked: ${nextTopic.name}` : 'You finished the last topic of this course.'
      );
    }
    return res.json({
      question: null,
      cleared: true,
      progress: publicProgress(progress),
      topic: { name: topic.name, slug: topic.slug },
      nextTopic,
      ...stats,
      message: 'You have answered every question in this topic correctly. Press Practise again to take the test again.'
    });
  }

  res.json({
    question: question.toLearnerJSON(),
    isRetry: history.missedIds.includes(String(question._id)),
    questionNumber: history.roundAttempts + 1,
    progress: publicProgress(progress),
    topic: { name: topic.name, slug: topic.slug },
    ...stats
  });
});

/** POST /api/quiz/answer  { questionId, selectedAnswer } */
exports.submitAnswer = asyncHandler(async (req, res) => {
  const { questionId, selectedAnswer } = req.body;
  if (!mongoose.isValidObjectId(questionId)) throw ApiError.badRequest('That question id is not valid');
  if (!Number.isInteger(selectedAnswer)) throw ApiError.badRequest('Choose an option before submitting');

  const question = await Question.findById(questionId);
  if (!question) throw ApiError.notFound('That question no longer exists');
  if (selectedAnswer < 0 || selectedAnswer >= question.options.length) {
    throw ApiError.badRequest('That option does not exist');
  }

  const progress = await getOrCreateProgress(req.user._id, question.course, question.topic);
  const wasCompleted = progress.completed;
  const correct = selectedAnswer === question.correctAnswer;

  // A question answered correctly is retired for good. Refusing it here also
  // stops a double-click or an old browser tab from counting it twice.
  const history = await loadHistory(req.user._id, question.course, question.topic, progress.roundStartedAt);
  if (history.correctIds.includes(String(question._id))) {
    throw ApiError.conflict('You already answered this question correctly');
  }

  // ---- adaptive step -------------------------------------------------
  const result = engine.applyAnswer(progress, { correct, questionDifficulty: question.difficulty });

  progress.mastery = result.mastery;
  progress.elo = result.eloAfter;
  progress.difficulty = result.difficultyAfter;
  progress.attempts = result.attempts;
  progress.correctAnswers = result.correctAnswers;
  progress.wrongAnswers = result.wrongAnswers;
  progress.consecutiveCorrect = result.consecutiveCorrect;
  progress.consecutiveWrong = result.consecutiveWrong;
  progress.mediumCorrect = result.mediumCorrect;
  progress.hardCorrect = result.hardCorrect;
  progress.recentQuestions = engine.rememberQuestion(progress.recentQuestions, question._id);
  progress.lastPracticedAt = new Date();

  // Has the learner now answered every question in the topic correctly?
  const fullBank = await Question.find({ course: question.course, topic: question.topic }).select('_id').lean();
  const bank = await selectableBank(fullBank, req.user._id, question.course, question.topic);
  const correctIds = correct ? [...history.correctIds, String(question._id)] : history.correctIds;
  const cleared = engine.isBankCleared(bank, correctIds);
  const stats = bankStats(bank, correctIds);

  const mastered = result.mastered || cleared;
  if (cleared && !result.mastered) markCleared(progress);
  if (mastered) {
    progress.completed = true;
    progress.completedAt = progress.completedAt || new Date();
  }
  await progress.save();

  await QuizAttempt.create({
    user: req.user._id,
    course: question.course,
    topic: question.topic,
    question: question._id,
    selectedAnswer,
    correct,
    difficulty: question.difficulty,
    masteryAfter: progress.mastery
  });

  if (touchStreak(req.user)) await req.user.save();

  // ---- unlocking + notifications -------------------------------------
  let nextTopic = null;
  const justMastered = mastered && !wasCompleted;
  if (justMastered || cleared) {
    nextTopic = await nextTopicAfter(req.user._id, question.course, question.topic);
  }
  if (justMastered) {
    const topicDoc = await Topic.findOne({ course: question.course, slug: question.topic }).lean();
    await notify(
      req.user._id,
      'mastery',
      `Topic mastered: ${topicDoc?.name || question.topic}`,
      nextTopic ? `Next topic unlocked: ${nextTopic.name}` : 'You finished the last topic of this course.'
    );
  }

  res.json({
    correct,
    correctAnswer: question.correctAnswer,
    correctOption: question.options[question.correctAnswer],
    yourOption: question.options[selectedAnswer],
    explanation: question.explanation,
    concept: question.concept,
    tip: question.tip,
    mastery: progress.mastery,
    elo: progress.elo,
    eloBefore: result.eloBefore,
    eloAfter: result.eloAfter,
    difficultyBefore: result.difficultyBefore,
    difficultyAfter: result.difficultyAfter,
    difficultyChanged: result.difficultyBefore !== result.difficultyAfter,
    mastered: justMastered,
    cleared,
    nextTopic,
    ...stats,
    progress: publicProgress(progress)
  });
});

/**
 * POST /api/quiz/restart  { course, topic }
 * "Practise again": starts a fresh round of the test for one topic.
 *
 * Nothing is deleted. The topic stays completed (the next topic stays unlocked),
 * mastery and lifetime statistics are kept, and every earlier attempt is still
 * available to Mistake Review. What resets is the round: questions answered
 * correctly before now can be asked again, difficulty goes back to the start
 * level and the streaks and recently-seen list are cleared.
 */
exports.restartTopic = asyncHandler(async (req, res) => {
  const course = String(req.body.course || req.user.selectedCourse).toLowerCase();
  const topicSlug = String(req.body.topic || '').toLowerCase();
  if (!topicSlug) throw ApiError.badRequest('Pick a topic to practise');

  await loadUnlockedTopic(req.user._id, course, topicSlug);
  const progress = await getOrCreateProgress(req.user._id, course, topicSlug);

  progress.roundStartedAt = new Date();
  progress.elo = engine.config.elo.initial;
  progress.difficulty = engine.config.startLevel;
  progress.consecutiveCorrect = 0;
  progress.consecutiveWrong = 0;
  progress.recentQuestions = [];
  await progress.save();

  res.json({ restarted: true, progress: publicProgress(progress) });
});

/** GET /api/quiz/progress?course=java&topic=arrays */
exports.quizProgress = asyncHandler(async (req, res) => {
  const course = String(req.query.course || req.user.selectedCourse).toLowerCase();
  const topic = String(req.query.topic || '').toLowerCase();
  const progress = await UserProgress.findOne({ user: req.user._id, course, topic });
  res.json({ progress: progress ? publicProgress(progress) : null, config: engine.config });
});

/** GET /api/quiz/mistakes?course=java */
exports.mistakes = asyncHandler(async (req, res) => {
  const filter = { user: req.user._id, correct: false };
  if (req.query.course) filter.course = String(req.query.course).toLowerCase();

  const attempts = await QuizAttempt.find(filter)
    .sort({ createdAt: -1 })
    .limit(60)
    .populate('question')
    .lean();

  const seen = new Set();
  const mistakes = [];
  for (const attempt of attempts) {
    if (!attempt.question || seen.has(String(attempt.question._id))) continue;
    seen.add(String(attempt.question._id));
    const q = attempt.question;
    mistakes.push({
      attemptId: attempt._id,
      course: attempt.course,
      topic: attempt.topic,
      difficulty: q.difficulty,
      question: q.question,
      code: q.code,
      options: q.options,
      yourAnswer: attempt.selectedAnswer,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      concept: q.concept,
      answeredAt: attempt.createdAt
    });
  }
  res.json({ mistakes });
});
