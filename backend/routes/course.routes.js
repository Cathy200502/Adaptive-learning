const router = require('express').Router();
const ctrl = require('../controllers/courseController');
const { protect } = require('../middleware/auth');

router.get('/', ctrl.listCourses);
router.get('/:course', protect, ctrl.getCourse);

module.exports = router;
