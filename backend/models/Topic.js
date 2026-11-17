const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema(
  {
    course: { type: String, required: true, lowercase: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    section: { type: String, default: 'General' },
    description: { type: String, default: '' },
    objectives: { type: [String], default: [] },
    // Slugs (within this course) that must be completed before this topic
    // unlocks. An empty list means the topic has no prerequisite and is a
    // root of the course's prerequisite graph (see services/topicGraph.js).
    prerequisites: { type: [String], default: [] },
    cheatSheet: {
      language: { type: String, default: '' },
      code: { type: String, default: '' },
      notes: { type: [String], default: [] },
      mistakes: { type: [String], default: [] },
      interviewTips: { type: [String], default: [] }
    },
    order: { type: Number, required: true }
  },
  { timestamps: true }
);

topicSchema.index({ course: 1, slug: 1 }, { unique: true });
topicSchema.index({ course: 1, order: 1 });

module.exports = mongoose.model('Topic', topicSchema);
