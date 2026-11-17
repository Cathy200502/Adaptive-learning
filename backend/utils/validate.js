/**
 * Small, dependency-free input validators.
 * Every failure throws an ApiError(400) which the error middleware turns into
 * a friendly JSON response, so controllers stay readable.
 */
const ApiError = require('./ApiError');

const isEmail = (value) => /^\S+@\S+\.\S+$/.test(String(value || '').trim());

/** Throws unless every listed field is present and non-empty. */
function requireFields(body = {}, fields = []) {
  const missing = fields.filter((f) => {
    const v = body[f];
    return v === undefined || v === null || String(v).trim() === '';
  });
  if (missing.length) {
    throw ApiError.badRequest(
      `Please fill in: ${missing.join(', ')}`,
      Object.fromEntries(missing.map((f) => [f, 'This field is required']))
    );
  }
}

function validateRegister(body = {}) {
  requireFields(body, ['name', 'email', 'password']);
  const errors = {};
  if (String(body.name).trim().length < 2) errors.name = 'Name is too short';
  if (!isEmail(body.email)) errors.email = 'Enter a valid email address';
  if (String(body.password).length < 6) errors.password = 'Use at least 6 characters';
  if (body.confirmPassword !== undefined && body.confirmPassword !== body.password) {
    errors.confirmPassword = 'Passwords do not match';
  }
  if (body.selectedCourse !== undefined && !['java', 'python'].includes(body.selectedCourse)) {
    errors.selectedCourse = 'Course must be java or python';
  }
  if (Object.keys(errors).length) throw ApiError.badRequest('Please check the form', errors);
}

/**
 * Validates an admin-supplied question.
 * With { partial: true } the object is an existing question merged with the
 * update, so the same rules still apply to the merged result.
 */
function validateQuestion(body = {}) {
  requireFields(body, ['course', 'topic', 'question', 'explanation']);
  const errors = {};

  if (!['java', 'python'].includes(String(body.course).toLowerCase())) {
    errors.course = 'Course must be java or python';
  }
  if (!['easy', 'medium', 'hard'].includes(String(body.difficulty || 'easy').toLowerCase())) {
    errors.difficulty = 'Difficulty must be easy, medium or hard';
  }

  const options = Array.isArray(body.options) ? body.options.map((o) => String(o).trim()) : [];
  if (options.length < 2) errors.options = 'Provide at least two options';
  else if (options.some((o) => !o)) errors.options = 'Options cannot be blank';
  else if (new Set(options).size !== options.length) errors.options = 'Options must be different from each other';

  const answer = Number(body.correctAnswer);
  if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) {
    errors.correctAnswer = 'Pick which option is correct';
  }

  if (Object.keys(errors).length) throw ApiError.badRequest('Please check the question', errors);
}

module.exports = { isEmail, requireFields, validateRegister, validateQuestion };
