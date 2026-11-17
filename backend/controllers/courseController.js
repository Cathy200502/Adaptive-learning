const Course = require('../models/Course');
const Topic = require('../models/Topic');
const Question = require('../models/Question');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { courseSummary } = require('../services/progressService');

exports.listCourses = asyncHandler(async (req, res) => {
  const courses = await Course.find().sort({ name: 1 }).lean();
  const enriched = await Promise.all(
    courses.map(async (course) => ({
      ...course,
      topicCount: await Topic.countDocuments({ course: course.slug }),
      questionCount: await Question.countDocuments({ course: course.slug })
    }))
  );
  res.json({ courses: enriched });
});

exports.getCourse = asyncHandler(async (req, res) => {
  const slug = String(req.params.course).toLowerCase();
  const course = await Course.findOne({ slug }).lean();
  if (!course) throw ApiError.notFound('That course does not exist');
  const topics = await Topic.find({ course: slug }).sort({ order: 1 }).lean();
  const summary = req.user ? await courseSummary(req.user._id, slug) : null;
  res.json({ course: { ...course, topicCount: topics.length }, topics, summary });
});
