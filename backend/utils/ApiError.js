class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
  static badRequest(msg, details) { return new ApiError(400, msg, details); }
  static unauthorized(msg = 'You need to sign in to do that') { return new ApiError(401, msg); }
  static forbidden(msg = 'You do not have access to this area') { return new ApiError(403, msg); }
  static notFound(msg = 'Not found') { return new ApiError(404, msg); }
  static conflict(msg = 'That conflicts with the current state') { return new ApiError(409, msg); }
}

module.exports = ApiError;
