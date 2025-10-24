/**
 * Secure Logger Utility
 * Prevents sensitive data from being logged to console
 * Only shows detailed logs in development mode
 */

const isDevelopment = import.meta.env.MODE === 'development';

// List of sensitive keys that should NEVER be logged
const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'accessToken',
  'refreshToken',
  'privateKey',
  'sessionId',
  'sessionToken'
];

// Keys that should be redacted in production
const REDACT_IN_PRODUCTION = [
  'email',
  'username',
  'phone',
  'address',
  'ssn',
  'creditCard',
  'bankAccount'
];

/**
 * Sanitize data before logging
 */
function sanitizeData(data, isProduction = !isDevelopment) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item, isProduction));
  }

  const sanitized = {};
  
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    // Always remove sensitive keys
    if (SENSITIVE_KEYS.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '***REDACTED***';
      continue;
    }
    
    // Redact PII in production
    if (isProduction && REDACT_IN_PRODUCTION.some(redact => lowerKey.includes(redact))) {
      sanitized[key] = '***REDACTED***';
      continue;
    }
    
    // Recursively sanitize nested objects
    if (value && typeof value === 'object') {
      sanitized[key] = sanitizeData(value, isProduction);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Create a safe summary of user data for logging
 */
function createUserSummary(userData) {
  if (!userData) return null;
  
  return {
    id: userData.id,
    role: userData.role || userData.panelType,
    team: userData.team,
    // Only show first letter of username in production
    username: isDevelopment ? userData.username : `${userData.username?.[0]}***`,
    // Completely hide email in production
    email: isDevelopment ? userData.email : '***@***.***',
    timestamp: new Date().toISOString()
  };
}

/**
 * Secure Logger Class
 */
class SecureLogger {
  constructor(component = 'App') {
    this.component = component;
  }

  // Log levels
  log(message, data = null) {
    if (!isDevelopment) return;
    
    const sanitized = data ? sanitizeData(data) : null;
    console.log(`[${this.component}] ${message}`, sanitized || '');
  }

  info(message, data = null) {
    const sanitized = data ? sanitizeData(data) : null;
    console.info(`ℹ️ [${this.component}] ${message}`, sanitized || '');
  }

  warn(message, data = null) {
    const sanitized = data ? sanitizeData(data) : null;
    console.warn(`⚠️ [${this.component}] ${message}`, sanitized || '');
  }

  error(message, error = null) {
    // Always log errors, but sanitize sensitive data
    const errorInfo = error ? {
      message: error.message,
      name: error.name,
      // Only include stack trace in development
      stack: isDevelopment ? error.stack : undefined
    } : null;
    
    console.error(`❌ [${this.component}] ${message}`, errorInfo || '');
  }

  // Secure methods for specific operations
  logLogin(userData) {
    const summary = createUserSummary(userData);
    this.info('User logged in', summary);
  }

  logLogout() {
    this.info('User logged out');
  }

  logStateUpdate(stateName) {
    this.log(`State updated: ${stateName}`);
  }

  logNavigation(from, to) {
    this.log(`Navigation: ${from} → ${to}`);
  }

  // Debug mode (only in development)
  debug(message, data = null) {
    if (isDevelopment) {
      const sanitized = data ? sanitizeData(data) : null;
      console.debug(`🐛 [${this.component}] ${message}`, sanitized || '');
    }
  }

  // Performance logging (safe for production)
  logPerformance(operation, duration) {
    console.log(`⚡ [${this.component}] ${operation} took ${duration}ms`);
  }
}

/**
 * Global secure logger instance
 */
export const logger = new SecureLogger('Global');

/**
 * Create component-specific logger
 */
export function createLogger(componentName) {
  return new SecureLogger(componentName);
}

/**
 * Legacy console.log replacement (gradually replace throughout app)
 */
export function secureLog(message, data = null) {
  if (!isDevelopment) return;
  
  const sanitized = data ? sanitizeData(data) : null;
  console.log(message, sanitized || '');
}

/**
 * Utility to check if we're in production
 */
export function isProduction() {
  return !isDevelopment;
}

export default SecureLogger;
