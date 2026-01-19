const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const { logActivity, logError, logInfo } = require('../utils/logger');
const { createNotification } = require('./notifications');
const { validate, schemas } = require('../middleware/validation');
const { asyncHandler, AuthenticationError, NotFoundError } = require('../middleware/errorHandler');

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Login endpoint
router.post('/login', validate(schemas.login), asyncHandler(async (req, res) => {
  const { email, password, loginType = 'user' } = req.body;

  logInfo('Login attempt', { email, loginType });

  // Find user by email OR username
  const query = email.includes('@')
    ? 'SELECT * FROM users WHERE email = ?'
    : 'SELECT * FROM users WHERE username = ?';

  const user = await new Promise((resolve, reject) => {
    db.get(query, [email], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (!user) {
    logInfo('Login failed - user not found', { email });
    throw new AuthenticationError('Invalid email or password');
  }

  // Verify password
  const isValidPassword = bcrypt.compareSync(password, user.password);
  if (!isValidPassword) {
    logInfo('Login failed - invalid password', { email });
    throw new AuthenticationError('Invalid email or password');
  }

  logInfo('Password verified', { userId: user.id, role: user.role });

  // Role-based access control
  const rawRole = (user.role || '').toString().trim().toUpperCase();
  const normalizedRole = rawRole.replace(/\s+/g, '_');

  if (loginType === 'user') {
    // User window: USER and TEAM_LEADER can access. ADMIN must use Admin Login.
    if (normalizedRole === 'ADMIN') {
      logInfo('Admin attempted user window access', { userId: user.id });
      throw new AuthenticationError('Please switch to Admin Login to continue.');
    }
  } else if (loginType === 'admin') {
    // Admin window: TEAM_LEADER and ADMIN can access
    if (normalizedRole === 'USER') {
      logInfo('User attempted admin window access', { userId: user.id });
      throw new AuthenticationError('You do not have permission to access the Admin Login. Please use the User Login instead.');
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

  logInfo('Login successful', { userId: user.id, role: user.role, panelType });

  // Log activity
  logActivity(
    db,
    user.id,
    user.username,
    user.role,
    user.team,
    `User logged in via ${loginType} portal`
  );

  // Remove password from user object before sending response
  const { password: _, ...userWithoutPassword } = user;
  res.json({
    success: true,
    user: {
      ...userWithoutPassword,
      panelType
    },
    message: 'Login successful'
  });
}));

// Forgot password endpoint
router.post('/forgot-password', validate(schemas.forgotPassword), asyncHandler(async (req, res) => {
  const { email } = req.body;

  logInfo('Forgot password request', { email });

  // Always return success for security reasons (don't reveal if email exists)
  res.json({
    success: true,
    message: 'If the account exists, a password reset email has been sent.'
  });

  try {
    // First, find the user who is requesting the reset (by email or username)
    const userQuery = email.includes('@')
      ? 'SELECT id, username, fullName, email FROM users WHERE email = ?'
      : 'SELECT id, username, fullName, email FROM users WHERE username = ?';

    const requestingUser = await new Promise((resolve, reject) => {
      db.get(userQuery, [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!requestingUser) {
      logInfo('Password reset - user not found', { email });
      return; // Still return success to client for security
    }

    logInfo('Password reset - user found', { userId: requestingUser.id, username: requestingUser.username });

    // Find all admin users to notify them
    const adminQuery = 'SELECT id, username, role FROM users WHERE role LIKE ?';
    const adminUsers = await new Promise((resolve, reject) => {
      db.all(adminQuery, ['%ADMIN%'], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    logInfo('Password reset - notifying admins', { adminCount: adminUsers.length });

    // Create notification for each admin user
    const notificationPromises = adminUsers.map(async (admin) => {
      const notificationMessage = `${requestingUser.fullName || requestingUser.username} (${requestingUser.email}) has requested a password reset.`;

      // Create a notification with password_reset_request type
      await createNotification(
        admin.id,                    // userId (admin receiving notification)
        null,                        // fileId (no file associated)
        'password_reset_request',    // type
        'Password Reset Request',    // title
        notificationMessage,         // message (contains requesting user info)
        requestingUser.id,           // actionById (user who requested reset)
        requestingUser.username,     // actionByUsername
        'USER',                      // actionByRole
        null                         // assignmentId (no assignment)
      );

      logInfo('Password reset notification created', { adminId: admin.id, adminUsername: admin.username });
    });

    await Promise.all(notificationPromises);

    logInfo('Password reset request completed', { email, notifiedAdmins: adminUsers.length });

  } catch (error) {
    logError(error, { context: 'forgot-password', email });
    // Don't send error to client for security
  }
}));

module.exports = router;
