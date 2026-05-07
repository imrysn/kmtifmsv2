/**
 * Assignment Routes
 *
 * MERGE RESOLUTION NOTES:
 * - HEAD had: clean controller-based thin routes with authenticateToken/authorizeRole,
 *   plus the /admin/all alias we added to fix the 404.
 * - THEIRS had: full inline implementation with many additional features:
 *     batched submission notifications, @mention notifications, SSE push (pushToUser),
 *     nonce-based Electron upload-replay protection, create-json route, upload-nonce route,
 *     archive route, update-members route, edit/delete replies, debug endpoint,
 *     and richer comment/reply inline SQL.
 *
 * RESOLUTION: Keep THEIRS (more feature-complete) as the base.
 * Add authenticateToken middleware from HEAD on every route (was missing entirely in THEIRS).
 * Keep /admin/all alias from HEAD alongside THEIRS' /admin/all inline handler.
 * The controller (assignmentController) is no longer used — all logic lives inline here.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query, queryOne } = require('../../database/config');
const { uploadsDir, moveToUserFolder } = require('../config/middleware');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { createAdminNotification, pushToUser } = require('./notifications');
const { decodeUTF8Filename } = require('../utils/fileUtils');

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
// Groups multiple rapid file submissions into a single notification for the TL.
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
const uploadNonces = new Map(); // nonce -> { used: bool, expiresAt: number }

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of uploadNonces.entries()) {
    if (now > v.expiresAt) {
      uploadNonces.delete(k);
    }
  }
}, 5 * 60 * 1000);

// ── Routes ────────────────────────────────────────────────────────────────────

// Issue a one-time upload nonce (client calls this immediately before each upload)
router.post('/upload-nonce', authenticateToken, (req, res) => {
  const nonce = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
  uploadNonces.set(nonce, { used: false, expiresAt: Date.now() + 2 * 60 * 1000 });
  res.json({ success: true, nonce });
});

// GET /admin/all — paginated cursor-based admin view of all assignments
// (HEAD added /all as a legacy alias; both are kept)
router.get('/admin/all', authenticateToken, authorizeRole(['ADMIN']), async (req, res) => {
  try {
    const { cursor, limit = 20 } = req.query;
    const parsedLimit = parseInt(limit, 10);

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
                COALESCE(status, 'team_leader_approved') AS status,
                COALESCE(current_stage, 'pending_admin') AS current_stage
         FROM assignment_attachments WHERE assignment_id = ? ORDER BY COALESCE(folder_name, ''), created_at DESC`,
        [assignment.id]
      ) || [];

      assignment.recent_submissions = await query(
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

// Legacy alias — same handler as /admin/all
router.get('/all', authenticateToken, authorizeRole(['ADMIN']), async (req, res) => {
  req.url = '/admin/all';
  return router.handle(req, res, () => { });
});

// GET /team-leader/:userId/all-submissions
router.get('/team-leader/:userId/all-submissions', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🔍 DASHBOARD API: Fetching all submissions for TL user ID: ${userId}`);

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
              COALESCE(aa.status, 'team_leader_approved') as status,
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
    const allExistingIds = new Set([...memberFileIds, ...uniqueTLFiles.map(f => String(f.id))]);
    const uniqueAttachments = tlAttachments.filter(f => !allExistingIds.has(String(f.id)));
    const allSubmissions = [...memberSubmissions, ...uniqueTLFiles, ...uniqueAttachments];

    console.log(`✅ DASHBOARD API: ${memberSubmissions.length} member + ${uniqueTLFiles.length} TL + ${uniqueAttachments.length} attachments = ${allSubmissions.length} total`);
    res.json({ success: true, submissions: allSubmissions });
  } catch (error) {
    console.error('❌ DASHBOARD API: Error fetching all submissions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch submissions', error: error.message });
  }
});

// GET /team/:team/all-tasks
router.get('/team/:team/all-tasks', authenticateToken, async (req, res) => {
  try {
    const { team } = req.params;
    const { cursor, limit = 20 } = req.query;
    const parsedLimit = parseInt(limit, 10);

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
    if (cursor) {
      queryStr += ' AND a.id < ?'; queryParams.push(cursor);
    }
    queryStr += ' GROUP BY a.id ORDER BY a.created_at DESC, a.id DESC LIMIT ?';
    queryParams.push(parsedLimit + 1);

    const assignments = await query(queryStr, queryParams);
    const hasMore = assignments.length > parsedLimit;
    const assignmentsToReturn = hasMore ? assignments.slice(0, parsedLimit) : assignments;
    const nextCursor = hasMore && assignmentsToReturn.length > 0
      ? assignmentsToReturn[assignmentsToReturn.length - 1].id : null;

    for (const assignment of assignmentsToReturn) {
      assignment.assigned_member_details = await query(
        'SELECT u.id, u.username, u.fullName FROM assignment_members am JOIN users u ON am.user_id = u.id WHERE am.assignment_id = ?',
        [assignment.id]
      ) || [];
      assignment.attachments = await query(
        `SELECT id, original_name, filename, file_path, public_network_url, file_size, file_type, folder_name, relative_path, created_at,
                COALESCE(status, 'team_leader_approved') AS status, COALESCE(current_stage, 'pending_admin') AS current_stage
         FROM assignment_attachments WHERE assignment_id = ? ORDER BY COALESCE(folder_name, ''), created_at DESC`,
        [assignment.id]
      ) || [];
      assignment.recent_submissions = await query(
        `SELECT f.id, f.original_name, f.filename, f.file_type, f.file_path, f.public_network_url, f.file_size,
                f.tag, f.description, f.uploaded_at, f.status, f.folder_name, f.relative_path, f.is_folder,
                u.username, u.fullName, asub.submitted_at, asub.submitted_at as created_at
         FROM assignment_submissions asub
         JOIN files f ON asub.file_id = f.id JOIN users u ON asub.user_id = u.id
         WHERE asub.assignment_id = ? ORDER BY asub.submitted_at DESC`,
        [assignment.id]
      ) || [];
      const tl = await queryOne('SELECT fullName, username, email FROM users WHERE id = ?', [assignment.team_leader_id || assignment.teamLeaderId]);
      if (tl) {
        assignment.team_leader_fullname = tl.fullName; assignment.team_leader_username = tl.username; assignment.team_leader_email = tl.email;
      }
    }

    res.json({ success: true, assignments: assignmentsToReturn || [], nextCursor, hasMore });
  } catch (error) {
    console.error('Error in team all tasks route:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch team tasks', error: error.message });
  }
});

// GET /team-leader/:userId
router.get('/team-leader/:userId', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), async (req, res) => {
  try {
    const { userId } = req.params;
    const ledTeams = await query(
      'SELECT DISTINCT t.name FROM team_leaders tl JOIN teams t ON tl.team_id = t.id WHERE tl.user_id = ?',
      [userId]
    );
    if (!ledTeams || ledTeams.length === 0) {
      return res.json({ success: true, assignments: [] });
    }

    const teamNames = ledTeams.map(t => t.name);
    const placeholders = teamNames.map(() => '?').join(',');
    const tlAssignments = await query(
      `SELECT a.*, COUNT(DISTINCT asub.id) as submission_count, COUNT(DISTINCT am.id) as assigned_members_count
       FROM assignments a
       LEFT JOIN assignment_members am ON a.id = am.assignment_id
       LEFT JOIN assignment_submissions asub ON a.id = asub.assignment_id
       WHERE a.team IN (${placeholders}) GROUP BY a.id ORDER BY a.created_at DESC`,
      teamNames
    );

    for (const assignment of tlAssignments) {
      assignment.assigned_member_details = await query(
        'SELECT u.id, u.username, u.fullName FROM assignment_members am JOIN users u ON am.user_id = u.id WHERE am.assignment_id = ?',
        [assignment.id]
      ) || [];
      assignment.attachments = await query(
        `SELECT id, original_name, filename, file_path, public_network_url, file_size, file_type, folder_name, relative_path, created_at,
                COALESCE(status, 'team_leader_approved') AS status, COALESCE(current_stage, 'pending_admin') AS current_stage
         FROM assignment_attachments WHERE assignment_id = ? ORDER BY COALESCE(folder_name, ''), created_at DESC`,
        [assignment.id]
      ) || [];
      const recentSubmissions = await query(
        `SELECT f.id, f.original_name, f.filename, f.file_type, f.file_path, f.public_network_url, f.file_size,
                f.tag, f.description, f.uploaded_at, f.status, f.folder_name, f.relative_path, f.is_folder, f.user_team,
                u.username, u.fullName, asub.submitted_at, asub.submitted_at as created_at, asub.user_id
         FROM assignment_submissions asub
         JOIN files f ON asub.file_id = f.id JOIN users u ON asub.user_id = u.id
         WHERE asub.assignment_id = ? ORDER BY asub.submitted_at DESC`,
        [assignment.id]
      ) || [];
      assignment.recent_submissions = recentSubmissions;
      const tl = await queryOne('SELECT fullName, username, email FROM users WHERE id = ?', [assignment.team_leader_id || assignment.teamLeaderId]);
      if (tl) {
        assignment.team_leader_fullname = tl.fullName; assignment.team_leader_username = tl.username; assignment.team_leader_email = tl.email;
      }
      if (assignment.submission_count > 0 && recentSubmissions.length === 0) {
        console.warn(`⚠️ Assignment ${assignment.id} has submission_count ${assignment.submission_count} but fetched no submissions`);
      }
    }

    res.json({ success: true, assignments: tlAssignments || [] });
  } catch (error) {
    console.error('Error in fetchAssignments route:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch assignments', error: error.message });
  }
});

// GET /:assignmentId/details
router.get('/:assignmentId/details', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const assignment = await queryOne('SELECT * FROM assignments WHERE id = ?', [assignmentId]);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    assignment.assigned_member_details = await query(
      'SELECT u.id, u.username, u.fullName FROM assignment_members am JOIN users u ON am.user_id = u.id WHERE am.assignment_id = ?',
      [assignmentId]
    ) || [];

    const submissions = await query(
      `SELECT f.*, u.username, u.fullName, am.submitted_at, am.status as review_status, am.id as submission_id
       FROM assignment_members am
       JOIN files f ON am.file_id = f.id JOIN users u ON am.user_id = u.id
       WHERE am.assignment_id = ? AND am.file_id IS NOT NULL AND am.status = 'submitted'
       ORDER BY am.submitted_at DESC`,
      [assignmentId]
    );

    res.json({ success: true, assignment, submissions: submissions || [] });
  } catch (error) {
    console.error('Error in assignment details route:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch assignment details', error: error.message });
  }
});

// POST /create-json — no file uploads (bypasses multer, avoids Electron replay)
router.post('/create-json', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), async (req, res) => {
  try {
    const { title, description, dueDate, fileTypeRequired, assignedTo, assignedMembers, teamLeaderId, teamLeaderUsername, team } = req.body;
    if (!title || !team || !teamLeaderId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const finalMembers = Array.isArray(assignedMembers) ? assignedMembers : JSON.parse(assignedMembers || '[]');
    const assignmentResult = await query(
      `INSERT INTO assignments (title, description, due_date, file_type_required, assigned_to, max_file_size, team_leader_id, team_leader_username, team, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'active')`,
      [title, description || null, dueDate || null, fileTypeRequired || null, assignedTo || 'specific', 10485760, teamLeaderId, teamLeaderUsername, team]
    );
    const assignmentId = assignmentResult.insertId;
    let membersAssigned = 0;

    if (finalMembers.length > 0) {
      const placeholders = finalMembers.map(() => '(?, ?)').join(', ');
      await query(`INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`, finalMembers.flatMap(uid => [assignmentId, uid]));
      membersAssigned = finalMembers.length;
      for (const uid of finalMembers) {
        try {
          await query(
            'INSERT INTO notifications (user_id, assignment_id, file_id, type, title, message, action_by_id, action_by_username, action_by_role) VALUES (?,?,?,?,?,?,?,?,?)',
            [uid, assignmentId, null, 'assignment', 'New Assignment',
              `${teamLeaderUsername} assigned you a new task: "${title}"${dueDate ? ` - Due: ${new Date(dueDate).toLocaleDateString()}` : ''}`,
              teamLeaderId, teamLeaderUsername, 'TEAM_LEADER']
          );
          pushToUser(uid);
        } catch (e) {
          console.warn('Notification failed for user', uid, e.message);
        }
      }
    } else if (assignedTo === 'all') {
      const teamMembers = await query('SELECT id FROM users WHERE team = ? AND role = ?', [team, 'USER']);
      if (teamMembers.length > 0) {
        const placeholders = teamMembers.map(() => '(?, ?)').join(', ');
        await query(`INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`, teamMembers.flatMap(m => [assignmentId, m.id]));
        membersAssigned = teamMembers.length;
      }
    }

    try {
      await query('INSERT INTO activity_logs (user_id, username, role, team, activity) VALUES (?,?,?,?,?)',
        [teamLeaderId, teamLeaderUsername, 'TEAM_LEADER', team, `Created assignment: ${title}`]);
    } catch (e) { /* ignore */ }

    console.log(`✅ Assignment ${assignmentId} created via JSON (no attachments)`);
    res.json({ success: true, message: 'Assignment created successfully', assignmentId, membersAssigned, attachmentsCreated: 0 });
  } catch (error) {
    console.error('Error creating assignment (JSON):', error);
    res.status(500).json({ success: false, message: 'Failed to create assignment', error: error.message });
  }
});

