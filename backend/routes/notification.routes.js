const router = require('express').Router();
const ctrl = require('../controllers/progressController');
const { protect } = require('../middleware/auth');

router.get('/', protect, ctrl.listNotifications);
router.put('/read', protect, ctrl.markNotificationsRead);

module.exports = router;
