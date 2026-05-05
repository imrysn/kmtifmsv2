const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { db, query, queryOne, networkDataPath } = require('../../config/database-mysql');
const { upload, uploadsDir, moveToUserFolder } = require('../../config/middleware');
const { logActivity, logFileStatusChange } = require('../../utils/logger');
const { getFileTypeDescription } = require('../../utils/fileHelpers');
const { safeDeleteFile } = require('../../utils/fileUtils');
const { createNotification, createAdminNotification } = require('../notifications');
const { syncDeletedFiles } = require('../../services/fileSyncService');

const router = express.Router();

// Helper: resolve physical file path
async function resolveFilePath(storedPath, username = null) {
  if (!storedPath) return null;
  if (/^\\\\/.test(storedPath) || path.isAbsolute(storedPath)) return storedPath;
  if (storedPath.startsWith('/uploads/')) {
    const rel = storedPath.substring(9);
    if (rel.includes('/')) return path.join(uploadsDir, rel);
    if (username) {
      const userPath = path.join(uploadsDir, username, path.basename(storedPath));
      try { await fs.access(userPath); return userPath; } catch (e) {}
    }
    return path.join(uploadsDir, rel);
  }
  return path.join(uploadsDir, path.basename(storedPath));
}

// ── Manual file sync endpoint ─────────────────────────────────────────────
router.get('/:id/path', async (req, res) => {
  const { id } = req.params;
  try {
    const file = await queryOne('SELECT file_path, original_name, public_network_url, status FROM files WHERE id = ?', [id]);
    if (!file) {
      const attachment = await queryOne('SELECT file_path, original_name, public_network_url, status FROM assignment_attachments WHERE id = ?', [id]);
      if (!attachment) return res.status(404).json({ success: false, message: 'File not found' });
      
      let abs = attachment.public_network_url && !attachment.public_network_url.startsWith('http') 
        ? attachment.public_network_url : await resolveFilePath(attachment.file_path, attachment.uploaded_by_username);
      return res.json({ success: true, filePath: abs, originalName: attachment.original_name });
    }
    let abs = file.public_network_url && !file.public_network_url.startsWith('http') 
      ? file.public_network_url : await resolveFilePath(file.file_path, file.username);
    res.json({ success: true, filePath: abs, originalName: file.original_name });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error resolving path' });
  }
});

router.get('/member/:memberId', async (req, res) => {
  try {
    const files = await query(`SELECT f.*, fc.comment as latest_comment FROM files f LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (SELECT MAX(id) FROM file_comments WHERE file_id = f.id) WHERE f.user_id = ? ORDER BY f.uploaded_at DESC`, [req.params.memberId]);
    res.json({ success: true, files });
  } catch (err) { res.status(500).json({ success: false, message: 'Error' }); }
});

router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params, page = parseInt(req.query.page) || 1, limit = parseInt(req.query.limit) || 1000, offset = (page - 1) * limit;
  try {
    const countResult = await queryOne('SELECT COUNT(*) as total FROM files WHERE user_id = ?', [userId]);
    const files = await query(`SELECT f.*, fc.comment as latest_comment FROM files f LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (SELECT MAX(id) FROM file_comments WHERE file_id = f.id) WHERE f.user_id = ? ORDER BY f.uploaded_at DESC LIMIT ? OFFSET ?`, [userId, limit, offset]);
    res.json({ success: true, files, pagination: { page, limit, total: countResult.total, pages: Math.ceil(countResult.total / limit) } });
  } catch (err) { res.status(500).json({ success: false, message: 'Error' }); }
});

router.get('/user/:userId/pending', async (req, res) => {
  const { userId } = req.params, page = parseInt(req.query.page) || 1, limit = parseInt(req.query.limit) || 50, offset = (page - 1) * limit;
  try {
    const countResult = await queryOne('SELECT COUNT(*) as total FROM files WHERE user_id = ?', [userId]);
    const files = await query(`SELECT f.*, GROUP_CONCAT(fc.comment, ' | ') as comments FROM files f LEFT JOIN file_comments fc ON f.id = fc.file_id WHERE f.user_id = ? GROUP BY f.id ORDER BY f.uploaded_at DESC LIMIT ? OFFSET ?`, [userId, limit, offset]);
    const processed = files.map(f => ({ ...f, comments: f.comments ? f.comments.split(' | ').map(c => ({ comment: c })) : [] }));
    res.json({ success: true, files: processed, pagination: { page, limit, total: countResult.total, pages: Math.ceil(countResult.total / limit) } });
  } catch (err) { res.status(500).json({ success: false, message: 'Error' }); }
});

router.get('/team-leader/:team', async (req, res) => {
  const { team } = req.params, page = parseInt(req.query.page) || 1, limit = parseInt(req.query.limit) || 50, offset = (page - 1) * limit;
  try {
    const countResult = await queryOne('SELECT COUNT(*) as total FROM files WHERE user_team = ? AND current_stage = ?', [team, 'pending_team_leader']);
    const files = await query(`SELECT f.*, fc.comment as latest_comment FROM files f LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (SELECT MAX(id) FROM file_comments WHERE file_id = f.id) WHERE f.user_team = ? AND f.current_stage = 'pending_team_leader' ORDER BY f.uploaded_at DESC LIMIT ? OFFSET ?`, [team, limit, offset]);
    res.json({ success: true, files, pagination: { page, limit, total: countResult.total, pages: Math.ceil(countResult.total / limit) } });
  } catch (err) { res.status(500).json({ success: false, message: 'Error' }); }
});

