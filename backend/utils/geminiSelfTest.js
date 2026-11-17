/* Self-test for the Gemini question generator. No network and no database:
 * fetch and the Mongoose models are replaced with stubs.
 *   npm run test:gemini
 */
const assert = require('assert');

process.env.GEMINI_API_KEY = 'test-key-123';
process.env.GEMINI_MODEL = 'test-model';

const gemini = require('../services/geminiService');
const Topic = require('../models/Topic');
const Question = require('../models/Question');
const ctrl = require('../controllers/adminController');

const { _internals } = gemini;
const topic = {
  slug: 'arrays', name: 'Arrays', description: 'Fixed-size collections', objectives: ['Declare arrays'],
  cheatSheet: { mistakes: ['Off-by-one errors'], notes: ['Indexes start at 0'] }
};
const good = (n, extra = {}) => ({
  question: `Question number ${n}?`, code: '', options: [`a${n}`, `b${n}`, `c${n}`, `d${n}`],
  correctAnswer: 1, explanation: 'Because.', concept: 'Arrays', tip: 'Count from zero', ...extra
});

const geminiReply = (questions, wrap = (t) => t) => ({
  ok: true, status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text: wrap(JSON.stringify({ questions })) }] } }] })
});
const errorReply = (status, message = '') => ({ ok: false, status, json: async () => ({ error: { message } }) });

let lastRequest = null;
const mockFetch = (impl) => { global.fetch = async (url, init) => { lastRequest = { url, init }; return impl(url, init); }; };
const rejects = async (fn, status, pattern) => {
  try { await fn(); } catch (err) {
    assert.strictEqual(err.status, status, `expected HTTP ${status}, got ${err.status}: ${err.message}`);
    if (pattern) assert.match(err.message, pattern);
    assert.ok(!err.message.includes('test-key-123'), 'the API key leaked into an error message');
    return;
  }
  assert.fail(`expected a ${status} error but nothing was thrown`);
};
const run = (extra = {}) => gemini.generateQuestions({ course: 'java', topic, difficulty: 'easy', type: 'concept', count: 3, existing: [], rng: () => 0, ...extra });

