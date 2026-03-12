const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../../database/config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadsDir, moveToUserFolder } = require('../config/middleware');
const assignmentController = require('../controllers/assignmentController');

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

// Batch submission tracker to group multiple file submissions into single notification
const pendingBatchSubmissions = new Map();

// Function to create grouped notification
async function createBatchedSubmissionNotification(teamLeaderId, assignmentId, submissions) {
  try {
    const assignment = await queryOne('SELECT title FROM assignments WHERE id = ?', [assignmentId]);
    const firstSubmission = submissions[0];

    // Check if this is a folder upload by looking at folder_name
    const folderName = firstSubmission.folderName;
    const isFolder = folderName && submissions.length > 1;

    let message;
    let title = 'New File Submitted for Review';

    if (isFolder) {
      // Folder upload - create a single notification for the entire folder
      title = 'New Folder Submitted for Review';
      message = `${firstSubmission.submitterName} submitted folder "${folderName}" (${submissions.length} files) for the assignment "${assignment.title}"`;
    } else if (submissions.length === 1) {
      // Single file
      message = `${firstSubmission.submitterName} submitted "${firstSubmission.fileName}" for the assignment "${assignment.title}"`;
    } else {
      // Multiple individual files
      message = `${firstSubmission.submitterName} submitted ${submissions.length} files for the assignment "${assignment.title}"`;
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
      teamLeaderId,
      assignmentId,
      firstSubmission.fileId, // Link to first file
      'submission',
      title,
      message,
      firstSubmission.userId,
      firstSubmission.username,
      'USER'
    ]);

    console.log(`✅ Created batched notification for team leader ${teamLeaderId}: ${isFolder ? `folder "${folderName}"` : `${submissions.length} file(s)`}`);
  } catch (error) {
    console.error('⚠️ Failed to create batched submission notification:', error);
  }
}

router.get('/admin/all', async (req, res) => {
  try {
    console.log('🔍 Admin assignments route called');
    const { cursor, limit = 20 } = req.query;
    const parsedLimit = parseInt(limit, 10);

    console.log('Admin fetching assignments with pagination:', { cursor, limit: parsedLimit });

    let queryStr = `
      SELECT
        a.*,
        COUNT(DISTINCT asub.id) as submission_count,
        COUNT(DISTINCT am.id) as assigned_members_count,
        COUNT(DISTINCT ac.id) as comment_count
      FROM assignments a
      LEFT JOIN assignment_members am ON a.id = am.assignment_id
      LEFT JOIN assignment_submissions asub ON a.id = asub.assignment_id
      LEFT JOIN assignment_comments ac ON a.id = ac.assignment_id
    `;

    const queryParams = [];
    const conditions = [];

    // Add cursor condition if provided
    if (cursor) {
      conditions.push('a.id < ?');
      queryParams.push(cursor);
    }

    // Add WHERE clause if there are conditions
    if (conditions.length > 0) {
      queryStr += ' WHERE ' + conditions.join(' AND ');
    }

    queryStr += `
      GROUP BY a.id
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ?
    `;
    queryParams.push(parsedLimit + 1); // Fetch one extra to check if there are more

    const assignments = await query(queryStr, queryParams);

    console.log(`Found ${assignments.length} assignments for this batch`);

    // Check if there are more results
    const hasMore = assignments.length > parsedLimit;
    const assignmentsToReturn = hasMore ? assignments.slice(0, parsedLimit) : assignments;
    const nextCursor = hasMore && assignmentsToReturn.length > 0
      ? assignmentsToReturn[assignmentsToReturn.length - 1].id
      : null;

    // Get additional details for each assignment
    for (const assignment of assignmentsToReturn) {
      // Get assigned member details
      const assignedMembers = await query(`
        SELECT u.id, u.username, u.fullName
        FROM assignment_members am
        JOIN users u ON am.user_id = u.id
        WHERE am.assignment_id = ?
      `, [assignment.id]);

      assignment.assigned_member_details = assignedMembers || [];

      // Get attachments for this assignment
      const attachments = await query(`
        SELECT id, original_name, filename, file_path, file_size, file_type, folder_name, relative_path, created_at
        FROM assignment_attachments
        WHERE assignment_id = ?
        ORDER BY COALESCE(folder_name, ''), created_at DESC
      `, [assignment.id]);

      assignment.attachments = attachments || [];

      // Get recent submissions from assignment_submissions table (includes ALL submitted files)
      const recentSubmissions = await query(`
        SELECT
          f.id,
          f.original_name,
          f.filename,
          f.file_type,
          f.file_path,
          f.public_network_url,
          f.file_size,
          f.tag,
          f.description,
          f.uploaded_at,
          f.status,
          f.folder_name,
          f.relative_path,
          f.is_folder,
          u.username,
          u.fullName,
          asub.submitted_at,
          asub.submitted_at as created_at,
          asub.user_id
        FROM assignment_submissions asub
        JOIN files f ON asub.file_id = f.id
        JOIN users u ON asub.user_id = u.id
        WHERE asub.assignment_id = ?
        ORDER BY asub.submitted_at DESC
      `, [assignment.id]);

      assignment.recent_submissions = recentSubmissions || [];

      // Get team leader info
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

    console.log(`Returning ${assignmentsToReturn.length} assignments to admin, hasMore: ${hasMore}`);

    // Debug: Check comment_count in assignments
    if (assignmentsToReturn.length > 0) {
      console.log('First assignment comment_count:', assignmentsToReturn[0].comment_count, 'type:', typeof assignmentsToReturn[0].comment_count);
      console.log('First assignment keys:', Object.keys(assignmentsToReturn[0]));
    }

    res.json({
      success: true,
      assignments: assignmentsToReturn || [],
      nextCursor,
      hasMore
    });
  } catch (error) {
    console.error('Error in admin all assignments route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assignments',
      error: error.message
    });
  }
});

