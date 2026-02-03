const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const { logActivity, logInfo, logWarn } = require('../utils/logger');
const { getCache, setCache, clearCache } = require('../utils/cache');
const { validate, schemas, validateId } = require('../middleware/validation');
const { asyncHandler, DatabaseError, NotFoundError } = require('../middleware/errorHandler');

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

router.post('/', validate(schemas.createUser), asyncHandler(async (req, res) => {
  const { fullName, username, email, password, adminId, adminUsername, adminRole, adminTeam } = req.body;
  const role = (req.body.role || 'USER').toString().trim().toUpperCase();
  const team = (req.body.team || 'General').toString().trim();
  logInfo('Creating new user', { fullName, username, email, role, team });

  // Hash password
  const hashedPassword = bcrypt.hashSync(password, 10);
  db.run(
    'INSERT INTO users (fullName, username, email, password, role, team) VALUES (?, ?, ?, ?, ?, ?)',
    [fullName, username, email, hashedPassword, role, team],
    function (err, result) {
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
      // For SQLite callback style, result may be undefined and 'this' contains lastID. For MySQL, result.insertId is available.
      const newUserId = (result && (result.insertId || result.insert_id)) || (this && this.lastID) || null;
      console.log(`✅ User created with ID: ${newUserId}`);

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

      // If the new user is a Team Leader and a team is specified, set the team's leader
      if (role === 'TEAM LEADER' && team) {
        db.get('SELECT id FROM teams WHERE name = ?', [team], (err, teamRow) => {
          if (!err && teamRow) {
            db.run('UPDATE teams SET leader_id = ?, leader_username = ? WHERE id = ?', [newUserId, username, teamRow.id], (err) => {
              if (err) {
                console.error('❌ Error assigning team leader to team:', err);
              } else {
                console.log(`✅ Assigned ${username} (ID: ${newUserId}) as leader for team '${team}'`);
              }
            });
          } else {
            console.log(`⚠️ Team '${team}' not found; skipping leader assignment`);
          }
        });
      }

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        userId: newUserId
      });
    }
  );
}));

// Update user (Admin only)
router.put('/:id', (req, res) => {
  const userId = req.params.id;
  const { fullName, username, email, role: rawRole, team: rawTeam, adminId, adminUsername, adminRole, adminTeam } = req.body;
  // Normalize role and team
  const role = (rawRole || '').toString().trim().toUpperCase();
  const team = (rawTeam || 'General').toString().trim();
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

    // Perform a single UPDATE (no explicit SQL transaction; helper transaction is available)
    db.run(
      'UPDATE users SET fullName = ?, username = ?, email = ?, role = ?, team = ? WHERE id = ?',
      [fullName, username, email, role, team || 'General', userId],
      function (err, result) {
        if (err) {
          console.error('❌ Error updating user:', err);
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

        // Determine affected rows for SQLite (this.changes) or MySQL (result.affectedRows)
        const rowsAffected = (result && (result.affectedRows || result.affected_rows || result.length)) || (this && this.changes) || 0;
        if (!rowsAffected) {
          return res.status(404).json({
            success: false,
            message: 'User not found or no changes made'
          });
        }

        // Clear cache since users list changed
        clearCache('all_users');

        console.log(`✅ User ${userId} updated successfully - ${rowsAffected} row(s) affected`);
        console.log(`   Old values: ${currentUser.fullName} (${currentUser.username}) - ${currentUser.role} - ${currentUser.team}`);
        console.log(`   New values: ${fullName} (${username}) - ${role} - ${team || 'General'}`);

        // If role changed to TEAM LEADER, assign to team; if role changed away from TEAM LEADER, clear previous team leader entries
        try {
          if (role === 'TEAM LEADER') {
            db.get('SELECT id FROM teams WHERE name = ?', [team], (err, teamRow) => {
              if (!err && teamRow) {
                db.run('UPDATE teams SET leader_id = ?, leader_username = ? WHERE id = ?', [userId, username, teamRow.id], (err) => {
                  if (err) {
                    console.error('❌ Error assigning team leader during user update:', err);
                  } else {
                    console.log(`✅ Assigned ${username} (ID: ${userId}) as leader for team '${team}'`);
                  }
                });
              } else {
                console.log(`⚠️ Team '${team}' not found; skipping leader assignment`);
              }
            });
          }

          if (currentUser.role === 'TEAM LEADER' && role !== 'TEAM LEADER') {
            db.run('UPDATE teams SET leader_id = NULL, leader_username = NULL WHERE leader_id = ?', [userId], (err) => {
              if (err) {
                console.error('❌ Error clearing leader assignment:', err);
              } else {
                console.log(`✅ Cleared leader assignment for user ID ${userId}`);
              }
            });
          }
        } catch (err) {
          console.error('❌ Error handling team leader assignment during user update:', err);
        }

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
      }
    );
  });
});