(async () => {
  /* ------------------------------------------------------------ status */
  assert.deepStrictEqual(Object.keys(gemini.status()).sort(), ['configured', 'maxPerRequest', 'model']);
  assert.strictEqual(gemini.status().configured, true);
  assert.ok(!JSON.stringify(gemini.status()).includes('test-key-123'), 'status must never expose the key');

  /* ------------------------------------------------------------ prompt */
  const prompt = _internals.buildPrompt({ course: 'java', topic, difficulty: 'hard', type: 'debug', count: 4, existing: [{ question: 'Already asked?' }] });
  assert.match(prompt.user, /Topic: Arrays/);
  assert.match(prompt.user, /Off-by-one errors/, 'common mistakes are given to the model');
  assert.match(prompt.user, /exactly 4 different questions/);
  assert.match(prompt.user, /Already asked\?/, 'existing questions are listed so they are not repeated');
  assert.match(prompt.user, /Difficulty: hard/);

  /* ------------------------------------------ happy path + request shape */
  mockFetch(() => geminiReply([good(1), good(2), good(3)]));
  let out = await run();
  assert.strictEqual(out.questions.length, 3);
  assert.strictEqual(out.dropped.length, 0);
  assert.strictEqual(out.model, 'test-model');
  assert.ok(lastRequest.url.endsWith('/models/test-model:generateContent'));
  assert.strictEqual(lastRequest.init.headers['x-goog-api-key'], 'test-key-123', 'key goes in a header, not the URL');
  assert.ok(!lastRequest.url.includes('test-key-123'), 'key must not be in the URL');
  const body = JSON.parse(lastRequest.init.body);
  assert.strictEqual(body.generationConfig.responseMimeType, 'application/json');
  assert.ok(body.generationConfig.responseSchema, 'a response schema is sent');
  assert.ok(body.systemInstruction.parts[0].text.length > 10);
  for (const q of out.questions) {
    assert.strictEqual(q.options.length, 4);
    assert.strictEqual(q.course, 'java');
    assert.strictEqual(q.topic, 'arrays');
    assert.strictEqual(q.difficulty, 'easy');
  }

  /* --------- shuffling keeps the answer key pointing at the right text --- */
  for (const rng of [() => 0, () => 0.99, Math.random]) {
    mockFetch(() => geminiReply([good(7)]));
    out = await run({ rng });
    assert.strictEqual(out.questions[0].options[out.questions[0].correctAnswer], 'b7', 'correct answer moved with its option');
  }
  const seenPositions = new Set();
  for (let i = 0; i < 60; i += 1) {
    mockFetch(() => geminiReply([good(8)]));
    seenPositions.add((await run({ rng: Math.random })).questions[0].correctAnswer);
  }
  assert.ok(seenPositions.size > 1, 'the correct answer position is randomised');

  // "All of the above" style options must not be reordered
  mockFetch(() => geminiReply([good(9, { options: ['x', 'y', 'z', 'All of the above'], correctAnswer: 3 })]));
  out = await run();
  assert.deepStrictEqual(out.questions[0].options, ['x', 'y', 'z', 'All of the above']);
  assert.strictEqual(out.questions[0].correctAnswer, 3);

  /* ------------------------------------------------ tolerant parsing --- */
  mockFetch(() => geminiReply([good(10)], (t) => `\`\`\`json\n${t}\n\`\`\``));
  assert.strictEqual((await run()).questions.length, 1, 'markdown-fenced JSON is accepted');

  mockFetch(() => geminiReply([good(11, { options: ['A) one', 'B. two', 'C: three', 'd) four'], correctAnswer: 0, code: '```java\nint x = 1;\n```' })]));
  out = await run({ rng: () => 0.99 });
  assert.ok(!out.questions[0].options.some((o) => /^[A-Da-d][).:]/.test(o)), 'option letters are stripped');
  assert.strictEqual(out.questions[0].code, 'int x = 1;', 'code fences are stripped');

  /* ------------------------------------------- bad items are dropped --- */
  mockFetch(() => geminiReply([
    good(20),
    good(21, { options: ['a', 'b', 'c'] }),                                  // only 3 options
    good(22, { correctAnswer: 9 }),                                          // answer out of range
    good(23, { options: ['same', 'same', 'x', 'y'] }),                       // duplicate options
    good(24, { explanation: '' }),                                           // no explanation
    good(20),                                                                // duplicate within batch
    good(25, { question: 'Already in the bank?' })                           // duplicate of existing
  ]));
  out = await run({ existing: [{ question: 'Already in the bank?', code: '' }] });
  assert.strictEqual(out.questions.length, 1, 'only the one valid, new question survives');
  assert.strictEqual(out.dropped.length, 6);

  /* ------------------------------------------------------------ errors */
  mockFetch(() => { throw new Error('should not be called'); });
  const savedKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';
  assert.strictEqual(gemini.status().configured, false);
  await rejects(run, 503, /GEMINI_API_KEY/);
  process.env.GEMINI_API_KEY = savedKey;

  mockFetch(() => errorReply(400, 'API key not valid. Please pass a valid API key.'));
  await rejects(run, 502, /rejected the API key/);
  mockFetch(() => errorReply(403, 'Permission denied'));
  await rejects(run, 502, /rejected the API key/);
  mockFetch(() => errorReply(404, 'model not found'));
  await rejects(run, 502, /GEMINI_MODEL/);
  mockFetch(() => errorReply(429, 'quota'));
  await rejects(run, 429, /rate limit|quota/i);
  mockFetch(() => errorReply(500, 'boom'));
  await rejects(run, 502, /unavailable/);
  mockFetch(() => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; });
  await rejects(run, 504, /too long/);
  mockFetch(() => { throw new TypeError('fetch failed'); });
  await rejects(run, 502, /Could not reach/);
  mockFetch(async () => ({ ok: true, status: 200, json: async () => ({ promptFeedback: { blockReason: 'SAFETY' } }) }));
  await rejects(run, 422, /declined/);
  mockFetch(async () => ({ ok: true, status: 200, json: async () => ({ candidates: [] }) }));
  await rejects(run, 502, /empty/);
  mockFetch(async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"questions": [ {"question": "cut off' }] } }] }) }));
  await rejects(run, 502, /could not be read/);
  mockFetch(() => geminiReply([good(30, { options: ['a'] })]));
  await rejects(run, 502, /usable questions/);

  /* --------------------------- admin controller: generate endpoint ------- */
  const call = (handler, body) => new Promise((resolve) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(p) { resolve({ status: this.statusCode, body: p }); return this; } };
    handler({ body }, res, (err) => resolve({ status: err.status || 500, error: err.message }));
  });

  Topic.findOne = () => ({ lean: async () => topic });
  Question.find = () => ({ select: () => ({ limit: () => ({ lean: async () => [] }), lean: async () => [] }) });

  mockFetch(() => geminiReply([good(40)]));
  let r = await call(ctrl.generateQuestions, { course: 'java', topic: 'arrays', difficulty: 'medium', type: 'output', count: 500 });
  assert.strictEqual(r.status, 200);
  assert.match(JSON.parse(lastRequest.init.body).contents[0].parts[0].text, new RegExp(`exactly ${gemini.status().maxPerRequest} different questions`), 'count is clamped to the configured maximum');
  assert.strictEqual(r.body.questions[0].difficulty, 'medium');
  assert.strictEqual(r.body.questions[0].type, 'output');

  r = await call(ctrl.generateQuestions, { course: 'java', topic: 'arrays', difficulty: 'impossible' });
  assert.strictEqual(r.status, 400);
  r = await call(ctrl.generateQuestions, { course: 'java', topic: 'arrays', type: 'essay' });
  assert.strictEqual(r.status, 400);
  r = await call(ctrl.generateQuestions, { course: 'ruby', topic: 'arrays' });
  assert.strictEqual(r.status, 400);
  r = await call(ctrl.generateQuestions, { course: 'java' });
  assert.strictEqual(r.status, 400);
  Topic.findOne = () => ({ lean: async () => null });
  r = await call(ctrl.generateQuestions, { course: 'java', topic: 'nope' });
  assert.strictEqual(r.status, 404);
  Topic.findOne = () => ({ lean: async () => topic });

  /* ------------------------ admin controller: save approved drafts ------- */
  let inserted = null;
  Question.insertMany = async (docs) => { inserted = docs; return docs; };
  Question.find = () => ({ select: () => ({ lean: async () => [{ question: 'Existing one?', code: '' }] }) });

  r = await call(ctrl.saveGeneratedQuestions, {
    course: 'java', topic: 'arrays',
    questions: [
      { ...good(50), difficulty: 'hard', type: 'debug', _id: 'evil', source: 'manual', role: 'admin' },
      good(51, { question: 'Existing one?' }),
      good(52, { options: ['x', 'x', 'y', 'z'] }),
      { ...good(53), difficulty: 'nonsense', type: 'nonsense' }
    ]
  });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.body.saved, 2);
  assert.strictEqual(r.body.skipped.length, 2);
  assert.ok(inserted.every((d) => d.source === 'ai'), 'saved questions are marked as AI-generated');
  assert.ok(inserted.every((d) => d._id === undefined && d.role === undefined), 'unexpected fields are not saved');
  assert.strictEqual(inserted[0].difficulty, 'hard');
  assert.strictEqual(inserted[1].difficulty, 'easy', 'an invalid difficulty falls back to easy');
  assert.strictEqual(inserted[1].type, 'concept', 'an invalid type falls back to concept');

  r = await call(ctrl.saveGeneratedQuestions, { course: 'java', topic: 'arrays', questions: [] });
  assert.strictEqual(r.status, 400);
  r = await call(ctrl.saveGeneratedQuestions, { course: 'java', topic: 'arrays', questions: Array.from({ length: 51 }, (_, i) => good(i)) });
  assert.strictEqual(r.status, 400);

  console.log('gemini self-test: all assertions passed');
})().catch((err) => { console.error(err); process.exit(1); });
