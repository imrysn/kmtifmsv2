const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

if (!JWT_SECRET) {
  console.error('❌ CRITICAL: JWT_SECRET is not defined in environment variables!');
  console.error('   Please add JWT_SECRET to your .env file');
  console.error('   Generate one using: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  process.exit(1);
}

/**
 * Generate JWT token for user
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    panelType: user.panelType,
    team: user.team
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} Decoded user data
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Middleware to authenticate requests
 */
function authenticateToken(req, res, next) {
  // Get token from Authorization header or cookie
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1] || req.cookies?.authToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  try {
    const user = verifyToken(token);
    req.user = user; // Attach user data to request
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
}

/**
 * Middleware to check user role
 * @param {...string} allowedRoles - Allowed panel types
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.panelType)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
}

/**
 * Extract user from token without throwing error
 * @param {string} token - JWT token
 * @returns {Object|null} User data or null
 */
function getUserFromToken(token) {
  try {
    return verifyToken(token);
  } catch (error) {
    return null;
  }
}

module.exports = {
  generateToken,
  verifyToken,
  authenticateToken,
  requireRole,
  getUserFromToken
};