// Get all submitted files for file collection (Team Leader view)
router.get('/team-leader/:userId/all-submissions', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🔍 DASHBOARD API: Fetching all submissions for team leader user ID: ${userId}`);

    // First, get all teams this user leads
    const ledTeams = await query(`
      SELECT DISTINCT t.name
      FROM team_leaders tl
      JOIN teams t ON tl.team_id = t.id
      WHERE tl.user_id = ?
    `, [userId]);

    if (!ledTeams || ledTeams.length === 0) {
      console.log(`⚠️ User ${userId} is not a leader of any teams`);
      return res.json({
        success: true,
        submissions: []
      });
    }

    const teamNames = ledTeams.map(t => t.name);
    console.log(`✅ User ${userId} leads teams:`, teamNames);

    // Get all submissions from ALL teams this user leads
    const placeholders = teamNames.map(() => '?').join(',');
    const allSubmissions = await query(`
      SELECT
        f.id,
        f.original_name,
        f.filename,
        f.file_type,
        f.file_path,
        f.public_network_url,
        f.file_size,
        f.uploaded_at,
        f.status,
        f.user_team,
        f.folder_name,
        f.relative_path,
        f.is_folder,
        u.username,
        u.fullName,
        asub.submitted_at,
        asub.submitted_at as created_at,
        a.id as assignment_id,
        a.title as assignment_title,
        a.due_date as assignment_due_date,
        a.team
      FROM assignment_submissions asub
      JOIN files f ON asub.file_id = f.id
      JOIN users u ON asub.user_id = u.id
      JOIN assignments a ON asub.assignment_id = a.id
      WHERE a.team IN (${placeholders})
      ORDER BY asub.submitted_at DESC
    `, teamNames);

    console.log(`✅ DASHBOARD API: Found ${allSubmissions?.length || 0} submissions across ${teamNames.length} teams`);

    res.json({
      success: true,
      submissions: allSubmissions || []
    });
  } catch (error) {
    console.error('❌ DASHBOARD API: Error fetching all submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submissions',
      error: error.message
    });
  }
});

// Get all tasks for team members view (similar to admin view but filtered by team)
router.get('/team/:team/all-tasks', async (req, res) => {
  try {
    console.log('🔍 Team tasks route called for team:', req.params.team);
    const { team } = req.params;
    const { cursor, limit = 20 } = req.query;
    const parsedLimit = parseInt(limit, 10);

    console.log('Fetching team tasks with pagination:', { team, cursor, limit: parsedLimit });

    let queryStr = `
      SELECT
        a.*,
        COUNT(DISTINCT CASE WHEN am.status = 'submitted' AND am.file_id IS NOT NULL THEN am.id END) as submission_count,
        COUNT(DISTINCT am.id) as assigned_members_count,
        COUNT(DISTINCT ac.id) as comment_count
      FROM assignments a
      LEFT JOIN assignment_members am ON a.id = am.assignment_id
      LEFT JOIN assignment_comments ac ON a.id = ac.assignment_id
      WHERE a.team = ?
    `;

    const queryParams = [team];

    // Add cursor condition if provided
    if (cursor) {
      queryStr += ' AND a.id < ?';
      queryParams.push(cursor);
    }

    queryStr += `
      GROUP BY a.id
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ?
    `;
    queryParams.push(parsedLimit + 1); // Fetch one extra to check if there are more

    const assignments = await query(queryStr, queryParams);

    console.log(`Found ${assignments.length} assignments for team ${team}`);

    // Check if there are more results
    const hasMore = assignments.length > parsedLimit;
    const assignmentsToReturn = hasMore ? assignments.slice(0, parsedLimit) : assignments;
    const nextCursor = hasMore && assignmentsToReturn.length > 0
      ? assignmentsToReturn[assignmentsToReturn.length - 1].id
      : null;

    // Get additional details for each assignment
    for (const assignment of assignmentsToReturn) {
      // Get assigned member details
      const assignedMembers = await query(`
        SELECT u.id, u.username, u.fullName
        FROM assignment_members am
        JOIN users u ON am.user_id = u.id
        WHERE am.assignment_id = ?
      `, [assignment.id]);

      assignment.assigned_member_details = assignedMembers || [];

      // Get attachments for this assignment
      const attachments = await query(`
        SELECT id, original_name, filename, file_path, file_size, file_type, folder_name, relative_path, created_at
        FROM assignment_attachments
        WHERE assignment_id = ?
        ORDER BY COALESCE(folder_name, ''), created_at DESC
      `, [assignment.id]);

      assignment.attachments = attachments || [];

      // Get recent submissions from assignment_submissions table (includes ALL submitted files)
      const recentSubmissions = await query(`
        SELECT
          f.id,
          f.original_name,
          f.filename,
          f.file_type,
          f.file_path,
          f.public_network_url,
          f.file_size,
          f.tag,
          f.description,
          f.uploaded_at,
          f.status,
          f.folder_name,
          f.relative_path,
          f.is_folder,
          u.username,
          u.fullName,
          asub.submitted_at,
          asub.submitted_at as created_at
        FROM assignment_submissions asub
        JOIN files f ON asub.file_id = f.id
        JOIN users u ON asub.user_id = u.id
        WHERE asub.assignment_id = ?
        ORDER BY asub.submitted_at DESC
      `, [assignment.id]);

      assignment.recent_submissions = recentSubmissions || [];

      // Get team leader info
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

    console.log(`Returning ${assignmentsToReturn.length} assignments to team view, hasMore: ${hasMore}`);

    res.json({
      success: true,
      assignments: assignmentsToReturn || [],
      nextCursor,
      hasMore
    });
  } catch (error) {
    console.error('Error in team all tasks route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team tasks',
      error: error.message
    });
  }
});

// Get all assignments for a team leader
router.get('/team-leader/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🔍 Fetching assignments for team leader user ID: ${userId}`);

    // First, get all teams this user leads
    const ledTeams = await query(`
      SELECT DISTINCT t.name
      FROM team_leaders tl
      JOIN teams t ON tl.team_id = t.id
      WHERE tl.user_id = ?
    `, [userId]);

    if (!ledTeams || ledTeams.length === 0) {
      console.log(`⚠️ User ${userId} is not a leader of any teams`);
      return res.json({
        success: true,
        assignments: []
      });
    }

    const teamNames = ledTeams.map(t => t.name);
    console.log(`✅ User ${userId} leads teams:`, teamNames);

    // Get all assignments from ALL teams this user leads
    const placeholders = teamNames.map(() => '?').join(',');
    const assignments = await query(`
      SELECT
        a.*,
        COUNT(DISTINCT asub.id) as submission_count,
        COUNT(DISTINCT am.id) as assigned_members_count
      FROM assignments a
      LEFT JOIN assignment_members am ON a.id = am.assignment_id
      LEFT JOIN assignment_submissions asub ON a.id = asub.assignment_id
      WHERE a.team IN (${placeholders})
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `, teamNames);

    console.log(`✅ Found ${assignments.length} assignments across ${teamNames.length} teams`);

    // Get recent submissions for each assignment
    for (const assignment of assignments) {
      // Get assigned member details
      const assignedMembers = await query(`
        SELECT u.id, u.username, u.fullName
        FROM assignment_members am
        JOIN users u ON am.user_id = u.id
        WHERE am.assignment_id = ?
      `, [assignment.id]);

      assignment.assigned_member_details = assignedMembers || [];

      // Get attachments for this assignment
      const attachments = await query(`
        SELECT id, original_name, filename, file_path, file_size, file_type, folder_name, relative_path, created_at
        FROM assignment_attachments
        WHERE assignment_id = ?
        ORDER BY COALESCE(folder_name, ''), created_at DESC
      `, [assignment.id]);

      assignment.attachments = attachments || [];

      // Get all submissions from assignment_submissions table (includes ALL submitted files)
      const recentSubmissions = await query(`
        SELECT
          f.id,
          f.original_name,
          f.filename,
          f.file_type,
          f.file_path,
          f.public_network_url,
          f.file_size,
          f.tag,
          f.description,
          f.uploaded_at,
          f.status,
          f.folder_name,
          f.relative_path,
          f.is_folder,
          f.user_team,
          u.username,
          u.fullName,
          asub.submitted_at,
          asub.submitted_at as created_at,
          asub.user_id
        FROM assignment_submissions asub
        JOIN files f ON asub.file_id = f.id
        JOIN users u ON asub.user_id = u.id
        WHERE asub.assignment_id = ?
        ORDER BY asub.submitted_at DESC
      `, [assignment.id]);

      assignment.recent_submissions = recentSubmissions || [];

      // Get team leader info
      const teamLeader = await queryOne(
        'SELECT fullName, username, email FROM users WHERE id = ?',
        [assignment.team_leader_id || assignment.teamLeaderId]
      );

      if (teamLeader) {
        assignment.team_leader_fullname = teamLeader.fullName;
        assignment.team_leader_username = teamLeader.username;
        assignment.team_leader_email = teamLeader.email;
      }

      // Debug log
      if (assignment.submission_count > 0 && (!recentSubmissions || recentSubmissions.length === 0)) {
        console.log(`WARNING: Assignment ${assignment.id} has submission_count ${assignment.submission_count} but no recent_submissions`);
        // Try to debug what's in assignment_members
        const debugData = await query(
          'SELECT * FROM assignment_members WHERE assignment_id = ?',
          [assignment.id]
        );
        console.log(`Debug assignment_members for assignment ${assignment.id}:`, debugData);
      }
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
        am.submitted_at,
        am.status as review_status,
        am.id as submission_id
      FROM assignment_members am
      JOIN files f ON am.file_id = f.id
      JOIN users u ON am.user_id = u.id
      WHERE am.assignment_id = ? AND am.file_id IS NOT NULL AND am.status = 'submitted'
      ORDER BY am.submitted_at DESC
    `, [assignmentId]);

    console.log(`Assignment ${assignmentId} details:`, {
      assignmentId,
      assignedMembersCount: memberDetails?.length || 0,
      submissionsCount: submissions?.length || 0,
      submissions: submissions
    });

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

// One-time nonce store: prevents Electron multipart cache replay on /create
// Client requests a nonce before each upload, uses it once, then it's deleted.
const uploadNonces = new Map(); // nonce -> { used: bool, expiresAt: number }

// Clean up expired nonces every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of uploadNonces.entries()) {
    if (now > v.expiresAt) uploadNonces.delete(k);
  }
}, 5 * 60 * 1000);

// Issue a one-time upload nonce (must be called right before the real upload)
router.post('/upload-nonce', (req, res) => {
  const nonce = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
  uploadNonces.set(nonce, { used: false, expiresAt: Date.now() + 2 * 60 * 1000 }); // valid 2 min
  res.json({ success: true, nonce });
});

// Create assignment via plain JSON (no file uploads) — bypasses multer entirely
// Used by client when no attachments are selected, to avoid Electron multipart cache replay
router.post('/create-json', async (req, res) => {
  try {
    const {
      title, description, dueDate, fileTypeRequired,
      assignedTo, assignedMembers, teamLeaderId, teamLeaderUsername, team
    } = req.body

    if (!title || !team || !teamLeaderId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' })
    }

    const finalMembers = Array.isArray(assignedMembers) ? assignedMembers : JSON.parse(assignedMembers || '[]')

    const assignmentResult = await query(`
      INSERT INTO assignments (
        title, description, due_date, file_type_required,
        assigned_to, max_file_size, team_leader_id, team_leader_username, team, created_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'active')
    `, [title, description || null, dueDate || null, fileTypeRequired || null,
        assignedTo || 'specific', 10485760, teamLeaderId, teamLeaderUsername, team])

    const assignmentId = assignmentResult.insertId
    let membersAssigned = 0

    if (finalMembers.length > 0) {
      const placeholders = finalMembers.map(() => '(?, ?)').join(', ')
      await query(
        `INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`,
        finalMembers.flatMap(uid => [assignmentId, uid])
      )
      membersAssigned = finalMembers.length

      for (const uid of finalMembers) {
        try {
          await query(`INSERT INTO notifications (user_id,assignment_id,file_id,type,title,message,action_by_id,action_by_username,action_by_role) VALUES (?,?,?,?,?,?,?,?,?)`,
            [uid, assignmentId, null, 'assignment', 'New Assignment',
             `${teamLeaderUsername} assigned you a new task: "${title}"${dueDate ? ` - Due: ${new Date(dueDate).toLocaleDateString()}` : ''}`,
             teamLeaderId, teamLeaderUsername, 'TEAM_LEADER'])
        } catch (e) { console.warn('Notification failed for user', uid, e.message) }
      }
    } else if (assignedTo === 'all') {
      const teamMembers = await query('SELECT id FROM users WHERE team = ? AND role = ?', [team, 'USER'])
      if (teamMembers.length > 0) {
        const placeholders = teamMembers.map(() => '(?, ?)').join(', ')
        await query(
          `INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`,
          teamMembers.flatMap(m => [assignmentId, m.id])
        )
        membersAssigned = teamMembers.length
      }
    }

    try {
      await query(`INSERT INTO activity_logs (user_id,username,role,team,activity) VALUES (?,?,?,?,?)`,
        [teamLeaderId, teamLeaderUsername, 'TEAM_LEADER', team, `Created assignment: ${title}`])
    } catch (e) { /* ignore */ }

    console.log(`✅ Assignment ${assignmentId} created via JSON (no attachments)`)
    res.json({ success: true, message: 'Assignment created successfully', assignmentId, membersAssigned, attachmentsCreated: 0 })
  } catch (error) {
    console.error('Error creating assignment (JSON):', error)
    res.status(500).json({ success: false, message: 'Failed to create assignment', error: error.message })
  }
});

// Create new assignment with file attachments
// NOTE: If client sends no files, it should use /create-json instead.
// This route still cleans up any stray multer files if hasAttachments is false.
router.post('/create', upload.array('attachments', 10000), async (req, res) => {
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
    const finalMembers = typeof assignedMembers === 'string' ? JSON.parse(assignedMembers) : (assignedMembers || assigned_members);
    const finalTeamLeaderId = teamLeaderId || team_leader_id;
    const finalTeamLeaderUsername = teamLeaderUsername || team_leader_username;

    // NONCE VALIDATION: Reject any request that doesn't have a fresh one-time nonce.
    // This is the definitive fix for Electron's multipart cache replay bug:
    // A cached/replayed request will not have a valid unused nonce, so it gets rejected.
    const requestNonce = req.body.uploadNonce;
    const rawFiles = req.files || [];

    if (!requestNonce || !uploadNonces.has(requestNonce)) {
      // No valid nonce = replayed or stale request — discard all files and reject
      console.warn(`⚠️ /create rejected: missing or invalid uploadNonce. Discarding ${rawFiles.length} file(s).`);
      for (const f of rawFiles) {
        try { fs.unlinkSync(f.path); } catch (e) { /* ignore */ }
      }
      return res.status(400).json({ success: false, message: 'Invalid or missing upload nonce. Please try again.' });
    }

    const nonceEntry = uploadNonces.get(requestNonce);
    if (nonceEntry.used) {
      // Already-used nonce = definitely a replay attack
      console.warn(`⚠️ /create rejected: nonce already used. Discarding ${rawFiles.length} file(s).`);
      for (const f of rawFiles) {
        try { fs.unlinkSync(f.path); } catch (e) { /* ignore */ }
      }
      return res.status(400).json({ success: false, message: 'Upload nonce already used. Please try again.' });
    }

    // Mark nonce as used immediately (one-time use)
    nonceEntry.used = true;

    const clientSentAttachments = req.body.hasAttachments === 'true';

    // Even with a valid nonce, if client says no attachments, discard any stray files
    if (!clientSentAttachments && rawFiles.length > 0) {
      console.warn(`⚠️ Discarding ${rawFiles.length} unexpected temp file(s) — client did not flag hasAttachments`);
      for (const f of rawFiles) {
        try { fs.unlinkSync(f.path); } catch (e) { /* ignore */ }
      }
    }

    const uploadedFiles = clientSentAttachments ? rawFiles : [];

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
    let attachmentsCreated = 0;

    // Save attachment file records if any files were uploaded
    if (uploadedFiles.length > 0) {
      try {
        console.log(`📎 Saving ${uploadedFiles.length} attachment(s) for assignment ${assignmentId}`);

        // Parse relative paths sent by the client ONCE before the loop
        let relativePaths = []
        try {
          relativePaths = JSON.parse(req.body.relativePaths || '[]')
          console.log(`📂 relativePaths received: ${JSON.stringify(relativePaths)}`)
        } catch (e) {
          console.warn('⚠️ Could not parse relativePaths:', e.message)
          relativePaths = []
        }

        for (const file of uploadedFiles) {
          // Move file from temp location to team leader's folder
          let finalPath;
          try {
            finalPath = await moveToUserFolder(file.path, finalTeamLeaderUsername, file.originalname);
            console.log(`✅ Moved attachment to: ${finalPath}`);
          } catch (moveError) {
            console.error('⚠️ Failed to move attachment file:', moveError);
            // If move fails, use the original temp path
            finalPath = file.path;
          }

          const fileIndex = uploadedFiles.indexOf(file)
          const relPath = relativePaths[fileIndex] || file.originalname
          const folderName = relPath.includes('/') ? relPath.split('/')[0] : null
          console.log(`📎 File ${fileIndex}: ${file.originalname} → relPath: ${relPath}, folderName: ${folderName}`)

          await query(`
            INSERT INTO assignment_attachments (
              assignment_id,
              original_name,
              filename,
              file_path,
              file_size,
              file_type,
              uploaded_by_id,
              uploaded_by_username,
              folder_name,
              relative_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            assignmentId,
            file.originalname,
            path.basename(finalPath),
            finalPath,
            file.size,
            file.mimetype,
            finalTeamLeaderId,
            finalTeamLeaderUsername,
            folderName,
            relPath !== file.originalname ? relPath : null
          ]);
          attachmentsCreated++;
        }

        console.log(`✅ Saved ${attachmentsCreated} attachment(s) for assignment ${assignmentId}`);
      } catch (attachmentError) {
        console.error('⚠️ Failed to save attachments:', attachmentError);
        // Don't fail the request if attachments fail
      }
    }

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
        membersAssigned,
        attachmentsCreated
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

