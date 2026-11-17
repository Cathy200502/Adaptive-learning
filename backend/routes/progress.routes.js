const router = require('express').Router();
const ctrl = require('../controllers/progressController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', ctrl.overview);
router.get('/dashboard', ctrl.dashboard);
router.get('/:course', ctrl.byCourse);

module.exports = router;
