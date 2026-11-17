/* Self-test for the adaptive tutor loop. No network, no database:
 * fetch and the Mongoose models are replaced with stubs.
 *   npm run test:tutor
 */
const assert = require('assert');

process.env.JWT_SECRET = 'test-secret';
process.env.GEMINI_API_KEY = 'test-key-123';

const tutor = require('../services/tutorService');
const Question = require('../models/Question');
const Topic = require('../models/Topic');
const TutorSession = require('../models/TutorSession');
const QuizAttempt = require('../models/QuizAttempt');
const UserProgress = require('../models/UserProgress');
const ctrl = require('../controllers/tutorController');

const oid = () => new (require('mongoose').Types.ObjectId)().toString();
const q = {
  _id: oid(), course: 'python', topic: 'loops', difficulty: 'easy', concept: 'range', tip: 'range stops before the end',
  question: 'What does range(3) produce?', code: '', options: ['0,1,2', '1,2,3', '0,1,2,3', '3'], correctAnswer: 0, explanation: 'range(3) stops before 3.'
};
const other = { ...q, _id: oid(), question: 'What does range(2) produce?', options: ['0,1', '1,2', '0,1,2', '2'], correctAnswer: 0 };

Question.findById = async () => q;
let bankList = [q, other];
Question.find = () => { const r = { limit: () => r, lean: async () => bankList }; return r; };
QuizAttempt.find = () => ({ select: () => ({ lean: async () => [] }) });
UserProgress.findOne = () => ({ select: () => ({ lean: async () => null }) });
Topic.findOne = () => ({ lean: async () => ({ name: 'Loops', slug: 'loops' }) });
const sessions = [];
// what the quiz would see as "already used by the tutor": every $addToSet the controller recorded
TutorSession.find = () => ({ select: () => ({ lean: async () => sessions.filter((x) => x.u.$addToSet).map((x) => ({ reassessedQuestions: [x.u.$addToSet.reassessedQuestions] })) }) });
TutorSession.findOneAndUpdate = async (f, u) => { sessions.push({ f, u }); };
TutorSession.updateOne = async (f, u) => { sessions.push({ f, u }); };

const mq = (n, correct = 1) => ({ question: `Q${n}?`, code: '', options: [`a${n}`, `b${n}`, `c${n}`, `d${n}`], correctAnswer: correct, explanation: `Because ${n}.` });
const lessonJson = (extra = {}) => ({
  misconception: 'You may think range includes its end.', explanation: 'range stops before the end value.',
  example: { title: 'range(2)', code: 'print(list(range(2)))', walkthrough: 'It prints [0, 1].' },
  practice: mq(1), reassessment: mq(2, 2), ...extra
});
const reply = (obj) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }) });

const call = async (fn, body, user = { _id: 'u1' }) => {
  let out; let error;
  await fn({ body, user }, { json: (v) => { out = v; } }, (e) => { error = e; });
  if (error) throw error;
  return out;
};
const rejects = async (fn, status) => {
  try { await fn(); } catch (e) { assert.strictEqual(e.status, status, e.message); return; }
  assert.fail(`expected ${status}`);
};

