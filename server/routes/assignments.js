const express = require('express');
const router = express.Router();
const { db } = require('../config/database');

// Get all assignments for a team leader
router.get('/team-leader/:team', (req, res) => {
  try {
    const { team } = req.params;

    db.all(`
      SELECT
        a.*,
        COUNT(DISTINCT asub.id) as submission_count
      FROM assignments a
      LEFT JOIN assignment_submissions asub ON a.id = asub.assignment_id
      WHERE a.team = ?
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `, [team], (err, assignments) => {
      if (err) {
        console.error('Error fetching assignments:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch assignments',
          error: err.message
        });
      }

      res.json({
        success: true,
        assignments: assignments || []
      });
    });
  } catch (error) {
    console.error('Error in fetchAssignments route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assignments',
      error: error.message
    });
  }
});

// Get assignment details with submissions
router.get('/:assignmentId/details', (req, res) => {
  try {
    const { assignmentId } = req.params;

    // Get assignment details
    db.get(
      'SELECT * FROM assignments WHERE id = ?',
      [assignmentId],
      (err, assignment) => {
        if (err) {
          console.error('Error fetching assignment:', err);
          return res.status(500).json({
            success: false,
            message: 'Failed to fetch assignment details',
            error: err.message
          });
        }

        if (!assignment) {
          return res.status(404).json({
            success: false,
            message: 'Assignment not found'
          });
        }

        // Get submissions
        db.all(`
          SELECT 
            f.*,
            u.username,
            u.fullName,
            asub.submitted_at
          FROM assignment_submissions asub
          JOIN files f ON asub.file_id = f.id
          JOIN users u ON f.user_id = u.id
          WHERE asub.assignment_id = ?
          ORDER BY asub.submitted_at DESC
        `, [assignmentId], (err, submissions) => {
          if (err) {
            console.error('Error fetching submissions:', err);
            return res.status(500).json({
              success: false,
              message: 'Failed to fetch submissions',
              error: err.message
            });
          }

          res.json({
            success: true,
            assignment,
            submissions: submissions || []
          });
        });
      }
    );
  } catch (error) {
    console.error('Error in assignment details route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assignment details',
      error: error.message
    });
  }
});

