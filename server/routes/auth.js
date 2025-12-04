const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { logActivity } = require('../utils/logger');
const { createNotification } = require('./notifications');
const { generateToken, authenticateToken } = require('../utils/jwt');

const router = express.Router();

// Validation rules
const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email or username is required')
    .custom((value) => {
      // Allow email or username format
      if (value.includes('@')) {
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          throw new Error('Invalid email format');
        }
      } else {
        // Username validation
        const usernameRegex = /^[a-zA-Z0-9._-]+$/;
        if (!usernameRegex.test(value) || value.length < 3 || value.length > 30) {
          throw new Error('Username must be 3-30 characters and contain only letters, numbers, dots, underscores, or hyphens');
        }
      }
      return true;
    }),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 1 }).withMessage('Password is required'),
  body('loginType')
    .optional()
    .isIn(['user', 'admin']).withMessage('Invalid login type')
];

const forgotPasswordValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail()
];

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Login endpoint with JWT
router.post('/login', loginValidation, async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array()
    });
  }

  console.log('🔐 Login attempt for:', req.body.email, 'via', req.body.loginType || 'user', 'window');
  const { email, password, loginType = 'user' } = req.body;

  try {
    // Find user by email OR username
    const query = email.includes('@')
      ? 'SELECT * FROM users WHERE email = ?'
      : 'SELECT * FROM users WHERE username = ?';

    db.get(query, [email], async (err, user) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      }
      
      if (!user) {
        console.log('❌ User not found:', email);
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }
      
      console.log('✅ User found, verifying password...');

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        console.log('❌ Invalid password for:', email);
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      console.log(`✅ Password verified for ${user.role}: ${email}`);

      // Role-based access control
      const rawRole = (user.role || '').toString().trim().toUpperCase();
      const normalizedRole = rawRole.replace(/\s+/g, '_');

      if (loginType === 'user') {
        // User window: USER and TEAM_LEADER can access. ADMIN must use Admin Login.
        if (normalizedRole === 'ADMIN') {
          console.log('❌ ADMIN trying to access user window');
          return res.status(403).json({
            success: false,
            message: 'Please switch to Admin Login to continue.'
          });
        }
      } else if (loginType === 'admin') {
        // Admin window: TEAM_LEADER and ADMIN can access
        if (normalizedRole === 'USER') {
          console.log('❌ USER trying to access admin window');
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to access the Admin Login. Please use the User Login instead.'
          });
        }
      }

      // Determine panel type based on role and login type
      let panelType;
      if (loginType === 'user') {
        panelType = 'user';
      } else if (loginType === 'admin') {
        if (normalizedRole === 'TEAM_LEADER') {
          panelType = 'teamleader';
        } else if (normalizedRole === 'ADMIN') {
          panelType = 'admin';
        }
      }

      console.log(`✅ Login successful for ${user.role} -> ${panelType} panel`);

      // Generate JWT token
      const token = generateToken({
        id: user.id,
        username: user.username,
        email: user.email,
        panelType: panelType,
        team: user.team
      });

      // Log activity
      logActivity(
        db,
        user.id,
        user.username,
        user.role,
        user.team,
        `User logged in via ${loginType} portal`
      );

      // Set token in httpOnly cookie (more secure)
      res.cookie('authToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Only HTTPS in production
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      // Remove password from user object
      const { password: _, ...userWithoutPassword } = user;
      
      res.json({
        success: true,
        token, // Also send in response for flexibility
        user: {
          ...userWithoutPassword,
          panelType
        },
        message: 'Login successful'
      });
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Logout endpoint
router.post('/logout', authenticateToken, (req, res) => {
  // Clear the auth cookie
  res.clearCookie('authToken');
  
  // Log activity
  if (req.user) {
    logActivity(
      db,
      req.user.id,
      req.user.username,
      req.user.panelType,
      req.user.team,
      'User logged out'
    );
  }

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Verify token endpoint (check if user is still authenticated)
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user,
    message: 'Token is valid'
  });
});

// Forgot password endpoint
router.post('/forgot-password', forgotPasswordValidation, async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg
    });
  }

  console.log('🔑 Forgot password request for:', req.body.email);
  const { email } = req.body;

  // Always return success for security reasons (don't reveal if email exists)
  res.json({
    success: true,
    message: 'If the account exists, a password reset notification has been sent to administrators.'
  });

  try {
    // Check if user exists
    db.get('SELECT id, username, email FROM users WHERE email = ?', [email], async (err, user) => {
      if (err || !user) {
        // Don't reveal if user exists or not
        console.log('Password reset requested for non-existent email:', email);
        return;
      }

      // Find all admin users to notify them
      db.all('SELECT id, username, role FROM users WHERE role LIKE ?', ['%ADMIN%'], async (err, admins) => {
        if (err || !admins || admins.length === 0) {
          console.error('❌ Error finding admins or no admins found:', err);
          return;
        }

        // Create notifications for all admins
        for (const admin of admins) {
          await createNotification(
            admin.id,
            'password_reset_request',
            `Password reset requested for ${user.email}`,
            `/users?email=${user.email}`,
            null,
            user.id
          );
        }

        console.log(`✅ Password reset notifications sent to ${admins.length} admin(s)`);
      });
    });
  } catch (error) {
    console.error('❌ Forgot password error:', error);
    // Still return success to prevent email enumeration
  }
});

// Refresh token endpoint
router.post('/refresh', authenticateToken, (req, res) => {
  // Generate new token
  const newToken = generateToken(req.user);

  // Set new token in cookie
  res.cookie('authToken', newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
  });

  res.json({
    success: true,
    token: newToken,
    message: 'Token refreshed successfully'
  });
});

module.exports = router;
