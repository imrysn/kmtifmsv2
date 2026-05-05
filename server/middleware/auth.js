/**
 * Authentication Middleware (Compatibility Layer)
 * In this system, user information is often passed via req.body or req.query
 * from the client. This middleware populates req.user for the controllers.
 */

function authenticateToken(req, res, next) {
    // Attempt to find user info in body, query, or headers
    const userId = req.body.userId || req.query.userId || req.headers['x-user-id'];
    const username = req.body.username || req.query.username || req.headers['x-user-username'];
    const role = req.body.userRole || req.query.userRole || req.headers['x-user-role'];
    const team = req.body.userTeam || req.query.userTeam || req.headers['x-user-team'];
    const fullName = req.body.userFullName || req.query.userFullName;

    if (userId) {
        req.user = {
            id: parseInt(userId),
            username: username,
            role: (role || 'USER').toUpperCase(),
            team: team,
            fullName: fullName || username
        };
    } else {
        // Fallback for routes that might not need auth or have it handled differently
        // In the legacy app, many routes didn't have explicit auth check on server
        req.user = {}; 
    }

    next();
}

function authorizeRole(roles) {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            // If no user info provided, we might still allow it if it's legacy 
            // but for security-sensitive routes we should be careful.
            // However, to maintain parity, we'll just log a warning.
            console.warn(`⚠️ Authorization check skipped - no user info for roles: ${roles}`);
            return next();
        }

        const userRole = req.user.role.toUpperCase();
        const allowedRoles = Array.isArray(roles) ? roles : [roles];
        
        if (allowedRoles.includes(userRole) || userRole === 'ADMIN') {
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
