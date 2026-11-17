/* Same row format as _q.js, but the option order is shuffled deterministically.
   Rows are written with the correct option FIRST (index 0); this helper moves it to a
   varied position so the answer is not always "A". The shuffle is seeded from the
   question text, so every seed run produces the same order.
   Options such as "All of the above" keep their position so they still make sense. */
const build = require('./_q');

const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rngFor = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const ORDER_SENSITIVE = /\b(all|none|both|neither)\b.*\b(above|these|them)\b/i;

module.exports = (course) => (rows) =>
  build(course)(rows).map((q) => {
    if (q.options.some((o) => ORDER_SENSITIVE.test(o))) return q;
    const rng = rngFor(hash(q.question + q.code));
    const tagged = q.options.map((text, i) => ({ text, correct: i === q.correctAnswer }));
    for (let i = tagged.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
    }
    return { ...q, options: tagged.map((t) => t.text), correctAnswer: tagged.findIndex((t) => t.correct) };
  });
