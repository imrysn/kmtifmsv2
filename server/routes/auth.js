const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const { logActivity } = require('../utils/logger');

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
    const userRole = user.role;
    if (loginType === 'user') {
      // User window: USER and TEAM LEADER can access
      if (userRole === 'ADMIN') {
        console.log('❌ ADMIN user trying to access user window');
        return res.status(403).json({
          success: false,
          message: 'Admin accounts must use the Admin Login. Please switch to Admin Login to continue.'
        });
      }
    } else if (loginType === 'admin') {
      // Admin window: TEAM LEADER and ADMIN can access
      if (userRole === 'USER') {
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
      panelType = 'user'; // Both USER and TEAM LEADER get user panel via user login
    } else if (loginType === 'admin') {
      if (userRole === 'TEAM LEADER') {
        panelType = 'teamleader';
      } else if (userRole === 'ADMIN') {
        panelType = 'admin';
      }
    }

    console.log(`✅ Login successful for ${userRole} -> ${panelType} panel`);

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

module.exports = router;
