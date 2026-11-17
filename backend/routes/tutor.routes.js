const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/tutorController');
const { protect } = require('../middleware/auth');

router.use(protect);

// Lessons cost Gemini quota, so cap how often a learner can request them.
const lessonLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 60, message: { error: 'You have used a lot of tutor lessons this hour. Please take a short break.' } });

router.post('/lesson', lessonLimiter, ctrl.lesson);
router.post('/check', ctrl.check);
router.get('/stats', ctrl.stats);

module.exports = router;