// Update existing assignment with file attachments
router.put('/:id', upload.array('attachments', 10000), async (req, res) => {
  try {
    const { id } = req.params;
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
    const finalMembers = typeof assignedMembers === 'string' ? JSON.parse(assignedMembers) : (assignedMembers || assigned_members);
    const finalTeamLeaderId = teamLeaderId || team_leader_id;
    const finalTeamLeaderUsername = teamLeaderUsername || team_leader_username;

    // NONCE VALIDATION for PUT (edit with attachments)
    const requestNonce = req.body.uploadNonce;
    const rawFiles = req.files || [];

    if (!requestNonce || !uploadNonces.has(requestNonce)) {
      console.warn(`⚠️ [PUT] rejected: missing or invalid uploadNonce. Discarding ${rawFiles.length} file(s).`);
      for (const f of rawFiles) {
        try { fs.unlinkSync(f.path); } catch (e) { /* ignore */ }
      }
      return res.status(400).json({ success: false, message: 'Invalid or missing upload nonce. Please try again.' });
    }

    const nonceEntry = uploadNonces.get(requestNonce);
    if (nonceEntry.used) {
      console.warn(`⚠️ [PUT] rejected: nonce already used. Discarding ${rawFiles.length} file(s).`);
      for (const f of rawFiles) {
        try { fs.unlinkSync(f.path); } catch (e) { /* ignore */ }
      }
      return res.status(400).json({ success: false, message: 'Upload nonce already used. Please try again.' });
    }
    nonceEntry.used = true;

    const clientSentAttachments = req.body.hasAttachments === 'true';

    if (!clientSentAttachments && rawFiles.length > 0) {
      console.warn(`⚠️ [PUT] Discarding ${rawFiles.length} unexpected temp file(s) — client did not flag hasAttachments`);
      for (const f of rawFiles) {
        try { fs.unlinkSync(f.path); } catch (e) { /* ignore */ }
      }
    }

    const uploadedFiles = clientSentAttachments ? rawFiles : [];

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    // Check if assignment exists
    const existingAssignment = await queryOne(
      'SELECT * FROM assignments WHERE id = ?',
      [id]
    );

    if (!existingAssignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Update assignment
    await query(`
      UPDATE assignments SET
        title = ?,
        description = ?,
        due_date = ?,
        file_type_required = ?,
        assigned_to = ?,
        max_file_size = ?
      WHERE id = ?
    `, [
      title,
      description || null,
      finalDueDate || null,
      finalFileType || null,
      finalAssignedTo || existingAssignment.assigned_to,
      finalMaxSize,
      id
    ]);

    let membersAssigned = 0;
    let attachmentsCreated = 0;

    // Save new attachment file records if any files were uploaded
    if (uploadedFiles.length > 0) {
      try {
        console.log(`📎 Saving ${uploadedFiles.length} new attachment(s) for assignment ${id}`);

        for (const file of uploadedFiles) {
          // Move file from temp location to team leader's folder
          let finalPath;
          try {
            finalPath = await moveToUserFolder(file.path, finalTeamLeaderUsername, file.originalname);
            console.log(`✅ Moved attachment to: ${finalPath}`);
          } catch (moveError) {
            console.error('⚠️ Failed to move attachment file:', moveError);
            // If move fails, use the original temp path
            finalPath = file.path;
          }

          await query(`
            INSERT INTO assignment_attachments (
              assignment_id,
              original_name,
              filename,
              file_path,
              file_size,
              file_type,
              uploaded_by_id,
              uploaded_by_username
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            id,
            file.originalname,
            path.basename(finalPath),
            finalPath,
            file.size,
            file.mimetype,
            finalTeamLeaderId,
            finalTeamLeaderUsername
          ]);
          attachmentsCreated++;
        }

        console.log(`✅ Saved ${attachmentsCreated} new attachment(s) for assignment ${id}`);
      } catch (attachmentError) {
        console.error('⚠️ Failed to save attachments:', attachmentError);
        // Don't fail the request if attachments fail
      }
    }

    try {
      // Update assigned members if provided
      if (finalMembers && Array.isArray(finalMembers)) {
        // Delete existing assignments
        await query('DELETE FROM assignment_members WHERE assignment_id = ?', [id]);

        // Insert new assignments
        if (finalMembers.length > 0) {
          const memberValues = finalMembers.map(userId => [id, userId]);
          const placeholders = memberValues.map(() => '(?, ?)').join(', ');
          const flattenedValues = memberValues.flat();

          await query(
            `INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`,
            flattenedValues
          );
          membersAssigned = finalMembers.length;
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
          finalTeamLeaderId || existingAssignment.team_leader_id,
          finalTeamLeaderUsername || existingAssignment.team_leader_username,
          'TEAM_LEADER',
          team || existingAssignment.team,
          `Updated assignment: ${title}`
        ]);
      } catch (logError) {
        console.warn('Activity log insertion failed:', logError.message);
      }

      res.json({
        success: true,
        message: 'Assignment updated successfully',
        assignmentId: id,
        membersAssigned,
        attachmentsCreated
      });

    } catch (memberError) {
      console.error('Error updating members:', memberError);
      res.json({
        success: true,
        message: 'Assignment updated successfully',
        assignmentId: id,
        membersAssigned: 0,
        warning: 'Assignment updated but member assignment failed'
      });
    }

  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update assignment',
      error: error.message
    });
  }
});



// Get assignments for a specific user with all submitted files
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
        fs.file_path as submitted_file_path,
        fs.id as submitted_file_id,
        fs.tag as submitted_file_tag,
        tl.fullName as team_leader_fullname,
        tl.username as team_leader_username,
        tl.role as team_leader_role,
        ? as assigned_user_fullname,
        ? as assigned_user_username
      FROM assignments a
      LEFT JOIN assignment_members am ON a.id = am.assignment_id AND am.user_id = ?
      LEFT JOIN files fs ON am.file_id = fs.id
      LEFT JOIN users tl ON a.team_leader_id = tl.id
      WHERE
        (a.assigned_to = 'all' AND a.team = ?)
        OR
        (a.assigned_to = 'specific' AND am.user_id = ?)
      ORDER BY a.created_at DESC
    `, [currentUser.fullName, currentUser.username, userId, currentUser.team, userId]);

    console.log('Assignments found:', assignments.length);
    if (assignments.length > 0) {
      console.log('First assignment:', assignments[0]);
    }

    // Fetch assigned member details and all submitted files for each assignment
    for (const assignment of assignments) {
      const memberDetails = await query(`
        SELECT u.id, u.username, u.fullName
        FROM assignment_members am
        JOIN users u ON am.user_id = u.id
        WHERE am.assignment_id = ?
      `, [assignment.id]);

      assignment.assigned_member_details = memberDetails || [];

      // Get attachments for this assignment
      const attachments = await query(`
        SELECT id, original_name, filename, file_path, file_size, file_type, folder_name, relative_path, created_at
        FROM assignment_attachments
        WHERE assignment_id = ?
        ORDER BY COALESCE(folder_name, ''), created_at DESC
      `, [assignment.id]);

      assignment.attachments = attachments || [];

      // Fetch ALL submitted files for this assignment by this user
      const submittedFiles = await query(`
        SELECT 
          f.id,
          f.original_name,
          f.filename,
          f.file_path,
          f.file_type,
          f.file_size,
          f.tag,
          f.description,
          f.status,
          f.folder_name,
          f.relative_path,
          f.is_folder,
          asub.submitted_at,
          u.fullName as submitter_name,
          u.username as submitter_username
        FROM assignment_submissions asub
        JOIN files f ON asub.file_id = f.id
        JOIN users u ON asub.user_id = u.id
        WHERE asub.assignment_id = ? AND asub.user_id = ?
        ORDER BY asub.submitted_at DESC
      `, [assignment.id, userId]);

      assignment.submitted_files = submittedFiles || [];
      console.log(`Assignment ${assignment.id} has ${submittedFiles ? submittedFiles.length : 0} submitted file(s)`);
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

// Submit assignment (supports multiple file submissions with BATCHED notifications)
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

    // Check if this specific file has already been submitted for this assignment
    const existingFileSubmission = await queryOne(
      'SELECT * FROM assignment_submissions WHERE assignment_id = ? AND file_id = ?',
      [assignmentId, fileId]
    );

    if (existingFileSubmission) {
      return res.status(400).json({
        success: false,
        message: 'This file has already been submitted for this assignment'
      });
    }

    // Add submission to assignment_submissions table
    await query(
      'INSERT INTO assignment_submissions (assignment_id, file_id, user_id, submitted_at) VALUES (?, ?, ?, NOW())',
      [assignmentId, fileId, userId]
    );

    // Check if user has submitted before
    const hasSubmittedBefore = await queryOne(
      'SELECT * FROM assignment_members WHERE assignment_id = ? AND user_id = ?',
      [assignmentId, userId]
    );

    // Update assignment_members to mark as submitted (first submission)
    if (hasSubmittedBefore && hasSubmittedBefore.status !== 'submitted') {
      await query(
        'UPDATE assignment_members SET status = ?, submitted_at = NOW(), file_id = ? WHERE assignment_id = ? AND user_id = ?',
        ['submitted', fileId, assignmentId, userId]
      );
      console.log(`✅ Assignment ${assignmentId} first submission by user ${userId} with file ${fileId}`);
    } else if (!hasSubmittedBefore) {
      // For 'all' assignments, create the assignment_members entry on first submission
      await query(
        'INSERT INTO assignment_members (assignment_id, user_id, status, submitted_at, file_id) VALUES (?, ?, ?, NOW(), ?)',
        [assignmentId, userId, 'submitted', fileId]
      );
      console.log(`✅ Assignment ${assignmentId} first submission by user ${userId} (auto-created member entry)`);
    } else {
      console.log(`✅ Assignment ${assignmentId} additional file submitted by user ${userId} with file ${fileId}`);
    }

    // BATCHED NOTIFICATION SYSTEM
    // Get user details for notification
    const submitter = await queryOne(
      'SELECT username, fullName FROM users WHERE id = ?',
      [userId]
    );

    // Get file details for notification
    const file = await queryOne(
      'SELECT original_name, folder_name FROM files WHERE id = ?',
      [fileId]
    );

    // Create batch key: assignmentId-userId-teamLeaderId
    const batchKey = `${assignmentId}-${userId}-${assignment.team_leader_id}`;

    // If batch doesn't exist, create it
    if (!pendingBatchSubmissions.has(batchKey)) {
      pendingBatchSubmissions.set(batchKey, {
        teamLeaderId: assignment.team_leader_id,
        assignmentId: assignmentId,
        submissions: []
      });
    }

    // Add this submission to the batch
    const batch = pendingBatchSubmissions.get(batchKey);
    batch.submissions.push({
      fileId: fileId,
      fileName: file.original_name,
      folderName: file.folder_name,
      userId: userId,
      username: submitter.username,
      submitterName: submitter.fullName
    });

    console.log(`📦 Added file to batch: ${file.original_name} (${batch.submissions.length} files total)`);

    // Clear existing timeout if any
    if (batch.timeoutId) {
      clearTimeout(batch.timeoutId);
    }

    // Set timeout to send batched notification after 5 seconds of no new submissions
    batch.timeoutId = setTimeout(async () => {
      const batchToSend = pendingBatchSubmissions.get(batchKey);
      if (batchToSend) {
        console.log(`🔔 Sending batched notification for ${batchToSend.submissions.length} file(s)`);
        await createBatchedSubmissionNotification(
          batchToSend.teamLeaderId,
          batchToSend.assignmentId,
          batchToSend.submissions
        );
        pendingBatchSubmissions.delete(batchKey);
      }
    }, 5000); // Wait 5 seconds after last submission to accommodate folder uploads

    res.json({
      success: true,
      message: 'File submitted successfully'
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
    try {
      console.log(`💬 Comment posted by ${user.role}: ${user.fullName} (ID: ${userId})`);
      console.log(`📋 Assignment ID: ${assignmentId}`);

      // Get assignment details
      const assignment = await queryOne(
        'SELECT title, team_leader_id FROM assignments WHERE id = ?',
        [assignmentId]
      );
      console.log(`📝 Assignment title: ${assignment?.title}`);

      // Get all members assigned to this task (except the commenter)
      const assignedMembers = await query(
        'SELECT user_id FROM assignment_members WHERE assignment_id = ? AND user_id != ?',
        [assignmentId, userId]
      );

      console.log(`👥 Found ${assignedMembers.length} assigned members (excluding commenter):`);
      console.log(assignedMembers);

      // If admin commented, notify both team leader AND assigned members
      if (user.role === 'ADMIN') {
        console.log('🏗️ Admin commented - notifying both team leader and assigned members');
        console.log('📊 Assignment details:', {
          assignmentId,
          team_leader_id: assignment.team_leader_id,
          teamLeaderId: assignment.teamLeaderId,
          userId,
          userRole: user.role,
          title: assignment.title
        });

        // Always notify the team leader if they exist (including if admin is also team leader)
        const teamLeaderId = assignment.team_leader_id || assignment.teamLeaderId;
        if (teamLeaderId) {
          console.log(`📤 Creating notification for team leader ID: ${teamLeaderId}`);

          const teamLeaderNotification = await query(`
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
            assignment.team_leader_id,
            assignmentId,
            null,
            'comment',
            'New Admin Comment on Assignment',
            `Admin ${user.fullName} commented on "${assignment.title}": ${comment.substring(0, 100)}${comment.length > 100 ? '...' : ''}`,
            userId,
            username,
            user.role
          ]);

          console.log(`✅ Notification created for team leader with ID: ${teamLeaderNotification.insertId}`);
        }

        // Then notify assigned members (except if any of them are team leaders who already got notified)
        if (assignedMembers.length === 0) {
          console.log('ℹ️ No members to notify (either no one assigned or only commenter is assigned)');
        }

        // Create notification for each assigned member
        for (const member of assignedMembers) {
          console.log(`📤 Creating notification for user ID: ${member.user_id}`);

          const notificationResult = await query(`
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
            member.user_id,
            assignmentId,
            null,
            'comment',
            'New Admin Comment on Assignment',
            `Admin ${user.fullName} commented on "${assignment.title}": ${comment.substring(0, 100)}${comment.length > 100 ? '...' : ''}`,
            userId,
            username,
            user.role
          ]);

          console.log(`✅ Notification created with ID: ${notificationResult.insertId}`);
        }

        console.log(`✅ Successfully created admin comment notifications for team leader + ${assignedMembers.length} member(s)`);
      }
      // If team leader commented, notify assigned members
      else if (user.role === 'TEAM_LEADER') {
        if (assignedMembers.length === 0) {
          console.log('ℹ️ No members to notify (either no one assigned or only commenter is assigned)');
        }

        // Create notification for each assigned member
        for (const member of assignedMembers) {
          console.log(`📤 Creating notification for user ID: ${member.user_id}`);

          const notificationResult = await query(`
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
            member.user_id,
            assignmentId,
            null,
            'comment',
            'New Comment on Assignment',
            `${user.fullName} commented on "${assignment.title}": ${comment.substring(0, 100)}${comment.length > 100 ? '...' : ''}`,
            userId,
            username,
            user.role
          ]);

          console.log(`✅ Notification created with ID: ${notificationResult.insertId}`);
        }

        console.log(`✅ Successfully created ${assignedMembers.length} comment notification(s)`);
      }
      // If regular user commented, notify team leader
      else if (user.role === 'USER' && assignment.team_leader_id && assignment.team_leader_id !== userId) {
        console.log(`📤 Creating notification for team leader ID: ${assignment.team_leader_id}`);

        const notificationResult = await query(`
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
          assignment.team_leader_id,
          assignmentId,
          null,
          'comment',
          'New Comment on Assignment',
          `${user.fullName} commented on "${assignment.title}": ${comment.substring(0, 100)}${comment.length > 100 ? '...' : ''}`,
          userId,
          username,
          user.role
        ]);

        console.log(`✅ Notification created for team leader with ID: ${notificationResult.insertId}`);
      } else {
        console.log(`ℹ️ User ${user.fullName} (${user.role}) posted comment - no additional notifications needed`);
      }
    } catch (notifError) {
      console.error('⚠️ Failed to create comment notifications:', notifError);
      console.error('Error stack:', notifError.stack);
      // Don't fail the request if notifications fail
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

// Archive assignment (Admin only)
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
router.delete('/:assignmentId', async (req, res) => {
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

    // Get all file IDs associated with this assignment
    const submittedFiles = await query(
      'SELECT file_id FROM assignment_submissions WHERE assignment_id = ?',
      [assignmentId]
    );

    console.log(`✅ Assignment ${assignmentId} has ${submittedFiles ? submittedFiles.length : 0} submitted file(s)`);
    console.log('ℹ️ Files will be kept in database and NAS - they will return to users\' "My Files"');

    // ✅ IMPORTANT: Do NOT delete files from the files table
    // Files should persist after assignment deletion so users can access them in "My Files"
    // Only delete the assignment_submissions links (done below via cascade)

    // Delete related records (replies will cascade delete when comments are deleted)
    await query('DELETE FROM assignment_submissions WHERE assignment_id = ?', [assignmentId]);
    await query('DELETE FROM assignment_members WHERE assignment_id = ?', [assignmentId]);
    await query('DELETE FROM assignment_comments WHERE assignment_id = ?', [assignmentId]);

    // Delete the assignment
    await query('DELETE FROM assignments WHERE id = ?', [assignmentId]);

    console.log(`✅ Assignment ${assignmentId} deleted successfully with all related data`);

    res.json({
      success: true,
      message: 'Assignment and associated files deleted permanently',
      deletedFiles: submittedFiles ? submittedFiles.length : 0
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

// Remove a submitted file from an assignment
router.delete('/:assignmentId/files/:fileId', async (req, res) => {
  try {
    const { assignmentId, fileId } = req.params;
    const { userId } = req.body;

    console.log(`🗑️ Removing file ${fileId} from assignment ${assignmentId} for user ${userId}`);

    // Verify the file belongs to this user and assignment
    const submission = await queryOne(
      'SELECT * FROM assignment_submissions WHERE assignment_id = ? AND file_id = ? AND user_id = ?',
      [assignmentId, fileId, userId]
    );

    if (!submission) {
      console.log('❌ Submission not found or user not authorized');
      return res.status(404).json({
        success: false,
        message: 'File not found or you are not authorized to remove it'
      });
    }

    // Get file info before deleting
    const fileInfo = await queryOne(
      'SELECT file_path FROM files WHERE id = ?',
      [fileId]
    );
    console.log('📄 File to delete:', fileInfo);

    // Check if there are any OTHER submissions for this assignment by this user
    const remainingSubmissions = await query(
      'SELECT file_id, submitted_at FROM assignment_submissions WHERE assignment_id = ? AND user_id = ? AND file_id != ? ORDER BY submitted_at DESC',
      [assignmentId, userId, fileId]
    );
    console.log(`📊 Found ${remainingSubmissions?.length || 0} remaining submission(s) after deleting file ${fileId}`);
    if (remainingSubmissions && remainingSubmissions.length > 0) {
      console.log('Remaining files:', remainingSubmissions.map(s => s.file_id));
    }

    // 🗑️ DELETE EVERYTHING - Start by removing ALL foreign key references
    console.log('🔗 Step 1: Removing ALL foreign key references...');

    // 1. CRITICAL: Set file_id = NULL in assignment_members FIRST (before deleting anything)
    // This clears the foreign key reference to the file we're about to delete
    console.log(`⚙️ Setting file_id=NULL for assignment ${assignmentId}, user ${userId}, file ${fileId}`);
    await query(
      'UPDATE assignment_members SET file_id = NULL WHERE assignment_id = ? AND user_id = ? AND file_id = ?',
      [assignmentId, userId, fileId]
    );
    console.log('✅ Cleared file_id reference in assignment_members');

    // Now update status based on remaining submissions
    if (!remainingSubmissions || remainingSubmissions.length === 0) {
      console.log('🚧 No remaining files - setting status to pending');
      await query(
        'UPDATE assignment_members SET status = ?, submitted_at = NULL WHERE assignment_id = ? AND user_id = ?',
        ['pending', assignmentId, userId]
      );
      console.log('✅ Updated assignment_members: status=pending (no more files)');
    } else {
      const mostRecentFile = remainingSubmissions[0];
      console.log(`🔄 Pointing to most recent remaining file: ${mostRecentFile.file_id}`);

      // Verify the file we're pointing to actually exists and is NOT the one being deleted
      if (mostRecentFile.file_id === fileId) {
        console.error('❌❌❌ ERROR: Trying to set file_id to the file being deleted!');
        throw new Error('Logic error: Cannot set file_id to file being deleted');
      }

      await query(
        'UPDATE assignment_members SET file_id = ?, submitted_at = ?, status = ? WHERE assignment_id = ? AND user_id = ?',
        [mostRecentFile.file_id, mostRecentFile.submitted_at, 'submitted', assignmentId, userId]
      );
      console.log('✅ Updated assignment_members to point to most recent remaining file');
    }

    // 2. Delete from assignment_submissions
    await query(
      'DELETE FROM assignment_submissions WHERE assignment_id = ? AND file_id = ? AND user_id = ?',
      [assignmentId, fileId, userId]
    );
    console.log('✅ Deleted from assignment_submissions');

    // 3. Delete from notifications (if any reference this file)
    try {
      await query('DELETE FROM notifications WHERE file_id = ?', [fileId]);
      console.log('✅ Deleted notifications');
    } catch (err) {
      console.log('⚠️ No notifications to delete');
    }

    // 4. Delete from file_comments
    try {
      await query('DELETE FROM file_comments WHERE file_id = ?', [fileId]);
      console.log('✅ Deleted file comments');
    } catch (err) {
      console.log('⚠️ No file comments to delete');
    }

    // 5. Delete from file_status_history
    try {
      await query('DELETE FROM file_status_history WHERE file_id = ?', [fileId]);
      console.log('✅ Deleted file status history');
    } catch (err) {
      console.log('⚠️ No file status history to delete');
    }

    // 6. Check for any other references in assignment_attachments
    try {
      await query('DELETE FROM assignment_attachments WHERE file_id = ?', [fileId]);
      console.log('✅ Deleted from assignment_attachments');
    } catch (err) {
      console.log('⚠️ No assignment_attachments to delete');
    }

    console.log('💾 Step 2: Deleting physical file...');

    // 7. Delete physical file from NAS
    if (fileInfo && fileInfo.file_path) {
      try {
        if (fs.existsSync(fileInfo.file_path)) {
          fs.unlinkSync(fileInfo.file_path);
          console.log('✅ Physical file deleted from:', fileInfo.file_path);
        } else {
          console.log('⚠️ Physical file not found at:', fileInfo.file_path);
        }
      } catch (fsError) {
        console.error('❌ Failed to delete physical file:', fsError);
      }
    }

    console.log('📀 Step 3: Deleting file record from database...');

    // 8. Finally, delete file record from database
    await query('DELETE FROM files WHERE id = ?', [fileId]);
    console.log('✅ File record deleted from database');

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error removing submitted file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove file',
      error: error.message
    });
  }
});

// Debug endpoint - Get raw assignment_members data
router.get('/debug/:assignmentId/members', async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const members = await query(
      'SELECT * FROM assignment_members WHERE assignment_id = ?',
      [assignmentId]
    );

    const assignment = await queryOne(
      'SELECT * FROM assignments WHERE id = ?',
      [assignmentId]
    );

    res.json({
      success: true,
      assignment,
      members,
      membersCount: members?.length || 0
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch debug data',
      error: error.message
    });
  }
});

// Delete a single assignment attachment (Team Leader only)
router.delete('/:assignmentId/attachments/:attachmentId', async (req, res) => {
  try {
    const { assignmentId, attachmentId } = req.params;

    const attachment = await queryOne(
      'SELECT * FROM assignment_attachments WHERE id = ? AND assignment_id = ?',
      [attachmentId, assignmentId]
    );

    if (!attachment) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }

    // Delete physical file
    if (attachment.file_path) {
      try {
        const filePath = attachment.file_path.startsWith('/uploads/')
          ? require('path').join(uploadsDir, attachment.file_path.substring(9))
          : attachment.file_path;
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) { console.warn('⚠️ Could not delete physical attachment file:', e.message); }
    }

    await query('DELETE FROM assignment_attachments WHERE id = ?', [attachmentId]);

    console.log(`✅ Attachment ${attachmentId} deleted from assignment ${assignmentId}`);
    res.json({ success: true, message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({ success: false, message: 'Failed to delete attachment', error: error.message });
  }
});

// NOTE: Comment and reply routes are already registered above with full inline logic.
// The assignmentController duplicates are intentionally removed to prevent route conflicts.

console.log('✅ Assignments routes registered, including comments endpoint');
module.exports = router;