// Reset user password (Admin only)
router.put('/:id/password', validateId(), validate(schemas.resetPassword), asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const { password, adminId, adminUsername, adminRole, adminTeam } = req.body;
  logInfo('Resetting password for user', { userId });

  const hashedPassword = bcrypt.hashSync(password, 10);

  await new Promise((resolve, reject) => {
    db.run(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId],
      function (err) {
        if (err) {
          reject(new DatabaseError('Failed to reset password', err));
        }
        if (this.changes === 0) {
          reject(new NotFoundError('User'));
        }
        resolve();
      }
    );
  });

  logInfo('Password reset successful', { userId });

  // Get user details for logging, notification, and email
  const userDetails = await new Promise((resolve, reject) => {
    db.get('SELECT username, fullName, email FROM users WHERE id = ?', [userId], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });

  if (userDetails) {
    // Log activity using admin's information
    logActivity(
      db,
      adminId || null,
      adminUsername || 'Administrator',
      adminRole || 'ADMIN',
      adminTeam || 'System',
      `Password reset by administrator for user: ${userDetails.fullName} (${userDetails.username})`
    );

    // Create in-app notification for the user
    try {
      const { createNotification } = require('./notifications');
      const notificationMessage = `Your password has been reset by ${adminUsername || 'Administrator'}. You can now log in with your new password.`;

      await createNotification(
        userId,                          // userId (user whose password was reset)
        null,                            // fileId (no file associated)
        'password_reset_complete',       // type
        'Password Reset Complete',       // title
        notificationMessage,             // message
        adminId || null,                 // actionById (admin who reset the password)
        adminUsername || 'Administrator', // actionByUsername
        adminRole || 'ADMIN',            // actionByRole
        null                             // assignmentId (no assignment)
      );

      logInfo('Password reset notification sent to user', { userId, username: userDetails.username });
    } catch (notifError) {
      // Log error but don't fail the password reset
      console.error('❌ Failed to create password reset notification:', notifError);
    }

    // Send email notification to user
    try {
      const { sendPasswordResetEmail } = require('../utils/email');

      const emailResult = await sendPasswordResetEmail(
        userDetails.email,
        userDetails.fullName || userDetails.username,
        adminUsername || 'Administrator'
      );

      if (emailResult.success) {
        logInfo('Password reset email sent', { userId, email: userDetails.email });
      } else {
        logWarn('Failed to send password reset email', { userId, reason: emailResult.message || emailResult.error });
      }
    } catch (emailError) {
      // Log error but don't fail the password reset
      console.error('❌ Failed to send password reset email:', emailError);
      logWarn('Password reset email failed', { userId, error: emailError.message });
    }
  }

  res.json({
    success: true,
    message: 'Password reset successfully'
  });
}));

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
    db.run('DELETE FROM users WHERE id = ?', [userId], function (err) {
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

// Get team members (Team Leader only)
router.get('/team/:teamName', (req, res) => {
  const { teamName } = req.params;
  console.log(`👥 Getting team members for team: ${teamName}`);

  db.all(
    'SELECT id, fullName, username, email, role, team, created_at FROM users WHERE team = ? AND role != ? ORDER BY fullName',
    [teamName, 'TEAM LEADER'],
    (err, members) => {
      if (err) {
        console.error('❌ Error getting team members:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch team members'
        });
      }
      console.log(`✅ Retrieved ${members.length} members for team ${teamName}`);

      // Get file counts for each member
      const memberPromises = members.map(member => {
        return new Promise((resolve) => {
          db.get(
            'SELECT COUNT(*) as totalFiles FROM files WHERE user_id = ?',
            [member.id],
            (err, result) => {
              if (!err && result) {
                member.totalFiles = result.totalFiles || 0;
              } else {
                member.totalFiles = 0;
              }
              resolve(member);
            }
          );
        });
      });

      Promise.all(memberPromises).then(membersWithFiles => {
        res.json({
          success: true,
          members: membersWithFiles
        });
      });
    }
  );
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

// Get team members - Direct route (supports /api/team-members/:teamName)
// IMPORTANT: This must be LAST to avoid conflicts with other routes
router.get('/:teamName', (req, res) => {
  const { teamName } = req.params;
  console.log(`👥 Getting team members for team: ${teamName}`);

  db.all(
    'SELECT id, fullName, username, email, role, team, created_at FROM users WHERE team = ? AND role != ? ORDER BY fullName',
    [teamName, 'TEAM LEADER'],
    (err, members) => {
      if (err) {
        console.error('❌ Error getting team members:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch team members'
        });
      }
      console.log(`✅ Retrieved ${members.length} members for team ${teamName}`);

      // Get file counts for each member
      const memberPromises = members.map(member => {
        return new Promise((resolve) => {
          db.get(
            'SELECT COUNT(*) as totalFiles FROM files WHERE user_id = ?',
            [member.id],
            (err, result) => {
              if (!err && result) {
                member.totalFiles = result.totalFiles || 0;
              } else {
                member.totalFiles = 0;
              }
              resolve(member);
            }
          );
        });
      });

      Promise.all(memberPromises).then(membersWithFiles => {
        res.json({
          success: true,
          members: membersWithFiles
        });
      });
    }
  );
});

module.exports = router;
