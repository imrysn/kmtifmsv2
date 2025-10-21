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
        COUNT(DISTINCT asub.id) as submissionCount
      FROM assignments a
      LEFT JOIN assignment_submissions asub ON a.id = asub.assignment_id
      WHERE a.team = ?
      GROUP BY a.id
      ORDER BY a.createdAt DESC
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
router.post('/create', (req, res) => {
  try {
    const {
      title,
      description,
      dueDate,
      fileTypeRequired,
      assignedTo,
      maxFileSize,
      assignedMembers,
      teamLeaderId,
      teamLeaderUsername,
      team
    } = req.body;

    // Validate required fields
    if (!title || !team || !teamLeaderId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Insert assignment
    db.run(`
      INSERT INTO assignments (
        title,
        description,
        dueDate,
        fileTypeRequired,
        assignedTo,
        maxFileSize,
        teamLeaderId,
        teamLeaderUsername,
        team,
        createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [
      title,
      description || null,
      dueDate || null,
      fileTypeRequired || null,
      assignedTo,
      maxFileSize || 10485760,
      teamLeaderId,
      teamLeaderUsername,
      team
    ], function(err) {
      if (err) {
        console.error('Error creating assignment:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to create assignment',
          error: err.message
        });
      }

      const assignmentId = this.lastID;
      let membersAssigned = 0;
      let membersProcessed = 0;

      // Function to insert assignment members
      const insertMember = (userId, callback) => {
        db.run(
          'INSERT INTO assignment_members (assignment_id, user_id) VALUES (?, ?)',
          [assignmentId, userId],
          callback
        );
      };

      // If assigned to specific members
      if (assignedTo === 'specific' && assignedMembers && assignedMembers.length > 0) {
        membersAssigned = assignedMembers.length;
        
        assignedMembers.forEach((memberId, index) => {
          insertMember(memberId, (err) => {
            if (err) console.error('Error assigning member:', err);
            membersProcessed++;
            
            if (membersProcessed === assignedMembers.length) {
              finishCreation();
            }
          });
        });
      } else {
        // Get all team members for 'all' assignment
        db.all(
          'SELECT id FROM users WHERE team = ? AND role = ?',
          [team, 'user'],
          (err, teamMembers) => {
            if (err) {
              console.error('Error fetching team members:', err);
              return finishCreation();
            }

            if (!teamMembers || teamMembers.length === 0) {
              return finishCreation();
            }

            membersAssigned = teamMembers.length;
            
            teamMembers.forEach((member) => {
              insertMember(member.id, (err) => {
                if (err) console.error('Error assigning member:', err);
                membersProcessed++;
                
                if (membersProcessed === teamMembers.length) {
                  finishCreation();
                }
              });
            });
          }
        );
      }

      function finishCreation() {
        // Log activity
        db.run(`
          INSERT INTO activity_logs (
            user_id,
            username,
            action,
            details,
            ip_address,
            created_at
          ) VALUES (?, ?, ?, ?, ?, datetime('now'))
        `, [
          teamLeaderId,
          teamLeaderUsername,
          'assignment_created',
          `Created assignment: ${title}`,
          req.ip
        ]);

        res.json({
          success: true,
          message: 'Assignment created successfully',
          assignmentId,
          membersAssigned
        });
      }

      // If no members to assign, finish immediately
      if (assignedTo === 'specific' && (!assignedMembers || assignedMembers.length === 0)) {
        finishCreation();
      }
    });
  } catch (error) {
    console.error('Error in create assignment route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create assignment',
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
