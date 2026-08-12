/**
 * Assignment Routes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query, queryOne } = require('../config/database');
const { uploadsDir, teamLeaderDir, moveToUserFolder, moveToTeamLeaderFolder } = require('../config/middleware');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { createAdminNotification, pushToUser } = require('./notifications');
const { decodeUTF8Filename, safeDeleteFile, safeDeleteDir } = require('../utils/fileUtils');

// ── Multer: temp upload storage ───────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    cb(null, `temp_${timestamp}_${randomString}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 * 1024 } // 50 GB
});

// ── Batched submission notifications ─────────────────────────────────────────
const pendingBatchSubmissions = new Map();

async function createBatchedSubmissionNotification(teamLeaderId, assignmentId, submissions) {
  try {
    const assignment = await queryOne('SELECT title FROM assignments WHERE id = ?', [assignmentId]);
    const firstSubmission = submissions[0];

    const realCount = await queryOne(
      'SELECT COUNT(*) as total FROM assignment_submissions WHERE assignment_id = ? AND user_id = ?',
      [assignmentId, firstSubmission.userId]
    );
    const totalFileCount = realCount ? realCount.total : submissions.length;

    const folderName = firstSubmission.folderName;
    const isFolder = folderName && totalFileCount > 1;

    let title = 'New File Submitted for Review';
    let message;
    if (isFolder) {
      title = 'New Folder Submitted for Review';
      message = `${firstSubmission.submitterName} submitted folder "${folderName}" (${totalFileCount} files) for the assignment "${assignment.title}"`;
    } else if (totalFileCount === 1) {
      message = `${firstSubmission.submitterName} submitted "${firstSubmission.fileName}" for the assignment "${assignment.title}"`;
    } else {
      message = `${firstSubmission.submitterName} submitted ${totalFileCount} files for the assignment "${assignment.title}"`;
    }

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

    await query(
      `INSERT INTO notifications (user_id, assignment_id, file_id, type, title, message, action_by_id, action_by_username, action_by_role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [finalTeamLeaderId, assignmentId, firstSubmission.fileId, 'submission', title, message,
        firstSubmission.userId, firstSubmission.username, 'USER']
    );

    console.log(`✅ Batched notification sent to TL ${finalTeamLeaderId}`);
    pushToUser(finalTeamLeaderId);
  } catch (error) {
    console.error('⚠️ Failed to create batched submission notification:', error);
  }
}

// ── Nonce store: prevents Electron multipart cache replay ────────────────────
const uploadNonces = new Map();
const uploadNonceCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of uploadNonces.entries()) {
    if (now > v.expiresAt) uploadNonces.delete(k);
  }
}, 5 * 60 * 1000);
if (typeof uploadNonceCleanupTimer.unref === 'function') uploadNonceCleanupTimer.unref();

// ── Routes ────────────────────────────────────────────────────────────────────

router.post('/upload-nonce', authenticateToken, (req, res) => {
  const nonce = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
  uploadNonces.set(nonce, { used: false, expiresAt: Date.now() + 2 * 60 * 1000 });
  res.json({ success: true, nonce });
});

router.get('/admin/all', authenticateToken, authorizeRole(['ADMIN']), async (req, res) => {
  try {
    const { cursor, limit = 20 } = req.query;
    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));

    let queryStr = `
      SELECT a.*,
        COUNT(DISTINCT asub.id) as submission_count,
        COUNT(DISTINCT am.id)   as assigned_members_count,
        COUNT(DISTINCT ac.id)   as comment_count
      FROM assignments a
      LEFT JOIN assignment_members am      ON a.id = am.assignment_id
      LEFT JOIN assignment_submissions asub ON a.id = asub.assignment_id
      LEFT JOIN assignment_comments ac     ON a.id = ac.assignment_id
    `;
    const queryParams = [];
    const conditions = [];

    if (cursor) {
      conditions.push('a.id < ?');
      queryParams.push(cursor);
    }
    if (conditions.length > 0) {
      queryStr += ' WHERE ' + conditions.join(' AND ');
    }
    queryStr += ' GROUP BY a.id ORDER BY a.created_at DESC, a.id DESC LIMIT ?';
    queryParams.push(parsedLimit + 1);

    const assignments = await query(queryStr, queryParams);
    const hasMore = assignments.length > parsedLimit;
    const assignmentsToReturn = hasMore ? assignments.slice(0, parsedLimit) : assignments;
    const nextCursor = hasMore && assignmentsToReturn.length > 0
      ? assignmentsToReturn[assignmentsToReturn.length - 1].id
      : null;

    for (const assignment of assignmentsToReturn) {
      assignment.assigned_member_details = await query(
        'SELECT u.id, u.username, u.fullName FROM assignment_members am JOIN users u ON am.user_id = u.id WHERE am.assignment_id = ?',
        [assignment.id]
      ) || [];

      assignment.attachments = await query(
        `SELECT id, original_name, filename, file_path, public_network_url, file_size, file_type, folder_name, relative_path, created_at,
                COALESCE(status, 'Task Reference') AS status,
                COALESCE(current_stage, 'published') AS current_stage
         FROM assignment_attachments WHERE assignment_id = ? ORDER BY COALESCE(folder_name, ''), created_at DESC`,
        [assignment.id]
      ) || [];

      assignment.submitted_files = await query(
        `SELECT f.id, f.original_name, f.filename, f.file_type, f.file_path, f.public_network_url, f.file_size,
                f.tag, f.description, f.uploaded_at, f.status, f.folder_name, f.relative_path, f.is_folder,
                u.username, u.fullName, asub.submitted_at, asub.submitted_at as created_at, asub.user_id
         FROM assignment_submissions asub
         JOIN files f ON asub.file_id = f.id
         JOIN users u ON asub.user_id = u.id
         WHERE asub.assignment_id = ? ORDER BY asub.submitted_at DESC`,
        [assignment.id]
      ) || [];

      const teamLeader = await queryOne(
        'SELECT fullName, username, email FROM users WHERE id = ?',
        [assignment.team_leader_id || assignment.teamLeaderId]
      );
      if (teamLeader) {
        assignment.team_leader_fullname = teamLeader.fullName;
        assignment.team_leader_username = teamLeader.username;
        assignment.team_leader_email = teamLeader.email;
      }
    }

    res.json({ success: true, assignments: assignmentsToReturn || [], nextCursor, hasMore });
  } catch (error) {
    console.error('Error in admin all assignments route:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch assignments', error: error.message });
  }
});

router.get('/all', authenticateToken, authorizeRole(['ADMIN']), async (req, res) => {
  req.url = '/admin/all';
  return router.handle(req, res, () => { });
});

router.get('/team-leader/:userId/all-submissions', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), async (req, res) => {
  try {
    const { userId } = req.params;
    const ledTeams = await query(
      'SELECT DISTINCT t.name FROM team_leaders tl JOIN teams t ON tl.team_id = t.id WHERE tl.user_id = ?',
      [userId]
    );
    const teamNames = (ledTeams || []).map(t => t.name);

    let memberSubmissions = [];
    if (teamNames.length > 0) {
      const placeholders = teamNames.map(() => '?').join(',');
      memberSubmissions = await query(
        `SELECT f.id, f.original_name, f.filename, f.file_type, f.file_path, f.public_network_url, f.file_size,
                f.uploaded_at, f.status, f.user_team, f.folder_name, f.relative_path, f.is_folder,
                u.username, u.fullName,
                asub.submitted_at, asub.submitted_at as created_at,
                a.id as assignment_id, a.title as assignment_title, a.due_date as assignment_due_date, a.team
         FROM assignment_submissions asub
         JOIN files f ON asub.file_id = f.id
         JOIN users u ON asub.user_id = u.id
         JOIN assignments a ON asub.assignment_id = a.id
         WHERE a.team IN (${placeholders}) ORDER BY asub.submitted_at DESC`,
        teamNames
      );
    }

    const tlFiles = await query(
      `SELECT f.id, f.original_name, f.filename, f.file_type, f.file_path, f.public_network_url, f.file_size,
              f.uploaded_at, f.status, f.user_team, f.folder_name, f.relative_path, f.is_folder,
              u.username, u.fullName,
              f.uploaded_at as submitted_at, f.uploaded_at as created_at,
              NULL as assignment_id, NULL as assignment_title, NULL as assignment_due_date, f.user_team as team
       FROM files f JOIN users u ON f.user_id = u.id WHERE f.user_id = ? ORDER BY f.uploaded_at DESC`,
      [userId]
    );

    const tlAttachments = await query(
      `SELECT aa.id, aa.original_name, aa.filename, aa.file_type, aa.file_path,
              COALESCE(aa.public_network_url, NULL) as public_network_url,
              aa.file_size, aa.created_at as uploaded_at,
              COALESCE(aa.status, 'Task Reference') as status,
              u.team as user_team, aa.folder_name, aa.relative_path, 0 as is_folder,
              aa.uploaded_by_username as username, u.fullName,
              aa.created_at as submitted_at, aa.created_at as created_at,
              a.id as assignment_id, a.title as assignment_title, a.due_date as assignment_due_date,
              u.team as team, 'assignment_attachment' as source_type
       FROM assignment_attachments aa
       JOIN assignments a ON aa.assignment_id = a.id
       JOIN users u ON aa.uploaded_by_id = u.id
       WHERE aa.uploaded_by_id = ? ORDER BY aa.created_at DESC`,
      [userId]
    );

    const memberFileIds = new Set(memberSubmissions.map(f => String(f.id)));
    const uniqueTLFiles = tlFiles.filter(f => !memberFileIds.has(String(f.id)));
    const allSubmissions = [...memberSubmissions, ...uniqueTLFiles, ...tlAttachments];

    res.json({ success: true, submissions: allSubmissions });
  } catch (error) {
    console.error('Error fetching all submissions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch submissions', error: error.message });
  }
});

router.get('/team/:team/all-tasks', authenticateToken, async (req, res) => {
  try {
    const { team } = req.params;
    const { cursor, limit = 20 } = req.query;
    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));

    let queryStr = `
      SELECT a.*,
        COUNT(DISTINCT CASE WHEN am.status = 'submitted' AND am.file_id IS NOT NULL THEN am.id END) as submission_count,
        COUNT(DISTINCT am.id) as assigned_members_count,
        COUNT(DISTINCT ac.id) as comment_count
      FROM assignments a
      LEFT JOIN assignment_members am ON a.id = am.assignment_id
      LEFT JOIN assignment_comments ac ON a.id = ac.assignment_id
      WHERE a.team = ?
    `;
    const queryParams = [team];
    if (cursor) { queryStr += ' AND a.id < ?'; queryParams.push(cursor); }
    queryStr += ' GROUP BY a.id ORDER BY a.created_at DESC, a.id DESC LIMIT ?';
    queryParams.push(parsedLimit + 1);

    const assignments = await query(queryStr, queryParams);
    const hasMore = assignments.length > parsedLimit;
    const assignmentsToReturn = hasMore ? assignments.slice(0, parsedLimit) : assignments;
    const nextCursor = hasMore && assignmentsToReturn.length > 0
      ? assignmentsToReturn[assignmentsToReturn.length - 1].id : null;

    if (assignmentsToReturn.length === 0) {
      return res.json({ success: true, assignments: [], nextCursor: null, hasMore: false });
    }

    const ids = assignmentsToReturn.map(a => a.id);
    const placeholders = ids.map(() => '?').join(',');

    const tlIds = [...new Set(assignmentsToReturn
      .map(a => a.team_leader_id || a.teamLeaderId)
      .filter(Boolean))];
    const tlPlaceholders = tlIds.map(() => '?').join(',');

    const [memberDetails, attachments, submissions, teamLeaders] = await Promise.all([
      query(`SELECT am.assignment_id, u.id, u.username, u.fullName FROM assignment_members am JOIN users u ON am.user_id = u.id WHERE am.assignment_id IN (${placeholders})`, ids),
      query(`SELECT assignment_id, id, original_name, filename, file_path, public_network_url, file_size, file_type, folder_name, relative_path, created_at, COALESCE(status, 'Task Reference') AS status, COALESCE(current_stage, 'published') AS current_stage FROM assignment_attachments WHERE assignment_id IN (${placeholders}) ORDER BY COALESCE(folder_name, ''), created_at DESC`, ids),
      query(`SELECT asub.assignment_id, f.id, f.original_name, f.filename, f.file_type, f.file_path, f.public_network_url, f.file_size, f.tag, f.description, f.uploaded_at, f.status, f.folder_name, f.relative_path, f.is_folder, u.username, u.fullName, u.id as user_id, asub.submitted_at FROM assignment_submissions asub JOIN files f ON asub.file_id = f.id JOIN users u ON asub.user_id = u.id WHERE asub.assignment_id IN (${placeholders}) ORDER BY asub.submitted_at DESC`, ids),
      tlIds.length > 0 ? query(`SELECT id, fullName, username, email FROM users WHERE id IN (${tlPlaceholders})`, tlIds) : Promise.resolve([]),
    ]);

    const memberMap = {}; memberDetails?.forEach(m => { if (!memberMap[m.assignment_id]) memberMap[m.assignment_id] = []; memberMap[m.assignment_id].push(m); });
    const attachmentMap = {}; attachments?.forEach(a => { if (!attachmentMap[a.assignment_id]) attachmentMap[a.assignment_id] = []; attachmentMap[a.assignment_id].push(a); });
    const submissionMap = {}; submissions?.forEach(s => { if (!submissionMap[s.assignment_id]) submissionMap[s.assignment_id] = []; submissionMap[s.assignment_id].push(s); });
    const tlMap = {}; teamLeaders?.forEach(tl => tlMap[tl.id] = tl);

    for (const assignment of assignmentsToReturn) {
      assignment.assigned_member_details = memberMap[assignment.id] || [];
      assignment.attachments = attachmentMap[assignment.id] || [];
      assignment.submitted_files = submissionMap[assignment.id] || [];
      const tl = tlMap[assignment.team_leader_id || assignment.teamLeaderId];
      if (tl) {
        assignment.team_leader_fullname = tl.fullName; assignment.team_leader_username = tl.username; assignment.team_leader_email = tl.email;
      }
    }
    res.json({ success: true, assignments: assignmentsToReturn, nextCursor, hasMore });
  } catch (error) {
    console.error('Error in team all tasks route:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch team tasks', error: error.message });
  }
});

router.get('/team-leader/:userId', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), async (req, res) => {
  try {
    const { userId } = req.params;
    const ledTeams = await query('SELECT DISTINCT t.name FROM team_leaders tl JOIN teams t ON tl.team_id = t.id WHERE tl.user_id = ?', [userId]);
    if (!ledTeams || ledTeams.length === 0) return res.json({ success: true, assignments: [] });

    const teamNames = ledTeams.map(t => t.name);
    const placeholders = teamNames.map(() => '?').join(',');
    const tlAssignments = await query(
      `SELECT a.*, COUNT(DISTINCT asub.id) as submission_count, COUNT(DISTINCT am.id) as assigned_members_count, COUNT(DISTINCT ac.id) as comment_count
       FROM assignments a
       LEFT JOIN assignment_members am ON a.id = am.assignment_id
       LEFT JOIN assignment_submissions asub ON a.id = asub.assignment_id
       LEFT JOIN assignment_comments ac ON a.id = ac.assignment_id
       WHERE a.team IN (${placeholders}) GROUP BY a.id ORDER BY a.created_at DESC`,
      teamNames
    );

    for (const assignment of tlAssignments) {
      assignment.assigned_member_details = await query('SELECT u.id, u.username, u.fullName FROM assignment_members am JOIN users u ON am.user_id = u.id WHERE am.assignment_id = ?', [assignment.id]) || [];
      assignment.attachments = await query(`SELECT id, original_name, filename, file_path, public_network_url, file_size, file_type, folder_name, relative_path, created_at, COALESCE(status, 'Task Reference') AS status, COALESCE(current_stage, 'published') AS current_stage FROM assignment_attachments WHERE assignment_id = ? ORDER BY COALESCE(folder_name, ''), created_at DESC`, [assignment.id]) || [];
      assignment.submitted_files = await query(`SELECT f.id, f.original_name, f.filename, f.file_type, f.file_path, f.public_network_url, f.file_size, f.tag, f.description, f.uploaded_at, f.status, f.folder_name, f.relative_path, f.is_folder, u.username, u.fullName, asub.submitted_at FROM assignment_submissions asub JOIN files f ON asub.file_id = f.id JOIN users u ON asub.user_id = u.id WHERE asub.assignment_id = ? ORDER BY asub.submitted_at DESC`, [assignment.id]) || [];
      const tl = await queryOne('SELECT fullName, username, email FROM users WHERE id = ?', [assignment.team_leader_id || assignment.teamLeaderId]);
      if (tl) { assignment.team_leader_fullname = tl.fullName; assignment.team_leader_username = tl.username; assignment.team_leader_email = tl.email; }
    }
    res.json({ success: true, assignments: tlAssignments || [] });
  } catch (error) {
    console.error('Error in fetchAssignments route:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch assignments', error: error.message });
  }
});

router.post('/create-json', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), async (req, res) => {
  try {
    const { title, description, dueDate, fileTypeRequired, assignedTo, assignedMembers, teamLeaderId, teamLeaderUsername, team } = req.body;
    const finalMembers = Array.isArray(assignedMembers) ? assignedMembers : [];

    if (!title || !team || !teamLeaderId) return res.status(400).json({ success: false, message: 'Missing fields' });

    const result = await query(
      `INSERT INTO assignments 
      (title, description, due_date, file_type_required, assigned_to, max_file_size, team_leader_id, team_leader_username, team, created_at, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'active')`, 
      [title, description || null, dueDate || null, fileTypeRequired || null, assignedTo || 'specific', 10485760, teamLeaderId, teamLeaderUsername, team]
    );
    
    const assignmentId = result.insertId;

    if (assignedTo === 'all') {
      const teamMembers = await query('SELECT id FROM users WHERE team = ? AND role = ?', [team, 'USER']);
      if (teamMembers?.length > 0) {
        const placeholders = teamMembers.map(() => '(?, ?)').join(', ');
        await query(`INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`, teamMembers.flatMap(m => [assignmentId, m.id]));
      }
    } else if (finalMembers.length > 0) {
      const placeholders = finalMembers.map(() => '(?, ?)').join(', ');
      await query(`INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`, finalMembers.flatMap(uid => [assignmentId, uid]));
    }

    res.json({ success: true, message: 'Assignment created (metadata)', assignmentId, membersAssigned: finalMembers.length });
  } catch (error) {
    console.error('Error in create-json assignment:', error);
    res.status(500).json({ success: false, message: 'Failed to create assignment', error: error.message });
  }
});

router.post('/create', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), upload.array('attachments', 10000), async (req, res) => {
  try {
    const { title, description, dueDate, fileTypeRequired, assignedTo, assignedMembers, teamLeaderId, teamLeaderUsername, team } = req.body;
    const finalMembers = typeof assignedMembers === 'string' ? JSON.parse(assignedMembers) : (assignedMembers || []);
    const requestNonce = req.body.uploadNonce;
    const rawFiles = req.files || [];

    if (req.is('multipart/form-data')) {
      if (!requestNonce || !uploadNonces.has(requestNonce)) return res.status(400).json({ success: false, message: 'Invalid nonce' });
      const entry = uploadNonces.get(requestNonce); if (entry.used) return res.status(400).json({ success: false, message: 'Nonce used' });
      entry.used = true;
    }

    const uploadedFiles = req.body.hasAttachments === 'true' ? rawFiles : [];
    if (!title || !team || !teamLeaderId) return res.status(400).json({ success: false, message: 'Missing fields' });

    const result = await query(`INSERT INTO assignments (title, description, due_date, file_type_required, assigned_to, max_file_size, team_leader_id, team_leader_username, team, created_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'active')`, [title, description || null, dueDate || null, fileTypeRequired || null, assignedTo || 'specific', 10485760, teamLeaderId, teamLeaderUsername, team]);
    const assignmentId = result.insertId;
    let attachmentsCreated = 0;

    if (uploadedFiles.length > 0) {
      let relativePaths = []; try { relativePaths = JSON.parse(req.body.relativePaths || '[]'); } catch (e) { }
      
      // Parallelize file processing and DB insertion
      await Promise.all(uploadedFiles.map(async (file, i) => {
        const fixedName = decodeUTF8Filename(file.originalname);
        const relPath = relativePaths[i] || fixedName;
        const folderName = relPath.includes('/') ? relPath.split('/')[0] : null;
        const finalPath = await moveToTeamLeaderFolder(file.path, teamLeaderUsername, fixedName, folderName, relPath);
        
        await query(
          `INSERT INTO assignment_attachments 
          (assignment_id, original_name, filename, file_path, file_size, file_type, 
           uploaded_by_id, uploaded_by_username, folder_name, relative_path, status, current_stage) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Task Reference', 'published')`, 
          [assignmentId, fixedName, path.basename(finalPath), finalPath, file.size, file.mimetype, 
           teamLeaderId, teamLeaderUsername, folderName, relPath !== fixedName ? relPath : null]
        );
        attachmentsCreated++;
      }));
    }

    if (assignedTo === 'all') {
      const teamMembers = await query('SELECT id FROM users WHERE team = ? AND role = ?', [team, 'USER']);
      if (teamMembers?.length > 0) {
        const placeholders = teamMembers.map(() => '(?, ?)').join(', ');
        await query(`INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`, teamMembers.flatMap(m => [assignmentId, m.id]));
      }
    } else if (finalMembers.length > 0) {
      const placeholders = finalMembers.map(() => '(?, ?)').join(', ');
      await query(`INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`, finalMembers.flatMap(uid => [assignmentId, uid]));
    }

    res.json({ success: true, message: 'Assignment created', assignmentId, attachmentsCreated });
  } catch (error) {
    console.error('Error in create assignment:', error);
    res.status(500).json({ success: false, message: 'Failed to create assignment', error: error.message });
  }
});

router.put('/:id', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), upload.array('attachments', 10000), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, dueDate, fileTypeRequired, assignedTo, assignedMembers, teamLeaderId, teamLeaderUsername, team } = req.body;
    const rawFiles = req.files || [];
    const requestNonce = req.body.uploadNonce;

    if (req.is('multipart/form-data')) {
      if (!requestNonce || !uploadNonces.has(requestNonce)) return res.status(400).json({ success: false, message: 'Invalid nonce' });
      const entry = uploadNonces.get(requestNonce); if (entry.used) return res.status(400).json({ success: false, message: 'Nonce used' });
      entry.used = true;
    }

    // Handle removed attachments
    let removeAttachmentIds = []; try { removeAttachmentIds = JSON.parse(req.body.removeAttachmentIds || '[]'); } catch (e) { }
    for (const attId of removeAttachmentIds) {
      const att = await queryOne('SELECT * FROM assignment_attachments WHERE id = ? AND assignment_id = ?', [attId, id]);
      if (att?.file_path) { await safeDeleteFile(att.file_path); await query('DELETE FROM assignment_attachments WHERE id = ?', [attId]); }
    }

    await query('UPDATE assignments SET title=?, description=?, due_date=?, file_type_required=?, assigned_to=? WHERE id=?', [title, description || null, dueDate || null, fileTypeRequired || null, assignedTo || 'specific', id]);

    let attachmentsCreated = 0;
    if (req.body.hasAttachments === 'true' && rawFiles.length > 0) {
      let relativePaths = []; try { relativePaths = JSON.parse(req.body.relativePaths || '[]'); } catch (e) { }
      
      // Parallelize file processing and DB insertion
      await Promise.all(rawFiles.map(async (file, i) => {
        const fixedName = decodeUTF8Filename(file.originalname);
        const relPath = relativePaths[i] || fixedName;
        const folderName = relPath.includes('/') ? relPath.split('/')[0] : null;
        const finalPath = await moveToTeamLeaderFolder(file.path, teamLeaderUsername, fixedName, folderName, relPath);
        
        await query(
          `INSERT INTO assignment_attachments 
          (assignment_id, original_name, filename, file_path, file_size, file_type, 
           uploaded_by_id, uploaded_by_username, folder_name, relative_path, status, current_stage) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Task Reference', 'published')`, 
          [id, fixedName, path.basename(finalPath), finalPath, file.size, file.mimetype, 
           teamLeaderId, teamLeaderUsername, folderName, relPath !== fixedName ? relPath : null]
        );
        attachmentsCreated++;
      }));
    }

    if (Array.isArray(assignedMembers)) {
      await query('DELETE FROM assignment_members WHERE assignment_id = ?', [id]);
      if (assignedMembers.length > 0) {
        const placeholders = assignedMembers.map(() => '(?, ?)').join(', ');
        await query(`INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`, assignedMembers.flatMap(uid => [id, uid]));
      }
    }

    res.json({ success: true, message: 'Assignment updated', attachmentsCreated });
  } catch (error) {
    console.error('Error in update assignment:', error);
    res.status(500).json({ success: false, message: 'Failed to update assignment', error: error.message });
  }
});

router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await queryOne('SELECT fullName, username, team FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const assignments = await query(
      `SELECT a.*, am.status as user_status, am.submitted_at as user_submitted_at, fs.original_name as submitted_file_name, fs.file_path as submitted_file_path, fs.status as submitted_file_status, fs.id as submitted_file_id, tl.fullName as team_leader_fullname, (SELECT COUNT(*) FROM assignment_comments ac WHERE ac.assignment_id = a.id) as comment_count
       FROM assignments a
       LEFT JOIN assignment_members am ON a.id = am.assignment_id AND am.user_id = ?
       LEFT JOIN files fs ON am.file_id = fs.id
       LEFT JOIN users tl ON a.team_leader_id = tl.id
       WHERE (a.assigned_to = 'all' AND a.team = ?) OR (a.assigned_to = 'specific' AND am.user_id = ?)
       ORDER BY a.created_at DESC`,
      [userId, user.team, userId]
    );

    for (const a of assignments) {
      a.attachments = await query(`SELECT id, original_name, filename, file_path, public_network_url, file_size, file_type, folder_name, relative_path, created_at, COALESCE(status, 'Task Reference') AS status, COALESCE(current_stage, 'published') AS current_stage FROM assignment_attachments WHERE assignment_id = ? ORDER BY COALESCE(folder_name, ''), created_at DESC`, [a.id]) || [];
      a.submitted_files = await query(`SELECT f.*, asub.submitted_at FROM assignment_submissions asub JOIN files f ON asub.file_id = f.id WHERE asub.assignment_id = ? AND asub.user_id = ? ORDER BY asub.submitted_at DESC`, [a.id, userId]) || [];
    }
    res.json({ success: true, assignments });
  } catch (error) {
    console.error('Error in user assignments:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch assignments', error: error.message });
  }
});

router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const { assignmentId, userId, fileId } = req.body;
    await query('INSERT INTO assignment_submissions (assignment_id, file_id, user_id, submitted_at) VALUES (?, ?, ?, NOW())', [assignmentId, fileId, userId]);
    await query('UPDATE assignment_members SET status = ?, submitted_at = NOW(), file_id = ? WHERE assignment_id = ? AND user_id = ?', ['submitted', fileId, assignmentId, userId]);
    res.json({ success: true, message: 'Submitted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:assignmentId/comments', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const comments = await query(`SELECT ac.*, u.fullName as user_fullname, u.role as user_role FROM assignment_comments ac JOIN users u ON ac.user_id = u.id WHERE ac.assignment_id = ? ORDER BY ac.created_at ASC`, [assignmentId]);
    for (const c of comments) { c.replies = await query(`SELECT cr.*, u.fullName as user_fullname, u.role as user_role FROM comment_replies cr JOIN users u ON cr.user_id = u.id WHERE cr.comment_id = ? ORDER BY cr.created_at ASC`, [c.id]) || []; }
    res.json({ success: true, comments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:assignmentId/comments', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { userId, username, comment } = req.body;
    const user = await queryOne('SELECT fullName, role FROM users WHERE id = ?', [userId]);
    const result = await query(`INSERT INTO assignment_comments (assignment_id, user_id, username, user_fullname, user_role, comment) VALUES (?, ?, ?, ?, ?, ?)`, [assignmentId, userId, username, user.fullName, user.role, comment]);
    res.json({ success: true, commentId: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:assignmentId', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const atts = await query('SELECT file_path FROM assignment_attachments WHERE assignment_id = ?', [assignmentId]);
    for (const att of atts) { if (att.file_path) await safeDeleteFile(att.file_path); }
    await query('DELETE FROM assignment_submissions WHERE assignment_id = ?', [assignmentId]);
    await query('DELETE FROM assignment_members WHERE assignment_id = ?', [assignmentId]);
    await query('DELETE FROM assignment_comments WHERE assignment_id = ?', [assignmentId]);
    await query('DELETE FROM assignment_attachments WHERE assignment_id = ?', [assignmentId]);
    await query('DELETE FROM assignments WHERE id = ?', [assignmentId]);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:assignmentId/attachments/:attachmentId', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), async (req, res) => {
  try {
    const att = await queryOne('SELECT file_path FROM assignment_attachments WHERE id = ?', [req.params.attachmentId]);
    if (att?.file_path) await safeDeleteFile(att.file_path);
    await query('DELETE FROM assignment_attachments WHERE id = ?', [req.params.attachmentId]);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Standalone attachment upload endpoint.
 * Supports adding new attachments to an existing assignment.
 */
