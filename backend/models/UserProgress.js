const mongoose = require('mongoose');

const userProgressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: String, required: true, lowercase: true },
    topic: { type: String, required: true, lowercase: true },
    mastery: { type: Number, default: 0, min: 0, max: 100 },
    // Elo-style skill rating this topic's difficulty is now derived from
    // (see services/adaptiveEngine.js). `difficulty` is kept in sync as the
    // display/selection tier so nothing downstream has to know about Elo.
    elo: { type: Number, default: 900 },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'easy' },
    correctAnswers: { type: Number, default: 0 },
    wrongAnswers: { type: Number, default: 0 },
    attempts: { type: Number, default: 0 },
    consecutiveCorrect: { type: Number, default: 0 },
    consecutiveWrong: { type: Number, default: 0 },
    mediumCorrect: { type: Number, default: 0 },
    hardCorrect: { type: Number, default: 0 },
    recentQuestions: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    // Start of the current practice round. Attempts before this moment no longer
    // count as "answered", so pressing Practise again gives a fresh test.
    roundStartedAt: { type: Date, default: null },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    lastPracticedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

userProgressSchema.index({ user: 1, course: 1, topic: 1 }, { unique: true });

userProgressSchema.virtual('accuracy').get(function accuracy() {
  return this.attempts ? this.correctAnswers / this.attempts : 0;
});

userProgressSchema.set('toJSON', { virtuals: true });
userProgressSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('UserProgress', userProgressSchema);