// Create new assignment
router.post('/create', async (req, res) => {
  try {
    const {
      title,
      description,
      due_date,
      file_type_required,
      assigned_to,
      max_file_size,
      assigned_members,
      team_leader_id,
      team_leader_username,
      team
    } = req.body;

    // Validate required fields
    if (!title || !team || !team_leader_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Insert assignment
    const assignmentResult = await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO assignments (
          title,
          description,
          due_date,
          file_type_required,
          assigned_to,
          max_file_size,
          team_leader_id,
          team_leader_username,
          team,
          created_at,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'active')
      `, [
        title,
        description || null,
        due_date || null,
        file_type_required || null,
        assigned_to,
        max_file_size || 10485760,
        team_leader_id,
        team_leader_username,
        team
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            insertId: this.lastID
          });
        }
      });
    });

    const assignmentId = assignmentResult.insertId;
    let membersAssigned = 0;

    try {
      // Assign members
      if (assigned_to === 'specific' && assigned_members && assigned_members.length > 0) {
        // Insert specific members using batch insert
        const memberValues = assigned_members.map(userId => [assignmentId, userId]);
        if (memberValues.length > 0) {
          const placeholders = memberValues.map(() => '(?, ?)').join(', ');
          const flattenedValues = memberValues.flat();

          await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`,
              flattenedValues,
              (err) => err ? reject(err) : resolve()
            );
          });
          membersAssigned = assigned_members.length;
        }
      } else if (assigned_to === 'all') {
        // Get all team members and assign
        const teamMembers = await new Promise((resolve, reject) => {
          db.all(
            'SELECT id FROM users WHERE team = ? AND role = ?',
            [team, 'user'],
            (err, rows) => err ? reject(err) : resolve(rows || [])
          );
        });

        if (teamMembers && teamMembers.length > 0) {
          const memberValues = teamMembers.map(member => [assignmentId, member.id]);
          const placeholders = memberValues.map(() => '(?, ?)').join(', ');
          const flattenedValues = memberValues.flat();

          await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`,
              flattenedValues,
              (err) => err ? reject(err) : resolve()
            );
          });
          membersAssigned = teamMembers.length;
        }
      }

      // Note: Activity log insertion will fail silently if there's an error to avoid breaking assignment creation
      try {
        await new Promise((resolve) => {
          db.run(`
            INSERT INTO activity_logs (
              user_id,
              username,
              role,
              team,
              activity
            ) VALUES (?, ?, ?, ?, ?)
          `, [
            team_leader_id,
            team_leader_username,
            'TEAM_LEADER',
            team,
            `Created assignment: ${title}`
          ], (err) => {
            if (err) console.warn('Activity log insertion failed:', err.message);
            resolve();
          });
        });
      } catch (logError) {
        console.warn('Activity log insertion failed:', logError.message);
      }

      res.json({
        success: true,
        message: 'Assignment created successfully',
        assignmentId,
        membersAssigned
      });

    } catch (memberError) {
      // If member assignment fails, we should still return success since the assignment was created
      console.error('Error assigning members:', memberError);
      res.json({
        success: true,
        message: 'Assignment created successfully',
        assignmentId,
        membersAssigned: 0,
        warning: 'Assignment created but member assignment failed'
      });
    }

  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create assignment',
      error: error.message
    });
  }
});

// Get assignments for a specific user
router.get('/user/:userId', (req, res) => {
  try {
    const { userId } = req.params;

    db.all(`
      SELECT
        a.*,
        am.status as user_status,
        am.submitted_at as user_submitted_at,
        fs.original_name as submitted_file_name,
        fs.id as submitted_file_id
      FROM assignments a
      LEFT JOIN assignment_members am ON a.id = am.assignment_id AND am.user_id = ?
      LEFT JOIN assignment_submissions asub ON a.id = asub.assignment_id AND asub.user_id = ?
      LEFT JOIN files fs ON asub.file_id = fs.id
      WHERE
        (a.assigned_to = 'all' AND a.team = (SELECT team FROM users WHERE id = ?))
        OR
        (a.assigned_to = 'specific' AND am.user_id = ?)
      ORDER BY a.created_at DESC
    `, [userId, userId, userId, userId], (err, assignments) => {
      if (err) {
        console.error('Error fetching user assignments:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch assignments',
          error: err.message
        });
      }

      res.json({
        success: true,
        assignments: assignments || []
      });
    });
  } catch (error) {
    console.error('Error in user assignments route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assignments',
      error: error.message
    });
  }
});

// Submit assignment
router.post('/submit', async (req, res) => {
  try {
    const { assignmentId, userId, fileId } = req.body;

    // Validate required fields
    if (!assignmentId || !userId || !fileId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Check if assignment exists and user is assigned
    const assignment = await new Promise((resolve, reject) => {
      db.get(`
        SELECT a.*, am.user_id as assigned_user
        FROM assignments a
        LEFT JOIN assignment_members am ON a.id = am.assignment_id AND am.user_id = ?
        WHERE a.id = ?
      `, [userId, assignmentId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Check if user is assigned (either 'all' or specifically assigned)
    if (assignment.assigned_to === 'specific' && !assignment.assigned_user) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this assignment'
      });
    }

    // Check if already submitted
    const existingSubmission = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM assignment_submissions WHERE assignment_id = ? AND user_id = ?',
        [assignmentId, userId],
        (err, row) => err ? reject(err) : resolve(row)
      );
    });

    if (existingSubmission) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted this assignment'
      });
    }

    // Insert submission
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO assignment_submissions (assignment_id, user_id, file_id, submitted_at) VALUES (?, ?, ?, NOW())',
        [assignmentId, userId, fileId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Update assignment_members status
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE assignment_members SET status = ?, submitted_at = NOW() WHERE assignment_id = ? AND user_id = ?',
        ['submitted', assignmentId, userId],
        function(err) {
          // Ignore errors as this might not exist for 'all' assignments
          resolve();
        }
      );
    });

    res.json({
      success: true,
      message: 'Assignment submitted successfully'
    });

  } catch (error) {
    console.error('Error submitting assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit assignment',
      error: error.message
    });
  }
});

// Delete assignment
router.delete('/:assignmentId', (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { teamLeaderUsername, team } = req.body;

    // Verify assignment exists and belongs to the team
    db.get(
      'SELECT * FROM assignments WHERE id = ? AND team = ?',
      [assignmentId, team],
      (err, assignment) => {
        if (err) {
          console.error('Error finding assignment:', err);
          return res.status(500).json({
            success: false,
            message: 'Failed to delete assignment',
            error: err.message
          });
        }

        if (!assignment) {
          return res.status(404).json({
            success: false,
            message: 'Assignment not found or access denied'
          });
        }

        // Delete related records first
        db.run('DELETE FROM assignment_submissions WHERE assignment_id = ?', [assignmentId], (err) => {
          if (err) console.error('Error deleting submissions:', err);

          db.run('DELETE FROM assignment_members WHERE assignment_id = ?', [assignmentId], (err) => {
            if (err) console.error('Error deleting members:', err);

            // Delete the assignment
            db.run('DELETE FROM assignments WHERE id = ?', [assignmentId], (err) => {
              if (err) {
                console.error('Error deleting assignment:', err);
                return res.status(500).json({
                  success: false,
                  message: 'Failed to delete assignment',
                  error: err.message
                });
              }

              res.json({
                success: true,
                message: 'Assignment deleted successfully'
              });
            });
          });
        });
      }
    );
  } catch (error) {
    console.error('Error in delete assignment route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete assignment',
      error: error.message
    });
  }
});

module.exports = router;
