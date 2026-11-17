const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.get('/me', protect, ctrl.me);
router.put('/profile', protect, ctrl.updateProfile);
router.put('/password', protect, ctrl.changePassword);
// Logout is client-side (the JWT is simply discarded); this endpoint exists so
// the client has a single place to call if server-side sessions are added.
router.post('/logout', protect, (req, res) => res.json({ message: 'Signed out' }));

module.exports = router;
