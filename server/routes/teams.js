const express = require('express');
const { db } = require('../config/database');
const { logActivity } = require('../utils/logger');

const router = express.Router();

// Get all teams (Admin only)
router.get('/', (req, res) => {
  console.log('🏢 Getting all teams...');
  db.all('SELECT * FROM teams ORDER BY created_at DESC', [], (err, teams) => {
    if (err) {
      console.error('❌ Database error getting teams:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch teams'
      });
    }
    console.log(`✅ Retrieved ${teams.length} teams`);
    res.json({
      success: true,
      teams
    });
  });
});

// Create new team (Admin only)
router.post('/', (req, res) => {
  const { name, description, leaderId, leaderUsername, color = '#3B82F6' } = req.body;
  console.log('🏢 Creating new team:', { name, description, leaderId, leaderUsername, color });

  // Validation
  if (!name || name.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Team name is required'
    });
  }

  const now = new Date().toISOString();
  db.run(
    'INSERT INTO teams (name, description, leader_id, leader_username, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name.trim(), description || null, leaderId || null, leaderUsername || null, color, now, now],
    function(err) {
      if (err) {
        console.error('❌ Error creating team:', err);
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(409).json({
            success: false,
            message: 'Team name already exists'
          });
        }
        return res.status(500).json({
          success: false,
          message: 'Failed to create team'
        });
      }
      console.log(`✅ Team created with ID: ${this.lastID}`);

      // Log activity
      logActivity(
        db,
        null,
        'System',
        'ADMIN',
        'System',
        `Team created: ${name} (ID: ${this.lastID})`
      );
      res.status(201).json({
        success: true,
        message: 'Team created successfully',
        teamId: this.lastID,
        team: {
          id: this.lastID,
          name: name.trim(),
          description: description || null,
          leader_id: leaderId || null,
          leader_username: leaderUsername || null,
          color: color,
          is_active: 1,
          created_at: now,
          updated_at: now
        }
      });
    }
  );
});

// Update team (Admin only)
router.put('/:id', (req, res) => {
  const teamId = req.params.id;
  const { name, description, leaderId, leaderUsername, color, isActive } = req.body;
  console.log(`✏️ Updating team ${teamId}:`, { name, description, leaderId, leaderUsername, color, isActive });

  // Validation
  if (!name || name.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Team name is required'
    });
  }

  const now = new Date().toISOString();
  const activeStatus = isActive !== undefined ? (isActive ? 1 : 0) : 1;
  db.run(
    'UPDATE teams SET name = ?, description = ?, leader_id = ?, leader_username = ?, color = ?, is_active = ?, updated_at = ? WHERE id = ?',
    [name.trim(), description || null, leaderId || null, leaderUsername || null, color || '#3B82F6', activeStatus, now, teamId],
    function(err) {
      if (err) {
        console.error('❌ Error updating team:', err);
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(409).json({
            success: false,
            message: 'Team name already exists'
          });
        }
        return res.status(500).json({
          success: false,
          message: 'Failed to update team'
        });
      }
      if (this.changes === 0) {
        return res.status(404).json({
          success: false,
          message: 'Team not found'
        });
      }
      console.log(`✅ Team ${teamId} updated successfully`);

      // Log activity
      logActivity(
        db,
        null,
        'System',
        'ADMIN',
        'System',
        `Team updated: ${name} (ID: ${teamId})`
      );
      res.json({
        success: true,
        message: 'Team updated successfully'
      });
    }
  );
});

// Delete team (Admin only)
router.delete('/:id', (req, res) => {
  const teamId = req.params.id;
  console.log(`🗑️ Deleting team ${teamId}`);

  // First check if team exists and get info
  db.get('SELECT name FROM teams WHERE id = ?', [teamId], (err, team) => {
    if (err) {
      console.error('❌ Error checking team:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete team'
      });
    }
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if team has users assigned
    db.get('SELECT COUNT(*) as count FROM users WHERE team = ?', [team.name], (err, result) => {
      if (err) {
        console.error('❌ Error checking team users:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to delete team'
        });
      }
      if (result.count > 0) {
        return res.status(409).json({
          success: false,
          message: `Cannot delete team '${team.name}' because it has ${result.count} user(s) assigned. Please reassign users to other teams first.`
        });
      }

      // Delete the team
      db.run('DELETE FROM teams WHERE id = ?', [teamId], function(err) {
        if (err) {
          console.error('❌ Error deleting team:', err);
          return res.status(500).json({
            success: false,
            message: 'Failed to delete team'
          });
        }
        console.log(`✅ Team deleted: ${team.name}`);

        // Log activity
        logActivity(
          db,
          null,
          'System',
          'ADMIN',
          'System',
          `Team deleted: ${team.name} (ID: ${teamId})`
        );
        res.json({
          success: true,
          message: `Team '${team.name}' deleted successfully`
        });
      });
    });
  });
});

// Get team by name (for user assignment validation)
router.get('/name/:name', (req, res) => {
  const { name } = req.params;
  db.get('SELECT * FROM teams WHERE name = ? AND is_active = 1', [name], (err, team) => {
    if (err) {
      console.error('❌ Error getting team by name:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch team'
      });
    }
    res.json({
      success: true,
      team: team || null,
      exists: !!team
    });
  });
});

module.exports = router;
