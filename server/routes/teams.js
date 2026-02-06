const express = require('express');
const { db } = require('../config/database');
const { logActivity } = require('../utils/logger');

const router = express.Router();

// Get all teams (Admin only)
router.get('/', (req, res) => {
  console.log('🏢 Getting all teams...');

  // First get all teams
  db.all('SELECT * FROM teams ORDER BY created_at DESC', [], (err, teams) => {
    if (err) {
      console.error('❌ Database error getting teams:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch teams'
      });
    }

    // For each team, get its leaders
    const teamPromises = teams.map(team => {
      return new Promise((resolve) => {
        db.all(
          `SELECT tl.user_id, tl.username, u.fullName 
           FROM team_leaders tl 
           LEFT JOIN users u ON tl.user_id = u.id 
           WHERE tl.team_id = ?`,
          [team.id],
          (err, leaders) => {
            if (err) {
              console.error(`❌ Error getting leaders for team ${team.id}:`, err);
              team.leaders = [];
            } else {
              team.leaders = leaders || [];
            }
            // Keep backward compatibility
            if (team.leaders.length > 0) {
              team.leader_id = team.leaders[0].user_id;
              team.leader_username = team.leaders[0].username;
            }
            resolve(team);
          }
        );
      });
    });

    Promise.all(teamPromises).then(teamsWithLeaders => {
      console.log(`✅ Retrieved ${teamsWithLeaders.length} teams`);
      res.json({
        success: true,
        teams: teamsWithLeaders
      });
    });
  });
});

// Create new team (Admin only)
router.post('/', (req, res) => {
  const { name, description, leaderIds = [], color = '#3B82F6' } = req.body;
  console.log('🏢 Creating new team:', { name, description, leaderIds, color });

  // Validation
  if (!name || name.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Team name is required'
    });
  }

  const now = new Date().toISOString();

  // Insert team record (leader_id kept for backward compatibility)
  db.run(
    'INSERT INTO teams (name, description, leader_id, leader_username, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name.trim(), description || null, null, null, color, now, now],
    function (err) {
      if (err) {
        console.error('❌ Error creating team:', err);
        if (err.code === 'ER_DUP_ENTRY' || err.code === 'SQLITE_CONSTRAINT') {
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

      const teamId = this.lastID;
      console.log(`✅ Team created with ID: ${teamId}`);

      // Insert team leaders if any
      if (leaderIds && leaderIds.length > 0) {
        console.log(`📝 Assigning ${leaderIds.length} team leader(s)...`);

        // Get user details for the leaders
        const placeholders = leaderIds.map(() => '?').join(',');
        db.all(
          `SELECT id, username FROM users WHERE id IN (${placeholders}) AND role IN ('TEAM LEADER', 'ADMIN')`,
          leaderIds,
          (err, users) => {
            if (err) {
              console.error('❌ Error fetching leader details:', err);
              return finishCreation(teamId, name, null, null);
            }

            if (users.length === 0) {
              console.log('⚠️  No valid team leaders found');
              return finishCreation(teamId, name, null, null);
            }

            // Insert into team_leaders table
            let completed = 0;
            let firstLeader = users[0];

            users.forEach((user, index) => {
              db.run(
                'INSERT INTO team_leaders (team_id, user_id, username) VALUES (?, ?, ?)',
                [teamId, user.id, user.username],
                (err) => {
                  if (err) {
                    console.error(`❌ Error assigning leader ${user.username}:`, err);
                  } else {
                    console.log(`✅ Assigned ${user.username} as team leader`);

                    // Automatically update user's team to match the team they're leading
                    db.run(
                      'UPDATE users SET team = ? WHERE id = ?',
                      [name.trim(), user.id],
                      (updateErr) => {
                        if (updateErr) {
                          console.error(`❌ Error updating team for ${user.username}:`, updateErr);
                        } else {
                          console.log(`✅ Updated ${user.username}'s team to ${name.trim()}`);
                        }
                      }
                    );
                  }

                  completed++;
                  if (completed === users.length) {
                    // Update team's leader_id for backward compatibility (use first leader)
                    db.run(
                      'UPDATE teams SET leader_id = ?, leader_username = ? WHERE id = ?',
                      [firstLeader.id, firstLeader.username, teamId],
                      (err) => {
                        if (err) console.error('❌ Error updating team leader_id:', err);
                        finishCreation(teamId, name, firstLeader.id, firstLeader.username);
                      }
                    );
                  }
                }
              );
            });
          }
        );
      } else {
        finishCreation(teamId, name, null, null);
      }

      function finishCreation(teamId, name, leaderId, leaderUsername) {
        // Log activity
        logActivity(
          db,
          null,
          'System',
          'ADMIN',
          'System',
          `Team created: ${name} (ID: ${teamId})`
        );

        res.status(201).json({
          success: true,
          message: 'Team created successfully',
          teamId: teamId,
          team: {
            id: teamId,
            name: name.trim(),
            description: description || null,
            leader_id: leaderId,
            leader_username: leaderUsername,
            color: color,
            is_active: 1,
            created_at: now,
            updated_at: now
          }
        });
      }
    }
  );
});

