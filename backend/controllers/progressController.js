const QuizAttempt = require('../models/QuizAttempt');
const UserProgress = require('../models/UserProgress');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const { courseSummary, weakAreas } = require('../services/progressService');

const COURSES = ['java', 'python'];

exports.overview = asyncHandler(async (req, res) => {
  const summaries = {};
  for (const course of COURSES) summaries[course] = await courseSummary(req.user._id, course);

  const attempts = await QuizAttempt.find({ user: req.user._id }).lean();
  const correct = attempts.filter((a) => a.correct).length;

  res.json({
    courses: summaries,
    performance: {
      attempted: attempts.length,
      correct,
      wrong: attempts.length - correct,
      accuracy: attempts.length ? Math.round((correct / attempts.length) * 100) : 0
    }
  });
});

exports.byCourse = asyncHandler(async (req, res) => {
  const course = String(req.params.course).toLowerCase();
  const summary = await courseSummary(req.user._id, course);
  const attempts = await QuizAttempt.find({ user: req.user._id, course }).lean();
  const correct = attempts.filter((a) => a.correct).length;

  res.json({
    ...summary,
    weakAreas: weakAreas(summary.topics),
    performance: {
      attempted: attempts.length,
      correct,
      wrong: attempts.length - correct,
      accuracy: attempts.length ? Math.round((correct / attempts.length) * 100) : 0,
      byDifficulty: ['easy', 'medium', 'hard'].map((level) => {
        const set = attempts.filter((a) => a.difficulty === level);
        return {
          level,
          attempted: set.length,
          correct: set.filter((a) => a.correct).length
        };
      })
    }
  });
});

/** Dashboard payload: everything the home screen needs in one request. */
exports.dashboard = asyncHandler(async (req, res) => {
  const course = String(req.query.course || req.user.selectedCourse).toLowerCase();
  const summary = await courseSummary(req.user._id, course);

  const [recentAttempts, recentProgress, notifications] = await Promise.all([
    QuizAttempt.find({ user: req.user._id, course }).sort({ createdAt: -1 }).limit(8).lean(),
    UserProgress.find({ user: req.user._id, course }).sort({ updatedAt: -1 }).limit(5).lean(),
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(5).lean()
  ]);

  const topicName = (slug) => summary.topics.find((t) => t.slug === slug)?.name || slug;

  const activity = [
    ...recentAttempts.map((a) => ({
      kind: a.correct ? 'correct' : 'wrong',
      label: `${a.correct ? 'Answered correctly' : 'Missed a question'} in ${topicName(a.topic)}`,
      meta: `${a.difficulty} · mastery ${a.masteryAfter}%`,
      at: a.createdAt
    })),
    ...recentProgress
      .filter((p) => p.completed)
      .map((p) => ({
        kind: 'mastered',
        label: `Mastered ${topicName(p.topic)}`,
        meta: `${p.mastery}% mastery`,
        at: p.completedAt || p.updatedAt
      }))
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 8);

  res.json({
    course,
    summary,
    weakAreas: weakAreas(summary.topics),
    activity,
    notifications,
    masteryByTopic: summary.topics
      .filter((t) => t.attempts > 0 || t.status !== 'locked')
      .slice(0, 8)
      .map((t) => ({ name: t.name, slug: t.slug, mastery: t.mastery, status: t.status }))
  });
});

exports.listNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20).lean();
  res.json({ notifications });
});

exports.markNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ message: 'Notifications marked as read' });
});
