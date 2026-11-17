const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    tagline: { type: String, default: '' },
    language: { type: String, default: '' },
    difficulty: { type: String, default: 'Beginner to Intermediate' },
    estimatedHours: { type: Number, default: 40 },
    accent: { type: String, default: 'teal' }
  },
  { timestamps: true }
);

courseSchema.virtual('topics', {
  ref: 'Topic',
  localField: 'slug',
  foreignField: 'course'
});

courseSchema.set('toJSON', { virtuals: true });
courseSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Course', courseSchema);
