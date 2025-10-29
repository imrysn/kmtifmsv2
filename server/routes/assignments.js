const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../../database/config');
const { createNotification } = require('./notifications');

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
    `, [team]);

    // Fetch assigned member details for each assignment
    for (let assignment of assignments) {
      const memberDetails = await query(`
        SELECT u.id, u.username, u.fullName
        FROM assignment_members am
        JOIN users u ON am.user_id = u.id
        WHERE am.assignment_id = ?
      `, [assignment.id]);
      
      assignment.assigned_member_details = memberDetails || [];
    }

    res.json({
      success: true,
      assignments: assignments || []
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
    const assignment = await queryOne(
      'SELECT * FROM assignments WHERE id = ?',
      [assignmentId]
    );

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Get assigned member details
    const memberDetails = await query(`
      SELECT u.id, u.username, u.fullName
      FROM assignment_members am
      JOIN users u ON am.user_id = u.id
      WHERE am.assignment_id = ?
    `, [assignmentId]);
    
    assignment.assigned_member_details = memberDetails || [];

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
      finalDueDate || null,
      finalFileType || null,
      finalAssignedTo,
      finalMaxSize,
      finalTeamLeaderId,
      finalTeamLeaderUsername,
      team
    ]);

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

          await query(
            `INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`,
            flattenedValues
          );
          membersAssigned = finalMembers.length;
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
        await query(`
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
          team,
          `Created assignment: ${title}`
        ]);
      } catch (logError) {
        console.warn('Activity log insertion failed:', logError.message);
      }

      // Create notifications for assigned members
      try {
        console.log('🔔 Creating notifications for assignment:', assignmentId);
        console.log('Assigned to:', finalAssignedTo);
        console.log('Members:', finalMembers);
        console.log('Team:', team);
        console.log('Team Leader:', finalTeamLeaderUsername, '(ID:', finalTeamLeaderId, ')');
        
        if (finalAssignedTo === 'specific' && finalMembers && finalMembers.length > 0) {
          // Notify specific members
          console.log('Creating notifications for specific members:', finalMembers);
          for (const userId of finalMembers) {
            try {
              const notificationData = {
                user_id: userId,
                assignment_id: assignmentId,
                file_id: null,
                type: 'assignment',
                title: 'New Assignment',
                message: `${finalTeamLeaderUsername} assigned you a new task: "${title}"${finalDueDate ? ` - Due: ${new Date(finalDueDate).toLocaleDateString()}` : ''}`,
                action_by_id: finalTeamLeaderId,
                action_by_username: finalTeamLeaderUsername,
                action_by_role: 'TEAM_LEADER'
              };
              
              console.log('Inserting notification:', notificationData);
              
              await query(`
                INSERT INTO notifications (
                  user_id,
                  assignment_id,
                  file_id,
                  type,
                  title,
                  message,
                  action_by_id,
                  action_by_username,
                  action_by_role
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                notificationData.user_id,
                notificationData.assignment_id,
                notificationData.file_id,
                notificationData.type,
                notificationData.title,
                notificationData.message,
                notificationData.action_by_id,
                notificationData.action_by_username,
                notificationData.action_by_role
              ]);
              console.log(`✅ Notification created successfully for user ${userId}`);
            } catch (err) {
              console.error(`❌ Failed to create notification for user ${userId}:`, err);
              console.error('Error details:', err.message);
              console.error('SQL State:', err.sqlState);
              console.error('SQL Message:', err.sqlMessage);
            }
          }
          console.log(`✅ Completed creating ${finalMembers.length} notification(s) for specific members`);
        } else if (finalAssignedTo === 'all') {
          // Notify all team members
          console.log('Creating notifications for all team members in team:', team);
          const teamMembers = await query(
            'SELECT id FROM users WHERE team = ? AND role = ?',
            [team, 'USER']
          );
          
          console.log(`Found ${teamMembers.length} team members to notify`);
          for (const member of teamMembers) {
            try {
              const notificationData = {
                user_id: member.id,
                assignment_id: assignmentId,
                file_id: null,
                type: 'assignment',
                title: 'New Assignment',
                message: `${finalTeamLeaderUsername} assigned a new task to all team members: "${title}"${finalDueDate ? ` - Due: ${new Date(finalDueDate).toLocaleDateString()}` : ''}`,
                action_by_id: finalTeamLeaderId,
                action_by_username: finalTeamLeaderUsername,
                action_by_role: 'TEAM_LEADER'
              };
              
              console.log('Inserting notification for member:', member.id, notificationData);
              
              await query(`
                INSERT INTO notifications (
                  user_id,
                  assignment_id,
                  file_id,
                  type,
                  title,
                  message,
                  action_by_id,
                  action_by_username,
                  action_by_role
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                notificationData.user_id,
                notificationData.assignment_id,
                notificationData.file_id,
                notificationData.type,
                notificationData.title,
                notificationData.message,
                notificationData.action_by_id,
                notificationData.action_by_username,
                notificationData.action_by_role
              ]);
              console.log(`✅ Notification created successfully for user ${member.id}`);
            } catch (err) {
              console.error(`❌ Failed to create notification for user ${member.id}:`, err);
              console.error('Error details:', err.message);
              console.error('SQL State:', err.sqlState);
              console.error('SQL Message:', err.sqlMessage);
            }
          }
          console.log(`✅ Completed creating ${teamMembers.length} notification(s) for all team members`);
        }
      } catch (notificationError) {
        console.error('⚠️ Failed to create notifications:', notificationError.message);
        console.error('Full error:', notificationError);
        console.error('Stack:', notificationError.stack);
        // Don't fail the request if notifications fail
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

    // First get the current user's info
    const currentUser = await queryOne(
      'SELECT username, fullName, team FROM users WHERE id = ?',
      [userId]
    );

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('Current user:', currentUser);

    const assignments = await query(`
      SELECT
        a.*,
        am.status as user_status,
        am.submitted_at as user_submitted_at,
        fs.original_name as submitted_file_name,
        fs.id as submitted_file_id,
        ? as assigned_user_fullname,
        ? as assigned_user_username
      FROM assignments a
      LEFT JOIN assignment_members am ON a.id = am.assignment_id AND am.user_id = ?
      LEFT JOIN assignment_submissions asub ON a.id = asub.assignment_id AND asub.user_id = ?
      LEFT JOIN files fs ON asub.file_id = fs.id
      WHERE
        (a.assigned_to = 'all' AND a.team = ?)
        OR
        (a.assigned_to = 'specific' AND am.user_id = ?)
      ORDER BY a.created_at DESC
    `, [currentUser.fullName, currentUser.username, userId, userId, currentUser.team, userId]);

    console.log('Assignments found:', assignments.length);
    if (assignments.length > 0) {
      console.log('First assignment:', assignments[0]);
    }

    // Fetch assigned member details for each assignment
    for (let assignment of assignments) {
      const memberDetails = await query(`
        SELECT u.id, u.username, u.fullName
        FROM assignment_members am
        JOIN users u ON am.user_id = u.id
        WHERE am.assignment_id = ?
      `, [assignment.id]);
      
      assignment.assigned_member_details = memberDetails || [];
    }

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

// Get comments for an assignment with replies
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

    // Fetch replies for each comment
    for (let comment of comments) {
      const replies = await query(`
        SELECT 
          cr.*,
          u.fullName as user_fullname,
          u.role as user_role
        FROM comment_replies cr
        JOIN users u ON cr.user_id = u.id
        WHERE cr.comment_id = ?
        ORDER BY cr.created_at ASC
      `, [comment.id]);
      
      comment.replies = replies || [];
    }

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

// Post a reply to a comment
router.post('/:assignmentId/comments/:commentId/replies', async (req, res) => {
  try {
    const { assignmentId, commentId } = req.params;
    const { userId, username, reply } = req.body;

    if (!userId || !username || !reply) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Verify comment exists and belongs to the assignment
    const comment = await queryOne(
      'SELECT * FROM assignment_comments WHERE id = ? AND assignment_id = ?',
      [commentId, assignmentId]
    );

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
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
      INSERT INTO comment_replies (
        comment_id,
        user_id,
        username,
        user_fullname,
        user_role,
        reply
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [commentId, userId, username, user.fullName, user.role, reply]);

    // Fetch the newly created reply with full details
    const newReply = await queryOne(`
      SELECT 
        cr.*,
        u.fullName as user_fullname,
        u.role as user_role
      FROM comment_replies cr
      JOIN users u ON cr.user_id = u.id
      WHERE cr.id = ?
    `, [result.insertId]);

    res.json({
      success: true,
      message: 'Reply posted successfully',
      reply: newReply
    });
  } catch (error) {
    console.error('Error in post reply route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to post reply',
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

    // Delete related records first (replies will cascade delete when comments are deleted)
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
