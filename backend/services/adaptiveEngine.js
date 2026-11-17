/**
 * Adaptive engine - pure, dependency free logic.
 *
 * The engine owns three decisions:
 *   1. which difficulty the learner should see next (an Elo rating),
 *   2. how a single answer changes mastery and that rating,
 *   3. which question in the bank best matches that rating right now
 *      (a min-heap over the eligible questions).
 *
 * Keeping it free of database calls means it can be reasoned about and unit
 * tested on its own (see utils/engineSelfTest.js).
 */
const config = require('../config/adaptive.config');
const MinHeap = require('../utils/minHeap');

const LEVELS = config.levels; // ['easy','medium','hard']

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const levelIndex = (level) => Math.max(0, LEVELS.indexOf(level));
const stepLevel = (level, delta) => LEVELS[clamp(levelIndex(level) + delta, 0, LEVELS.length - 1)];

/** The fixed rating a question of this difficulty tier "plays at". */
const anchorOf = (difficulty) => config.elo.anchors[difficulty] ?? config.elo.anchors.medium;

/** Turns a learner's current Elo rating into a difficulty tier for display/selection. */
function eloToLevel(elo, cfg = config.elo) {
  if (elo >= cfg.thresholds.toHard) return 'hard';
  if (elo >= cfg.thresholds.toMedium) return 'medium';
  return 'easy';
}

/**
 * Applies one answer to a progress snapshot and returns the next snapshot.
 *
 * Rating update: a standard Elo expected-score update, exactly as used to
 * rate a player after one game - the learner "plays" the question, whose
 * rating is the fixed anchor for its difficulty tier.
 *
 *   expected = 1 / (1 + 10 ^ ((questionElo - learnerElo) / 400))
 *   newElo   = learnerElo + K * (actualScore - expected)
 *
 * A correct answer against a question already near the learner's rating
 * moves the rating a little; an upset (correct on a much harder question,
 * or wrong on a much easier one) moves it a lot.
 *
 * On top of the rating, the difficulty TIER steps immediately: a correct
 * answer promotes the learner one tier (easy -> medium -> hard) and a wrong
 * answer demotes them one tier, after `promoteStreak` / `demoteStreak`
 * answers in a row (both default to 1). The rating is snapped to the new
 * tier so the two can never disagree.
 */
function applyAnswer(progress, { correct, questionDifficulty }) {
  const state = {
    mastery: progress.mastery ?? 0,
    elo: progress.elo ?? config.elo.initial,
    difficulty: progress.difficulty || config.startLevel,
    correctAnswers: progress.correctAnswers ?? 0,
    wrongAnswers: progress.wrongAnswers ?? 0,
    attempts: progress.attempts ?? 0,
    consecutiveCorrect: progress.consecutiveCorrect ?? 0,
    consecutiveWrong: progress.consecutiveWrong ?? 0,
    mediumCorrect: progress.mediumCorrect ?? 0,
    hardCorrect: progress.hardCorrect ?? 0
  };

  const difficultyBefore = state.difficulty;
  const eloBefore = state.elo;
  state.attempts += 1;

  const questionElo = anchorOf(questionDifficulty);
  const expected = 1 / (1 + 10 ** ((questionElo - state.elo) / 400));
  const actual = correct ? 1 : 0;
  state.elo = clamp(Math.round(state.elo + config.elo.k * (actual - expected)), config.elo.min, config.elo.max);

  // Streak counters are updated first so the level step below can use them.
  if (correct) {
    state.consecutiveCorrect += 1;
    state.consecutiveWrong = 0;
  } else {
    state.consecutiveWrong += 1;
    state.consecutiveCorrect = 0;
  }

  // Level step: a correct answer moves the learner UP one tier and a wrong one
  // moves them DOWN one tier (once the promote/demote streak is met). The Elo
  // rating alone moves only ~20 points per answer, which left the learner on the
  // same tier for five or more answers - so the rating is snapped to the new
  // tier's anchor whenever the step goes beyond what the rating already implies.
  const ratingLevel = eloToLevel(state.elo);
  if (correct && state.consecutiveCorrect % config.elo.promoteStreak === 0) {
    const target = stepLevel(difficultyBefore, +1);
    if (levelIndex(target) > levelIndex(ratingLevel)) state.elo = Math.max(state.elo, anchorOf(target));
  } else if (!correct && state.consecutiveWrong % config.elo.demoteStreak === 0) {
    const target = stepLevel(difficultyBefore, -1);
    if (levelIndex(target) < levelIndex(ratingLevel)) {
      state.elo = clamp(Math.min(state.elo, anchorOf(target)), config.elo.min, config.elo.max);
    }
  }
  state.difficulty = eloToLevel(state.elo);

  if (correct) {
    state.correctAnswers += 1;
    if (questionDifficulty === 'medium') state.mediumCorrect += 1;
    if (questionDifficulty === 'hard') state.hardCorrect += 1;

    const gain = config.masteryGain + (config.masteryLevelBonus[questionDifficulty] || 0);
    state.mastery = clamp(state.mastery + gain, 0, 100);
  } else {
    state.wrongAnswers += 1;
    state.mastery = clamp(state.mastery - config.masteryPenalty, 0, 100);
  }

  const mastered = isMastered(state);
  return {
    ...state,
    difficultyBefore,
    difficultyAfter: state.difficulty,
    eloBefore,
    eloAfter: state.elo,
    mastered
  };
}

