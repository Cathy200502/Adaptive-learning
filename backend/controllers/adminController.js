const Course = require('../models/Course');
const Topic = require('../models/Topic');
const Question = require('../models/Question');
const Resource = require('../models/Resource');
const User = require('../models/User');
const QuizAttempt = require('../models/QuizAttempt');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { validateQuestion, requireFields } = require('../utils/validate');
const gemini = require('../services/geminiService');
const geminiConfig = require('../config/gemini.config');

const slugify = (value) =>
  String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

exports.stats = asyncHandler(async (req, res) => {
  const [users, courses, topics, questions, attempts, resources] = await Promise.all([
    User.countDocuments(),
    Course.countDocuments(),
    Topic.countDocuments(),
    Question.countDocuments(),
    QuizAttempt.countDocuments(),
    Resource.countDocuments()
  ]);
  const byCourse = await Promise.all(
    (await Course.find().lean()).map(async (c) => ({
      course: c.slug,
      name: c.name,
      topics: await Topic.countDocuments({ course: c.slug }),
      questions: await Question.countDocuments({ course: c.slug }),
      resources: await Resource.countDocuments({ course: c.slug })
    }))
  );
  res.json({ stats: { users, courses, topics, questions, attempts, resources }, byCourse });
});

/* ------------------------------- courses ------------------------------- */
exports.createCourse = asyncHandler(async (req, res) => {
  requireFields(req.body, ['name']);
  const course = await Course.create({ ...req.body, slug: slugify(req.body.slug || req.body.name) });
  res.status(201).json({ course });
});

exports.updateCourse = asyncHandler(async (req, res) => {
  const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!course) throw ApiError.notFound('Course not found');
  res.json({ course });
});

/* -------------------------------- topics -------------------------------- */
exports.listTopics = asyncHandler(async (req, res) => {
  const filter = req.query.course ? { course: String(req.query.course).toLowerCase() } : {};
  res.json({ topics: await Topic.find(filter).sort({ course: 1, order: 1 }).lean() });
});

exports.createTopic = asyncHandler(async (req, res) => {
  requireFields(req.body, ['course', 'name']);
  const course = String(req.body.course).toLowerCase();
  const order = req.body.order ?? (await Topic.countDocuments({ course })) + 1;
  const topic = await Topic.create({
    ...req.body,
    course,
    slug: slugify(req.body.slug || req.body.name),
    order
  });
  res.status(201).json({ topic });
});

exports.updateTopic = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  if (payload.slug) payload.slug = slugify(payload.slug);
  const topic = await Topic.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  if (!topic) throw ApiError.notFound('Topic not found');
  res.json({ topic });
});

exports.deleteTopic = asyncHandler(async (req, res) => {
  const topic = await Topic.findByIdAndDelete(req.params.id);
  if (!topic) throw ApiError.notFound('Topic not found');
  await Question.deleteMany({ course: topic.course, topic: topic.slug });
  await Resource.deleteMany({ course: topic.course, topic: topic.slug });
  res.json({ message: 'Topic deleted with its questions and resources' });
});

/* ------------------------------- questions ------------------------------ */
exports.listQuestions = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.course) filter.course = String(req.query.course).toLowerCase();
  if (req.query.topic) filter.topic = String(req.query.topic).toLowerCase();
  if (req.query.difficulty) filter.difficulty = req.query.difficulty;
  if (req.query.search) filter.question = new RegExp(req.query.search, 'i');
  const questions = await Question.find(filter).sort({ topic: 1, difficulty: 1 }).limit(300).lean();
  res.json({ questions });
});

exports.createQuestion = asyncHandler(async (req, res) => {
  validateQuestion(req.body);
  const question = await Question.create({
    ...req.body,
    course: String(req.body.course).toLowerCase(),
    topic: slugify(req.body.topic),
    correctAnswer: Number(req.body.correctAnswer)
  });
  res.status(201).json({ question });
});

exports.updateQuestion = asyncHandler(async (req, res) => {
  const existing = await Question.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Question not found');
  validateQuestion({ ...existing.toObject(), ...req.body }, { partial: true });
  Object.assign(existing, req.body);
  if (req.body.topic) existing.topic = slugify(req.body.topic);
  await existing.save();
  res.json({ question: existing });
});

exports.deleteQuestion = asyncHandler(async (req, res) => {
  const question = await Question.findByIdAndDelete(req.params.id);
  if (!question) throw ApiError.notFound('Question not found');
  res.json({ message: 'Question deleted' });
});

