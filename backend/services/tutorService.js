/**
 * Adaptive tutor: the "wrong answer -> understand it" loop.
 *
 *   Wrong answer -> misconception detection -> explanation -> simple example
 *   -> mini practice -> reassessment -> understood?  YES: continue
 *                                                    NO : simpler explanation (max 3 levels)
 *
 * Gemini writes the lesson (misconception, explanation, example, practice and
 * reassessment questions). It NEVER grades: answer keys are sealed inside a
 * signed session token and checked by the server, so the browser never sees them.
 * If Gemini is unavailable, a fallback lesson is built from the question bank so
 * the loop still works.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const cfg = require('../config/gemini.config');
const gemini = require('./geminiService');
const { isDuplicateOfBank } = require('./questionPool');

const MAX_LEVEL = 3;
const LANGUAGE = { java: 'Java', python: 'Python' };
const LEVEL_GUIDE = {
  1: 'Explain clearly and concisely, like a good tutor talking to a beginner.',
  2: 'The learner did NOT understand the first explanation. Use a completely different angle, an everyday real-world analogy, shorter sentences and no jargon.',
  3: 'The learner is still stuck. Break the idea into 3 tiny steps, assume nothing, use the simplest possible vocabulary and the smallest possible code (1-3 lines).'
};

const secret = () => process.env.JWT_SECRET || 'dev_only_insecure_secret_change_me';
const clip = (t, n) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const stripFences = (c) => String(c || '').replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```\s*$/, '').replace(/\s+$/, '');
const stripPrefix = (o) => String(o).trim().replace(/^[A-Da-d][).:]\s+/, '').trim();

const QUESTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    question: { type: 'STRING' },
    code: { type: 'STRING' },
    options: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 4, maxItems: 4 },
    correctAnswer: { type: 'INTEGER' },
    explanation: { type: 'STRING' }
  },
  required: ['question', 'options', 'correctAnswer', 'explanation']
};
const LESSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    misconception: { type: 'STRING' },
    explanation: { type: 'STRING' },
    example: {
      type: 'OBJECT',
      properties: { title: { type: 'STRING' }, code: { type: 'STRING' }, walkthrough: { type: 'STRING' } },
      required: ['walkthrough']
    },
    practice: QUESTION_SCHEMA,
    reassessment: QUESTION_SCHEMA
  },
  required: ['misconception', 'explanation', 'example', 'practice', 'reassessment']
};

/* ------------------------------------------------------------------ prompt */
function buildPrompt({ course, topic, question, selectedAnswer, level, previousMisconception }) {
  const language = LANGUAGE[course] || course;
  const system =
    `You are a patient ${language} tutor inside a learning platform. A learner just answered a question wrongly. ` +
    'Work out WHY they chose that option (the misconception), then teach it. Accuracy matters more than cleverness: ' +
    'every answer key you write will be trusted. Reply with JSON only, matching the schema.';

  const lines = [
    `Language: ${language}`,
    `Topic: ${topic?.name || question.topic}`,
    `Question: ${question.question}`,
    question.code ? `Code:\n${question.code}` : null,
    `Options: ${question.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join(' | ')}`,
    `Correct answer: ${String.fromCharCode(65 + question.correctAnswer)}) ${question.options[question.correctAnswer]}`,
    `Learner chose: ${String.fromCharCode(65 + selectedAnswer)}) ${question.options[selectedAnswer]}`,
    question.explanation ? `Official explanation: ${clip(question.explanation, 400)}` : null,
    previousMisconception ? `Earlier diagnosis (the learner still does not get it): ${clip(previousMisconception, 200)}` : null,
    '',
    `Teaching level ${level} of ${MAX_LEVEL}: ${LEVEL_GUIDE[level]}`,
    '',
    'Return:',
    '- "misconception": ONE sentence naming the faulty belief that leads to the learner\'s choice, addressed to "you" (e.g. "You may think X, but ...").',
    '- "explanation": 2-4 short sentences that fix that specific belief. Do not just repeat the official explanation.',
    '- "example": a NEW, simple example (not the original question) with optional "code" (plain source, no markdown fences, valid ' + language + ') and a "walkthrough" that traces it step by step.',
    '- "practice": a small guided question about the same idea, easier than the original. Its "explanation" says why the answer is right.',
    '- "reassessment": a DIFFERENT question testing the same idea from another angle, about as hard as the original. Must not reuse the example or the practice.',
    '- Every question has exactly 4 plausible options, exactly one unambiguously correct; "correctAnswer" is the zero-based index. No letters like "A)" inside options.',
    `- For output questions, mentally run the code line by line and make sure the marked answer is exactly what it prints. Stay strictly on this topic.`
  ];
  return { system, user: lines.filter((l) => l !== null).join('\n') };
}

/* ------------------------------------------------------------- normalising */
function shuffle(options, correctAnswer, rng = Math.random) {
  if (options.some((o) => /\b(all|none|both|neither)\b.*\b(above|these|them)\b/i.test(o))) return { options, correctAnswer };
  const tagged = options.map((text, i) => ({ text, correct: i === correctAnswer }));
  for (let i = tagged.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
  }
  return { options: tagged.map((t) => t.text), correctAnswer: tagged.findIndex((t) => t.correct) };
}

