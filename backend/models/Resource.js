const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema(
  {
    course: { type: String, required: true, lowercase: true, index: true },
    topic: { type: String, required: true, lowercase: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['video', 'article', 'docs', 'practice'], default: 'video' },
    url: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resource', resourceSchema);
