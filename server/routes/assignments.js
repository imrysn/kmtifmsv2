const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../../database/config');

// Get all assignments for a team leader
router.get('/team-leader/:team', async (req, res) => {
  try {
    const { team } = req.params;

    const assignments = await query(`
      SELECT
        a.*,
        COUNT(DISTINCT asub.id) as submission_count,
        COUNT(DISTINCT am.user_id) as assigned_members_count
      FROM assignments a
      LEFT JOIN assignment_submissions asub ON a.id = asub.assignment_id
      LEFT JOIN assignment_members am ON a.id = am.assignment_id
      WHERE a.team = ?
      GROUP BY a.id
      ORDER BY a.created_at DESC
<<<<<<< Updated upstream
    `, [team], async (err, assignments) => {
      if (err) {
        console.error('Error fetching assignments:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch assignments',
          error: err.message
        });
      }

      // Fetch assigned members for each assignment
      const assignmentsWithMembers = await Promise.all(
        (assignments || []).map(async (assignment) => {
          if (assignment.assigned_to === 'specific') {
            const members = await new Promise((resolve, reject) => {
              db.all(`
                SELECT u.id, u.username, u.fullName
                FROM assignment_members am
                JOIN users u ON am.user_id = u.id
                WHERE am.assignment_id = ?
              `, [assignment.id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
              });
            });
            return { ...assignment, assigned_member_details: members };
          }
          return assignment;
        })
      );

      res.json({
        success: true,
        assignments: assignmentsWithMembers
      });
=======
    `, [team]);

    res.json({
      success: true,
      assignments: assignments || []
>>>>>>> Stashed changes
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
router.get('/:assignmentId/details', async (req, res) => {
  try {
    const { assignmentId } = req.params;

    // Get assignment details
<<<<<<< Updated upstream
    const assignment = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM assignments WHERE id = ?',
        [assignmentId],
        (err, row) => err ? reject(err) : resolve(row)
      );
    });
=======
    const assignment = await queryOne(
      'SELECT * FROM assignments WHERE id = ?',
      [assignmentId]
    );
>>>>>>> Stashed changes

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

<<<<<<< Updated upstream
    // Get assigned members if specific
    let assignmentWithMembers = assignment;
    if (assignment.assigned_to === 'specific') {
      const members = await new Promise((resolve, reject) => {
        db.all(`
          SELECT u.id, u.username, u.fullName
          FROM assignment_members am
          JOIN users u ON am.user_id = u.id
          WHERE am.assignment_id = ?
        `, [assignmentId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
      assignmentWithMembers = { ...assignment, assigned_member_details: members };
    }

    // Get submissions
    const submissions = await new Promise((resolve, reject) => {
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
      `, [assignmentId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    res.json({
      success: true,
      assignment: assignmentWithMembers,
      submissions: submissions
=======
    // Get submissions
    const submissions = await query(`
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
    `, [assignmentId]);

    res.json({
      success: true,
      assignment,
      submissions: submissions || []
>>>>>>> Stashed changes
    });
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
      dueDate,
      due_date,
      fileTypeRequired,
      file_type_required,
      assignedTo,
      assigned_to,
      maxFileSize,
      max_file_size,
      assignedMembers,
      assigned_members,
      teamLeaderId,
      team_leader_id,
      teamLeaderUsername,
      team_leader_username,
      team
    } = req.body;

    // Support both camelCase and snake_case
    const finalDueDate = dueDate || due_date;
    const finalFileType = fileTypeRequired || file_type_required;
    const finalAssignedTo = assignedTo || assigned_to;
    const finalMaxSize = maxFileSize || max_file_size || 10485760;
    const finalMembers = assignedMembers || assigned_members;
    const finalTeamLeaderId = teamLeaderId || team_leader_id;
    const finalTeamLeaderUsername = teamLeaderUsername || team_leader_username;

    // Validate required fields
    if (!title || !team || !finalTeamLeaderId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Insert assignment
    const assignmentResult = await query(`
      INSERT INTO assignments (
        title,
<<<<<<< Updated upstream
        description || null,
        finalDueDate || null,
        finalFileType || null,
        finalAssignedTo,
        finalMaxSize,
        finalTeamLeaderId,
        finalTeamLeaderUsername,
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
=======
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'active')
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
    ]);
>>>>>>> Stashed changes

    const assignmentId = assignmentResult.insertId;
    let membersAssigned = 0;

    try {
      // Assign members
      if (finalAssignedTo === 'specific' && finalMembers && finalMembers.length > 0) {
        // Insert specific members using batch insert
        const memberValues = finalMembers.map(userId => [assignmentId, userId]);
        if (memberValues.length > 0) {
          const placeholders = memberValues.map(() => '(?, ?)').join(', ');
          const flattenedValues = memberValues.flat();

<<<<<<< Updated upstream
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`,
              flattenedValues,
              (err) => err ? reject(err) : resolve()
            );
          });
          membersAssigned = finalMembers.length;
=======
          await query(
            `INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`,
            flattenedValues
          );
          membersAssigned = assigned_members.length;
>>>>>>> Stashed changes
        }
      } else if (finalAssignedTo === 'all') {
        // Get all team members and assign
        const teamMembers = await query(
          'SELECT id FROM users WHERE team = ? AND role = ?',
          [team, 'USER']
        );

        if (teamMembers && teamMembers.length > 0) {
          const memberValues = teamMembers.map(member => [assignmentId, member.id]);
          const placeholders = memberValues.map(() => '(?, ?)').join(', ');
          const flattenedValues = memberValues.flat();

          await query(
            `INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`,
            flattenedValues
          );
          membersAssigned = teamMembers.length;
        }
      }

      // Log activity
      try {
<<<<<<< Updated upstream
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
            finalTeamLeaderId,
            finalTeamLeaderUsername,
            'TEAM_LEADER',
=======
        await query(`
          INSERT INTO activity_logs (
            user_id,
            username,
            role,
>>>>>>> Stashed changes
            team,
            activity
          ) VALUES (?, ?, ?, ?, ?)
        `, [
          team_leader_id,
          team_leader_username,
          'TEAM_LEADER',
          team,
          `Created assignment: ${title}`
        ]);
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
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const assignments = await query(`
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
    `, [userId, userId, userId, userId]);

    res.json({
      success: true,
      assignments: assignments || []
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
    const assignment = await queryOne(`
      SELECT a.*, am.user_id as assigned_user
      FROM assignments a
      LEFT JOIN assignment_members am ON a.id = am.assignment_id AND am.user_id = ?
      WHERE a.id = ?
    `, [userId, assignmentId]);

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
    const existingSubmission = await queryOne(
      'SELECT * FROM assignment_submissions WHERE assignment_id = ? AND user_id = ?',
      [assignmentId, userId]
    );

    if (existingSubmission) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted this assignment'
      });
    }

    // Insert submission
    await query(
      'INSERT INTO assignment_submissions (assignment_id, user_id, file_id, submitted_at) VALUES (?, ?, ?, NOW())',
      [assignmentId, userId, fileId]
    );

    // Update assignment_members status
    await query(
      'UPDATE assignment_members SET status = ?, submitted_at = NOW() WHERE assignment_id = ? AND user_id = ?',
      ['submitted', assignmentId, userId]
    );

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

// Get comments for an assignment
router.get('/:assignmentId/comments', async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const comments = await query(`
      SELECT 
        ac.*,
        u.fullName as user_fullname,
        u.role as user_role
      FROM assignment_comments ac
      JOIN users u ON ac.user_id = u.id
      WHERE ac.assignment_id = ?
      ORDER BY ac.created_at ASC
    `, [assignmentId]);

    res.json({
      success: true,
      comments: comments || []
    });
  } catch (error) {
    console.error('Error in get comments route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comments',
      error: error.message
    });
  }
});