function cleanQuestion(raw, rng) {
  const options = (Array.isArray(raw?.options) ? raw.options : []).map(stripPrefix);
  const correctAnswer = Number(raw?.correctAnswer);
  const question = String(raw?.question || '').trim();
  const explanation = String(raw?.explanation || '').trim();
  if (!question || !explanation) throw new Error('question text or explanation missing');
  if (options.length !== 4 || options.some((o) => !o)) throw new Error('needs exactly 4 non-empty options');
  if (new Set(options.map((o) => o.toLowerCase())).size !== 4) throw new Error('options must be different');
  if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) throw new Error('bad answer index');
  return { question, code: stripFences(raw?.code), explanation, ...shuffle(options, correctAnswer, rng) };
}

function normalizeLesson(raw, rng) {
  const explanation = String(raw?.explanation || '').trim();
  const misconception = clip(raw?.misconception, 300);
  const walkthrough = String(raw?.example?.walkthrough || '').trim();
  if (!explanation || !misconception || !walkthrough) throw new Error('lesson is incomplete');
  return {
    misconception,
    explanation,
    example: { title: clip(raw.example.title, 80), code: stripFences(raw.example.code), walkthrough },
    practice: cleanQuestion(raw.practice, rng),
    reassessment: cleanQuestion(raw.reassessment, rng)
  };
}

/* ------------------------------------------------------- session token/keys */
const sealSession = ({ sid, userId, questionId, level, misconception, practice, reassessment }) =>
  jwt.sign(
    { kind: 'tutor', sid, uid: String(userId), qid: String(questionId), level, misconception,
      keys: { practice: practice ? practice.correctAnswer : null, reassess: reassessment.correctAnswer },
      explain: { practice: practice?.explanation || '', reassess: reassessment.explanation } },
    secret(),
    { expiresIn: '2h' }
  );

function openSession(token) {
  try {
    const p = jwt.verify(String(token || ''), secret());
    return p.kind === 'tutor' ? p : null;
  } catch (_) {
    return null;
  }
}

/** What the browser is allowed to see: never the answer keys. */
const publicQuestion = (q) => (q ? { question: q.question, code: q.code || '', options: q.options } : null);

/* ------------------------------------------------------------------ lesson */
function fallbackLesson({ question, selectedAnswer, level, bank = [], excludeIds = new Set(), rng = Math.random }) {
  const usable = bank.filter((q) => String(q._id) !== String(question._id) && q.options.length >= 2);
  // Never reassess with a question the learner was already asked or the tutor already used;
  // only if the bank is completely used up do we fall back to the full list.
  const unused = usable.filter((q) => !excludeIds.has(String(q._id)));
  const pool = unused.length ? unused : usable;
  const sameConcept = pool.filter((q) => q.concept && q.concept === question.concept);
  const candidates = sameConcept.length ? sameConcept : pool.filter((q) => q.difficulty === question.difficulty);
  const pick = (candidates.length ? candidates : pool)[Math.floor(rng() * (candidates.length || pool.length || 1))];
  const reassessSource = pick || question;

  const chosen = question.options[selectedAnswer];
  const right = question.options[question.correctAnswer];
  return {
    misconception: `You chose "${clip(chosen, 80)}", but the correct answer is "${clip(right, 80)}".`,
    explanation: level > 1 && question.tip ? `${question.explanation} ${question.tip}` : question.explanation,
    example: { title: question.concept || 'Key idea', code: '', walkthrough: question.tip || question.explanation },
    practice: null,
    reassessment: {
      question: reassessSource.question,
      code: reassessSource.code || '',
      options: reassessSource.options,
      correctAnswer: reassessSource.correctAnswer,
      explanation: reassessSource.explanation
    },
    _fallbackQuestionId: String(reassessSource._id)
  };
}

async function buildLesson({ course, topic, question, selectedAnswer, level, previousMisconception, bank, excludeIds, rng }) {
  if (cfg.apiKey()) {
    try {
      const { system, user } = buildPrompt({ course, topic, question, selectedAnswer, level, previousMisconception });
      const data = await gemini.callGemini({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          temperature: cfg.temperature(),
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          responseSchema: LESSON_SCHEMA
        }
      });
      const lesson = normalizeLesson(gemini.extractJsonObject(data), rng);
      // AI questions must not duplicate the asked question or anything in the quiz bank,
      // otherwise the learner would meet the same question again in the normal quiz.
      const known = [question, ...(bank || [])];
      if (isDuplicateOfBank(lesson.reassessment, known) || (lesson.practice && isDuplicateOfBank(lesson.practice, known))) {
        throw new Error('AI question duplicates a bank question');
      }
      return { lesson, source: 'ai' };
    } catch (err) {
      console.warn('[tutor] Gemini lesson failed, using fallback:', err.message);
    }
  }
  return { lesson: fallbackLesson({ question, selectedAnswer, level, bank, excludeIds, rng }), source: 'fallback' };
}

function newSid() {
  return crypto.randomBytes(12).toString('hex');
}

module.exports = {
  MAX_LEVEL,
  buildLesson,
  sealSession,
  openSession,
  publicQuestion,
  newSid,
  _internals: { buildPrompt, normalizeLesson, cleanQuestion, fallbackLesson, shuffle }
};
