const router = require('express').Router();
const ctrl = require('../controllers/resourceController');
const { protect } = require('../middleware/auth');

router.get('/:course', protect, ctrl.byCourse);
router.get('/:course/:topic', protect, ctrl.byTopic);

module.exports = router;
