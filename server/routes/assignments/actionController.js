const express = require('express');
const router = express.Router();
const { db, query, queryOne } = require('../../config/database-mysql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadsDir, moveToUserFolder } = require('../../config/middleware');

const { createAdminNotification } = require('../notifications');

// Configure multer for file uploads using existing uploads directory
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Upload to temp location first, then move to user folder
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Use temp filename like regular uploads
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    cb(null, `temp_${timestamp}_${randomString}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 * 1024 // 50GB limit (limitless)
  }
});

// Helper: fix garbled UTF-8 filenames that multer/busboy decoded as latin1.
// Japanese, Chinese, Korean and other multibyte filenames arrive as latin1-garbled
// strings. Re-encoding to latin1 bytes and decoding as UTF-8 recovers the real name.
function fixFilename(name) {
  if (!name) return name;
  try {
    const reDecoded = Buffer.from(name, 'latin1').toString('utf8');
    if (reDecoded !== name && !reDecoded.includes('\uFFFD')) return reDecoded;
  } catch (_) {}
  return name;
}

// Batch submission tracker to group multiple file submissions into single notification
const pendingBatchSubmissions = new Map();

// Function to create grouped notification
async function createBatchedSubmissionNotification(teamLeaderId, assignmentId, submissions) {
  try {
    const assignment = await queryOne('SELECT title FROM assignments WHERE id = ?', [assignmentId]);
    const firstSubmission = submissions[0];

    // Get the REAL total count of files submitted for this assignment by this user from DB
    // This ensures the count is accurate even if some files were skipped as duplicates
    const realCount = await queryOne(
      'SELECT COUNT(*) as total FROM assignment_submissions WHERE assignment_id = ? AND user_id = ?',
      [assignmentId, firstSubmission.userId]
    );
    const totalFileCount = realCount ? realCount.total : submissions.length;

    // Get folder name — use DB data for accuracy
    const folderName = firstSubmission.folderName;
    const isFolder = folderName && totalFileCount > 1;

    let message;
    let title = 'New File Submitted for Review';

    if (isFolder) {
      title = 'New Folder Submitted for Review';
      message = `${firstSubmission.submitterName} submitted folder "${folderName}" (${totalFileCount} files) for the assignment "${assignment.title}"`;
    } else if (totalFileCount === 1) {
      message = `${firstSubmission.submitterName} submitted "${firstSubmission.fileName}" for the assignment "${assignment.title}"`;
    } else {
      message = `${firstSubmission.submitterName} submitted ${totalFileCount} files for the assignment "${assignment.title}"`;
    }

    // Find the team leader — first try assignment.team_leader_id, then look up by team
    let finalTeamLeaderId = teamLeaderId;
    if (!finalTeamLeaderId) {
      const tl = await queryOne(
        'SELECT u.id FROM users u JOIN team_leaders tl ON u.id = tl.user_id JOIN teams t ON tl.team_id = t.id JOIN assignments a ON a.team = t.name WHERE a.id = ? LIMIT 1',
        [assignmentId]
      );
      finalTeamLeaderId = tl ? tl.id : null;
    }

    if (!finalTeamLeaderId) {
      console.warn(`⚠️ No team leader found for assignment ${assignmentId} — skipping notification`);
      return;
    }

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
      finalTeamLeaderId,
      assignmentId,
      firstSubmission.fileId,
      'submission',
      title,
      message,
      firstSubmission.userId,
      firstSubmission.username,
      'USER'
    ]);

    console.log(`✅ Created batched notification for team leader ${finalTeamLeaderId}: ${isFolder ? `folder "${folderName}" (${totalFileCount} files)` : `${totalFileCount} file(s)`}`);
  } catch (error) {
    console.error('⚠️ Failed to create batched submission notification:', error);
  }
}

router.patch('/:assignmentId/archive', async (req, res) => {
  try {
    const { assignmentId } = req.params;

    // Verify assignment exists
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

    // Toggle archive status
    const newArchiveStatus = assignment.archived ? 0 : 1;
    await query(
      'UPDATE assignments SET archived = ?, archived_at = ? WHERE id = ?',
      [newArchiveStatus, newArchiveStatus === 1 ? new Date() : null, assignmentId]
    );

    res.json({
      success: true,
      message: newArchiveStatus === 1 ? 'Assignment archived successfully' : 'Assignment unarchived successfully',
      archived: newArchiveStatus === 1
    });
  } catch (error) {
    console.error('Error in archive assignment route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to archive assignment',
      error: error.message
    });
  }
});

// Mark assignment as done (Team Leader only)
router.put('/:assignmentId/mark-done', async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { teamLeaderId, teamLeaderUsername, team } = req.body;

    console.log(`✅ Marking assignment ${assignmentId} as completed by ${teamLeaderUsername}`);

    // Verify assignment exists
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

    // Update assignment status to completed
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await query(
      'UPDATE assignments SET status = ?, updated_at = ? WHERE id = ?',
      ['completed', now, assignmentId]
    );

    console.log(`✅ Assignment ${assignmentId} marked as completed`);

    res.json({
      success: true,
      message: 'Assignment marked as completed',
      assignment: {
        ...assignment,
        status: 'completed',
        updated_at: now
      }
    });
  } catch (error) {
    console.error('Error marking assignment as done:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark assignment as done',
      error: error.message
    });
  }
});

// Update assignment (Team Leader only) - NON-MULTIPART fallback (no file uploads)
// Note: The main update route above (PUT /:id with multer) handles file uploads.
// This route handles plain JSON updates (e.g., member reassignment without new files).
router.put('/:assignmentId/update-members', async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const {
      title,
      description,
      dueDate,
      fileTypeRequired,
      assignedMembers,
      teamLeaderId,
      teamLeaderUsername,
      team
    } = req.body;

    console.log(`✏️ Updating assignment ${assignmentId} by ${teamLeaderUsername}`);

    // Verify assignment exists
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

    // Update assignment details
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await query(`
      UPDATE assignments
      SET
        title = ?,
        description = ?,
        due_date = ?,
        file_type_required = ?,
        updated_at = ?
      WHERE id = ?
    `, [
      title,
      description || null,
      dueDate || null,
      fileTypeRequired || null,
      now,
      assignmentId
    ]);

    console.log(`✅ Assignment ${assignmentId} details updated`);

    // Update assigned members if provided
    if (assignedMembers && Array.isArray(assignedMembers)) {
      // Get current assigned members
      const currentMembers = await query(
        'SELECT user_id FROM assignment_members WHERE assignment_id = ?',
        [assignmentId]
      );

      const currentMemberIds = currentMembers.map(m => m.user_id);
      const newMemberIds = assignedMembers;

      // Find members to add and remove
      const membersToAdd = newMemberIds.filter(id => !currentMemberIds.includes(id));
      const membersToRemove = currentMemberIds.filter(id => !newMemberIds.includes(id));

      // Remove members that are no longer assigned
      if (membersToRemove.length > 0) {
        await query(
          `DELETE FROM assignment_members WHERE assignment_id = ? AND user_id IN (${membersToRemove.map(() => '?').join(',')})`,
          [assignmentId, ...membersToRemove]
        );
        console.log(`✅ Removed ${membersToRemove.length} member(s) from assignment`);
      }

      // Add new members
      if (membersToAdd.length > 0) {
        const memberValues = membersToAdd.map(userId => [assignmentId, userId]);
        const placeholders = memberValues.map(() => '(?, ?)').join(', ');
        const flattenedValues = memberValues.flat();

        await query(
          `INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`,
          flattenedValues
        );
        console.log(`✅ Added ${membersToAdd.length} new member(s) to assignment`);

        // Create notifications for newly added members
        try {
          for (const userId of membersToAdd) {
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
              userId,
              assignmentId,
              null,
              'assignment',
              'Added to Assignment',
              `${teamLeaderUsername} added you to the task: "${title}"${dueDate ? ` - Due: ${new Date(dueDate).toLocaleDateString()}` : ''}`,
              teamLeaderId,
              teamLeaderUsername,
              'TEAM_LEADER'
            ]);
          }
          console.log(`✅ Created notifications for ${membersToAdd.length} newly added member(s)`);
        } catch (notifError) {
          console.error('⚠️ Failed to create notifications for new members:', notifError);
        }
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
        teamLeaderId,
        teamLeaderUsername,
        'TEAM_LEADER',
        team,
        `Updated assignment: ${title}`
      ]);
    } catch (logError) {
      console.warn('Activity log insertion failed:', logError.message);
    }

    res.json({
      success: true,
      message: 'Assignment updated successfully'
    });
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update assignment',
      error: error.message
    });
  }
});

// Delete assignment (Admin only - permanent delete)

module.exports = router;