// POST /create — with file attachments (multer + nonce protection)
router.post('/create', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), upload.array('attachments', 10000), async (req, res) => {
  try {
    const {
      title, description, dueDate, due_date, fileTypeRequired, file_type_required,
      assignedTo, assigned_to, maxFileSize, max_file_size,
      assignedMembers, assigned_members, teamLeaderId, team_leader_id,
      teamLeaderUsername, team_leader_username, team
    } = req.body;

    const finalDueDate = dueDate || due_date;
    const finalFileType = fileTypeRequired || file_type_required;
    const finalAssignedTo = assignedTo || assigned_to;
    const finalMaxSize = maxFileSize || max_file_size || 10485760;
    const finalMembers = typeof assignedMembers === 'string' ? JSON.parse(assignedMembers) : (assignedMembers || assigned_members);
    const finalTeamLeaderId = teamLeaderId || team_leader_id;
    const finalTeamLeaderUsername = teamLeaderUsername || team_leader_username;

    // Nonce validation for multipart requests only
    const isMultipart = req.is('multipart/form-data');
    const requestNonce = req.body.uploadNonce;
    const rawFiles = req.files || [];

    if (isMultipart) {
      if (!requestNonce || !uploadNonces.has(requestNonce)) {
        console.warn(`⚠️ /create rejected: invalid nonce. Discarding ${rawFiles.length} file(s).`);
        for (const f of rawFiles) {
          try {
            fs.unlinkSync(f.path);
          } catch (e) { /* ignore */ }
        }
        return res.status(400).json({ success: false, message: 'Invalid or missing upload nonce. Please try again.' });
      }
      const nonceEntry = uploadNonces.get(requestNonce);
      if (nonceEntry.used) {
        console.warn(`⚠️ /create rejected: nonce already used. Discarding ${rawFiles.length} file(s).`);
        for (const f of rawFiles) {
          try {
            fs.unlinkSync(f.path);
          } catch (e) { /* ignore */ }
        }
        return res.status(400).json({ success: false, message: 'Upload nonce already used. Please try again.' });
      }
      nonceEntry.used = true;
    }

    const clientSentAttachments = req.body.hasAttachments === 'true';
    if (!clientSentAttachments && rawFiles.length > 0) {
      console.warn(`⚠️ Discarding ${rawFiles.length} unexpected temp file(s)`);
      for (const f of rawFiles) {
        try {
          fs.unlinkSync(f.path);
        } catch (e) { /* ignore */ }
      }
    }
    const uploadedFiles = clientSentAttachments ? rawFiles : [];

    if (!title || !team || !finalTeamLeaderId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const assignmentResult = await query(
      `INSERT INTO assignments (title, description, due_date, file_type_required, assigned_to, max_file_size, team_leader_id, team_leader_username, team, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'active')`,
      [title, description || null, finalDueDate || null, finalFileType || null, finalAssignedTo, finalMaxSize, finalTeamLeaderId, finalTeamLeaderUsername, team]
    );
    const assignmentId = assignmentResult.insertId;
    let membersAssigned = 0;
    let attachmentsCreated = 0;

    // Save attachments
    if (uploadedFiles.length > 0) {
      try {
        let relativePaths = [];
        try {
          relativePaths = JSON.parse(req.body.relativePaths || '[]');
        } catch (e) { /* ignore */ }

        for (let i = 0; i < uploadedFiles.length; i++) {
          const file = uploadedFiles[i];
          const fixedName = decodeUTF8Filename(file.originalname);
          let finalPath;
          try {
            finalPath = await moveToUserFolder(file.path, finalTeamLeaderUsername, fixedName);
          } catch (e) {
            console.error('⚠️ Failed to move attachment:', e); finalPath = file.path;
          }

          const relPath = relativePaths[i] || fixedName;
          const folderName = relPath.includes('/') ? relPath.split('/')[0] : null;

          if (folderName) {
            try {
              finalPath = await moveToUserFolder(finalPath, finalTeamLeaderUsername, fixedName, folderName, relPath);
            } catch (e) {
              console.error('⚠️ Failed to re-move into folder structure:', e.message);
            }
          }

          await query(
            `INSERT INTO assignment_attachments (assignment_id, original_name, filename, file_path, file_size, file_type, uploaded_by_id, uploaded_by_username, folder_name, relative_path)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [assignmentId, fixedName, path.basename(finalPath), finalPath, file.size, file.mimetype,
              finalTeamLeaderId, finalTeamLeaderUsername, folderName, relPath !== fixedName ? relPath : null]
          );
          attachmentsCreated++;
        }
      } catch (e) {
        console.error('⚠️ Failed to save attachments:', e);
      }
    }

    // Assign members
    try {
      if (finalAssignedTo === 'specific' && finalMembers && finalMembers.length > 0) {
        const placeholders = finalMembers.map(() => '(?, ?)').join(', ');
        await query(`INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`, finalMembers.flatMap(uid => [assignmentId, uid]));
        membersAssigned = finalMembers.length;
      } else if (finalAssignedTo === 'all') {
        const teamMembers = await query('SELECT id FROM users WHERE team = ? AND role = ?', [team, 'USER']);
        if (teamMembers && teamMembers.length > 0) {
          const placeholders = teamMembers.map(() => '(?, ?)').join(', ');
          await query(`INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`, teamMembers.flatMap(m => [assignmentId, m.id]));
          membersAssigned = teamMembers.length;
        }
      }
      try {
        await query('INSERT INTO activity_logs (user_id, username, role, team, activity) VALUES (?, ?, ?, ?, ?)',
          [finalTeamLeaderId, finalTeamLeaderUsername, 'TEAM_LEADER', team, `Created assignment: ${title}`]);
      } catch (e) { /* ignore */ }

      // Notify members
      try {
        const memberIds = finalAssignedTo === 'specific' ? (finalMembers || []) :
          (await query('SELECT id FROM users WHERE team = ? AND role = ?', [team, 'USER'])).map(m => m.id);
        for (const uid of memberIds) {
          try {
            await query(
              'INSERT INTO notifications (user_id, assignment_id, file_id, type, title, message, action_by_id, action_by_username, action_by_role) VALUES (?,?,?,?,?,?,?,?,?)',
              [uid, assignmentId, null, 'assignment', 'New Assignment',
                `${finalTeamLeaderUsername} assigned you a new task: "${title}"${finalDueDate ? ` - Due: ${new Date(finalDueDate).toLocaleDateString()}` : ''}`,
                finalTeamLeaderId, finalTeamLeaderUsername, 'TEAM_LEADER']
            );
            pushToUser(uid);
          } catch (e) {
            console.error(`Failed to notify user ${uid}:`, e.message);
          }
        }
      } catch (e) {
        console.error('Failed to create notifications:', e.message);
      }

      if (attachmentsCreated > 0) {
        createAdminNotification(null, 'new_upload', 'Team Leader Uploaded Attachment(s)',
          `${finalTeamLeaderUsername} (Team Leader) uploaded ${attachmentsCreated} file${attachmentsCreated !== 1 ? 's' : ''} as attachment(s) for assignment "${title}".`,
          finalTeamLeaderId, finalTeamLeaderUsername, 'TEAM_LEADER', assignmentId
        ).catch(e => console.error('Failed to notify admins:', e));
      }

      res.json({ success: true, message: 'Assignment created successfully', assignmentId, membersAssigned, attachmentsCreated });
    } catch (memberError) {
      console.error('Error assigning members:', memberError);
      res.json({ success: true, message: 'Assignment created successfully', assignmentId, membersAssigned: 0, warning: 'Member assignment failed' });
    }
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({ success: false, message: 'Failed to create assignment', error: error.message });
  }
});

// PUT /:id — update assignment with optional new attachments
router.put('/:id', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), upload.array('attachments', 10000), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, description, dueDate, due_date, fileTypeRequired, file_type_required,
      assignedTo, assigned_to, maxFileSize, max_file_size,
      assignedMembers, assigned_members, teamLeaderId, team_leader_id,
      teamLeaderUsername, team_leader_username, team
    } = req.body;

    const finalDueDate = dueDate || due_date;
    const finalFileType = fileTypeRequired || file_type_required;
    const finalAssignedTo = assignedTo || assigned_to;
    const finalMaxSize = maxFileSize || max_file_size || 10485760;
    const finalMembers = typeof assignedMembers === 'string' ? JSON.parse(assignedMembers) : (assignedMembers || assigned_members);
    const finalTeamLeaderId = teamLeaderId || team_leader_id;
    const finalTeamLeaderUsername = teamLeaderUsername || team_leader_username;

    // Nonce validation for multipart
    const isMultipart = req.is('multipart/form-data');
    const requestNonce = req.body.uploadNonce;
    const rawFiles = req.files || [];

    if (isMultipart) {
      if (!requestNonce || !uploadNonces.has(requestNonce)) {
        console.warn(`⚠️ [PUT] rejected: invalid nonce. Discarding ${rawFiles.length} file(s).`);
        for (const f of rawFiles) {
          try {
            fs.unlinkSync(f.path);
          } catch (e) { /* ignore */ }
        }
        return res.status(400).json({ success: false, message: 'Invalid or missing upload nonce. Please try again.' });
      }
      const nonceEntry = uploadNonces.get(requestNonce);
      if (nonceEntry.used) {
        console.warn(`⚠️ [PUT] rejected: nonce already used. Discarding ${rawFiles.length} file(s).`);
        for (const f of rawFiles) {
          try {
            fs.unlinkSync(f.path);
          } catch (e) { /* ignore */ }
        }
        return res.status(400).json({ success: false, message: 'Upload nonce already used. Please try again.' });
      }
      nonceEntry.used = true;
    }

    // Handle removed attachments
    let removeAttachmentIds = [];
    try {
      const raw = req.body.removeAttachmentIds;
      removeAttachmentIds = typeof raw === 'string' ? JSON.parse(raw || '[]') : (Array.isArray(raw) ? raw : []);
    } catch (e) {
      removeAttachmentIds = [];
    }

    for (const attId of removeAttachmentIds) {
      try {
        const att = await queryOne('SELECT * FROM assignment_attachments WHERE id = ? AND assignment_id = ?', [attId, id]);
        if (att) {
          if (att.file_path) {
            try {
              const fp = att.file_path.startsWith('/uploads/') ? path.join(uploadsDir, att.file_path.substring(9)) : att.file_path;
              if (fs.existsSync(fp)) {
                fs.unlinkSync(fp);
              }
            } catch (e) {
              console.warn('⚠️ Could not delete physical attachment:', e.message);
            }
          }
          await query('DELETE FROM assignment_attachments WHERE id = ?', [attId]);
        }
      } catch (e) {
        console.warn('⚠️ Failed to remove attachment', attId, e.message);
      }
    }

    const clientSentAttachments = req.body.hasAttachments === 'true';
    if (!clientSentAttachments && rawFiles.length > 0) {
      for (const f of rawFiles) {
        try {
          fs.unlinkSync(f.path);
        } catch (e) { /* ignore */ }
      }
    }
    const uploadedFiles = clientSentAttachments ? rawFiles : [];

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const existingAssignment = await queryOne('SELECT * FROM assignments WHERE id = ?', [id]);
    if (!existingAssignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    await query(
      'UPDATE assignments SET title=?, description=?, due_date=?, file_type_required=?, assigned_to=?, max_file_size=? WHERE id=?',
      [title, description || null, finalDueDate || null, finalFileType || null, finalAssignedTo || existingAssignment.assigned_to, finalMaxSize, id]
    );

    let membersAssigned = 0;
    let attachmentsCreated = 0;

    if (uploadedFiles.length > 0) {
      try {
        let relativePaths = [];
        try {
          relativePaths = JSON.parse(req.body.relativePaths || '[]');
        } catch (e) { /* ignore */ }

        for (let i = 0; i < uploadedFiles.length; i++) {
          const file = uploadedFiles[i];
          const fixedName = decodeUTF8Filename(file.originalname);
          let finalPath;
          try {
            finalPath = await moveToUserFolder(file.path, finalTeamLeaderUsername, fixedName);
          } catch (e) {
            finalPath = file.path;
          }

          const relPath = relativePaths[i] || fixedName;
          const folderName = relPath.includes('/') ? relPath.split('/')[0] : null;
          if (folderName) {
            try {
              finalPath = await moveToUserFolder(finalPath, finalTeamLeaderUsername, fixedName, folderName, relPath);
            } catch (e) { /* keep flat */ }
          }

          await query(
            `INSERT INTO assignment_attachments (assignment_id, original_name, filename, file_path, file_size, file_type, uploaded_by_id, uploaded_by_username, folder_name, relative_path)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, fixedName, path.basename(finalPath), finalPath, file.size, file.mimetype,
              finalTeamLeaderId, finalTeamLeaderUsername, folderName, relPath !== fixedName ? relPath : null]
          );
          attachmentsCreated++;
        }
      } catch (e) {
        console.error('⚠️ Failed to save attachments:', e);
      }
    }

    try {
      if (finalMembers && Array.isArray(finalMembers)) {
        await query('DELETE FROM assignment_members WHERE assignment_id = ?', [id]);
        if (finalMembers.length > 0) {
          const placeholders = finalMembers.map(() => '(?, ?)').join(', ');
          await query(`INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`, finalMembers.flatMap(uid => [id, uid]));
          membersAssigned = finalMembers.length;
        }
      }
      try {
        await query('INSERT INTO activity_logs (user_id, username, role, team, activity) VALUES (?, ?, ?, ?, ?)',
          [finalTeamLeaderId || existingAssignment.team_leader_id,
          finalTeamLeaderUsername || existingAssignment.team_leader_username,
            'TEAM_LEADER', team || existingAssignment.team, `Updated assignment: ${title}`]);
      } catch (e) { /* ignore */ }

      if (attachmentsCreated > 0) {
        const tlId = finalTeamLeaderId || existingAssignment.team_leader_id;
        const tlUsername = finalTeamLeaderUsername || existingAssignment.team_leader_username;
        createAdminNotification(null, 'new_upload', 'Team Leader Uploaded Attachment(s)',
          `${tlUsername} (Team Leader) uploaded ${attachmentsCreated} file${attachmentsCreated !== 1 ? 's' : ''} as attachment(s) for assignment "${title}".`,
          tlId, tlUsername, 'TEAM_LEADER', id
        ).catch(e => console.error('Failed to notify admins:', e));
      }

      res.json({ success: true, message: 'Assignment updated successfully', assignmentId: id, membersAssigned, attachmentsCreated });
    } catch (memberError) {
      console.error('Error updating members:', memberError);
      res.json({ success: true, message: 'Assignment updated successfully', assignmentId: id, membersAssigned: 0, warning: 'Member assignment failed' });
    }
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({ success: false, message: 'Failed to update assignment', error: error.message });
  }
});

