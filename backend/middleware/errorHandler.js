const notFound = (req, res) => {
  res.status(404).json({ error: `No route matches ${req.method} ${req.originalUrl}` });
};

// Every error reaching here is turned into a friendly JSON payload so the
// client never receives an HTML stack trace.
const errorHandler = (err, req, res, _next) => {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong. Please try again.';
  let details = err.details;

  if (err.name === 'ValidationError') {
    status = 400;
    details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    message = 'Some fields need attention';
  }
  if (err.name === 'CastError') {
    status = 400;
    message = 'That id is not valid';
  }
  if (err.code === 11000) {
    status = 409;
    message = `That ${Object.keys(err.keyValue || { value: '' })[0]} is already in use`;
  }
  if (status >= 500) console.error('[error]', err);

  res.status(status).json({ error: message, ...(details ? { details } : {}) });
};

module.exports = { notFound, errorHandler };
