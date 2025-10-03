const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const { logActivity } = require('../utils/logger');
const { getCache, setCache, clearCache } = require('../utils/cache');

const router = express.Router();

// Get all users (Admin only) with caching
router.get('/', (req, res) => {
  const cacheKey = 'all_users';
  const cachedUsers = getCache(cacheKey);

  if (cachedUsers) {
    console.log('✅ Retrieved users from cache');
    return res.json({ success: true, users: cachedUsers });
  }

  console.log('📈 Getting all users...');
  db.all('SELECT id, fullName, username, email, role, team, created_at FROM users ORDER BY created_at DESC', [], (err, users) => {
    if (err) {
      console.error('❌ Database error getting users:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch users'
      });
    }
    console.log(`✅ Retrieved ${users.length} users`);
    setCache(cacheKey, users);
    res.json({
      success: true,
      users
    });
  });
});

// Create new user (Admin only)
router.post('/', (req, res) => {
  const { fullName, username, email, password, role = 'USER', team = 'General', adminId, adminUsername, adminRole, adminTeam } = req.body;
  console.log('👥 Creating new user:', { fullName, username, email, role, team });

  // Validation
  if (!fullName || !username || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Full name, username, email, and password are required'
    });
  }

  // Hash password
  const hashedPassword = bcrypt.hashSync(password, 10);
  db.run(
    'INSERT INTO users (fullName, username, email, password, role, team) VALUES (?, ?, ?, ?, ?, ?)',
    [fullName, username, email, hashedPassword, role, team],
    function(err) {
      if (err) {
        console.error('❌ Error creating user:', err);
        if (err.code === 'ER_DUP_ENTRY' || err.code === 'SQLITE_CONSTRAINT') {
          return res.status(409).json({
            success: false,
            message: 'Username or email already exists'
          });
        }
        return res.status(500).json({
          success: false,
          message: 'Failed to create user'
        });
      }
      console.log(`✅ User created with ID: ${this.lastID}`);

      // Clear cache since users list changed
      clearCache('all_users');

      // Log activity using admin's information
      logActivity(
        db,
        adminId || null,
        adminUsername || 'Administrator',
        adminRole || 'ADMIN',
        adminTeam || 'System',
        `User account created by administrator: ${fullName} (${username})`
      );
      res.status(201).json({
        success: true,
        message: 'User created successfully',
        userId: this.lastID
      });
    }
  );
});

// Update user (Admin only)
router.put('/:id', (req, res) => {
  const userId = req.params.id;
  const { fullName, username, email, role, team, adminId, adminUsername, adminRole, adminTeam } = req.body;
  console.log(`✏️ Updating user ${userId}:`, { fullName, username, email, role, team });

  // Validation
  if (!fullName || !username || !email || !role) {
    return res.status(400).json({
      success: false,
      message: 'Full name, username, email, and role are required'
    });
  }

  // First, check if user exists and get current data
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, currentUser) => {
    if (err) {
      console.error('❌ Error fetching user:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch user data'
      });
    }
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Perform the update with explicit transaction
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        console.error('❌ Error beginning transaction:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to update user'
        });
      }

      db.run(
        'UPDATE users SET fullName = ?, username = ?, email = ?, role = ?, team = ? WHERE id = ?',
        [fullName, username, email, role, team || 'General', userId],
        function(err) {
          if (err) {
            console.error('❌ Error updating user:', err);
            // Rollback on error
            db.run('ROLLBACK', (rollbackErr) => {
              if (rollbackErr) {
                console.error('❌ Error rolling back:', rollbackErr);
              }
            });
            if (err.code === 'ER_DUP_ENTRY' || err.code === 'SQLITE_CONSTRAINT') {
              return res.status(409).json({
                success: false,
                message: 'Username or email already exists'
              });
            }
            return res.status(500).json({
              success: false,
              message: 'Failed to update user'
            });
          }
          if (this.changes === 0) {
            db.run('ROLLBACK');
            return res.status(404).json({
              success: false,
              message: 'User not found or no changes made'
            });
          }

          // Commit the transaction
          db.run('COMMIT', (commitErr) => {
            if (commitErr) {
              console.error('❌ Error committing transaction:', commitErr);
              return res.status(500).json({
                success: false,
                message: 'Failed to commit changes'
              });
            }

            // Clear cache since users list changed
            clearCache('all_users');

            console.log(`✅ User ${userId} updated successfully - ${this.changes} row(s) affected`);
            console.log(`   Old values: ${currentUser.fullName} (${currentUser.username}) - ${currentUser.role} - ${currentUser.team}`);
            console.log(`   New values: ${fullName} (${username}) - ${role} - ${team || 'General'}`);

            // Log activity using admin's information
            logActivity(
              db,
              adminId || null,
              adminUsername || 'Administrator',
              adminRole || 'ADMIN',
              adminTeam || 'System',
              `User profile updated by administrator (Name: ${fullName}, Role: ${role}, Team: ${team || 'General'})`
            );
            res.json({
              success: true,
              message: 'User updated successfully',
              updatedUser: {
                id: userId,
                fullName,
                username,
                email,
                role,
                team: team || 'General'
              }
            });
          });
        }
      );
    });
  });
});