// GET /user/:userId
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = await queryOne('SELECT username, fullName, team FROM users WHERE id = ?', [userId]);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userAssignments = await query(
      `SELECT a.*, am.status as user_status, am.submitted_at as user_submitted_at,
              fs.original_name as submitted_file_name, fs.file_path as submitted_file_path,
              fs.public_network_url as submitted_file_nas_path, fs.status as submitted_file_status,
              fs.id as submitted_file_id, fs.tag as submitted_file_tag,
              tl.fullName as team_leader_fullname, tl.username as team_leader_username, tl.role as team_leader_role,
              ? as assigned_user_fullname, ? as assigned_user_username,
              (SELECT COUNT(*) FROM assignment_comments ac WHERE ac.assignment_id = a.id) as comment_count
       FROM assignments a
       LEFT JOIN assignment_members am ON a.id = am.assignment_id AND am.user_id = ?
       LEFT JOIN files fs ON am.file_id = fs.id
       LEFT JOIN users tl ON a.team_leader_id = tl.id
       WHERE (a.assigned_to = 'all' AND a.team = ?) OR (a.assigned_to = 'specific' AND am.user_id = ?)
       ORDER BY a.created_at DESC`,
      [currentUser.fullName, currentUser.username, userId, currentUser.team, userId]
    );

    for (const assignment of userAssignments) {
      assignment.assigned_member_details = await query(
        'SELECT u.id, u.username, u.fullName FROM assignment_members am JOIN users u ON am.user_id = u.id WHERE am.assignment_id = ?',
        [assignment.id]
      ) || [];
      assignment.attachments = await query(
        `SELECT id, original_name, filename, file_path, public_network_url, file_size, file_type, folder_name, relative_path, created_at,
                COALESCE(status, 'team_leader_approved') AS status, COALESCE(current_stage, 'pending_admin') AS current_stage
         FROM assignment_attachments WHERE assignment_id = ? ORDER BY COALESCE(folder_name, ''), created_at DESC`,
        [assignment.id]
      ) || [];
      assignment.submitted_files = await query(
        `SELECT f.id, f.original_name, f.filename, f.file_path, f.public_network_url, f.file_type, f.file_size,
                f.tag, f.description, f.status, f.folder_name, f.relative_path, f.is_folder,
                asub.submitted_at, u.fullName as submitter_name, u.username as submitter_username
         FROM assignment_submissions asub
         JOIN files f ON asub.file_id = f.id JOIN users u ON asub.user_id = u.id
         WHERE asub.assignment_id = ? AND asub.user_id = ? ORDER BY asub.submitted_at DESC`,
        [assignment.id, userId]
      ) || [];
    }

    res.json({ success: true, assignments: userAssignments || [] });
  } catch (error) {
    console.error('Error in user assignments route:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch assignments', error: error.message });
  }
});

