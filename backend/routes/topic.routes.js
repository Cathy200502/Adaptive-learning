const router = require('express').Router();
const ctrl = require('../controllers/topicController');
const { protect } = require('../middleware/auth');

router.get('/:course', protect, ctrl.listTopics);
router.get('/:course/:topic', protect, ctrl.getTopic);

module.exports = router;
