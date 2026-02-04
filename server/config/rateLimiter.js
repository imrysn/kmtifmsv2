const rateLimit = require('express-rate-limit');

const isDevelopment = process.env.NODE_ENV === 'development';

// General API rate limiter - 100 requests per 15 minutes
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isDevelopment && req.ip === '::1'
});

// Strict rate limiter for authentication endpoints - 5 attempts per 15 minutes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        message: 'Too many login attempts from this IP, please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    skip: (req) => isDevelopment && req.ip === '::1'
});

// File upload rate limiter - 20 uploads per hour
const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: {
        success: false,
        message: 'Too many file uploads from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        if (isDevelopment && req.ip === '::1') return true;
        return req.method === 'GET';
    }
});

module.exports = {
    apiLimiter,
    authLimiter,
    uploadLimiter
};