// POST /submit
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const { assignmentId, userId, fileId } = req.body;
    if (!assignmentId || !userId || !fileId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const assignment = await queryOne(
      'SELECT a.*, am.user_id as assigned_user FROM assignments a LEFT JOIN assignment_members am ON a.id = am.assignment_id AND am.user_id = ? WHERE a.id = ?',
      [userId, assignmentId]
    );
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }
    if (assignment.assigned_to === 'specific' && !assignment.assigned_user) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this assignment' });
    }

    const existingSubmission = await queryOne('SELECT * FROM assignment_submissions WHERE assignment_id = ? AND file_id = ?', [assignmentId, fileId]);
    if (existingSubmission) {
      console.log(`ℹ️ File ${fileId} already submitted for assignment ${assignmentId}`);
      return res.json({ success: true, message: 'File already submitted for this assignment' });
    }

    await query('INSERT INTO assignment_submissions (assignment_id, file_id, user_id, submitted_at) VALUES (?, ?, ?, NOW())', [assignmentId, fileId, userId]);

    const hasSubmitted = await queryOne('SELECT * FROM assignment_members WHERE assignment_id = ? AND user_id = ?', [assignmentId, userId]);
    if (hasSubmitted && hasSubmitted.status !== 'submitted') {
      await query('UPDATE assignment_members SET status=?, submitted_at=NOW(), file_id=? WHERE assignment_id=? AND user_id=?', ['submitted', fileId, assignmentId, userId]);
    } else if (!hasSubmitted) {
      await query('INSERT INTO assignment_members (assignment_id, user_id, status, submitted_at, file_id) VALUES (?,?,?,NOW(),?)', [assignmentId, userId, 'submitted', fileId]);
    }

    const submitter = await queryOne('SELECT username, fullName FROM users WHERE id = ?', [userId]);
    const file = await queryOne('SELECT original_name, folder_name FROM files WHERE id = ?', [fileId]);

    const batchKey = `${assignmentId}-${userId}-${assignment.team_leader_id}`;
    if (!pendingBatchSubmissions.has(batchKey)) {
      pendingBatchSubmissions.set(batchKey, { teamLeaderId: assignment.team_leader_id, assignmentId, submissions: [] });
    }
    const batch = pendingBatchSubmissions.get(batchKey);
    batch.submissions.push({ fileId, fileName: file.original_name, folderName: file.folder_name, userId, username: submitter.username, submitterName: submitter.fullName });
    if (batch.timeoutId) {
      clearTimeout(batch.timeoutId);
    }
    batch.timeoutId = setTimeout(async () => {
      const b = pendingBatchSubmissions.get(batchKey);
      if (b) {
        await createBatchedSubmissionNotification(b.teamLeaderId, b.assignmentId, b.submissions); pendingBatchSubmissions.delete(batchKey);
      }
    }, 5000);

    res.json({ success: true, message: 'File submitted successfully' });
  } catch (error) {
    console.error('Error submitting assignment:', error);
    res.status(500).json({ success: false, message: 'Failed to submit assignment', error: error.message });
  }
});