// Post a comment on an assignment
router.post('/:assignmentId/comments', async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { userId, username, comment } = req.body;

    if (!userId || !username || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Get user's full name and role
    const user = await queryOne(
      'SELECT fullName, role FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const result = await query(`
      INSERT INTO assignment_comments (
        assignment_id,
        user_id,
        username,
        user_fullname,
        user_role,
        comment
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [assignmentId, userId, username, user.fullName, user.role, comment]);

    // Fetch the newly created comment with full details
    const newComment = await queryOne(`
      SELECT 
        ac.*,
        u.fullName as user_fullname,
        u.role as user_role
      FROM assignment_comments ac
      JOIN users u ON ac.user_id = u.id
      WHERE ac.id = ?
    `, [result.insertId]);

    res.json({
      success: true,
      message: 'Comment posted successfully',
      comment: newComment
    });
  } catch (error) {
    console.error('Error in post comment route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to post comment',
      error: error.message
    });
  }
});

// Delete assignment
router.delete('/:assignmentId', async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { teamLeaderUsername, team } = req.body;

    // Verify assignment exists and belongs to the team
    const assignment = await queryOne(
      'SELECT * FROM assignments WHERE id = ? AND team = ?',
      [assignmentId, team]
    );

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found or access denied'
      });
    }

    // Delete related records first
    await query('DELETE FROM assignment_submissions WHERE assignment_id = ?', [assignmentId]);
    await query('DELETE FROM assignment_members WHERE assignment_id = ?', [assignmentId]);
    await query('DELETE FROM assignment_comments WHERE assignment_id = ?', [assignmentId]);
    
    // Delete the assignment
    await query('DELETE FROM assignments WHERE id = ?', [assignmentId]);

    res.json({
      success: true,
      message: 'Assignment deleted successfully'
    });
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
