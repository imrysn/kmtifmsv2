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

router.get('/:assignmentId/comments', async (req, res) => {
  try {
    const { assignmentId } = req.params;

    // First get all comments for this assignment
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

    // For each comment, get its replies
    for (const comment of comments) {
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

    console.log(`📝 Retrieved ${comments.length} comments for assignment ${assignmentId}`);

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

    // Create notifications for assigned members
    // NOTE: We pre-scan for @mentions first so mentioned users only get the
    // mention notification — not both a generic comment AND a mention.
    try {
      const assignment = await queryOne(
        'SELECT title, team_leader_id FROM assignments WHERE id = ?',
        [assignmentId]
      );

      // Pre-collect all mentioned user IDs so we can skip generic notif for them
      const mentionedUserIds = new Set();
      const preScanRegex = /@([A-Za-z0-9_.]+)/g;
      let preScanMatch;
      while ((preScanMatch = preScanRegex.exec(comment)) !== null) {
        const token = preScanMatch[1].replace(/_/g, ' ').toLowerCase();
        const mentioned = await queryOne(
          `SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(REPLACE(fullName,' ','_')) = ? OR LOWER(fullName) = ? LIMIT 1`,
          [token, token, token]
        );
        if (mentioned && String(mentioned.id) !== String(userId)) {
          mentionedUserIds.add(mentioned.id);
        }
      }

      const assignedMembers = await query(
        'SELECT user_id FROM assignment_members WHERE assignment_id = ? AND user_id != ?',
        [assignmentId, userId]
      );

      if (user.role === 'ADMIN') {
        const teamLeaderId = assignment.team_leader_id || assignment.teamLeaderId;
        if (teamLeaderId && !mentionedUserIds.has(teamLeaderId)) {
          await query(`
            INSERT INTO notifications (
              user_id, assignment_id, file_id, type, title, message,
              action_by_id, action_by_username, action_by_role
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            assignment.team_leader_id, assignmentId, null, 'comment',
            'New Admin Comment on Assignment',
            `Admin ${user.fullName} commented on "${assignment.title}": ${comment.substring(0, 100)}${comment.length > 100 ? '...' : ''}`,
            userId, username, user.role
          ]);
        }
        for (const member of assignedMembers) {
          if (!mentionedUserIds.has(member.user_id)) {
            await query(`
              INSERT INTO notifications (
                user_id, assignment_id, file_id, type, title, message,
                action_by_id, action_by_username, action_by_role
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              member.user_id, assignmentId, null, 'comment',
              'New Admin Comment on Assignment',
              `Admin ${user.fullName} commented on "${assignment.title}": ${comment.substring(0, 100)}${comment.length > 100 ? '...' : ''}`,
              userId, username, user.role
            ]);
          }
        }
      } else if (user.role === 'TEAM_LEADER') {
        for (const member of assignedMembers) {
          if (!mentionedUserIds.has(member.user_id)) {
            await query(`
              INSERT INTO notifications (
                user_id, assignment_id, file_id, type, title, message,
                action_by_id, action_by_username, action_by_role
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              member.user_id, assignmentId, null, 'comment',
              'New Comment on Assignment',
              `${user.fullName} commented on "${assignment.title}": ${comment.substring(0, 100)}${comment.length > 100 ? '...' : ''}`,
              userId, username, user.role
            ]);
          }
        }
      } else if (user.role === 'USER' && assignment.team_leader_id && assignment.team_leader_id !== userId) {
        if (!mentionedUserIds.has(assignment.team_leader_id)) {
          await query(`
            INSERT INTO notifications (
              user_id, assignment_id, file_id, type, title, message,
              action_by_id, action_by_username, action_by_role
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            assignment.team_leader_id, assignmentId, null, 'comment',
            'New Comment on Assignment',
            `${user.fullName} commented on "${assignment.title}": ${comment.substring(0, 100)}${comment.length > 100 ? '...' : ''}`,
            userId, username, user.role
          ]);
        }
      }
    } catch (notifError) {
      console.error('Failed to create comment notifications:', notifError.message);
      // Don't fail the request if notifications fail
    }

    // ── @mention notifications ─────────────────────────────────────────────
    try {
      const mentionRegex = /@([A-Za-z0-9_.]+)/g;
      let match;
      const notifiedIds = new Set([userId]); // don't notify self
      while ((match = mentionRegex.exec(comment)) !== null) {
        const token = match[1].replace(/_/g, ' ').toLowerCase();
        // Match by username OR fullName (spaces replaced with underscores in mentions)
        const mentioned = await queryOne(
          `SELECT id, fullName FROM users WHERE LOWER(username) = ? OR LOWER(REPLACE(fullName,' ','_')) = ? OR LOWER(fullName) = ? LIMIT 1`,
          [token, token, token]
        );
        if (mentioned && !notifiedIds.has(mentioned.id)) {
          notifiedIds.add(mentioned.id);
          const assignmentInfo = await queryOne('SELECT title FROM assignments WHERE id = ?', [assignmentId]);
          await query(`
            INSERT INTO notifications (user_id, assignment_id, file_id, type, title, message, action_by_id, action_by_username, action_by_role)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            mentioned.id, assignmentId, null, 'mention',
            `${user.fullName} mentioned you`,
            `${user.fullName} mentioned you in a comment on "${assignmentInfo?.title || 'an assignment'}": ${comment.substring(0, 100)}${comment.length > 100 ? '...' : ''}`,
            userId, username, user.role
          ]);
          console.log(`🔔 Mention notification sent to user ${mentioned.id} (${mentioned.fullName})`);
        }
      }
    } catch (mentionErr) {
      console.error('⚠️ Failed to send mention notifications:', mentionErr.message);
    }

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
router.post('/:assignmentId/comments/:commentId/reply', async (req, res) => {
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

    // Create notification for the original comment author if different from replier
    if (comment.user_id !== userId) {
      try {
        // Get assignment details
        const assignment = await queryOne(
          'SELECT title FROM assignments WHERE id = ?',
          [assignmentId]
        );

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
          comment.user_id,
          assignmentId,
          null,
          'comment',
          'New Reply on Assignment',
          `${user.fullName} replied to your comment on "${assignment.title}": ${reply.substring(0, 100)}${reply.length > 100 ? '...' : ''}`,
          userId,
          username,
          user.role
        ]);

        console.log(`✅ Created reply notification for user ${comment.user_id}`);
      } catch (notifError) {
        console.error('⚠️ Failed to create reply notification:', notifError);
        // Don't fail the request if notifications fail
      }
    }

    // ── @mention notifications for reply ───────────────────────────────────
    try {
      const mentionRegex = /@([A-Za-z0-9_.]+)/g;
      let match;
      const notifiedIds = new Set([userId, comment.user_id]);
      while ((match = mentionRegex.exec(reply)) !== null) {
        const token = match[1].replace(/_/g, ' ').toLowerCase();
        const mentioned = await queryOne(
          `SELECT id, fullName FROM users WHERE LOWER(username) = ? OR LOWER(REPLACE(fullName,' ','_')) = ? OR LOWER(fullName) = ? LIMIT 1`,
          [token, token, token]
        );
        if (mentioned && !notifiedIds.has(mentioned.id)) {
          notifiedIds.add(mentioned.id);
          const assignmentInfo = await queryOne('SELECT title FROM assignments WHERE id = ?', [assignmentId]);
          await query(`
            INSERT INTO notifications (user_id, assignment_id, file_id, type, title, message, action_by_id, action_by_username, action_by_role)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            mentioned.id, assignmentId, null, 'mention',
            `${user.fullName} mentioned you`,
            `${user.fullName} mentioned you in a reply on "${assignmentInfo?.title || 'an assignment'}": ${reply.substring(0, 100)}${reply.length > 100 ? '...' : ''}`,
            userId, username, user.role
          ]);
        }
      }
    } catch (mentionErr) {
      console.error('⚠️ Failed to send mention notifications for reply:', mentionErr.message);
    }

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

// ── Edit a comment ──────────────────────────────────────────────────────────
router.put('/:assignmentId/comments/:commentId', async (req, res) => {
  try {
    const { assignmentId, commentId } = req.params;
    const { userId, comment } = req.body;

    if (!userId || !comment?.trim()) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const existing = await queryOne(
      'SELECT * FROM assignment_comments WHERE id = ? AND assignment_id = ?',
      [commentId, assignmentId]
    );
    if (!existing) return res.status(404).json({ success: false, message: 'Comment not found' });
    if (String(existing.user_id) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'You can only edit your own comments' });
    }

    await query(
      'UPDATE assignment_comments SET comment = ?, updated_at = NOW() WHERE id = ?',
      [comment.trim(), commentId]
    );

    res.json({ success: true, message: 'Comment updated successfully' });
  } catch (error) {
    console.error('Error editing comment:', error);
    res.status(500).json({ success: false, message: 'Failed to edit comment', error: error.message });
  }
});

// ── Delete a comment (also deletes its replies via CASCADE) ─────────────────
router.delete('/:assignmentId/comments/:commentId', async (req, res) => {
  try {
    const { assignmentId, commentId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'Missing userId' });
    }

    const existing = await queryOne(
      'SELECT * FROM assignment_comments WHERE id = ? AND assignment_id = ?',
      [commentId, assignmentId]
    );
    if (!existing) return res.status(404).json({ success: false, message: 'Comment not found' });
    if (String(existing.user_id) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'You can only delete your own comments' });
    }

    // Delete replies first, then the comment
    await query('DELETE FROM comment_replies WHERE comment_id = ?', [commentId]);
    await query('DELETE FROM assignment_comments WHERE id = ?', [commentId]);

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ success: false, message: 'Failed to delete comment', error: error.message });
  }
});

