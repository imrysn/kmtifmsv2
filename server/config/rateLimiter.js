const rateLimit = require('express-rate-limit');

const isDevelopment = process.env.NODE_ENV === 'development';

// In a packaged Electron desktop app all requests arrive from localhost,
// so we skip rate-limiting for loopback addresses in every environment.
const isLocalhost = (req) => {
  const ip = req.ip || '';
  return ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
};

// General API rate limiter - 500 requests per 15 minutes
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: isLocalhost
});

// Auth rate limiter - 20 attempts per 15 minutes (was 5, too strict for desktop)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: {
        success: false,
        message: 'Too many login attempts from this IP, please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    skip: isLocalhost
});

// File upload rate limiter - 100 uploads per hour
const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        message: 'Too many file uploads from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isLocalhost(req) || req.method === 'GET'
});

module.exports = {
    apiLimiter,
    authLimiter,
    uploadLimiter
};