router.get('/admin', async (req, res) => {
  const page = parseInt(req.query.page) || 1, limit = parseInt(req.query.limit) || 50, offset = (page - 1) * limit;
  try {
    const countResult = await queryOne('SELECT COUNT(*) as total FROM files WHERE current_stage = ?', ['pending_admin']);
    const files = await query(`SELECT f.*, fc.comment as latest_comment FROM files f LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (SELECT MAX(id) FROM file_comments WHERE file_id = f.id) WHERE f.current_stage = 'pending_admin' ORDER BY f.uploaded_at DESC LIMIT ? OFFSET ?`, [limit, offset]);
    res.json({ success: true, files, pagination: { page, limit, total: countResult.total, pages: Math.ceil(countResult.total / limit) } });
  } catch (err) { res.status(500).json({ success: false, message: 'Error' }); }
});

router.get('/all', async (req, res) => {
  try {
    const files = await query(`SELECT f.*, fc.comment as latest_comment FROM files f LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (SELECT MAX(id) FROM file_comments WHERE file_id = f.id) ORDER BY f.uploaded_at DESC`);
    const attachments = await query(`SELECT aa.id, aa.original_name, aa.filename, aa.file_path, aa.file_size, aa.file_type, aa.created_at AS uploaded_at, COALESCE(aa.status, 'team_leader_approved') AS status, COALESCE(aa.current_stage, 'pending_admin') AS current_stage, aa.uploaded_by_username AS username, aa.uploaded_by_id AS user_id, u.team AS user_team, 'assignment_attachment' AS source_type FROM assignment_attachments aa LEFT JOIN users u ON aa.uploaded_by_id = u.id ORDER BY aa.created_at DESC`);
    const fileIds = new Set(files.map(f => String(f.id)));
    const all = [...files, ...attachments.filter(a => !fileIds.has(String(a.id)))];
    res.json({ success: true, files: all });
  } catch (err) { res.status(500).json({ success: false, message: 'Error' }); }
});

router.post('/:fileId/move-to-projects', async (req, res) => {
  const { fileId } = req.params, { destinationPath, adminId, adminUsername, adminRole, team, deleteFromUploads } = req.body;
  try {
    let file = await queryOne('SELECT * FROM files WHERE id = ?', [fileId]), isAttachment = false;
    if (!file) {
      file = await queryOne('SELECT *, created_at AS uploaded_at FROM assignment_attachments WHERE id = ?', [fileId]);
      if (file) { isAttachment = true; file.username = file.uploaded_by_username; }
    }
    if (!file) return res.status(404).json({ success: false, message: 'Not found' });

    let src = await resolveFilePath(file.file_path, file.username);
    if (!await fs.access(src).then(() => true).catch(() => false)) return res.status(404).json({ success: false, message: 'Source not found' });

    const destFile = path.join(destinationPath, file.original_name);
    await fs.mkdir(destinationPath, { recursive: true });
    if (await fs.access(destFile).then(() => true).catch(() => false)) return res.status(409).json({ success: false, message: 'Exists' });

    await fs.copyFile(src, destFile);
    if (deleteFromUploads) await safeDeleteFile(src);

    if (isAttachment) await query('UPDATE assignment_attachments SET public_network_url = ? WHERE id = ?', [destFile, fileId]);
    else await query('UPDATE files SET public_network_url = ? WHERE id = ?', [destFile, fileId]);

    logActivity(query, adminId, adminUsername, adminRole, team, `Moved: ${file.original_name} -> ${destFile}`);
    res.json({ success: true, destinationPath: destFile });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:fileId', async (req, res) => {
  const { fileId } = req.params, { adminId, adminUsername, adminRole, team } = req.body;
  try {
    const file = await queryOne('SELECT * FROM files WHERE id = ?', [fileId]);
    if (!file) {
      const att = await queryOne('SELECT * FROM assignment_attachments WHERE id = ?', [fileId]);
      if (!att) return res.status(404).json({ success: false });
      let p = att.public_network_url || await resolveFilePath(att.file_path, att.uploaded_by_username);
      if (p) await safeDeleteFile(p);
      await query('DELETE FROM assignment_attachments WHERE id = ?', [fileId]);
      logActivity(query, adminId, adminUsername, adminRole, team, `Deleted att: ${att.original_name}`);
      return res.json({ success: true });
    }

    const subs = await query('SELECT assignment_id, user_id FROM assignment_submissions WHERE file_id = ?', [fileId]);
    for (const s of subs) await query('UPDATE assignment_members SET status = "pending", submitted_at = NULL WHERE assignment_id = ? AND user_id = ?', [s.assignment_id, s.user_id]);
    await query('DELETE FROM assignment_submissions WHERE file_id = ?', [fileId]);

    let p = file.public_network_url || await resolveFilePath(file.file_path, file.username);
    if (p) await safeDeleteFile(p);
    await query('DELETE FROM files WHERE id = ?', [fileId]);
    logActivity(query, adminId, adminUsername, adminRole, team, `Deleted file: ${file.filename}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:fileId', async (req, res) => {
  const file = await queryOne('SELECT * FROM files WHERE id = ?', [req.params.fileId]);
  if (!file) return res.status(404).json({ success: false });
  res.json({ success: true, file });
});

router.get('/:fileId/history', async (req, res) => {
  const history = await query('SELECT * FROM file_status_history WHERE file_id = ? ORDER BY created_at DESC', [req.params.fileId]);
  res.json({ success: true, history });
});

router.post('/:id/delete-file', async (req, res) => {
  const file = await queryOne('SELECT * FROM files WHERE id = ?', [req.params.id]);
  if (!file) return res.status(404).json({ success: false });
  let p = file.public_network_url || await resolveFilePath(file.file_path, file.username);
  if (!p) return res.status(400).json({ success: false });
  const result = await safeDeleteFile(p);
  res.json({ success: result.success });
});

module.exports = router;