// GET /:assignmentId/comments
router.get('/:assignmentId/comments', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const comments = await query(
      `SELECT ac.*, u.fullName as user_fullname, u.role as user_role
       FROM assignment_comments ac JOIN users u ON ac.user_id = u.id
       WHERE ac.assignment_id = ? ORDER BY ac.created_at ASC`,
      [assignmentId]
    );
    for (const comment of comments) {
      comment.replies = await query(
        `SELECT cr.*, u.fullName as user_fullname, u.role as user_role
         FROM comment_replies cr JOIN users u ON cr.user_id = u.id
         WHERE cr.comment_id = ? ORDER BY cr.created_at ASC`,
        [comment.id]
      ) || [];
    }
    res.json({ success: true, comments: comments || [] });
  } catch (error) {
    console.error('Error in get comments route:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch comments', error: error.message });
  }
});

// POST /:assignmentId/comments
router.post('/:assignmentId/comments', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { userId, username, comment } = req.body;
    if (!userId || !username || !comment) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const user = await queryOne('SELECT fullName, role FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const result = await query(
      'INSERT INTO assignment_comments (assignment_id, user_id, username, user_fullname, user_role, comment) VALUES (?, ?, ?, ?, ?, ?)',
      [assignmentId, userId, username, user.fullName, user.role, comment]
    );
    const newComment = await queryOne(
      'SELECT ac.*, u.fullName as user_fullname, u.role as user_role FROM assignment_comments ac JOIN users u ON ac.user_id = u.id WHERE ac.id = ?',
      [result.insertId]
    );

    // Notifications with @mention pre-scan
    try {
      const assignment = await queryOne('SELECT title, team_leader_id FROM assignments WHERE id = ?', [assignmentId]);
      const mentionedUserIds = new Set();
      const preScanRegex = /@([A-Za-z0-9_.]+)/g;
      let m;
      while ((m = preScanRegex.exec(comment)) !== null) {
        const token = m[1].replace(/_/g, ' ').toLowerCase();
        const mentioned = await queryOne(
          'SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(REPLACE(fullName,\' \',\'_\')) = ? OR LOWER(fullName) = ? LIMIT 1',
          [token, token, token]
        );
        if (mentioned && String(mentioned.id) !== String(userId)) {
          mentionedUserIds.add(mentioned.id);
        }
      }

      const assignedMembers = await query('SELECT user_id FROM assignment_members WHERE assignment_id = ? AND user_id != ?', [assignmentId, userId]);
      const notifyUser = async (uid, title, msg) => {
        await query('INSERT INTO notifications (user_id,assignment_id,file_id,type,title,message,action_by_id,action_by_username,action_by_role) VALUES (?,?,?,?,?,?,?,?,?)',
          [uid, assignmentId, null, 'comment', title, msg, userId, username, user.role]);
        pushToUser(uid);
      };

      if (user.role === 'ADMIN') {
        const tlId = assignment.team_leader_id || assignment.teamLeaderId;
        if (tlId && !mentionedUserIds.has(tlId)) {
          await notifyUser(tlId, 'New Admin Comment on Assignment', `Admin ${user.fullName} commented on "${assignment.title}": ${comment.substring(0, 100)}...`);
        }
        for (const member of assignedMembers) {
          if (!mentionedUserIds.has(member.user_id)) {
            await notifyUser(member.user_id, 'New Admin Comment on Assignment', `Admin ${user.fullName} commented on "${assignment.title}": ${comment.substring(0, 100)}...`);
          }
        }
      } else if (user.role === 'TEAM_LEADER') {
        for (const member of assignedMembers) {
          if (!mentionedUserIds.has(member.user_id)) {
            await notifyUser(member.user_id, 'New Comment on Assignment', `${user.fullName} commented on "${assignment.title}": ${comment.substring(0, 100)}...`);
          }
        }
      } else if (user.role === 'USER' && assignment.team_leader_id && String(assignment.team_leader_id) !== String(userId)) {
        if (!mentionedUserIds.has(assignment.team_leader_id)) {
          await notifyUser(assignment.team_leader_id, 'New Comment on Assignment', `${user.fullName} commented on "${assignment.title}": ${comment.substring(0, 100)}...`);
        }
      }

      // @mention notifications
      const mentionRegex = /@([A-Za-z0-9_.]+)/g;
      const notifiedIds = new Set([userId]);
      let match;
      while ((match = mentionRegex.exec(comment)) !== null) {
        const token = match[1].replace(/_/g, ' ').toLowerCase();
        const mentioned = await queryOne('SELECT id, fullName FROM users WHERE LOWER(username) = ? OR LOWER(REPLACE(fullName,\' \',\'_\')) = ? OR LOWER(fullName) = ? LIMIT 1', [token, token, token]);
        if (mentioned && !notifiedIds.has(mentioned.id)) {
          notifiedIds.add(mentioned.id);
          const info = await queryOne('SELECT title FROM assignments WHERE id = ?', [assignmentId]);
          await query('INSERT INTO notifications (user_id,assignment_id,file_id,type,title,message,action_by_id,action_by_username,action_by_role) VALUES (?,?,?,?,?,?,?,?,?)',
            [mentioned.id, assignmentId, null, 'mention', `${user.fullName} mentioned you`,
            `${user.fullName} mentioned you in a comment on "${info?.title || 'an assignment'}": ${comment.substring(0, 100)}...`,
              userId, username, user.role]);
          pushToUser(mentioned.id);
        }
      }
    } catch (e) {
      console.error('Failed to create comment notifications:', e.message);
    }

    res.json({ success: true, message: 'Comment posted successfully', comment: newComment });
  } catch (error) {
    console.error('Error in post comment route:', error);
    res.status(500).json({ success: false, message: 'Failed to post comment', error: error.message });
  }
});

