const express = require('express');
const bcrypt = require('bcryptjs');
const { db, query: dbQuery, queryOne: dbQueryOne } = require('../config/database');
const { logActivity, logInfo, logWarn } = require('../utils/logger');
const { getCache, setCache, clearCache } = require('../utils/cache');
const { validate, schemas, validateId } = require('../middleware/validation');
const { asyncHandler, DatabaseError, NotFoundError } = require('../middleware/errorHandler');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes in this router
router.use(authenticateToken);

/**
 * GET /api/users/profile
 * Get current user's full info including led teams
 */
router.get('/profile', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  // 1. Get user basic info
  const user = await dbQueryOne(
    'SELECT id, fullName, username, email, role, team, created_at, profile_picture FROM users WHERE id = ?',
    [userId]
  );
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  // 2. If Team Leader or Admin, get teams they lead
  let ledTeams = [];
  if (user.role === 'TEAM_LEADER' || user.role === 'ADMIN') {
    const teams = await dbQuery(
      `SELECT t.id, t.name, t.color 
       FROM team_leaders tl 
       JOIN teams t ON tl.team_id = t.id 
       WHERE tl.user_id = ?`,
      [userId]
    );
    ledTeams = teams || [];
  }
  
  res.json({
    success: true,
    user: {
      ...user,
      ledTeams
    }
  });
}));

// Shared helper: attach file counts to an array of user/member objects using a single bulk query
async function attachFileCounts(db, members) {
  if (!members || members.length === 0) return members;
  const ids = members.map(m => m.id);
  const ph = ids.map(() => '?').join(',');
  try {
    const rows = await dbQuery(
      `SELECT user_id, COUNT(*) as totalFiles FROM files WHERE user_id IN (${ph}) GROUP BY user_id`,
      ids
    );
    const countMap = {};
    (rows || []).forEach(r => { countMap[r.user_id] = r.totalFiles || 0; });
    members.forEach(m => { m.totalFiles = countMap[m.id] || 0; });
  } catch (_) {
    members.forEach(m => { m.totalFiles = 0; });
  }
  return members;
}

// Get all users (Admin only) with caching
router.get('/', authorizeRole('ADMIN'), asyncHandler(async (req, res) => {
  const cacheKey = 'all_users';
  const cachedUsers = getCache(cacheKey);

  if (cachedUsers) {
    console.log('✅ Retrieved users from cache');
    return res.json({ success: true, users: cachedUsers });
  }

  console.log('📈 Getting all users...');
  try {
    const users = await dbQuery(
      'SELECT id, fullName, username, email, role, team, created_at FROM users ORDER BY created_at DESC'
    );
    console.log(`✅ Retrieved ${users.length} users`);
    setCache(cacheKey, users);
    res.json({ success: true, users });
  } catch (err) {
    console.error('❌ Database error getting users:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: err.message
    });
  }
}));

// Create new user (Admin only)
router.post('/', authorizeRole('ADMIN'), validate(schemas.createUser), asyncHandler(async (req, res) => {
  let { fullName, username, email, password, role = 'USER', team = 'General', adminId, adminUsername, adminRole, adminTeam } = req.body;
  role = (role || 'USER').toString().trim().toUpperCase();
  team = (team || 'General').toString().trim();
  logInfo('Creating new user', { fullName, username, email, role, team });

  const hashedPassword = bcrypt.hashSync(password, 10);

  let newUserId;
  try {
    const result = await dbQuery(
      'INSERT INTO users (fullName, username, email, password, role, team) VALUES (?, ?, ?, ?, ?, ?)',
      [fullName, username, email, hashedPassword, role, team]
    );
    newUserId = result?.insertId || null;
  } catch (err) {
    console.error('❌ Error creating user:', err);
    if (err.code === 'ER_DUP_ENTRY' || err.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ success: false, message: 'Username or email already exists' });
    }
    return res.status(500).json({ success: false, message: 'Failed to create user' });
  }

  console.log(`✅ User created with ID: ${newUserId}`);
  clearCache('all_users');

  logActivity(
    db,
    adminId || null,
    adminUsername || 'Administrator',
    adminRole || 'ADMIN',
    adminTeam || 'System',
    `User account created by administrator: ${fullName} (${username})`
  );

  // Assign Team Leader to team if applicable
  if (role === 'TEAM_LEADER' && team && newUserId) {
    try {
      const teamRow = await dbQueryOne('SELECT id, leader_id FROM teams WHERE name = ?', [team]);
      if (teamRow) {
        await dbQuery(
          'INSERT INTO team_leaders (team_id, user_id, username) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE username = VALUES(username)',
          [teamRow.id, newUserId, username]
        );
        console.log(`✅ Assigned ${username} (ID: ${newUserId}) as leader for team '${team}'`);
        if (!teamRow.leader_id) {
          await dbQuery('UPDATE teams SET leader_id = ?, leader_username = ? WHERE id = ?', [newUserId, username, teamRow.id]);
        }
      } else {
        console.log(`⚠️ Team '${team}' not found; skipping leader assignment`);
      }
    } catch (err) {
      console.error('❌ Error assigning team leader:', err);
    }
  }

  res.status(201).json({ success: true, message: 'User created successfully', userId: newUserId });
}));

