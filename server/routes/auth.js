const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const { logActivity } = require('../utils/logger');
const { createNotification } = require('./notifications');

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Login endpoint
router.post('/login', (req, res) => {
  console.log('🔐 Login attempt for:', req.body.email, 'via', req.body.loginType || 'user', 'window');
  const { email, password, loginType = 'user' } = req.body;

  // Basic validation
  if (!email || !password) {
    console.log('❌ Missing email or password');
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }
  if (!['user', 'admin'].includes(loginType)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid login type'
    });
  }

  // Find user by email OR username
  const query = email.includes('@')
    ? 'SELECT * FROM users WHERE email = ?'
    : 'SELECT * FROM users WHERE username = ?';

  db.get(query, [email], (err, user) => {
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
    const isValidPassword = bcrypt.compareSync(password, user.password);
    if (!isValidPassword) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    console.log(`✅ Password verified for ${user.role}: ${email}`);

    // Role-based access control
    // Normalize role to handle both 'TEAM LEADER' and 'TEAM_LEADER' variants stored in DB
    const rawRole = (user.role || '').toString().trim().toUpperCase();
    const normalizedRole = rawRole.replace(/\s+/g, '_'); // e.g. 'TEAM LEADER' -> 'TEAM_LEADER'

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
  });
});

// Forgot password endpoint
router.post('/forgot-password', async (req, res) => {
  console.log('🔑 Forgot password request for:', req.body.email);
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required'
    });
  }

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
      console.log('⚠️ User not found for password reset:', email);
      return; // Still return success to client for security
    }

    console.log('👤 Found requesting user:', requestingUser.username);

    // Find all admin users to notify them
    const adminQuery = 'SELECT id, username, role FROM users WHERE role LIKE ?';
    const adminUsers = await new Promise((resolve, reject) => {
      db.all(adminQuery, ['%ADMIN%'], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    console.log(`👤 Found ${adminUsers.length} admin users to notify`);

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

      console.log(`✅ Created password reset notification for admin ${admin.username}`);
    });

    await Promise.all(notificationPromises);

    // Log the attempt
    console.log(`🔐 Password reset request logged: "${email}" - notified ${adminUsers.length} admins`);

  } catch (error) {
    console.error('❌ Error processing forgot password request:', error);
    // Don't send error to client for security
  }
});

module.exports = router;
