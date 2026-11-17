/* Self-test for the adaptive engine. Runs without a database:
 *   npm run test:engine
 */
const assert = require('assert');
const {
  applyAnswer, selectQuestion, summariseAttempts, isBankCleared, rememberQuestion, isMastered, eloToLevel, config
} = require('../services/adaptiveEngine');

const fresh = () => ({ mastery: 0, elo: config.elo.initial, difficulty: 'easy', attempts: 0, correctAnswers: 0, wrongAnswers: 0 });
const step = (state, correct, questionDifficulty = state.difficulty) => applyAnswer(state, { correct, questionDifficulty });

/* --------------------------------------------------------------- Elo rating */

// A run of correct answers at the learner's own level raises the rating and,
// eventually, the difficulty tier - the reverse for a run of wrong answers.
let s = fresh();
assert.strictEqual(s.difficulty, 'easy');
for (let i = 0; i < 30 && s.difficulty !== 'hard'; i += 1) s = step(s, true);
assert.strictEqual(s.difficulty, 'hard', 'enough correct answers eventually reach hard');
assert.ok(s.elo > config.elo.initial, 'rating rose after a run of correct answers');

const highElo = s.elo;
for (let i = 0; i < 30 && s.difficulty !== 'easy'; i += 1) s = step(s, false);
assert.strictEqual(s.difficulty, 'easy', 'enough wrong answers eventually fall back to easy');
assert.ok(s.elo < highElo, 'rating fell after a run of wrong answers');
assert.ok(s.elo >= config.elo.min, 'rating never drops below the configured floor');

// One correct answer promotes the learner one tier straight away, and one wrong
// answer demotes them one tier (default promote/demote streak is 1).
let one = fresh();
one = step(one, true);
assert.strictEqual(one.difficulty, 'medium', 'one correct answer moves easy -> medium');
assert.strictEqual(one.difficultyBefore, 'easy');
assert.strictEqual(one.difficultyAfter, 'medium');
assert.ok(one.elo >= config.elo.thresholds.toMedium, 'rating is snapped into the medium tier');
one = step(one, true);
assert.strictEqual(one.difficulty, 'hard', 'second correct answer moves medium -> hard');
one = step(one, true);
assert.strictEqual(one.difficulty, 'hard', 'hard is the ceiling');
one = step(one, false);
assert.strictEqual(one.difficulty, 'medium', 'one wrong answer moves hard -> medium');
one = step(one, false);
assert.strictEqual(one.difficulty, 'easy', 'another wrong answer moves medium -> easy');
one = step(one, false);
assert.strictEqual(one.difficulty, 'easy', 'easy is the floor');
assert.ok(one.elo >= config.elo.min, 'rating stays above the floor');
// rating and tier always agree after a step
for (const correct of [true, false, true, true, false, false, true]) {
  one = step(one, correct);
  assert.strictEqual(one.difficulty, eloToLevel(one.elo), 'tier matches rating after every step');
}

// Rating is clamped at both ends.
let atFloor = applyAnswer({ elo: config.elo.min, mastery: 0, attempts: 0 }, { correct: false, questionDifficulty: 'easy' });
assert.strictEqual(atFloor.elo, config.elo.min, 'rating is clamped at the floor');
let atCeiling = applyAnswer({ elo: config.elo.max, mastery: 0, attempts: 0 }, { correct: true, questionDifficulty: 'hard' });
assert.strictEqual(atCeiling.elo, config.elo.max, 'rating is clamped at the ceiling');

assert.strictEqual(eloToLevel(config.elo.thresholds.toHard), 'hard');
assert.strictEqual(eloToLevel(config.elo.thresholds.toMedium), 'medium');
assert.strictEqual(eloToLevel(config.elo.thresholds.toMedium - 1), 'easy');

// mastery is capped at 100 / floored at 0, same rules as before
let high = { mastery: 98, elo: 1300, attempts: 10, correctAnswers: 9 };
high = applyAnswer(high, { correct: true, questionDifficulty: 'hard' });
assert.strictEqual(high.mastery, 100, 'mastery is capped at 100');
let low = { mastery: 2, elo: 900, attempts: 10, correctAnswers: 1 };
low = applyAnswer(low, { correct: false, questionDifficulty: 'easy' });
assert.strictEqual(low.mastery, 0, 'mastery is floored at 0');

// mastery gate needs evidence, not a single lucky answer
assert.strictEqual(isMastered({ mastery: 100, attempts: 2, correctAnswers: 2, mediumCorrect: 2 }), false);
assert.strictEqual(isMastered({ mastery: 90, attempts: 6, correctAnswers: 5, mediumCorrect: 2 }), true);

/* ------------------------------------------------------- heap-based selection */

