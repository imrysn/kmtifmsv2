/**
 * JWT Configuration
 * Centralized settings for JSON Web Token authentication
 */

const jwtConfig = {
  // Use secret from environment or fallback to a hardcoded string for development only
  secret: process.env.JWT_SECRET || 'dev-secret-replace-in-production',
  
  // Token expiration time (e.g., '24h', '7d', '1h')
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  
  // Algorithm used for signing
  algorithm: 'HS256'
};

module.exports = jwtConfig;