(async () => {
  /* 1. wrong answer -> lesson, answer keys hidden */
  let prompts = [];
  global.fetch = async (url, init) => { prompts.push(JSON.parse(init.body)); return reply(lessonJson()); };
  let lesson = await call(ctrl.lesson, { questionId: q._id, selectedAnswer: 1 });
  assert.strictEqual(lesson.level, 1);
  assert.strictEqual(lesson.source, 'ai');
  assert.match(lesson.misconception, /range/);
  assert.ok(lesson.example.walkthrough && lesson.practice && lesson.reassessment);
  assert.ok(!JSON.stringify(lesson).includes('correctAnswer'), 'answer keys must not reach the browser');
  assert.match(prompts[0].contents[0].parts[0].text, /Learner chose: B\) 1,2,3/, 'the wrong choice is given to the model');
  assert.match(prompts[0].contents[0].parts[0].text, /level 1 of 3/);

  /* 2. correct answers are refused, invalid input rejected */
  await rejects(() => call(ctrl.lesson, { questionId: q._id, selectedAnswer: 0 }), 400);
  await rejects(() => call(ctrl.lesson, { questionId: 'nope', selectedAnswer: 1 }), 400);

  /* 3. grading is server-side; find the shuffled key by trying answers */
  const grade = async (token, step, i) => call(ctrl.check, { sessionToken: token, step, selectedAnswer: i });
  const results = await Promise.all([0, 1, 2, 3].map((i) => grade(lesson.sessionToken, 'reassess', i)));
  assert.strictEqual(results.filter((r) => r.correct).length, 1, 'exactly one option is correct');
  const key = results.findIndex((r) => r.correct);
  assert.strictEqual(results[key].understood, true);
  assert.strictEqual(results[key].canSimplify, true);
  assert.ok(results[key].explanation);
  const wrong = results.find((r) => !r.correct);
  assert.strictEqual(wrong.understood, false);

  /* 4. tokens are bound to the user and cannot be forged */
  await rejects(() => call(ctrl.check, { sessionToken: lesson.sessionToken, step: 'practice', selectedAnswer: 0 }, { _id: 'someone-else' }), 400);
  await rejects(() => call(ctrl.check, { sessionToken: lesson.sessionToken + 'x', step: 'practice', selectedAnswer: 0 }), 400);
  await rejects(() => call(ctrl.check, { sessionToken: lesson.sessionToken, step: 'bogus', selectedAnswer: 0 }), 400);

  /* 5. NO -> simpler explanation at level 2, then 3, then exhausted */
  lesson = await call(ctrl.lesson, { questionId: q._id, selectedAnswer: 1, previousToken: lesson.sessionToken });
  assert.strictEqual(lesson.level, 2);
  assert.match(prompts[1].contents[0].parts[0].text, /level 2 of 3/);
  assert.match(prompts[1].contents[0].parts[0].text, /does NOT understand|did NOT understand/i);
  assert.match(prompts[1].contents[0].parts[0].text, /Earlier diagnosis/);
  lesson = await call(ctrl.lesson, { questionId: q._id, selectedAnswer: 1, previousToken: lesson.sessionToken });
  assert.strictEqual(lesson.level, 3);
  const last = await Promise.all([0, 1, 2, 3].map((i) => grade(lesson.sessionToken, 'reassess', i)));
  assert.strictEqual(last.find((r) => r.correct).canSimplify, false, 'no simpler level after level 3');
  const done = await call(ctrl.lesson, { questionId: q._id, selectedAnswer: 1, previousToken: lesson.sessionToken });
  assert.strictEqual(done.exhausted, true);
  assert.match(done.topicLink, /\/topics\/python\/loops/);

  /* 6. a token from a different question is refused */
  Question.findById = async () => other;
  await rejects(() => call(ctrl.lesson, { questionId: other._id, selectedAnswer: 1, previousToken: lesson.sessionToken }), 400);
  Question.findById = async () => q;

  /* 7. malformed Gemini output -> fallback lesson from the question bank */
  for (const bad of [lessonJson({ reassessment: { ...mq(3), options: ['x', 'x', 'y', 'z'] } }), lessonJson({ explanation: '' }), lessonJson({ practice: mq(4, 9) })]) {
    global.fetch = async () => reply(bad);
    const out = await call(ctrl.lesson, { questionId: q._id, selectedAnswer: 1 });
    assert.strictEqual(out.source, 'fallback', 'invalid AI output must fall back');
    assert.strictEqual(out.practice, null);
    assert.strictEqual(out.reassessment.question, other.question, 'fallback reassesses with a different bank question');
  }

  /* 8. Gemini down -> fallback; check works with no practice step */
  global.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
  const fb = await call(ctrl.lesson, { questionId: q._id, selectedAnswer: 1 });
  assert.strictEqual(fb.source, 'fallback');
  assert.match(fb.misconception, /1,2,3/);
  await rejects(() => grade(fb.sessionToken, 'practice', 0), 400);
  const fbGrades = await Promise.all([0, 1, 2, 3].map((i) => grade(fb.sessionToken, 'reassess', i)));
  assert.strictEqual(fbGrades.filter((r) => r.correct).length, 1);

  /* 9. no API key -> fallback without calling fetch */
  delete process.env.GEMINI_API_KEY;
  let called = false;
  global.fetch = async () => { called = true; return reply(lessonJson()); };
  assert.strictEqual((await call(ctrl.lesson, { questionId: q._id, selectedAnswer: 1 })).source, 'fallback');
  assert.strictEqual(called, false);

  /* 10. options are shuffled and order-dependent options are kept in place */
  const s = tutor._internals.shuffle(['A', 'B', 'C', 'D'], 0, () => 0);
  assert.strictEqual(['A', 'B', 'C', 'D'][0], 'A');
  assert.strictEqual(s.options[s.correctAnswer], 'A', 'correct answer follows the shuffle');
  const keep = tutor._internals.shuffle(['x', 'y', 'z', 'All of the above'], 3, () => 0);
  assert.strictEqual(keep.correctAnswer, 3);

  /* 11. no repeats: the tutor never reuses a bank question it already used or one the quiz asked */
  process.env.GEMINI_API_KEY = 'test-key-123';
  const third = { ...q, _id: oid(), question: 'What does range(1, 3) produce?', options: ['1,2', '0,1,2', '1,2,3', '3'], correctAnswer: 0 };
  bankList = [q, other, third];
  sessions.length = 0;
  global.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
  const first = await call(ctrl.lesson, { questionId: q._id, selectedAnswer: 1 });
  const second = await call(ctrl.lesson, { questionId: q._id, selectedAnswer: 1 });
  assert.notStrictEqual(first.reassessment.question, second.reassessment.question, 'two lessons never reassess with the same bank question');
  const recorded = sessions.filter((x) => x.u.$addToSet).map((x) => String(x.u.$addToSet.reassessedQuestions));
  assert.strictEqual(new Set(recorded).size, 2, 'each reassessment is recorded so the quiz can skip it');
  QuizAttempt.find = () => ({ select: () => ({ lean: async () => [{ question: other._id }] }) });
  sessions.length = 0;
  const third1 = await call(ctrl.lesson, { questionId: q._id, selectedAnswer: 1 });
  assert.strictEqual(third1.reassessment.question, third.question, 'a question already asked in the quiz is never reused');
  QuizAttempt.find = () => ({ select: () => ({ lean: async () => [] }) });

  /* 12. Gemini question that copies a bank question is rejected, so the quiz cannot repeat it later */
  sessions.length = 0;
  global.fetch = async () => reply(lessonJson({ reassessment: { ...mq(9), question: other.question } }));
  const dup = await call(ctrl.lesson, { questionId: q._id, selectedAnswer: 1 });
  assert.strictEqual(dup.source, 'fallback', 'AI output duplicating the bank falls back to a bank question');

  console.log('tutor self-test: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
