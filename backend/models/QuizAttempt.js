const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: String, required: true, lowercase: true },
    topic: { type: String, required: true, lowercase: true },
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    selectedAnswer: { type: Number, required: true },
    correct: { type: Boolean, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    masteryAfter: { type: Number, default: 0 }
  },
  { timestamps: true }
);

quizAttemptSchema.index({ user: 1, createdAt: -1 });
// per-topic history lookup used to keep correctly answered questions from repeating
quizAttemptSchema.index({ user: 1, course: 1, topic: 1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
