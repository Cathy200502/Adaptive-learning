const router = require('express').Router();
const ctrl = require('../controllers/adminController');
const rateLimit = require('express-rate-limit');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);

// Gemini calls cost quota, so cap how often they can be triggered.
const generateLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 40, message: { error: 'Too many AI generations this hour. Please wait a while.' } });

router.get('/stats', ctrl.stats);
router.get('/users', ctrl.listUsers);

router.post('/courses', ctrl.createCourse);
router.put('/courses/:id', ctrl.updateCourse);

router.get('/topics', ctrl.listTopics);
router.post('/topics', ctrl.createTopic);
router.put('/topics/:id', ctrl.updateTopic);
router.delete('/topics/:id', ctrl.deleteTopic);

router.get('/questions', ctrl.listQuestions);
router.get('/ai/status', ctrl.aiStatus);
router.post('/questions/generate', generateLimiter, ctrl.generateQuestions);
router.post('/questions/generated', ctrl.saveGeneratedQuestions);
router.post('/questions', ctrl.createQuestion);
router.put('/questions/:id', ctrl.updateQuestion);
router.delete('/questions/:id', ctrl.deleteQuestion);

router.get('/resources', ctrl.listResources);
router.post('/resources', ctrl.createResource);
router.put('/resources/:id', ctrl.updateResource);
router.delete('/resources/:id', ctrl.deleteResource);

module.exports = router;
