/**
 * Custom API Error class
 * Extends built-in Error with status code and operational flag
 */
class ApiError extends Error {
  constructor(statusCode, message, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }

  // Factory methods for common errors
  static badRequest(message = 'Bad request') {
    return new ApiError(400, message);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, message, false);
  }
}

module.exports = ApiError;