/* -------------------- Gemini question generation (admin) -------------------- */
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const QUESTION_TYPES = ['concept', 'output', 'debug', 'completion', 'scenario', 'problem'];
const DRAFT_FIELDS = ['question', 'code', 'options', 'correctAnswer', 'explanation', 'concept', 'tip', 'difficulty', 'type'];

const findTopic = async (courseInput, topicInput) => {
  const course = String(courseInput).toLowerCase();
  if (!['java', 'python'].includes(course)) throw ApiError.badRequest('Course must be java or python');
  const topic = await Topic.findOne({ course, slug: slugify(topicInput) }).lean();
  if (!topic) throw ApiError.notFound('That topic does not exist in this course');
  return { course, topic };
};

// Lets the admin UI show whether Gemini is set up. Never returns the key itself.
exports.aiStatus = asyncHandler(async (req, res) => {
  res.json(gemini.status());
});

// Step 1: ask Gemini for DRAFTS. Nothing is saved here.
exports.generateQuestions = asyncHandler(async (req, res) => {
  requireFields(req.body, ['course', 'topic']);
  const { course, topic } = await findTopic(req.body.course, req.body.topic);

  const difficulty = String(req.body.difficulty || 'easy').toLowerCase();
  const type = String(req.body.type || 'concept').toLowerCase();
  if (!DIFFICULTIES.includes(difficulty)) throw ApiError.badRequest('Difficulty must be easy, medium or hard');
  if (!QUESTION_TYPES.includes(type)) throw ApiError.badRequest('Unknown question type');
  const count = Math.min(Math.max(parseInt(req.body.count, 10) || 5, 1), geminiConfig.maxPerRequest());

  const existing = await Question.find({ course, topic: topic.slug }).select('question code').limit(60).lean();
  const result = await gemini.generateQuestions({ course, topic, difficulty, type, count, existing });
  res.json(result);
});

// Step 2: save the drafts the admin approved.
exports.saveGeneratedQuestions = asyncHandler(async (req, res) => {
  requireFields(req.body, ['course', 'topic']);
  const { course, topic } = await findTopic(req.body.course, req.body.topic);
  const drafts = Array.isArray(req.body.questions) ? req.body.questions : [];
  if (!drafts.length) throw ApiError.badRequest('Select at least one question to save');
  if (drafts.length > 50) throw ApiError.badRequest('Save at most 50 questions at a time');

  const existing = await Question.find({ course, topic: topic.slug }).select('question code').lean();
  const seen = new Set(existing.map(gemini.fingerprint));
  const docs = [];
  const skipped = [];

  drafts.forEach((draft, index) => {
    try {
      const clean = { course, topic: topic.slug };
      DRAFT_FIELDS.forEach((f) => { if (draft[f] !== undefined) clean[f] = draft[f]; });
      clean.difficulty = DIFFICULTIES.includes(clean.difficulty) ? clean.difficulty : 'easy';
      clean.type = QUESTION_TYPES.includes(clean.type) ? clean.type : 'concept';
      clean.correctAnswer = Number(clean.correctAnswer);
      validateQuestion(clean);
      const key = gemini.fingerprint(clean);
      if (seen.has(key)) throw new Error('already in the question bank');
      seen.add(key);
      docs.push({ ...clean, source: 'ai' });
    } catch (err) {
      skipped.push({ index, reason: err.details ? Object.values(err.details).join(', ') : err.message });
    }
  });

  if (docs.length) await Question.insertMany(docs);
  res.status(201).json({ saved: docs.length, skipped });
});

/* ------------------------------- resources ------------------------------ */
exports.listResources = asyncHandler(async (req, res) => {
  const filter = req.query.course ? { course: String(req.query.course).toLowerCase() } : {};
  res.json({ resources: await Resource.find(filter).sort({ course: 1, topic: 1 }).lean() });
});

exports.createResource = asyncHandler(async (req, res) => {
  requireFields(req.body, ['course', 'topic', 'title', 'url']);
  const resource = await Resource.create({
    ...req.body,
    course: String(req.body.course).toLowerCase(),
    topic: slugify(req.body.topic)
  });
  res.status(201).json({ resource });
});

exports.updateResource = asyncHandler(async (req, res) => {
  const resource = await Resource.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!resource) throw ApiError.notFound('Resource not found');
  res.json({ resource });
});

exports.deleteResource = asyncHandler(async (req, res) => {
  const resource = await Resource.findByIdAndDelete(req.params.id);
  if (!resource) throw ApiError.notFound('Resource not found');
  res.json({ message: 'Resource deleted' });
});

/* --------------------------------- users -------------------------------- */
exports.listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).limit(100).lean();
  res.json({ users: users.map(({ password, ...u }) => u) });
});
