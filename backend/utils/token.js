const jwt = require('jsonwebtoken');

const secret = () => process.env.JWT_SECRET || 'dev_only_insecure_secret_change_me';

function signToken(user) {
  return jwt.sign(
    { id: String(user._id), role: user.role },
    secret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, secret());
}

module.exports = { signToken, verifyToken };