const bank = [
  { _id: 'e1', difficulty: 'easy' },
  { _id: 'e2', difficulty: 'easy' },
  { _id: 'm1', difficulty: 'medium' },
  { _id: 'h1', difficulty: 'hard' }
];
const ids = (list) => list.map((q) => q._id).sort();
const anchor = (d) => config.elo.anchors[d];

// history helper: a wrong answer that was later answered correctly is NOT a miss
assert.deepStrictEqual(
  summariseAttempts([
    { question: 'e1', correct: false }, { question: 'e1', correct: true },
    { question: 'e2', correct: false }, { question: 'm1', correct: true }
  ]),
  { correctIds: ['e1', 'm1'], missedIds: ['e2'] }
);

// unseen question at the learner's rating is preferred - the heap pop with the
// smallest elo-distance wins
assert.strictEqual(selectQuestion(bank, { elo: anchor('hard') })._id, 'h1');
assert.strictEqual(selectQuestion(bank, { elo: anchor('medium') })._id, 'm1');

// a question answered correctly is never returned again - however often we ask
for (let i = 0; i < 200; i += 1) {
  const q = selectQuestion(bank, { elo: anchor('easy'), correctIds: ['e1', 'm1'] });
  assert.ok(!['e1', 'm1'].includes(q._id), 'correctly answered question was served again');
}

// when nothing is left at the target rating, the nearest rating wins
assert.strictEqual(selectQuestion(bank, { elo: anchor('easy'), correctIds: ['e1', 'e2'] })._id, 'm1');
assert.strictEqual(selectQuestion(bank, { elo: anchor('hard'), correctIds: ['h1', 'm1'] }).difficulty, 'easy');

// an unseen question beats a retry at the same rating, and a retry comes back once nothing unseen is left there
assert.strictEqual(selectQuestion(bank, { elo: anchor('easy'), missedIds: ['e1'] })._id, 'e2');
assert.strictEqual(selectQuestion(bank, { elo: anchor('easy'), correctIds: ['e2'], missedIds: ['e1'] })._id, 'e1');

// a retry at the learner's own rating still beats an unseen question a whole tier away
assert.strictEqual(
  selectQuestion([{ _id: 'e1', difficulty: 'easy' }, { _id: 'm1', difficulty: 'medium' }], { elo: anchor('easy'), missedIds: ['e1'] })._id,
  'e1'
);

// a missed question is the only thing left -> it is served even if it was just shown
assert.strictEqual(
  selectQuestion(bank, { elo: anchor('easy'), correctIds: ['e2', 'm1', 'h1'], missedIds: ['e1'], recentIds: ['e1'] })._id,
  'e1'
);

// a just-shown missed question is skipped while alternatives exist
for (let i = 0; i < 100; i += 1) {
  const q = selectQuestion(bank, { elo: anchor('easy'), missedIds: ['e1'], recentIds: ['e1'] });
  assert.notStrictEqual(q._id, 'e1', 'a missed question repeated straight away');
}

// nothing left -> null (topic cleared)
assert.strictEqual(selectQuestion(bank, { elo: anchor('easy'), correctIds: ids(bank) }), null);
assert.strictEqual(isBankCleared(bank, ['e1', 'e2', 'm1']), false);
assert.strictEqual(isBankCleared(bank, ids(bank)), true);
assert.strictEqual(isBankCleared([], []), false, 'an empty bank is not "cleared"');

assert.deepStrictEqual(rememberQuestion(['a'], 'b'), ['b', 'a']);

/* -------------------------------------------------- prerequisite graph -------
 * The graph algorithms in services/topicGraph.js are exercised directly,
 * plus a check that every real course in seed data is a genuine DAG (no
 * cyclic prerequisites) and that its topics are reachable from the roots.
 */
const { buildGraph, topologicalOrder, unlockedSlugs } = require('../services/topicGraph');

const topics = [
  { slug: 'a', order: 1, prerequisites: [] },
  { slug: 'b', order: 2, prerequisites: ['a'] },
  { slug: 'c', order: 3, prerequisites: ['a'] },
  { slug: 'd', order: 4, prerequisites: ['b', 'c'] }
];
const graph = buildGraph(topics);
const order = topologicalOrder(graph);
assert.strictEqual(order.indexOf('a') < order.indexOf('b'), true, 'a comes before its dependent b');
assert.strictEqual(order.indexOf('a') < order.indexOf('c'), true, 'a comes before its dependent c');
assert.strictEqual(order.indexOf('b') < order.indexOf('d'), true, 'b comes before its dependent d');
assert.strictEqual(order.indexOf('c') < order.indexOf('d'), true, 'c comes before its dependent d');

assert.deepStrictEqual([...unlockedSlugs(graph, [])].sort(), ['a'], 'only the root unlocks with nothing completed');
assert.deepStrictEqual([...unlockedSlugs(graph, ['a'])].sort(), ['a', 'b', 'c'], 'both branches unlock once their shared prerequisite is done');
assert.deepStrictEqual([...unlockedSlugs(graph, ['a', 'b'])].sort(), ['a', 'b', 'c'], 'd needs BOTH b and c, not just one');
assert.deepStrictEqual([...unlockedSlugs(graph, ['a', 'b', 'c'])].sort(), ['a', 'b', 'c', 'd'], 'd unlocks once every prerequisite is done');

