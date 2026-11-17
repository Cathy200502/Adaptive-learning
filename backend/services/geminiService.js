/**
 * Gemini question generator - the ONLY place the app talks to an AI model.
 *
 * It turns a topic (name, objectives, common mistakes) into multiple-choice
 * question DRAFTS. Nothing here writes to the database: an admin reviews the
 * drafts and saves the ones they approve (see adminController).
 *
 * Uses Node's built-in fetch (Node 18+), so there is no extra dependency.
 */
const ApiError = require('../utils/ApiError');
const { validateQuestion } = require('../utils/validate');
const cfg = require('../config/gemini.config');

const LANGUAGE = { java: 'Java', python: 'Python' };

const DIFFICULTY_GUIDE = {
  easy: 'Recall and recognition: syntax, definitions, or predicting the output of one simple line. A beginner who just read the topic should get it right.',
  medium: 'Application: trace a short snippet, spot a bug, or choose the right construct. Needs a solid grasp of the topic.',
  hard: 'Analysis: edge cases, subtle behaviour, or combining this topic with earlier ones. Only strong learners should get it right.'
};

const TYPE_GUIDE = {
  concept: 'a conceptual question about what something is or why it works that way',
  output: 'show a short code snippet and ask what it prints',
  debug: 'show code containing one bug and ask what is wrong or how to fix it',
  completion: 'show code with a blank and ask which option correctly completes it',
  scenario: 'describe a small real-world situation and ask which approach or construct fits',
  problem: 'a small problem-solving question where the learner picks the correct approach or result'
};

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          code: { type: 'STRING' },
          options: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 4, maxItems: 4 },
          correctAnswer: { type: 'INTEGER' },
          explanation: { type: 'STRING' },
          concept: { type: 'STRING' },
          tip: { type: 'STRING' }
        },
        required: ['question', 'options', 'correctAnswer', 'explanation']
      }
    }
  },
  required: ['questions']
};

const clip = (text, n) => {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

/** Lower-cased, whitespace-collapsed key used to spot duplicate questions. */
const fingerprint = (q) => `${q.question || ''} ${q.code || ''}`.toLowerCase().replace(/\s+/g, ' ').trim();

function status() {
  return { configured: Boolean(cfg.apiKey()), model: cfg.model(), maxPerRequest: cfg.maxPerRequest() };
}

function buildPrompt({ course, topic, difficulty, type, count, existing = [] }) {
  const language = LANGUAGE[course] || course;
  const mistakes = (topic.cheatSheet?.mistakes || []).slice(0, 6);
  const notes = (topic.cheatSheet?.notes || []).slice(0, 6);
  const avoid = existing.slice(0, 25).map((q) => `- ${clip(q.question, 140)}`);

  const system =
    `You write multiple-choice questions for a ${language} learning platform. ` +
    'Accuracy matters more than cleverness: a learner will trust every answer key you produce. ' +
    'Reply with JSON only, matching the requested schema.';

  const lines = [
    `Language: ${language}`,
    `Topic: ${topic.name}${topic.description ? ` - ${clip(topic.description, 200)}` : ''}`,
    topic.objectives?.length ? `Learning objectives: ${topic.objectives.join('; ')}` : null,
    notes.length ? `Key facts about the topic: ${notes.join(' | ')}` : null,
    mistakes.length ? `Common learner mistakes (good material for wrong options): ${mistakes.join(' | ')}` : null,
    `Difficulty: ${difficulty} - ${DIFFICULTY_GUIDE[difficulty]}`,
    `Question style: ${type} - ${TYPE_GUIDE[type]}`,
    '',
    `Write exactly ${count} different question${count === 1 ? '' : 's'}. Rules:`,
    '- Exactly 4 options. Exactly one is unambiguously correct; the other three are plausible but definitely wrong.',
    '- "correctAnswer" is the zero-based index (0-3) of the correct option. Do not put letters like "A)" inside the options.',
    '- Put any code in the "code" field as plain source (no markdown fences) and keep "question" short. Use an empty string if there is no code.',
    `- Code must be valid ${language}. For output questions, mentally execute the code line by line and make sure the marked answer is exactly what it prints.`,
    '- "explanation": 1-3 sentences on why the answer is right and why the most tempting wrong option is wrong.',
    '- "concept": a 2-5 word label. "tip": one short practical tip (may be empty).',
    '- Stay strictly on this topic; do not test material from later topics.',
    avoid.length ? `- Do not repeat or closely paraphrase these existing questions:\n${avoid.join('\n')}` : null
  ];

  return { system, user: lines.filter((l) => l !== null).join('\n') };
}

/** Remove option prefixes like "A) ", "b. " that models sometimes add. */
const stripOptionPrefix = (o) => String(o).trim().replace(/^[A-Da-d][).:]\s+/, '').trim();
const stripFences = (code) => String(code || '').replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```\s*$/, '').replace(/\s+$/, '');

// Options like "All of the above" only make sense in their original position.
const ORDER_DEPENDENT = /\b(all|none|both|neither)\b.*\b(above|these|them)\b|\bboth [a-d]\b/i;

/** Fisher-Yates shuffle that keeps track of where the correct answer ends up. */
function shuffleOptions(options, correctAnswer, rng = Math.random) {
  if (options.some((o) => ORDER_DEPENDENT.test(o))) return { options, correctAnswer };
  const tagged = options.map((text, i) => ({ text, correct: i === correctAnswer }));
  for (let i = tagged.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
  }
  return { options: tagged.map((t) => t.text), correctAnswer: tagged.findIndex((t) => t.correct) };
}

/**
 * Cleans the raw model output into question drafts. Anything malformed,
 * duplicated or failing the same validator the admin form uses is dropped and
 * counted, never passed on.
 */
function normalizeQuestions(raw, { course, topicSlug, difficulty, type, existing = [], rng }) {
  const seen = new Set(existing.map(fingerprint));
  const questions = [];
  const dropped = [];

  (Array.isArray(raw) ? raw : []).forEach((item, index) => {
    try {
      const options = (Array.isArray(item?.options) ? item.options : []).map(stripOptionPrefix);
      const draft = {
        course,
        topic: topicSlug,
        difficulty,
        type,
        question: String(item?.question || '').trim(),
        code: stripFences(item?.code),
        options,
        correctAnswer: Number(item?.correctAnswer),
        explanation: String(item?.explanation || '').trim(),
        concept: clip(item?.concept, 60),
        tip: clip(item?.tip, 200)
      };
      if (options.length !== 4) throw new Error('needs exactly 4 options');
      validateQuestion(draft);

      const key = fingerprint(draft);
      if (seen.has(key)) throw new Error('duplicate of an existing question');
      seen.add(key);

      Object.assign(draft, shuffleOptions(draft.options, draft.correctAnswer, rng));
      questions.push(draft);
    } catch (err) {
      const detail = err.details ? Object.values(err.details).join(', ') : err.message;
      dropped.push({ index, reason: detail });
    }
  });

  return { questions, dropped };
}

const errorFromResponse = async (res) => {
  let detail = '';
  try {
    detail = (await res.json())?.error?.message || '';
  } catch (_) { /* body was not JSON */ }

  if (res.status === 401 || res.status === 403 || /api key/i.test(detail)) {
    return new ApiError(502, 'Gemini rejected the API key. Check GEMINI_API_KEY in backend/.env and restart the server.');
  }
  if (res.status === 404) {
    return new ApiError(502, `Gemini could not find the model "${cfg.model()}". Check GEMINI_MODEL in backend/.env.`);
  }
  if (res.status === 429) {
    return new ApiError(429, 'Gemini rate limit or free-tier quota reached. Wait a minute and try again.');
  }
  if (res.status === 400) {
    return new ApiError(502, `Gemini rejected the request: ${clip(detail, 200) || 'bad request'}`);
  }
  return new ApiError(502, `Gemini is unavailable right now (HTTP ${res.status}). Try again shortly.`);
};

async function callGemini(body) {
  const key = cfg.apiKey();
  if (!key) {
    throw new ApiError(503, 'Gemini is not configured. Add GEMINI_API_KEY to backend/.env and restart the server.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs());
  let res;
  try {
    res = await fetch(`${cfg.baseUrl()}/models/${encodeURIComponent(cfg.model())}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new ApiError(504, 'Gemini took too long to answer. Try fewer questions.');
    throw new ApiError(502, 'Could not reach Gemini. Check the server\'s internet connection.');
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw await errorFromResponse(res);
  return res.json();
}

