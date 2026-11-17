const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    course: { type: String, required: true, lowercase: true, index: true },
    topic: { type: String, required: true, lowercase: true, index: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true, index: true },
    type: {
      type: String,
      enum: ['concept', 'output', 'debug', 'completion', 'scenario', 'problem'],
      default: 'concept'
    },
    question: { type: String, required: true },
    code: { type: String, default: '' },
    options: {
      type: [String],
      required: true,
      validate: [(v) => v.length >= 2, 'A question needs at least two options']
    },
    correctAnswer: { type: Number, required: true, min: 0 },
    explanation: { type: String, required: true },
    concept: { type: String, default: '' },
    tip: { type: String, default: '' },
    // 'ai' = drafted by Gemini and approved by an admin; existing questions default to 'manual'
    source: { type: String, enum: ['manual', 'ai'], default: 'manual' }
  },
  { timestamps: true }
);

questionSchema.index({ course: 1, topic: 1, difficulty: 1 });

// Shape sent to the learner - never leaks the answer key.
questionSchema.methods.toLearnerJSON = function toLearnerJSON() {
  return {
    id: this._id,
    course: this.course,
    topic: this.topic,
    difficulty: this.difficulty,
    type: this.type,
    question: this.question,
    code: this.code,
    options: this.options
  };
};

module.exports = mongoose.model('Question', questionSchema);