// Reset user password (Admin only)
router.put('/:id/password', (req, res) => {
  const userId = req.params.id;
  const { password, adminId, adminUsername, adminRole, adminTeam } = req.body;
  console.log(`🔐 Resetting password for user ${userId}`);

  if (!password || password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters long'
    });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  db.run(
    'UPDATE users SET password = ? WHERE id = ?',
    [hashedPassword, userId],
    function(err) {
      if (err) {
        console.error('❌ Error resetting password:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to reset password'
        });
      }
      if (this.changes === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      console.log(`✅ Password reset for user ${userId}`);

      // Get user details for logging the affected user's name
      db.get('SELECT username, fullName FROM users WHERE id = ?', [userId], (err, userDetails) => {
        if (!err && userDetails) {
          // Log activity using admin's information
          logActivity(
            db,
            adminId || null,
            adminUsername || 'Administrator',
            adminRole || 'ADMIN',
            adminTeam || 'System',
            `Password reset by administrator for user: ${userDetails.fullName} (${userDetails.username})`
          );
        }
      });
      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    }
  );
});

// Delete user (Admin only)
router.delete('/:id', (req, res) => {
  const userId = req.params.id;
  const { adminId, adminUsername, adminRole, adminTeam } = req.body;
  console.log(`🗑️ Deleting user ${userId}`);

  // First check if user exists and get their info
  db.get('SELECT fullName, email FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      console.error('❌ Error checking user:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete user'
      });
    }
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete the user
    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
      if (err) {
        console.error('❌ Error deleting user:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to delete user'
        });
      }

      // Clear cache since users list changed
      clearCache('all_users');

      console.log(`✅ User deleted: ${user.fullName} (${user.email})`);

      // Log activity using admin's information
      logActivity(
        db,
        adminId || null,
        adminUsername || 'Administrator',
        adminRole || 'ADMIN',
        adminTeam || 'System',
        `User account deleted by administrator: ${user.fullName} (${user.email})`
      );
      res.json({
        success: true,
        message: `User ${user.fullName} deleted successfully`
      });
    });
  });
});

// Search users (Admin only)
router.get('/search', (req, res) => {
  const { q } = req.query;
  if (!q || q.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Search query is required'
    });
  }
  console.log(`🔍 Searching users with query: ${q}`);
  const searchPattern = `%${q}%`;
  db.all(
    `SELECT id, fullName, username, email, role, team, created_at
     FROM users
     WHERE fullName LIKE ? OR username LIKE ? OR email LIKE ? OR role LIKE ? OR team LIKE ?
     ORDER BY fullName`,
    [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern],
    (err, users) => {
      if (err) {
        console.error('❌ Error searching users:', err);
        return res.status(500).json({
          success: false,
          message: 'Search failed'
        });
      }
      console.log(`✅ Found ${users.length} users matching '${q}'`);
      res.json({
        success: true,
        users
      });
    }
  );
});

module.exports = router;