/**
 * A topic is only mastered when there is enough evidence:
 * mastery score, a minimum number of attempts, an accuracy floor and - when
 * enabled - proof that the learner handled questions above the easy level.
 */
function isMastered(state, cfg = config.mastery) {
  const attempts = state.attempts ?? 0;
  if (attempts < cfg.minAttempts) return false;
  if ((state.mastery ?? 0) < cfg.threshold) return false;
  const accuracy = attempts ? (state.correctAnswers ?? 0) / attempts : 0;
  if (accuracy < cfg.minAccuracy) return false;
  if (cfg.requireMediumSuccess) {
    const above = (state.mediumCorrect ?? 0) + (state.hardCorrect ?? 0);
    if (above < cfg.mediumCorrectRequired) return false;
  }
  return true;
}

const idOf = (q) => String(q._id ?? q.id);

/**
 * Turns a learner's attempt history for ONE topic into two id lists.
 *
 *   correctIds - answered correctly at least once. These are retired for good.
 *   missedIds  - answered wrongly and never yet answered correctly. These are
 *                the only questions that may be shown a second time.
 *
 * attempts: [{ question, correct }]
 */
function summariseAttempts(attempts = []) {
  const correct = new Set();
  const wrong = new Set();
  for (const a of attempts) {
    const id = String(a.question);
    (a.correct ? correct : wrong).add(id);
  }
  return {
    correctIds: [...correct],
    missedIds: [...wrong].filter((id) => !correct.has(id))
  };
}

/**
 * Picks the next question with a min-heap, or returns null when the topic is
 * finished (every question in the bank has been answered correctly).
 *
 * Every eligible question (never one already answered correctly) is pushed
 * onto the heap once, with a priority of:
 *
 *   |questionElo - learnerElo| / 50        - how far this question is from the
 *                                             learner's current rating
 *   + retryPenalty  (if answered wrongly before and not yet correct)
 *   + recentPenalty (if shown in the last `recentWindow` questions)
 *
 * popping the minimum then gives the closest-matching question, softly
 * preferring an unseen one over a retry, and a fresh one over a recently
 * shown one, WITHOUT needing separate filtering passes for each rule: if
 * every remaining question is a recent retry, the smallest total still wins
 * rather than the search coming up empty.
 */
function selectQuestion(questions, { elo, difficulty, correctIds = [], missedIds = [], recentIds = [] }) {
  const correct = new Set(correctIds.map(String));
  const missed = new Set(missedIds.map(String));
  const recent = new Set(recentIds.map(String));

  const available = questions.filter((q) => !correct.has(idOf(q)));
  if (!available.length) return null;

  // Never repeat a question that was shown within the last `recentWindow`
  // questions - hard exclusion, not just a penalty - unless doing so would
  // leave nothing to ask (every remaining question was recently shown, which
  // can only happen once the bank is smaller than the recent window).
  const fresh = available.filter((q) => !recent.has(idOf(q)));
  const pool = fresh.length ? fresh : available;

  // Accept a caller that only knows the discrete level (e.g. older callers,
  // or the self-test) by treating it as "rated exactly at that tier".
  const learnerElo = elo ?? anchorOf(difficulty || config.startLevel);

  // Shuffle before pushing so that equal-priority questions (same difficulty,
  // same distance from the learner's rating) don't always resolve the same
  // way. Without this, the heap's stable tie-break could let one question
  // starve forever while another kept being re-picked - the opposite of
  // "no repeats".
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const heap = new MinHeap();
  for (const q of shuffled) {
    const id = idOf(q);
    let priority = Math.abs(anchorOf(q.difficulty) - learnerElo) / 50;
    if (missed.has(id)) priority += config.heap.retryPenalty;
    if (recent.has(id)) priority += config.heap.recentPenalty;
    heap.push(q, priority);
  }
  return heap.pop();
}

/** True when every question in the bank has been answered correctly. */
function isBankCleared(questions, correctIds = []) {
  if (!questions.length) return false;
  const correct = new Set(correctIds.map(String));
  return questions.every((q) => correct.has(idOf(q)));
}

function rememberQuestion(recentIds, questionId) {
  const next = [String(questionId), ...recentIds.map(String).filter((id) => id !== String(questionId))];
  return next.slice(0, config.recentWindow);
}

module.exports = {
  applyAnswer, isMastered, selectQuestion, summariseAttempts, isBankCleared, rememberQuestion,
  stepLevel, eloToLevel, LEVELS, config
};