// POST /:assignmentId/comments/:commentId/reply
router.post('/:assignmentId/comments/:commentId/reply', authenticateToken, async (req, res) => {
  try {
    const { assignmentId, commentId } = req.params;
    const { userId, username, reply } = req.body;
    if (!userId || !username || !reply) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const comment = await queryOne('SELECT * FROM assignment_comments WHERE id = ? AND assignment_id = ?', [commentId, assignmentId]);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const user = await queryOne('SELECT fullName, role FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const result = await query(
      'INSERT INTO comment_replies (comment_id, user_id, username, user_fullname, user_role, reply) VALUES (?, ?, ?, ?, ?, ?)',
      [commentId, userId, username, user.fullName, user.role, reply]
    );
    const newReply = await queryOne(
      'SELECT cr.*, u.fullName as user_fullname, u.role as user_role FROM comment_replies cr JOIN users u ON cr.user_id = u.id WHERE cr.id = ?',
      [result.insertId]
    );

    if (comment.user_id !== userId) {
      try {
        const assignment = await queryOne('SELECT title FROM assignments WHERE id = ?', [assignmentId]);
        await query('INSERT INTO notifications (user_id,assignment_id,file_id,type,title,message,action_by_id,action_by_username,action_by_role) VALUES (?,?,?,?,?,?,?,?,?)',
          [comment.user_id, assignmentId, null, 'comment', 'New Reply on Assignment',
          `${user.fullName} replied to your comment on "${assignment.title}": ${reply.substring(0, 100)}...`,
            userId, username, user.role]);
        pushToUser(comment.user_id);
      } catch (e) {
        console.error('⚠️ Failed to create reply notification:', e);
      }
    }

    // @mention notifications for reply
    try {
      const mentionRegex = /@([A-Za-z0-9_.]+)/g;
      let match;
      const notifiedIds = new Set([userId, comment.user_id]);
      while ((match = mentionRegex.exec(reply)) !== null) {
        const token = match[1].replace(/_/g, ' ').toLowerCase();
        const mentioned = await queryOne('SELECT id, fullName FROM users WHERE LOWER(username) = ? OR LOWER(REPLACE(fullName,\' \',\'_\')) = ? OR LOWER(fullName) = ? LIMIT 1', [token, token, token]);
        if (mentioned && !notifiedIds.has(mentioned.id)) {
          notifiedIds.add(mentioned.id);
          const info = await queryOne('SELECT title FROM assignments WHERE id = ?', [assignmentId]);
          await query('INSERT INTO notifications (user_id,assignment_id,file_id,type,title,message,action_by_id,action_by_username,action_by_role) VALUES (?,?,?,?,?,?,?,?,?)',
            [mentioned.id, assignmentId, null, 'mention', `${user.fullName} mentioned you`,
            `${user.fullName} mentioned you in a reply on "${info?.title || 'an assignment'}": ${reply.substring(0, 100)}...`,
              userId, username, user.role]);
          pushToUser(mentioned.id);
        }
      }
    } catch (e) {
      console.error('⚠️ Failed to send mention notifications for reply:', e.message);
    }

    res.json({ success: true, message: 'Reply posted successfully', reply: newReply });
  } catch (error) {
    console.error('Error in post reply route:', error);
    res.status(500).json({ success: false, message: 'Failed to post reply', error: error.message });
  }
});