// ── Edit a reply ─────────────────────────────────────────────────────────────
router.put('/:assignmentId/comments/:commentId/reply/:replyId', async (req, res) => {
  try {
    const { replyId } = req.params;
    const { userId, reply } = req.body;

    if (!userId || !reply?.trim()) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const existing = await queryOne('SELECT * FROM comment_replies WHERE id = ?', [replyId]);
    if (!existing) return res.status(404).json({ success: false, message: 'Reply not found' });
    if (String(existing.user_id) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'You can only edit your own replies' });
    }

    await query(
      'UPDATE comment_replies SET reply = ?, updated_at = NOW() WHERE id = ?',
      [reply.trim(), replyId]
    );

    res.json({ success: true, message: 'Reply updated successfully' });
  } catch (error) {
    console.error('Error editing reply:', error);
    res.status(500).json({ success: false, message: 'Failed to edit reply', error: error.message });
  }
});

// ── Delete a reply ───────────────────────────────────────────────────────────
router.delete('/:assignmentId/comments/:commentId/reply/:replyId', async (req, res) => {
  try {
    const { replyId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'Missing userId' });
    }

    const existing = await queryOne('SELECT * FROM comment_replies WHERE id = ?', [replyId]);
    if (!existing) return res.status(404).json({ success: false, message: 'Reply not found' });
    if (String(existing.user_id) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'You can only delete your own replies' });
    }

    await query('DELETE FROM comment_replies WHERE id = ?', [replyId]);

    res.json({ success: true, message: 'Reply deleted successfully' });
  } catch (error) {
    console.error('Error deleting reply:', error);
    res.status(500).json({ success: false, message: 'Failed to delete reply', error: error.message });
  }
});

// Archive assignment (Admin only)

module.exports = router;
