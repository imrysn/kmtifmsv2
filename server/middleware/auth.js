const jwt = require('jsonwebtoken');
const { secret } = require('../config/jwt');

/**
 * Authentication Middleware
 * Verifies the JWT from the Authorization header.
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Authentication required: No token provided' 
        });
    }

    jwt.verify(token, secret, (err, user) => {
        if (err) {
            return res.status(403).json({ 
                success: false, 
                message: 'Invalid or expired token' 
            });
        }
        
        req.user = user;
        next();
    });
}

/**
 * Authorization Middleware
 * Checks if the user has the required role(s).
 * @param {string|string[]} roles - Allowed role(s)
 */
function authorizeRole(roles) {
    const allowedRoles = Array.isArray(roles) ? roles.map(r => r.toUpperCase()) : [roles.toUpperCase()];
    
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({ 
                success: false, 
                message: 'Unauthorized: User info missing' 
            });
        }

        // Normalize user role and allowed roles for comparison (TEAM_LEADER vs TEAM LEADER)
        const userRole = req.user.role.toUpperCase().replace(/\s+/g, '_');
        const normalizedAllowedRoles = allowedRoles.map(r => r.replace(/\s+/g, '_'));
        
        // ADMIN always has access
        if (userRole === 'ADMIN' || normalizedAllowedRoles.includes(userRole)) {
            return next();
        }

        return res.status(403).json({
            success: false,
            message: 'Access denied: Insufficient permissions'
        });
    };
}

module.exports = {
    authenticateToken,
    authorizeRole
};

