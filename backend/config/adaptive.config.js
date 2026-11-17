/**
 * Every threshold used by the adaptive engine lives here so the behaviour of the
 * tutor can be tuned without touching the algorithm itself.
 * Values can be overridden with environment variables.
 */
const num = (v, d) => (v === undefined || v === '' || isNaN(Number(v)) ? d : Number(v));

const adaptiveConfig = {
  levels: ['easy', 'medium', 'hard'],
  startLevel: 'easy',

  // ---- Elo rating -------------------------------------------------------
  // The learner and every question difficulty tier each carry an Elo-style
  // rating. Difficulty is no longer a fixed "+1 level per correct answer"
  // streak counter: it is derived from the rating, which moves by however
  // much the outcome of one question actually surprised the model (see
  // applyAnswer in adaptiveEngine.js for the update itself).
  elo: {
    initial: num(process.env.ELO_INITIAL, 900), // starting rating - matches the 'easy' anchor
    k: num(process.env.ELO_K, 60), // how fast the rating reacts to one answer
    min: num(process.env.ELO_MIN, 400),
    max: num(process.env.ELO_MAX, 1800),
    // fixed rating each difficulty tier "plays at" when the learner answers a question of that tier
    anchors: { easy: 900, medium: 1000, hard: 1100 },
    // learner rating needed before a tier is treated as the target difficulty
    thresholds: { toMedium: 1000, toHard: 1200 },
    // Level stepping (the "+1 level per correct answer" rule). After this many
    // correct answers in a row the learner moves up one tier immediately, and
    // after this many wrong answers in a row they move down one tier. The Elo
    // rating is snapped to the new tier's anchor so rating and tier never disagree.
    promoteStreak: Math.max(1, num(process.env.ADAPTIVE_PROMOTE_STREAK, 1)),
    demoteStreak: Math.max(1, num(process.env.ADAPTIVE_DEMOTE_STREAK, 1))
  },

  // Weighs used by the heap-based question selector (services/adaptiveEngine.js
  // selectQuestion). Priority = elo distance (in 50-point units) + these
  // penalties; the min-heap pops whichever eligible question has the lowest
  // total. Keeping both penalties well under one level's worth of distance
  // (400 Elo points / 50 = 8) means "closest difficulty" only loses to a
  // penalty when the two questions are already almost equally suitable.
  heap: {
    retryPenalty: num(process.env.ADAPTIVE_RETRY_PENALTY, 1), // prefer an unseen question over a retry at the same distance
    recentPenalty: num(process.env.ADAPTIVE_RECENT_PENALTY, 6) // push a just-shown question behind fresher alternatives
  },

  masteryGain: num(process.env.MASTERY_GAIN, 10),
  masteryPenalty: num(process.env.MASTERY_PENALTY, 5),
  // bonus applied on top of the gain when the question was above 'easy'
  masteryLevelBonus: { easy: 0, medium: 2, hard: 5 },

  mastery: {
    threshold: num(process.env.MASTERY_THRESHOLD, 80),
    minAttempts: num(process.env.MASTERY_MIN_ATTEMPTS, 5),
    minAccuracy: num(process.env.MASTERY_MIN_ACCURACY, 0.7),
    requireMediumSuccess: String(process.env.MASTERY_REQUIRE_MEDIUM ?? 'true') === 'true',
    mediumCorrectRequired: num(process.env.MASTERY_MEDIUM_CORRECT, 2)
  },

  // Questions answered correctly are NEVER served again. Questions answered
  // wrongly are served again, but not within this many questions of the last
  // time they were shown (unless nothing else is left in the topic).
  recentWindow: num(process.env.ADAPTIVE_RECENT_WINDOW, 3)
};

module.exports = adaptiveConfig;
