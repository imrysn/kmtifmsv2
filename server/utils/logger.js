const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

winston.addColors(colors);

// Determine log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info';
};

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}]: ${info.message}${info.stack ? '\n' + info.stack : ''}`
  )
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat
  }),

  // Error log file
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/error.log'),
    level: 'error',
    format,
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }),

  // Combined log file
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/combined.log'),
    format,
    maxsize: 5242880, // 5MB
    maxFiles: 5
  })
];

// Create logger instance
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  exitOnError: false
});

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Log activity to database (backward compatibility)
 * @param {Object} db - Database instance
 * @param {number} userId - User ID
 * @param {string} username - Username
 * @param {string} role - User role
 * @param {string} team - User team
 * @param {string} action - Action description
 */
function logActivity(db, userId, username, role, team, action) {
  const timestamp = new Date().toISOString();

  // Log to Winston
  logger.info('Activity', {
    userId,
    username,
    role,
    team,
    action,
    timestamp
  });

  // Log to database
  const query = `
    INSERT INTO activity_logs (userId, username, role, team, action, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [userId, username, role, team, action, timestamp], (err) => {
    if (err) {
      logger.error('Failed to log activity to database', {
        error: err.message,
        userId,
        action
      });
    }
  });
}

/**
 * Log HTTP request
 */
function logRequest(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;

    if (res.statusCode >= 500) {
      logger.error(message, {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
    } else if (res.statusCode >= 400) {
      logger.warn(message, {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration,
        ip: req.ip
      });
    } else {
      logger.http(message, {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration
      });
    }
  });

  next();
}

/**
 * Log error with context
 */
function logError(error, context = {}) {
  logger.error(error.message, {
    error: error.message,
    stack: error.stack,
    ...context
  });
}

/**
 * Log info message
 */
function logInfo(message, meta = {}) {
  logger.info(message, meta);
}

/**
 * Log warning message
 */
function logWarn(message, meta = {}) {
  logger.warn(message, meta);
}

/**
 * Log debug message
 */
function logDebug(message, meta = {}) {
  logger.debug(message, meta);
}

module.exports = {
  logger,
  logActivity,
  logRequest,
  logError,
  logInfo,
  logWarn,
  logDebug
};