router.post('/:id/attachments', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), upload.array('attachments', 100), async (req, res) => {
  try {
    const { id } = req.params;
    const { teamLeaderId, teamLeaderUsername } = req.body;
    const rawFiles = req.files || [];

    if (rawFiles.length === 0) return res.status(400).json({ success: false, message: 'No files uploaded' });

    let relativePaths = []; try { relativePaths = JSON.parse(req.body.relativePaths || '[]'); } catch (e) { }

    const results = await Promise.all(rawFiles.map(async (file, i) => {
      const fixedName = decodeUTF8Filename(file.originalname);
      const relPath = relativePaths[i] || fixedName;
      const folderName = relPath.includes('/') ? relPath.split('/')[0] : null;
      const finalPath = await moveToTeamLeaderFolder(file.path, teamLeaderUsername, fixedName, folderName, relPath);

      await query(
        `INSERT INTO assignment_attachments 
        (assignment_id, original_name, filename, file_path, file_size, file_type, 
         uploaded_by_id, uploaded_by_username, folder_name, relative_path, status, current_stage) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Task Reference', 'published')`,
        [id, fixedName, path.basename(finalPath), finalPath, file.size, file.mimetype,
         teamLeaderId, teamLeaderUsername, folderName, relPath !== fixedName ? relPath : null]
      );
      return { original_name: fixedName, success: true };
    }));

    res.json({ success: true, message: `${results.length} attachments added`, results });
  } catch (error) {
    console.error('Error adding attachments:', error);
    res.status(500).json({ success: false, message: 'Failed to add attachments', error: error.message });
  }
});

console.log('✅ Assignments routes registered');
module.exports = router;
