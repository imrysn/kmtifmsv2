const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { db, query, queryOne } = require('../../config/database-mysql');
const { logActivity, logFileStatusChange } = require('../../utils/logger');
const { createNotification, createAdminNotification } = require('../notifications');

const router = express.Router();

router.post('/:fileId/team-leader-review', async (req, res) => {
  const { fileId } = req.params, { action, comments, teamLeaderId, teamLeaderUsername, teamLeaderRole, team } = req.body;
  try {
    const file = await queryOne('SELECT * FROM files WHERE id = ?', [fileId]);
    if (!file) return res.status(404).json({ success: false, message: 'Not found' });
    if (file.current_stage !== 'pending_team_leader') return res.status(400).json({ success: false, message: 'Invalid stage' });

    const nowSql = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const newStatus = action === 'approve' ? 'team_leader_approved' : 'rejected_by_team_leader';
    const newStage = action === 'approve' ? 'pending_admin' : 'rejected_by_team_leader';

    await query(`UPDATE files SET status = ?, current_stage = ?, team_leader_id = ?, team_leader_username = ?, team_leader_reviewed_at = ?, team_leader_comments = ?${action === 'reject' ? ', rejection_reason = ?, rejected_by = ?, rejected_at = ?' : ''} WHERE id = ?`,
      action === 'reject' ? [newStatus, newStage, teamLeaderId, teamLeaderUsername, nowSql, comments, comments, teamLeaderUsername, nowSql, fileId] : [newStatus, newStage, teamLeaderId, teamLeaderUsername, nowSql, comments, fileId]);

    if (comments) await query('INSERT INTO file_comments (file_id, user_id, username, user_role, comment, comment_type) VALUES (?, ?, ?, ?, ?, ?)', [fileId, teamLeaderId, teamLeaderUsername, teamLeaderRole, comments, action === 'approve' ? 'approval' : 'rejection']);

    logActivity(query, teamLeaderId, teamLeaderUsername, teamLeaderRole, team, `File ${action}d: ${file.filename}`);
    logFileStatusChange(query, fileId, file.status, newStatus, file.current_stage, newStage, teamLeaderId, teamLeaderUsername, teamLeaderRole, `TL ${action}: ${comments || 'No comments'}`);
    
    createNotification(file.user_id, fileId, action === 'approve' ? 'approval' : 'rejection', `File ${action}d`, `Your file "${file.original_name}" was ${action}d by ${teamLeaderUsername}.`, teamLeaderId, teamLeaderUsername, teamLeaderRole).catch(() => {});
    if (action === 'approve') createAdminNotification(fileId, 'team_leader_approved', 'TL Approved', `${teamLeaderUsername} approved "${file.original_name}"`, teamLeaderId, teamLeaderUsername, teamLeaderRole).catch(() => {});

    res.json({ success: true, message: `File ${action}d` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/:fileId/admin-review', async (req, res) => {
  const { fileId } = req.params, { action, comments, adminId, adminUsername, adminRole, team } = req.body;
  try {
    let file = await queryOne('SELECT * FROM files WHERE id = ?', [fileId]), isAtt = false;
    if (!file) {
      file = await queryOne('SELECT *, created_at AS uploaded_at, uploaded_by_id AS user_id, uploaded_by_username AS username FROM assignment_attachments WHERE id = ?', [fileId]);
      if (!file) return res.status(404).json({ success: false });
      isAtt = true;
    }

    const nowSql = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const newStatus = action === 'approve' ? 'final_approved' : 'rejected_by_admin';
    const newStage = action === 'approve' ? 'published_to_public' : 'rejected_by_admin';

    if (isAtt) {
      await query(`UPDATE assignment_attachments SET status = ?, current_stage = ?, admin_reviewed_at = ?, admin_comments = ?${action === 'approve' ? ', final_approved_at = ?' : ''} WHERE id = ?`,
        action === 'approve' ? [newStatus, newStage, nowSql, comments || null, nowSql, fileId] : [newStatus, newStage, nowSql, comments || null, fileId]);
    } else {
      await query(`UPDATE files SET status = ?, current_stage = ?, admin_id = ?, admin_username = ?, admin_reviewed_at = ?, admin_comments = ?${action === 'approve' ? ', final_approved_at = ?' : ''}${action === 'reject' ? ', rejection_reason = ?, rejected_by = ?, rejected_at = ?' : ''} WHERE id = ?`,
        action === 'approve' ? [newStatus, newStage, adminId, adminUsername, nowSql, comments, nowSql, fileId] : [newStatus, newStage, adminId, adminUsername, nowSql, comments, comments, adminUsername, nowSql, fileId]);
      logFileStatusChange(query, fileId, file.status, newStatus, file.current_stage, newStage, adminId, adminUsername, adminRole, `Admin ${action}: ${comments || 'No comments'}`);
    }

    if (comments) await query('INSERT INTO file_comments (file_id, user_id, username, user_role, comment, comment_type) VALUES (?, ?, ?, ?, ?, ?)', [fileId, adminId, adminUsername, adminRole, comments, action === 'approve' ? 'approval' : 'rejection']);
    logActivity(query, adminId, adminUsername, adminRole, team, `File ${action}d: ${file.filename} (Admin)`);
    
    createNotification(file.user_id, fileId, action === 'approve' ? 'final_approval' : 'final_rejection', `Final ${action}`, `Your file "${file.original_name}" was ${action}d by admin.`, adminId, adminUsername, adminRole).catch(() => {});
    res.json({ success: true, message: `File ${action}d` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:fileId/comments', async (req, res) => {
  const comments = await query('SELECT * FROM file_comments WHERE file_id = ? ORDER BY created_at DESC', [req.params.fileId]);
  res.json({ success: true, comments });
});

router.post('/:fileId/comments', async (req, res) => {
  const { fileId } = req.params, { comment, userId, username, userRole } = req.body;
  try {
    const file = await queryOne('SELECT * FROM files WHERE id = ?', [fileId]);
    if (!file) return res.status(404).json({ success: false });
    const result = await query('INSERT INTO file_comments (file_id, user_id, username, user_role, comment) VALUES (?, ?, ?, ?, ?)', [fileId, userId, username, userRole, comment.trim()]);
    if (userId !== file.user_id) createNotification(file.user_id, fileId, 'comment', 'New Comment', `${username} commented on "${file.original_name}"`, userId, username, userRole).catch(() => {});
    res.json({ success: true, comment: { id: result.insertId, file_id: fileId, user_id: userId, username, user_role: userRole, comment: comment.trim(), created_at: new Date() } });
  } catch (err) { res.status(500).json({ success: false }); }
});

router.patch('/:fileId/priority', async (req, res) => {
  const { fileId } = req.params, { priority, dueDate, reviewerId, reviewerUsername } = req.body;
  try {
    await query(`UPDATE files SET priority = ?, due_date = ? WHERE id = ?`, [priority, dueDate, fileId]);
    const file = await queryOne('SELECT * FROM files WHERE id = ?', [fileId]);
    if (file) logActivity(query, reviewerId, reviewerUsername, 'team_leader', file.user_team, `Updated priority/due: ${file.original_name}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false }); }
});

router.get('/notifications/:team', async (req, res) => {
  const now = new Date().toISOString();
  const files = await query(`SELECT id, original_name, uploaded_at, priority, due_date, username FROM files WHERE user_team = ? AND current_stage = 'pending_team_leader' ORDER BY CASE WHEN due_date IS NOT NULL AND due_date < ? THEN 1 WHEN priority = 'urgent' THEN 2 WHEN priority = 'high' THEN 3 ELSE 4 END, uploaded_at ASC LIMIT 10`, [req.params.team, now]);
  res.json({ success: true, files });
});

router.get('/team/:team/status/:status', async (req, res) => {
  const { team, status } = req.params;
  let where = 'user_team = ?', params = [team];
  if (status === 'approved') { where += ' AND (status = "team_leader_approved" OR status = "final_approved")'; }
  else if (status === 'pending') { where += ' AND (current_stage = "pending_team_leader" OR current_stage = "pending_admin")'; }
  else if (status === 'rejected') { where += ' AND (status = "rejected_by_team_leader" OR status = "rejected_by_admin")'; }
  else return res.status(400).json({ success: false });
  const files = await query(`SELECT f.*, fc.comment as latest_comment FROM files f LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (SELECT MAX(id) FROM file_comments WHERE file_id = f.id) WHERE ${where} ORDER BY f.uploaded_at DESC`, params);
  res.json({ success: true, files });
});

module.exports = router;
