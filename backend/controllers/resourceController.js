const Resource = require('../models/Resource');
const asyncHandler = require('../utils/asyncHandler');

exports.byCourse = asyncHandler(async (req, res) => {
  const course = String(req.params.course).toLowerCase();
  const search = (req.query.search || '').trim();
  const filter = { course };
  if (search) {
    filter.$or = [
      { title: new RegExp(search, 'i') },
      { description: new RegExp(search, 'i') },
      { topic: new RegExp(search, 'i') }
    ];
  }
  const resources = await Resource.find(filter).sort({ topic: 1 }).lean();
  res.json({ course, resources });
});

exports.byTopic = asyncHandler(async (req, res) => {
  const course = String(req.params.course).toLowerCase();
  const topic = String(req.params.topic).toLowerCase();
  const resources = await Resource.find({ course, topic }).lean();
  res.json({ course, topic, resources });
});
