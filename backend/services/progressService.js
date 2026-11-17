/**
 * Progress + learning-path helpers shared by the controllers.
 *
 * Nothing here decides *difficulty* - that belongs to services/adaptiveEngine.js.
 * This module only turns stored progress rows into the shapes the UI needs:
 * a progressively-unlocked learning path, a course summary and weak areas.
 */
const Topic = require('../models/Topic');
const UserProgress = require('../models/UserProgress');
const Notification = require('../models/Notification');
const config = require('../config/adaptive.config');
const { buildGraph, unlockedSlugs } = require('./topicGraph');

const WEAK_MASTERY_BELOW = Number(process.env.WEAK_AREA_MASTERY_BELOW || 60);
const WEAK_MIN_ATTEMPTS = Number(process.env.WEAK_AREA_MIN_ATTEMPTS || 2);

/** Local date as YYYY-MM-DD, used for the learning streak. */
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

/**
 * Updates the learner's day streak on the user document (in memory).
 * Returns true when something changed so the caller can persist it.
 */
function touchStreak(user) {
  const today = dayKey();
  if (!user.streak) user.streak = { count: 0, lastActiveDay: null };
  if (user.streak.lastActiveDay === today) return false;

  const yesterday = dayKey(new Date(Date.now() - 86400000));
  user.streak = {
    count: user.streak.lastActiveDay === yesterday ? (user.streak.count || 0) + 1 : 1,
    lastActiveDay: today
  };
  user.markModified('streak');
  return true;
}

/** Stores an in-app notification (topic mastered, topic unlocked, ...). */
async function notify(userId, kind, title, body = '') {
  try {
    await Notification.create({ user: userId, kind, title, body });
  } catch (err) {
    // Notifications are a nicety - never fail a quiz answer because of them.
    console.warn('[notify] could not store notification:', err.message);
  }
}

/**
 * Builds the ordered learning path for one course.
 *
 * Unlocking rule: a topic opens once every topic in its `prerequisites` list
 * is completed (see services/topicGraph.js) - not simply "the topic before it
 * in the list". A topic with no prerequisites is open from the start, and a
 * topic already attempted stays open so nobody gets locked out of work they
 * have started, even if a prerequisite is somehow re-locked later.
 */
async function buildLearningPath(userId, course) {
  const [topics, rows] = await Promise.all([
    Topic.find({ course }).sort({ order: 1 }).lean(),
    UserProgress.find({ user: userId, course }).lean()
  ]);

  const byTopic = new Map(rows.map((r) => [r.topic, r]));
  const completedSlugs = topics.filter((t) => byTopic.get(t.slug)?.completed).map((t) => t.slug);
  const graph = buildGraph(topics);
  const graphUnlocked = unlockedSlugs(graph, completedSlugs);

  let currentAssigned = false;

  return topics.map((topic) => {
    const p = byTopic.get(topic.slug);
    const completed = Boolean(p?.completed);
    const unlocked = graphUnlocked.has(topic.slug) || completed || Boolean(p?.attempts);

    let status = 'locked';
    if (completed) status = 'completed';
    else if (unlocked && !currentAssigned) {
      status = 'current';
      currentAssigned = true;
    } else if (unlocked) status = 'unlocked';

    return {
      id: topic._id,
      name: topic.name,
      slug: topic.slug,
      section: topic.section,
      description: topic.description,
      order: topic.order,
      objectives: topic.objectives,
      prerequisites: topic.prerequisites || [],
      status,
      unlocked,
      locked: !unlocked,
      completed,
      mastery: p?.mastery || 0,
      elo: p?.elo || config.elo.initial,
      difficulty: p?.difficulty || config.startLevel,
      attempts: p?.attempts || 0,
      correctAnswers: p?.correctAnswers || 0,
      wrongAnswers: p?.wrongAnswers || 0,
      accuracy: p?.attempts ? Math.round((p.correctAnswers / p.attempts) * 100) : 0
    };
  });
}

/** Topics the learner is struggling with - drives "Practice weak areas". */
function weakAreas(topics) {
  return topics
    .filter((t) => t.attempts >= WEAK_MIN_ATTEMPTS && t.mastery < WEAK_MASTERY_BELOW && !t.completed)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 5)
    .map((t) => ({ name: t.name, slug: t.slug, section: t.section, mastery: t.mastery, difficulty: t.difficulty }));
}

/** Everything the dashboard / progress pages need about a single course. */
async function courseSummary(userId, course) {
  const topics = await buildLearningPath(userId, course);
  const total = topics.length;
  const completed = topics.filter((t) => t.completed).length;
  const masterySum = topics.reduce((sum, t) => sum + t.mastery, 0);
  const attempts = topics.reduce((s, t) => s + t.attempts, 0);
  const correct = topics.reduce((s, t) => s + t.correctAnswers, 0);
  const wrong = topics.reduce((s, t) => s + t.wrongAnswers, 0);
  const current = topics.find((t) => t.status === 'current') || null;

  return {
    course,
    totalTopics: total,
    topicsCompleted: completed,
    topicsRemaining: total - completed,
    // "Overall progress" is average mastery, so partial work still shows up.
    overallProgress: total ? Math.round(masterySum / total) : 0,
    completionProgress: total ? Math.round((completed / total) * 100) : 0,
    currentTopic: current
      ? { name: current.name, slug: current.slug, section: current.section, mastery: current.mastery, difficulty: current.difficulty }
      : null,
    questionsAttempted: attempts,
    questionsCorrect: correct,
    questionsWrong: wrong,
    accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
    topics
  };
}

module.exports = { buildLearningPath, courseSummary, weakAreas, notify, touchStreak, dayKey };