// Update user (Admin only)
router.put('/:id', authorizeRole('ADMIN'), asyncHandler(async (req, res) => {
  const userId = req.params.id;
  let { fullName, username, email, role, team, adminId, adminUsername, adminRole, adminTeam } = req.body;
  role = (role || '').toString().trim().toUpperCase();
  team = (team || 'General').toString().trim();
  console.log(`✏️ Updating user ${userId}:`, { fullName, username, email, role, team });

  if (!fullName || !username || !email || !role) {
    return res.status(400).json({ success: false, message: 'Full name, username, email, and role are required' });
  }

  const currentUser = await dbQueryOne('SELECT * FROM users WHERE id = ?', [userId]);
  if (!currentUser) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  try {
    const result = await dbQuery(
      'UPDATE users SET fullName = ?, username = ?, email = ?, role = ?, team = ? WHERE id = ?',
      [fullName, username, email, role, team || 'General', userId]
    );
    const rowsAffected = result?.affectedRows || 0;
    if (!rowsAffected) {
      return res.status(404).json({ success: false, message: 'User not found or no changes made' });
    }
  } catch (err) {
    console.error('❌ Error updating user:', err);
    if (err.code === 'ER_DUP_ENTRY' || err.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ success: false, message: 'Username or email already exists' });
    }
    return res.status(500).json({ success: false, message: 'Failed to update user' });
  }

  clearCache('all_users');
  console.log(`✅ User ${userId} updated — ${currentUser.role}→${role}, ${currentUser.team}→${team}`);

  // Handle Team Leader assignment changes
  try {
    if (role === 'TEAM_LEADER') {
      const teamRow = await dbQueryOne('SELECT id, leader_id FROM teams WHERE name = ?', [team]);
      if (teamRow) {
        await dbQuery(
          'INSERT IGNORE INTO team_leaders (team_id, user_id, username) VALUES (?, ?, ?)',
          [teamRow.id, userId, username]
        );
        if (!teamRow.leader_id) {
          await dbQuery('UPDATE teams SET leader_id = ?, leader_username = ? WHERE id = ?', [userId, username, teamRow.id]);
        }
      }
    }
    if (currentUser.role === 'TEAM_LEADER' && role !== 'TEAM_LEADER') {
      await dbQuery('DELETE FROM team_leaders WHERE user_id = ?', [userId]);
      await dbQuery('UPDATE teams SET leader_id = NULL, leader_username = NULL WHERE leader_id = ?', [userId]);
    }
  } catch (err) {
    console.error('❌ Error handling team leader assignment during user update:', err);
  }

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
    updatedUser: { id: userId, fullName, username, email, role, team: team || 'General' }
  });
}));

// Reset user password (Admin only)
router.put('/:id/password', authorizeRole('ADMIN'), validateId(), validate(schemas.resetPassword), asyncHandler(async (req, res) => {
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
router.delete('/:id', authorizeRole('ADMIN'), asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const { adminId, adminUsername, adminRole, adminTeam } = req.body;
  console.log(`🗑️ Deleting user ${userId}`);

  const user = await dbQueryOne('SELECT fullName, email FROM users WHERE id = ?', [userId]);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  try {
    await dbQuery('DELETE FROM users WHERE id = ?', [userId]);
  } catch (err) {
    console.error('❌ Error deleting user:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete user' });
  }

  clearCache('all_users');
  console.log(`✅ User deleted: ${user.fullName} (${user.email})`);

  logActivity(
    db,
    adminId || null,
    adminUsername || 'Administrator',
    adminRole || 'ADMIN',
    adminTeam || 'System',
    `User account deleted by administrator: ${user.fullName} (${user.email})`
  );

  res.json({ success: true, message: `User ${user.fullName} deleted successfully` });
}));