// PUT /:assignmentId/comments/:commentId — edit comment
router.put('/:assignmentId/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { assignmentId, commentId } = req.params;
    const { userId, comment } = req.body;
    if (!userId || !comment?.trim()) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const existing = await queryOne('SELECT * FROM assignment_comments WHERE id = ? AND assignment_id = ?', [commentId, assignmentId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }
    if (String(existing.user_id) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'You can only edit your own comments' });
    }
    await query('UPDATE assignment_comments SET comment = ?, updated_at = NOW() WHERE id = ?', [comment.trim(), commentId]);
    res.json({ success: true, message: 'Comment updated successfully' });
  } catch (error) {
    console.error('Error editing comment:', error);
    res.status(500).json({ success: false, message: 'Failed to edit comment', error: error.message });
  }
});

// DELETE /:assignmentId/comments/:commentId — delete comment (and its replies)
router.delete('/:assignmentId/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { assignmentId, commentId } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Missing userId' });
    }
    const existing = await queryOne('SELECT * FROM assignment_comments WHERE id = ? AND assignment_id = ?', [commentId, assignmentId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }
    if (String(existing.user_id) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'You can only delete your own comments' });
    }
    await query('DELETE FROM comment_replies WHERE comment_id = ?', [commentId]);
    await query('DELETE FROM assignment_comments WHERE id = ?', [commentId]);
    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ success: false, message: 'Failed to delete comment', error: error.message });
  }
});

// PUT /:assignmentId/comments/:commentId/reply/:replyId — edit reply
router.put('/:assignmentId/comments/:commentId/reply/:replyId', authenticateToken, async (req, res) => {
  try {
    const { replyId } = req.params;
    const { userId, reply } = req.body;
    if (!userId || !reply?.trim()) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const existing = await queryOne('SELECT * FROM comment_replies WHERE id = ?', [replyId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Reply not found' });
    }
    if (String(existing.user_id) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'You can only edit your own replies' });
    }
    await query('UPDATE comment_replies SET reply = ?, updated_at = NOW() WHERE id = ?', [reply.trim(), replyId]);
    res.json({ success: true, message: 'Reply updated successfully' });
  } catch (error) {
    console.error('Error editing reply:', error);
    res.status(500).json({ success: false, message: 'Failed to edit reply', error: error.message });
  }
});

// DELETE /:assignmentId/comments/:commentId/reply/:replyId — delete reply
router.delete('/:assignmentId/comments/:commentId/reply/:replyId', authenticateToken, async (req, res) => {
  try {
    const { replyId } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Missing userId' });
    }
    const existing = await queryOne('SELECT * FROM comment_replies WHERE id = ?', [replyId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Reply not found' });
    }
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

// PATCH /:assignmentId/archive
router.patch('/:assignmentId/archive', authenticateToken, authorizeRole(['ADMIN']), async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const assignment = await queryOne('SELECT * FROM assignments WHERE id = ?', [assignmentId]);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }
    const newArchive = assignment.archived ? 0 : 1;
    await query('UPDATE assignments SET archived = ?, archived_at = ? WHERE id = ?', [newArchive, newArchive === 1 ? new Date() : null, assignmentId]);
    res.json({ success: true, message: newArchive === 1 ? 'Assignment archived successfully' : 'Assignment unarchived successfully', archived: newArchive === 1 });
  } catch (error) {
    console.error('Error in archive assignment route:', error);
    res.status(500).json({ success: false, message: 'Failed to archive assignment', error: error.message });
  }
});

// PUT /:assignmentId/mark-done
router.put('/:assignmentId/mark-done', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const assignment = await queryOne('SELECT * FROM assignments WHERE id = ?', [assignmentId]);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // 1. Update assignment status
    await query('UPDATE assignments SET status = ?, updated_at = ? WHERE id = ?', ['completed', now, assignmentId]);

    // 2. IMPORTANT: Update all members who haven't submitted yet to 'submitted' status
    // This ensures they get credit for completion in their performance metrics
    await query(
      'UPDATE assignment_members SET status = ?, submitted_at = ? WHERE assignment_id = ? AND (status IS NULL OR status != ?)',
      ['submitted', now, assignmentId, 'submitted']
    );

    res.json({ success: true, message: 'Assignment marked as completed and all members updated', assignment: { ...assignment, status: 'completed', updated_at: now } });
  } catch (error) {
    console.error('Error marking assignment as done:', error);
    res.status(500).json({ success: false, message: 'Failed to mark assignment as done', error: error.message });
  }
});


// PUT /:assignmentId/update-members
router.put('/:assignmentId/update-members', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { title, description, dueDate, fileTypeRequired, assignedMembers, teamLeaderId, teamLeaderUsername, team } = req.body;
    const assignment = await queryOne('SELECT * FROM assignments WHERE id = ?', [assignmentId]);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await query('UPDATE assignments SET title=?, description=?, due_date=?, file_type_required=?, updated_at=? WHERE id=?',
      [title, description || null, dueDate || null, fileTypeRequired || null, now, assignmentId]);

    if (assignedMembers && Array.isArray(assignedMembers)) {
      const currentMembers = await query('SELECT user_id FROM assignment_members WHERE assignment_id = ?', [assignmentId]);
      const currentIds = currentMembers.map(m => m.user_id);
      const newIds = assignedMembers;
      const toAdd = newIds.filter(id => !currentIds.includes(id));
      const toRemove = currentIds.filter(id => !newIds.includes(id));

      if (toRemove.length > 0) {
        await query(`DELETE FROM assignment_members WHERE assignment_id = ? AND user_id IN (${toRemove.map(() => '?').join(',')})`, [assignmentId, ...toRemove]);
      }
      if (toAdd.length > 0) {
        const placeholders = toAdd.map(() => '(?, ?)').join(', ');
        await query(`INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`, toAdd.flatMap(uid => [assignmentId, uid]));
        for (const uid of toAdd) {
          try {
            await query('INSERT INTO notifications (user_id,assignment_id,file_id,type,title,message,action_by_id,action_by_username,action_by_role) VALUES (?,?,?,?,?,?,?,?,?)',
              [uid, assignmentId, null, 'assignment', 'Added to Assignment',
                `${teamLeaderUsername} added you to the task: "${title}"${dueDate ? ` - Due: ${new Date(dueDate).toLocaleDateString()}` : ''}`,
                teamLeaderId, teamLeaderUsername, 'TEAM_LEADER']);
            pushToUser(uid);
          } catch (e) {
            console.error('⚠️ Failed to notify new member:', e);
          }
        }
      }
    }

    try {
      await query('INSERT INTO activity_logs (user_id,username,role,team,activity) VALUES (?,?,?,?,?)',
        [teamLeaderId, teamLeaderUsername, 'TEAM_LEADER', team, `Updated assignment: ${title}`]);
    } catch (e) { /* ignore */ }

    res.json({ success: true, message: 'Assignment updated successfully' });
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({ success: false, message: 'Failed to update assignment', error: error.message });
  }
});

