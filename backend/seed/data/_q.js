/* Helper: turns compact rows into Question documents.
   row = [topic, difficulty, type, question, options[], correctIndex, explanation, concept, tip, code?] */
module.exports = (course) => (rows) =>
  rows.map(([topic, difficulty, type, question, options, correctAnswer, explanation, concept, tip, code]) => ({
    course, topic, difficulty, type, question, options, correctAnswer, explanation,
    concept: concept || '', tip: tip || '', code: code || ''
  }));
