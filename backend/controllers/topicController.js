const Topic = require('../models/Topic');
const Question = require('../models/Question');
const Resource = require('../models/Resource');
const UserProgress = require('../models/UserProgress');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { buildLearningPath } = require('../services/progressService');

exports.listTopics = asyncHandler(async (req, res) => {
  const course = String(req.params.course).toLowerCase();
  const search = (req.query.search || '').trim().toLowerCase();
  let topics = await buildLearningPath(req.user._id, course);
  if (!topics.length) throw ApiError.notFound('No topics found for that course');
  if (search) {
    topics = topics.filter(
      (t) => t.name.toLowerCase().includes(search) || (t.section || '').toLowerCase().includes(search)
    );
  }
  res.json({ course, topics });
});

exports.getTopic = asyncHandler(async (req, res) => {
  const course = String(req.params.course).toLowerCase();
  const slug = String(req.params.topic).toLowerCase();

  const topic = await Topic.findOne({ course, slug }).lean();
  if (!topic) throw ApiError.notFound('That topic does not exist');

  const path = await buildLearningPath(req.user._id, course);
  const entry = path.find((t) => t.slug === slug);
  const [progress, questionCount, resources] = await Promise.all([
    UserProgress.findOne({ user: req.user._id, course, topic: slug }).lean(),
    Question.countDocuments({ course, topic: slug }),
    Resource.find({ course, topic: slug }).lean()
  ]);

  res.json({
    topic: {
      ...topic,
      unlocked: entry?.unlocked ?? false,
      status: entry?.status ?? 'locked',
      mastery: progress?.mastery ?? 0,
      difficulty: progress?.difficulty ?? 'easy',
      attempts: progress?.attempts ?? 0,
      correctAnswers: progress?.correctAnswers ?? 0,
      wrongAnswers: progress?.wrongAnswers ?? 0,
      completed: progress?.completed ?? false,
      questionCount
    },
    resources
  });
});