// a cycle must never crash the app - every topic falls back to "unlocked"
const cyclic = buildGraph([
  { slug: 'x', order: 1, prerequisites: ['y'] },
  { slug: 'y', order: 2, prerequisites: ['x'] }
]);
assert.strictEqual(topologicalOrder(cyclic), null, 'a cycle is detected');
assert.deepStrictEqual([...unlockedSlugs(cyclic, [])].sort(), ['x', 'y'], 'a cycle falls back to treating every topic as a root');

// an edge to a slug outside the course, or to itself, is ignored rather than crashing
const messy = buildGraph([{ slug: 'z', order: 1, prerequisites: ['z', 'missing-topic'] }]);
assert.deepStrictEqual([...unlockedSlugs(messy, [])], ['z']);

for (const courseFile of ['javaTopics', 'pythonTopics']) {
  const courseTopics = require(`../seed/data/${courseFile}`);
  const courseGraph = buildGraph(courseTopics);
  const courseOrder = topologicalOrder(courseGraph);
  assert.ok(courseOrder, `${courseFile}: prerequisites must not contain a cycle`);
  assert.strictEqual(courseOrder.length, courseTopics.length, `${courseFile}: every topic must appear in the topological order`);
  const fromStart = unlockedSlugs(courseGraph, []);
  assert.ok(fromStart.size >= 1, `${courseFile}: at least one topic must be unlocked with nothing completed`);
  const fromAll = unlockedSlugs(courseGraph, courseTopics.map((t) => t.slug));
  assert.strictEqual(fromAll.size, courseTopics.length, `${courseFile}: completing everything must unlock everything`);
}

/* ------------------------------------------- full-session simulation ------
 * Plays every real topic from the seed data with learners of different skill
 * and checks the rules hold on every single step:
 *   1. a correctly answered question is never shown again
 *   2. a question is only ever shown a second time if it was answered wrongly
 *   3. the rating (and the tier derived from it) generally tracks performance
 *   4. the session always finishes (every question eventually answered correctly)
 */
const seedQuestions = [
  ...require('../seed/data/javaQuestions.part1'), ...require('../seed/data/javaQuestions.part2'),
  ...require('../seed/data/javaQuestions.part3'), ...require('../seed/data/pythonQuestions.part1'),
  ...require('../seed/data/pythonQuestions.part2')
];
const byTopic = new Map();
seedQuestions.forEach((q, i) => {
  const key = `${q.course}/${q.topic}`;
  if (!byTopic.has(key)) byTopic.set(key, []);
  byTopic.get(key).push({ _id: `q${i}`, difficulty: q.difficulty });
});

let sessions = 0;
let retriesSeen = 0;
for (const [topic, topicBank] of byTopic) {
  for (const skill of [0.15, 0.5, 0.85, 1]) {
    let progress = fresh();
    const attempts = [];
    const correctSoFar = new Set();
    const missedSoFar = new Set();
    let recent = [];
    let guard = 0;

    for (;;) {
      assert.ok((guard += 1) < 4000, `${topic}: session never finished at skill ${skill}`);
      const history = summariseAttempts(attempts);
      const q = selectQuestion(topicBank, {
        elo: progress.elo, correctIds: history.correctIds,
        missedIds: history.missedIds, recentIds: recent
      });
      if (!q) break;

      assert.ok(!correctSoFar.has(q._id), `${topic}: ${q._id} was answered correctly and served again`);
      if (attempts.some((a) => a.question === q._id)) {
        assert.ok(missedSoFar.has(q._id), `${topic}: ${q._id} repeated without having been answered wrongly`);
        retriesSeen += 1;
      }

      const correct = Math.random() < skill;
      progress = step(progress, correct, q.difficulty);
      assert.ok(progress.elo >= config.elo.min && progress.elo <= config.elo.max, `${topic}: rating left its bounds`);
      assert.strictEqual(progress.difficulty, eloToLevel(progress.elo), `${topic}: displayed tier must match the rating`);

      attempts.push({ question: q._id, correct });
      if (correct) { correctSoFar.add(q._id); missedSoFar.delete(q._id); } else missedSoFar.add(q._id);
      recent = rememberQuestion(recent, q._id);
    }
    assert.ok(isBankCleared(topicBank, [...correctSoFar]), `${topic}: session ended before the bank was cleared`);
    sessions += 1;
  }
}
assert.ok(retriesSeen > 0, 'simulation never exercised a retry');

console.log(`adaptive engine self-test: all assertions passed (${sessions} simulated sessions over ${byTopic.size} topics, ${retriesSeen} retries of missed questions)`);