function extractJson(data) {
  if (data?.promptFeedback?.blockReason) {
    throw new ApiError(422, `Gemini declined this request (${data.promptFeedback.blockReason}). Try a different topic or wording.`);
  }
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text || '').join('').trim();
  if (!text) throw new ApiError(502, 'Gemini returned an empty answer. Try again.');

  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : parsed.questions;
  } catch (_) {
    throw new ApiError(502, 'Gemini returned an answer that could not be read. Try again, or ask for fewer questions.');
  }
}

/** Like extractJson but returns the parsed object as-is (used by the tutor). */
function extractJsonObject(data) {
  if (data?.promptFeedback?.blockReason) {
    throw new ApiError(422, `Gemini declined this request (${data.promptFeedback.blockReason}).`);
  }
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text || '').join('').trim();
  if (!text) throw new ApiError(502, 'Gemini returned an empty answer. Try again.');
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  } catch (_) {
    throw new ApiError(502, 'Gemini returned an answer that could not be read. Try again.');
  }
}

/**
 * Generates question drafts for one topic.
 * @returns {{ questions: object[], dropped: {index:number, reason:string}[], model: string }}
 */
async function generateQuestions({ course, topic, difficulty = 'easy', type = 'concept', count = 5, existing = [], rng }) {
  const { system, user } = buildPrompt({ course, topic, difficulty, type, count, existing });

  const data = await callGemini({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      temperature: cfg.temperature(),
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA
    }
  });

  const raw = extractJson(data);
  const { questions, dropped } = normalizeQuestions(raw, {
    course, topicSlug: topic.slug, difficulty, type, existing, rng
  });

  if (!questions.length) {
    throw new ApiError(502, 'Gemini did not return any usable questions. Try again.');
  }
  return { questions, dropped, model: cfg.model() };
}

module.exports = {
  generateQuestions,
  status,
  fingerprint,
  callGemini,
  extractJsonObject,
  _internals: { buildPrompt, normalizeQuestions, shuffleOptions, extractJson, stripOptionPrefix, clip }
};
