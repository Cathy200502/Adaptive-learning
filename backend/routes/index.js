const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/courses', require('./course.routes'));
router.use('/topics', require('./topic.routes'));
router.use('/quiz', require('./quiz.routes'));
router.use('/tutor', require('./tutor.routes'));
router.use('/progress', require('./progress.routes'));
router.use('/resources', require('./resource.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/admin', require('./admin.routes'));

router.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

module.exports = router;
