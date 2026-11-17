const router = require('express').Router();
const ctrl = require('../controllers/quizController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/question', ctrl.nextQuestion);
router.post('/answer', ctrl.submitAnswer);
router.post('/restart', ctrl.restartTopic);
router.get('/progress', ctrl.quizProgress);
router.get('/mistakes', ctrl.mistakes);

module.exports = router;