// DELETE /:assignmentId — permanent delete (files are kept, submissions cleared)
router.delete('/:assignmentId', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const assignment = await queryOne('SELECT * FROM assignments WHERE id = ?', [assignmentId]);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    const submittedFiles = await query('SELECT file_id FROM assignment_submissions WHERE assignment_id = ?', [assignmentId]);
    // Files are intentionally kept — they return to "My Files" for users
    await query('DELETE FROM assignment_submissions WHERE assignment_id = ?', [assignmentId]);
    await query('DELETE FROM assignment_members WHERE assignment_id = ?', [assignmentId]);
    await query('DELETE FROM assignment_comments WHERE assignment_id = ?', [assignmentId]);
    await query('DELETE FROM assignments WHERE id = ?', [assignmentId]);

    res.json({ success: true, message: 'Assignment deleted permanently', deletedFiles: submittedFiles ? submittedFiles.length : 0 });
  } catch (error) {
    console.error('Error in delete assignment route:', error);
    res.status(500).json({ success: false, message: 'Failed to delete assignment', error: error.message });
  }
});

// DELETE /:assignmentId/files/:fileId — remove a submitted file
router.delete('/:assignmentId/files/:fileId', authenticateToken, async (req, res) => {
  try {
    const { assignmentId, fileId } = req.params;
    const { userId } = req.body;

    const submission = await queryOne('SELECT * FROM assignment_submissions WHERE assignment_id = ? AND file_id = ? AND user_id = ?', [assignmentId, fileId, userId]);
    if (!submission) {
      return res.status(404).json({ success: false, message: 'File not found or not authorized' });
    }

    const fileInfo = await queryOne('SELECT file_path, public_network_url, username FROM files WHERE id = ?', [fileId]);
    const remainingSubmissions = await query(
      'SELECT file_id, submitted_at FROM assignment_submissions WHERE assignment_id = ? AND user_id = ? AND file_id != ? ORDER BY submitted_at DESC',
      [assignmentId, userId, fileId]
    );

    // Clear FK reference first
    await query('UPDATE assignment_members SET file_id = NULL WHERE assignment_id = ? AND user_id = ? AND file_id = ?', [assignmentId, userId, fileId]);
    if (!remainingSubmissions || remainingSubmissions.length === 0) {
      await query('UPDATE assignment_members SET status = ?, submitted_at = NULL WHERE assignment_id = ? AND user_id = ?', ['pending', assignmentId, userId]);
    } else {
      const mostRecent = remainingSubmissions[0];
      await query('UPDATE assignment_members SET file_id = ?, submitted_at = ?, status = ? WHERE assignment_id = ? AND user_id = ?',
        [mostRecent.file_id, mostRecent.submitted_at, 'submitted', assignmentId, userId]);
    }

    await query('DELETE FROM assignment_submissions WHERE assignment_id = ? AND file_id = ? AND user_id = ?', [assignmentId, fileId, userId]);
    try {
      await query('DELETE FROM notifications WHERE file_id = ?', [fileId]);
    } catch (e) { /* ignore */ }
    try {
      await query('DELETE FROM file_comments WHERE file_id = ?', [fileId]);
    } catch (e) { /* ignore */ }
    try {
      await query('DELETE FROM file_status_history WHERE file_id = ?', [fileId]);
    } catch (e) { /* ignore */ }
    try {
      await query('DELETE FROM assignment_attachments WHERE file_id = ?', [fileId]);
    } catch (e) { /* ignore */ }

    if (fileInfo) {
      try {
        let physicalPath = null;
        if (fileInfo.public_network_url && !fileInfo.public_network_url.startsWith('http')) {
          physicalPath = fileInfo.public_network_url;
        } else if (fileInfo.file_path && fileInfo.file_path.startsWith('/uploads/')) {
          physicalPath = path.join(uploadsDir, fileInfo.file_path.substring('/uploads/'.length));
        } else if (fileInfo.file_path) {
          physicalPath = fileInfo.file_path;
        }
        if (physicalPath && fs.existsSync(physicalPath)) {
          fs.unlinkSync(physicalPath);
        }
      } catch (e) {
        console.error('❌ Failed to delete physical file:', e.message);
      }
    }

    await query('DELETE FROM files WHERE id = ?', [fileId]);
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('❌ Error removing submitted file:', error);
    res.status(500).json({ success: false, message: 'Failed to remove file', error: error.message });
  }
});

// DELETE /:assignmentId/attachments/folder/:folderName
router.delete('/:assignmentId/attachments/folder/:folderName', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), async (req, res) => {
  try {
    const { assignmentId, folderName } = req.params;
    const decodedFolderName = decodeURIComponent(folderName);
    const folderAttachments = await query('SELECT * FROM assignment_attachments WHERE assignment_id = ? AND folder_name = ?', [assignmentId, decodedFolderName]);
    if (!folderAttachments || folderAttachments.length === 0) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    let folderDirPath = null;
    for (const att of folderAttachments) {
      if (att.file_path) {
        const candidate = path.dirname(att.file_path); if (candidate && candidate !== '.') {
          folderDirPath = candidate; break;
        }
      }
    }
    if (folderDirPath) {
      try {
        if (fs.existsSync(folderDirPath)) {
          fs.rmSync ? fs.rmSync(folderDirPath, { recursive: true, force: true }) : fs.rmdirSync(folderDirPath, { recursive: true });
        }
      } catch (e) {
        console.warn('⚠️ Could not delete physical folder:', e.message);
      }
    }

    await query('DELETE FROM assignment_attachments WHERE assignment_id = ? AND folder_name = ?', [assignmentId, decodedFolderName]);
    res.json({ success: true, message: 'Folder deleted successfully', deletedCount: folderAttachments.length });
  } catch (error) {
    console.error('Error deleting attachment folder:', error);
    res.status(500).json({ success: false, message: 'Failed to delete folder', error: error.message });
  }
});

// DELETE /:assignmentId/attachments/:attachmentId — must stay below /folder route
router.delete('/:assignmentId/attachments/:attachmentId', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), async (req, res) => {
  if (req.params.attachmentId === 'folder') {
    return res.status(404).json({ success: false, message: 'Route not found' });
  }
  try {
    const { assignmentId, attachmentId } = req.params;
    const attachment = await queryOne('SELECT * FROM assignment_attachments WHERE id = ? AND assignment_id = ?', [attachmentId, assignmentId]);
    if (!attachment) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }

    if (attachment.file_path) {
      try {
        const fp = attachment.file_path.startsWith('/uploads/') ? path.join(uploadsDir, attachment.file_path.substring(9)) : attachment.file_path;
        if (fs.existsSync(fp)) {
          fs.unlinkSync(fp);
        }
      } catch (e) {
        console.warn('⚠️ Could not delete physical attachment file:', e.message);
      }
    }
    await query('DELETE FROM assignment_attachments WHERE id = ?', [attachmentId]);
    res.json({ success: true, message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({ success: false, message: 'Failed to delete attachment', error: error.message });
  }
});

// GET /debug/:assignmentId/members — dev-only debug endpoint
router.get('/debug/:assignmentId/members', authenticateToken, authorizeRole(['ADMIN']), async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const members = await query('SELECT * FROM assignment_members WHERE assignment_id = ?', [assignmentId]);
    const assignment = await queryOne('SELECT * FROM assignments WHERE id = ?', [assignmentId]);
    res.json({ success: true, assignment, members, membersCount: members?.length || 0 });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch debug data', error: error.message });
  }
});

console.log('✅ Assignments routes registered');
module.exports = router;