// Update team (Admin only)
router.put('/:id', (req, res) => {
  const teamId = req.params.id;
  const { name, description, leaderIds = [], color, isActive } = req.body;
  console.log(`✏️ Updating team ${teamId}:`, { name, description, leaderIds, color, isActive });

  // Validation
  if (!name || name.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Team name is required'
    });
  }

  const now = new Date().toISOString();
  const activeStatus = isActive !== undefined ? (isActive ? 1 : 0) : 1;

  // First, update the team basic info
  db.run(
    'UPDATE teams SET name = ?, description = ?, color = ?, is_active = ?, updated_at = ? WHERE id = ?',
    [name.trim(), description || null, color || '#3B82F6', activeStatus, now, teamId],
    function (err) {
      if (err) {
        console.error('❌ Error updating team:', err);
        if (err.code === 'ER_DUP_ENTRY' || err.code === 'SQLITE_CONSTRAINT') {
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
      console.log(`✅ Team ${teamId} basic info updated`);

      // Now update team leaders
      // Step 1: Delete existing team leader assignments
      db.run('DELETE FROM team_leaders WHERE team_id = ?', [teamId], (err) => {
        if (err) {
          console.error('❌ Error deleting old team leaders:', err);
          return res.status(500).json({
            success: false,
            message: 'Failed to update team leaders'
          });
        }

        console.log('✅ Cleared existing team leaders');

        // Step 2: Insert new team leaders if any
        if (leaderIds && leaderIds.length > 0) {
          console.log(`📝 Assigning ${leaderIds.length} new team leader(s)...`);

          // Get user details for the leaders
          const placeholders = leaderIds.map(() => '?').join(',');
          db.all(
            `SELECT id, username FROM users WHERE id IN (${placeholders}) AND role IN ('TEAM LEADER', 'ADMIN')`,
            leaderIds,
            (err, users) => {
              if (err) {
                console.error('❌ Error fetching leader details:', err);
                return finishUpdate(null, null);
              }

              if (users.length === 0) {
                console.log('⚠️  No valid team leaders found');
                return finishUpdate(null, null);
              }

              // Insert into team_leaders table
              let completed = 0;
              let firstLeader = users[0];

              console.log(`🔍 DEBUG: About to insert ${users.length} leaders:`, users.map(u => `${u.username}(${u.id})`));

              users.forEach((user) => {
                db.run(
                  'INSERT INTO team_leaders (team_id, user_id, username) VALUES (?, ?, ?)',
                  [teamId, user.id, user.username],
                  (err) => {
                    if (err) {
                      console.error(`❌ Error assigning leader ${user.username}:`, err);
                    } else {
                      console.log(`✅ Assigned ${user.username} as team leader`);

                      // Automatically update user's team to match the team they're leading
                      db.run(
                        'UPDATE users SET team = ? WHERE id = ?',
                        [name.trim(), user.id],
                        (updateErr) => {
                          if (updateErr) {
                            console.error(`❌ Error updating team for ${user.username}:`, updateErr);
                          } else {
                            console.log(`✅ Updated ${user.username}'s team to ${name.trim()}`);
                          }
                        }
                      );
                    }

                    completed++;
                    console.log(`🔍 DEBUG: Completed ${completed} of ${users.length} insertions`);
                    if (completed === users.length) {
                      finishUpdate(firstLeader.id, firstLeader.username);
                    }
                  }
                );
              });
            }
          );
        } else {
          // No leaders selected
          finishUpdate(null, null);
        }

        function finishUpdate(leaderId, leaderUsername) {
          // Update team's leader_id for backward compatibility
          db.run(
            'UPDATE teams SET leader_id = ?, leader_username = ? WHERE id = ?',
            [leaderId, leaderUsername, teamId],
            (err) => {
              if (err) {
                console.error('❌ Error updating team leader_id:', err);
              }

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
        }
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
      db.run('DELETE FROM teams WHERE id = ?', [teamId], function (err) {
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
