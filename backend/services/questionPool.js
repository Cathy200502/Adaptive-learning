/**
 * Keeps the two places that ask questions from repeating each other:
 *
 *   - the normal adaptive quiz            (controllers/quizController.js)
 *   - the tutor's AI reassessment / mini practice   (services/tutorService.js)
 *
 * Rules enforced with this module:
 *   1. A bank question that the tutor used as a reassessment is never asked again
 *      by the normal quiz in the same round (TutorSession.reassessedQuestions).
 *   2. The tutor never reassesses with a bank question the learner has already been
 *      asked in the quiz this round, or one an earlier tutor session already used.
 *   3. Questions written by Gemini for the tutor are rejected when they duplicate or
 *      closely paraphrase a question in the topic's bank, so the quiz can never
 *      show the learner the same question later.
 */
// Models are required lazily so the pure helpers below (normalise, jaccard,
// isDuplicateOfBank) can be used and self-tested without a database driver.
const QuizAttempt = { find: (...a) => require('../models/QuizAttempt').find(...a) };
const TutorSession = { find: (...a) => require('../models/TutorSession').find(...a) };
const UserProgress = { findOne: (...a) => require('../models/UserProgress').findOne(...a) };

const SIMILARITY_LIMIT = 0.8;

const normalise = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (text) => new Set(normalise(text).split(' ').filter((t) => t.length > 1));

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/** Question text plus code is what the learner actually reads, so compare both. */
const fingerprint = (q) => `${q.question || ''} ${q.code || ''}`;

/** True when `candidate` is the same as, or a close paraphrase of, any question in `bank`. */
function isDuplicateOfBank(candidate, bank = []) {
  const text = normalise(fingerprint(candidate));
  const tk = tokens(fingerprint(candidate));
  return bank.some((q) => {
    const other = fingerprint(q);
    return normalise(other) === text || jaccard(tk, tokens(other)) >= SIMILARITY_LIMIT;
  });
}

async function roundStart(userId, course, topic) {
  const progress = await UserProgress.findOne({ user: userId, course, topic }).select('roundStartedAt').lean();
  return progress?.roundStartedAt || null;
}

/** Ids of bank questions the tutor has already used as a reassessment in this round. */
async function reassessedIds(userId, course, topic, since = null) {
  const filter = { user: userId, course, topic, 'reassessedQuestions.0': { $exists: true } };
  if (since) filter.createdAt = { $gte: since };
  const sessions = await TutorSession.find(filter).select('reassessedQuestions').lean();
  return new Set(sessions.flatMap((s) => (s.reassessedQuestions || []).map(String)));
}

/** Ids of questions the learner has already been asked (right or wrong) in this round. */
async function askedIds(userId, course, topic, since = null) {
  const filter = { user: userId, course, topic };
  if (since) filter.createdAt = { $gte: since };
  const attempts = await QuizAttempt.find(filter).select('question').lean();
  return new Set(attempts.map((a) => String(a.question)));
}

/** Everything the tutor must not reuse as a reassessment for this learner and topic. */
async function loadTutorExclusions(userId, course, topic) {
  const since = await roundStart(userId, course, topic);
  const [asked, used] = await Promise.all([
    askedIds(userId, course, topic, since),
    reassessedIds(userId, course, topic, since)
  ]);
  return new Set([...asked, ...used]);
}

/** Bank for the normal quiz: everything except questions the tutor already used as a reassessment. */
async function selectableBank(bank, userId, course, topic) {
  const since = await roundStart(userId, course, topic);
  const used = await reassessedIds(userId, course, topic, since);
  return used.size ? bank.filter((q) => !used.has(String(q._id))) : bank;
}

module.exports = { selectableBank, isDuplicateOfBank, reassessedIds, askedIds, loadTutorExclusions, normalise, jaccard };
