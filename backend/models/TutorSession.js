const mongoose = require('mongoose');

/**
 * One "understand your mistake" session: a wrong answer, the misconception the
 * tutor found, and whether the learner passed the reassessment. Sessions never
 * change mastery or difficulty - the adaptive engine still owns those.
 */
const tutorSessionSchema = new mongoose.Schema(
  {
    sid: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: String, required: true, lowercase: true },
    topic: { type: String, required: true, lowercase: true },
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    misconception: { type: String, default: '' },
    source: { type: String, enum: ['ai', 'fallback'], default: 'ai' },
    level: { type: Number, default: 1 },          // 1 normal, 2 simpler, 3 simplest
    practiceCorrect: { type: Boolean, default: null },
    reassessCorrect: { type: Boolean, default: null },
    understood: { type: Boolean, default: false },
    // bank questions this session used as a reassessment - the normal quiz never asks them again
    reassessedQuestions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }]
  },
  { timestamps: true }
);

tutorSessionSchema.index({ user: 1, question: 1, createdAt: -1 });

module.exports = mongoose.model('TutorSession', tutorSessionSchema);
