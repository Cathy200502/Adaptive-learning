const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { validateRegister, requireFields, isEmail } = require('../utils/validate');

const signToken = (user) =>
  jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });

exports.register = asyncHandler(async (req, res) => {
  validateRegister(req.body);
  const email = String(req.body.email).toLowerCase().trim();
  if (await User.findOne({ email })) throw ApiError.badRequest('An account with that email already exists');

  const user = await User.create({
    name: req.body.name.trim(),
    email,
    password: req.body.password,
    selectedCourse: ['java', 'python'].includes(req.body.selectedCourse) ? req.body.selectedCourse : 'java'
  });

  res.status(201).json({ token: signToken(user), user: user.toSafeJSON() });
});

exports.login = asyncHandler(async (req, res) => {
  requireFields(req.body, ['email', 'password']);
  if (!isEmail(req.body.email)) throw ApiError.badRequest('That email address does not look right');

  const user = await User.findOne({ email: String(req.body.email).toLowerCase().trim() }).select('+password');
  if (!user || !(await user.comparePassword(req.body.password))) {
    throw ApiError.unauthorized('Email or password is incorrect');
  }
  res.json({ token: signToken(user), user: user.toSafeJSON() });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, selectedCourse } = req.body;
  if (name !== undefined) {
    if (String(name).trim().length < 2) throw ApiError.badRequest('Name must be at least 2 characters');
    req.user.name = String(name).trim();
  }
  if (selectedCourse !== undefined) {
    if (!['java', 'python'].includes(selectedCourse)) throw ApiError.badRequest('Pick either Java or Python');
    req.user.selectedCourse = selectedCourse;
  }
  await req.user.save();
  res.json({ user: req.user.toSafeJSON() });
});

exports.changePassword = asyncHandler(async (req, res) => {
  requireFields(req.body, ['currentPassword', 'newPassword']);
  if (String(req.body.newPassword).length < 6) throw ApiError.badRequest('New password must be at least 6 characters');
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(req.body.currentPassword))) {
    throw ApiError.badRequest('Your current password is incorrect');
  }
  user.password = req.body.newPassword;
  await user.save();
  res.json({ message: 'Password changed' });
});
