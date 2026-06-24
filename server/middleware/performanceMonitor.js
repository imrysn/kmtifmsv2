const logger = require('../utils/logger');

// Performance thresholds (in milliseconds)
const THRESHOLDS = {
  SLOW: 1000,      // 1 second
  VERY_SLOW: 3000  // 3 seconds
};

// In-memory metrics storage
const metrics = {
  requests: [],
  slowRequests: [],
  errorRequests: []
};

const performanceMonitor = (req, res, next) => {
  const start = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Store original end function
  const originalEnd = res.end;

  // Override end function to capture metrics
  res.end = function (...args) {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    // Create metric entry
    const metric = {
      id: requestId,
      method: req.method,
      url: req.originalUrl,
      path: req.route?.path || req.path,
      duration,
      statusCode,
      timestamp: new Date().toISOString(),
      userAgent: req.get('user-agent'),
      ip: req.ip
    };

    // Store in metrics
    metrics.requests.push(metric);

    // Log slow requests
    if (duration > THRESHOLDS.VERY_SLOW) {
      logger.warn('Very slow request detected', metric);
      metrics.slowRequests.push(metric);
    } else if (duration > THRESHOLDS.SLOW) {
      logger.info('Slow request detected', metric);
      metrics.slowRequests.push(metric);
    }

    // Log errors
    if (statusCode >= 400) {
      logger.error('Error request', metric);
      metrics.errorRequests.push(metric);
    }

    // Keep only last 1000 entries
    if (metrics.requests.length > 1000) {
      metrics.requests = metrics.requests.slice(-1000);
    }
    if (metrics.slowRequests.length > 100) {
      metrics.slowRequests = metrics.slowRequests.slice(-100);
    }
    if (metrics.errorRequests.length > 100) {
      metrics.errorRequests = metrics.errorRequests.slice(-100);
    }

    // Call original end
    originalEnd.apply(res, args);
  };

  next();
};

// Get metrics endpoint
performanceMonitor.getMetrics = () => {
  const now = Date.now();
  const last5Minutes = metrics.requests.filter(
    m => now - new Date(m.timestamp).getTime() < 5 * 60 * 1000
  );

  return {
    total: metrics.requests.length,
    last5Minutes: last5Minutes.length,
    slowRequests: metrics.slowRequests.length,
    errorRequests: metrics.errorRequests.length,
    averageDuration: last5Minutes.length > 0
      ? last5Minutes.reduce((sum, m) => sum + m.duration, 0) / last5Minutes.length
      : 0,
    slowestRequests: metrics.slowRequests.slice(-10),
    recentErrors: metrics.errorRequests.slice(-10)
  };
};

module.exports = performanceMonitor;
