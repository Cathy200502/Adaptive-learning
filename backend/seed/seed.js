require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');

const Course = require('../models/Course');
const Topic = require('../models/Topic');
const Question = require('../models/Question');
const Resource = require('../models/Resource');
const User = require('../models/User');
const UserProgress = require('../models/UserProgress');
const QuizAttempt = require('../models/QuizAttempt');
const Notification = require('../models/Notification');

const courses = require('./data/courses');
const javaTopics = require('./data/javaTopics');
const pythonTopics = require('./data/pythonTopics');
const resources = require('./data/resources');

const questions = [
  ...require('./data/javaQuestions.part1'),
  ...require('./data/javaQuestions.part2'),
  ...require('./data/javaQuestions.part3'),
  ...require('./data/javaQuestions.part4'),
  ...require('./data/javaQuestions.part5'),
  ...require('./data/javaQuestions.part6'),
  ...require('./data/javaQuestions.part7'),
  ...require('./data/pythonQuestions.part1'),
  ...require('./data/pythonQuestions.part2')
];

/** Fails loudly if the content files contain a question whose answer is invalid. */
function validateContent(topics) {
  const slugs = new Set(topics.map((t) => `${t.course}/${t.slug}`));
  const problems = [];
  const seenText = new Set();
  for (const q of questions) {
    const key = `${q.course}/${q.topic}/${q.question}/${q.code}`.toLowerCase();
    if (seenText.has(key)) problems.push(`duplicate question in bank: \"${q.question}\"`);
    seenText.add(key);
    if (!slugs.has(`${q.course}/${q.topic}`)) problems.push(`unknown topic ${q.course}/${q.topic}`);
    if (q.correctAnswer < 0 || q.correctAnswer >= q.options.length) problems.push(`bad answer index in "${q.question}"`);
    if (new Set(q.options).size !== q.options.length) problems.push(`duplicate options in "${q.question}"`);
  }
  if (problems.length) {
    console.error('[seed] content problems:\n - ' + problems.join('\n - '));
    process.exit(1);
  }
}

async function run() {
  const topics = [...javaTopics, ...pythonTopics];
  validateContent(topics);

  await connectDB();
  console.log('[seed] clearing existing data');
  await Promise.all([
    Course.deleteMany({}),
    Topic.deleteMany({}),
    Question.deleteMany({}),
    Resource.deleteMany({}),
    User.deleteMany({}),
    UserProgress.deleteMany({}),
    QuizAttempt.deleteMany({}),
    Notification.deleteMany({})
  ]);

  await Course.insertMany(courses);
  await Topic.insertMany(topics);
  await Question.insertMany(questions);
  await Resource.insertMany(resources);

  // create() is used instead of insertMany so the pre-save hook hashes passwords
  await User.create({ name: 'Platform Admin', email: 'admin@example.com', password: 'password123', role: 'admin' });
  const student = await User.create({
    name: 'Sample Student', email: 'student@example.com', password: 'password123', selectedCourse: 'java'
  });

  // give the demo student a little history so the dashboard is not empty
  await UserProgress.create({
    user: student._id, course: 'java', topic: 'intro-to-java',
    mastery: 100, difficulty: 'hard', attempts: 6, correctAnswers: 6, wrongAnswers: 0,
    mediumCorrect: 2, hardCorrect: 2, completed: true, completedAt: new Date(), lastPracticedAt: new Date()
  });
  await UserProgress.create({
    user: student._id, course: 'java', topic: 'variables',
    mastery: 45, difficulty: 'medium', attempts: 5, correctAnswers: 3, wrongAnswers: 2,
    mediumCorrect: 1, lastPracticedAt: new Date()
  });

  const counts = {
    courses: await Course.countDocuments(),
    topics: await Topic.countDocuments(),
    questions: await Question.countDocuments(),
    resources: await Resource.countDocuments(),
    users: await User.countDocuments()
  };
  console.log('[seed] done:', counts);
  console.log('[seed] admin@example.com / password123   student@example.com / password123');
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('[seed] failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