// Get team members (Team Leader and Admin)
router.get('/team/:teamName', authorizeRole(['TEAM_LEADER', 'ADMIN']), asyncHandler(async (req, res) => {
  const { teamName } = req.params;
  if (req.user.role === 'TEAM_LEADER' && req.user.team !== teamName) {
    return res.status(403).json({ success: false, message: 'Access denied: You do not lead this team' });
  }
  console.log(`👥 Getting team members for team: ${teamName}`);
  const members = await dbQuery(
    'SELECT id, fullName, username, email, role, team, created_at FROM users WHERE team = ? AND role != ? ORDER BY fullName',
    [teamName, 'TEAM_LEADER']
  );
  console.log(`✅ Retrieved ${members.length} members for team ${teamName}`);
  await attachFileCounts(db, members);
  res.json({ success: true, members });
}));

// Search users (Admin only)
router.get('/search', authorizeRole('ADMIN'), asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim() === '') {
    return res.status(400).json({ success: false, message: 'Search query is required' });
  }
  console.log(`🔍 Searching users with query: ${q}`);
  const searchPattern = `%${q}%`;
  const users = await dbQuery(
    `SELECT id, fullName, username, email, role, team, created_at
     FROM users
     WHERE fullName LIKE ? OR username LIKE ? OR email LIKE ? OR role LIKE ? OR team LIKE ?
     ORDER BY fullName`,
    [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern]
  );
  console.log(`✅ Found ${users.length} users matching '${q}'`);
  res.json({ success: true, users });
}));

// Get team members for a team leader (across all led teams)
router.get('/team-leader/:userId', authorizeRole(['TEAM_LEADER', 'ADMIN']), asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (req.user.id !== parseInt(userId) && req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }
  console.log(`👥 Getting team members for team leader: ${userId}`);

  const ledTeams = await dbQuery(
    `SELECT DISTINCT t.name FROM team_leaders tl JOIN teams t ON tl.team_id = t.id WHERE tl.user_id = ?`,
    [userId]
  );

  if (!ledTeams || ledTeams.length === 0) {
    return res.json({ success: true, members: [] });
  }

  const teamNames = ledTeams.map(t => t.name);
  const placeholders = teamNames.map(() => '?').join(',');
  const members = await dbQuery(
    `SELECT id, fullName, username, email, role, team, created_at
     FROM users WHERE team IN (${placeholders}) AND role != ? ORDER BY fullName`,
    [...teamNames, 'TEAM_LEADER']
  );
  console.log(`✅ Retrieved ${members.length} members across teams: ${teamNames.join(', ')}`);
  await attachFileCounts(db, members);
  res.json({ success: true, members });
}));

// Get all mentionable users for @mention dropdown in comments
// NOTE: Defined before /:teamName to prevent the catch-all from swallowing this route
router.get('/mentionable', (req, res) => {
  db.all(
    `SELECT id, username, fullName, role FROM users
     WHERE role IN ('ADMIN', 'TEAM_LEADER', 'USER')
     ORDER BY
       CASE role
         WHEN 'ADMIN'       THEN 1
         WHEN 'TEAM_LEADER' THEN 2
         ELSE 3
       END,
       fullName ASC`,
    [],
    (err, users) => {
      if (err) {
        console.error('❌ Error fetching mentionable users:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch users' });
      }
      res.json({ success: true, users: users || [] });
    }
  );
});

// Get team members - Direct route (supports /api/users/:teamName)
// IMPORTANT: This must be LAST to avoid conflicts with other named routes
router.get('/:teamName', authorizeRole(['TEAM_LEADER', 'ADMIN']), asyncHandler(async (req, res) => {
  const { teamName } = req.params;
  if (req.user.role === 'TEAM_LEADER' && req.user.team !== teamName) {
    return res.status(403).json({ success: false, message: 'Access denied: You do not lead this team' });
  }
  console.log(`👥 Getting team members for team: ${teamName}`);
  const members = await dbQuery(
    'SELECT id, fullName, username, email, role, team, created_at FROM users WHERE team = ? AND role != ? ORDER BY fullName',
    [teamName, 'TEAM_LEADER']
  );
  console.log(`✅ Retrieved ${members.length} members for team ${teamName}`);
  await attachFileCounts(db, members);
  res.json({ success: true, members });
}));

module.exports = router;
