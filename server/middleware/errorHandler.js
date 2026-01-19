const { logError } = require('../utils/logger');

/**
 * Custom Application Error
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Database Error
 */
class DatabaseError extends AppError {
  constructor(message, originalError = null) {
    super(message, 500, true);
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

/**
 * Validation Error
 */
class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, true);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Authentication Error
 */
class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, true);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization Error
 */
class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, true);
    this.name = 'AuthorizationError';
  }
}

/**
 * Not Found Error
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, true);
    this.name = 'NotFoundError';
  }
}

/**
 * Centralized Error Handler Middleware
 */
const errorHandler = (err, req, res, _next) => {
  let error = err;

  // If it's not an AppError, convert it
  if (!(error instanceof AppError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';
    error = new AppError(message, statusCode, false);
  }

  // Log error
  logError(error, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id,
    body: req.body
  });

  // Prepare error response
  const response = {
    success: false,
    message: error.isOperational ? error.message : 'Internal server error',
    timestamp: error.timestamp || new Date().toISOString()
  };

  // Add validation errors if present
  if (error instanceof ValidationError && error.errors.length > 0) {
    response.errors = error.errors;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development' && error.stack) {
    response.stack = error.stack;
  }

  // Send response
  res.status(error.statusCode).json(response);
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found Handler
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl}`);
  next(error);
};

/**
 * Unhandled Rejection Handler
 */
const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    logError(new Error('Unhandled Rejection'), { reason, promise });
    // In production, you might want to gracefully shutdown
    // process.exit(1);
  });
};

/**
 * Uncaught Exception Handler
 */
const handleUncaughtException = () => {
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    logError(error, { type: 'uncaughtException' });
    // Exit process on uncaught exception
    process.exit(1);
  });
};

module.exports = {
  AppError,
  DatabaseError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  errorHandler,
  asyncHandler,
  notFoundHandler,
  handleUnhandledRejection,
  handleUncaughtException
};
