const fileService = require('../services/fileService');
const { uploadsDir } = require('../config/middleware');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { invalidateCache } = require('../utils/cacheUtils');

/**
 * File Controller
 * Handles HTTP requests for file operations
 */
class FileController {
  /**
     * Upload a file
     */
  uploadFile = asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const fileData = {
      original_name: req.file.originalname,
      filename: req.file.filename,
      file_path: req.file.path,
      file_size: req.file.size,
      file_type: req.file.mimetype,
      mime_type: req.file.mimetype,
      tag: req.body.tag,
      description: req.body.description,
      folder_name: req.body.folderName,
      relative_path: req.body.relativePath,
      is_folder: req.body.isFolder === 'true',
      assignment_id: req.body.assignmentId || null
    };

    const result = await fileService.uploadFile(fileData, req.user);

    if (result.isDuplicate) {
      return res.status(409).json({
        success: false,
        isDuplicate: true,
        message: 'File with this name already exists',
        existingFile: result.existingFile
      });
    }

    invalidateCache();

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      file: result
    });
  });

  /**
     * Upload multiple files (bulk) — FAST PATH
     *
     * Strategy:
     *   1. Multer has already written all files to local OS temp dir (fast, local disk).
     *   2. We INSERT the DB records immediately with the temp paths so the client
     *      can see the files right away.
     *   3. We respond to the client INSTANTLY — no waiting for the NAS.
     *   4. The NAS move (streamCopy) happens in the background after the response.
     *
     * This means the upload bar completes in ~1-2s regardless of NAS speed.
     */
  bulkUpload = asyncHandler(async (req, res) => {
    const rawFiles = req.files || [];
    if (rawFiles.length === 0) {
      throw new ValidationError('No files uploaded');
    }

    const { assignmentId, tag, description, targetFolder } = req.body;
    let relativePaths = [];
    try {
      relativePaths = JSON.parse(req.body.relativePaths || '[]');
    } catch (_) {}

    const filesData = rawFiles.map((file, i) => {
      const relPath = relativePaths[i] || file.originalname;
      return {
        original_name: file.originalname,
        filename: file.filename,
        file_path: file.path,   // still pointing at local temp — that's fine for now
        file_size: file.size,
        file_type: file.mimetype,
        mime_type: file.mimetype,
        tag,
        description,
        folder_name: relPath.includes('/') ? relPath.split('/')[0] : null,
        relative_path: relPath,
        is_folder: relPath.includes('/')
      };
    });

    // ── Phase 1: DB inserts only (fast — no NAS I/O) ──────────────────────
    const { assignmentLinks, fileRecords } = await fileService.bulkUploadFast(filesData, req.user, assignmentId, targetFolder);

    invalidateCache();

    // ── Respond immediately so the client sees 100% ───────────────────────
    res.status(201).json({
      success: true,
      message: `Bulk upload processed ${fileRecords.filter(r => r.success).length} files`,
      results: fileRecords,
      assignmentId: assignmentId || null
    });

    // ── Phase 2: move temp → NAS in the background (non-blocking) ─────────
    setImmediate(() => {
      fileService.bulkUploadMoveToNas(fileRecords, req.user, assignmentId, assignmentLinks)
        .catch(err => require('../utils/logger').logError(err, { context: 'bulkUpload-background-NAS-move' }));
    });
  });

  /**
     * Approve file by team leader
     */
  approveByTeamLeader = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { comments } = req.body;

    const file = await fileService.approveByTeamLeader(id, req.user, comments);
    invalidateCache();

    res.json({
      success: true,
      message: 'File approved by team leader',
      file
    });
  });

  /**
     * Reject file by team leader
     */
  rejectByTeamLeader = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    const file = await fileService.rejectByTeamLeader(id, req.user, reason);
    invalidateCache();

    res.json({
      success: true,
      message: 'File rejected by team leader',
      file
    });
  });

  /**
     * Admin review — dispatches to approve or reject based on req.body.action
     */
  adminReview = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { action, comments, reason } = req.body;

    if (action === 'reject') {
      const file = await fileService.rejectByAdmin(id, req.user, reason || comments);
      invalidateCache();
      return res.json({ success: true, message: 'File rejected by administrator', file });
    }

    // default: approve
    const file = await fileService.approveByAdmin(id, req.user, comments);
    invalidateCache();
    return res.json({ success: true, message: 'File final approved by administrator', file });
  });

  /**
     * Reject file by admin
     */
  rejectByAdmin = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    const file = await fileService.rejectByAdmin(id, req.user, reason);
    invalidateCache();

    res.json({
      success: true,
      message: 'File rejected by administrator',
      file
    });
  });

  /**
     * Move file to projects directory
     */
  moveToProjects = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { destinationPath, deleteFromUploads } = req.body;

    if (!destinationPath) {
      throw new ValidationError('Destination path is required');
    }

    const newPath = await fileService.moveToProjects(
      id,
      destinationPath,
      req.user,
      deleteFromUploads === true || deleteFromUploads === 'true'
    );

    res.json({
      success: true,
      message: 'File moved to projects successfully',
      path: newPath
    });
  });

  /**
     * Delete file
     */
  deleteFile = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await fileService.deleteFile(id, req.user);
    invalidateCache();

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  });

  /**
     * Get file stats
     */
  getStats = asyncHandler(async (req, res) => {
    const criteria = {};
    if (req.user.role === 'TEAM_LEADER') {
      criteria.team = req.user.team;
    }
    if (req.user.role === 'USER') {
      criteria.user_id = req.user.id;
    }

    const stats = await fileService.getFileStats(criteria);
    res.json({ success: true, stats });
  });

  /**
     * Get files for a specific user
     */
  getUserFiles = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const files = await fileService.getUserFiles(userId);
    res.json({ success: true, files });
  });

  /**
     * Get current user's files
     */
  getMyFiles = asyncHandler(async (req, res) => {
    const files = await fileService.getUserFiles(req.user.id);
    res.json({ success: true, files });
  });

  /**
     * Get pending reviews for team leader (non-paginated, for badge counts etc.)
     */
  getPendingReview = asyncHandler(async (req, res) => {
    const team = req.user.role === 'ADMIN' ? null : req.user.team;
    const files = await fileService.getPendingTeamLeaderReview(team);
    res.json({ success: true, files });
  });

  /**
     * Get team notifications and counts
     */
  getTeamNotifications = asyncHandler(async (req, res) => {
    const { team } = req.params;
    const pendingFiles = await fileService.getPendingTeamLeaderReview(team);

    res.json({
      success: true,
      notifications: [],
      counts: {
        pending: pendingFiles ? pendingFiles.length : 0,
        urgent: pendingFiles ? pendingFiles.filter(f => f.priority === 'urgent').length : 0,
        overdue: 0
      }
    });
  });

  /**
     * Get pending reviews for admin (non-paginated)
     */
  getAdminReview = asyncHandler(async (req, res) => {
    const files = await fileService.getPendingAdminReview();
    res.json({ success: true, files });
  });

  /**
     * Get all files for admin
     */
  getAllFiles = asyncHandler(async (req, res) => {
    const files = await fileService.getAllFiles(req.query);
    res.json({ success: true, files });
  });

  /**
     * Get file comments
     */
  getComments = asyncHandler(async (req, res) => {
    const id = req.params.id || req.params.fileId;
    const comments = await fileService.getFileComments(id);
    res.json({ success: true, comments });
  });

  /**
     * Add file comment
     */
  addComment = asyncHandler(async (req, res) => {
    const id = req.params.id || req.params.fileId;
    const { comment } = req.body;
    const comments = await fileService.addFileComment(id, req.user, comment);
    res.json({ success: true, message: 'Comment added', comments });
  });

  /**
     * Get file history
     */
  getHistory = asyncHandler(async (req, res) => {
    const id = req.params.id || req.params.fileId;
    const history = await fileService.getFileHistory(id);
    res.json({ success: true, history });
  });

  /**
     * Download file
     */
  download = asyncHandler(async (req, res) => {
    const id = req.params.id || req.params.fileId;
    const fileInfo = await fileService.resolvePhysicalPath(id);
    res.download(fileInfo.path, fileInfo.originalName);
  });

  /**
     * Stream file
     */
  stream = asyncHandler(async (req, res) => {
    const id = req.params.id || req.params.fileId;
    const fileInfo = await fileService.resolvePhysicalPath(id);
    const path = require('path');
    res.sendFile(path.resolve(fileInfo.path));
  });

  /**
     * Get file by ID
     */
  getFileById = asyncHandler(async (req, res) => {
    const id = req.params.id || req.params.fileId;
    const file = await fileService.getFileById(id);
    res.json({ success: true, file });
  });

  /**
     * Get physical file path (for Electron)
     */
  getFilePath = asyncHandler(async (req, res) => {
    const id = req.params.id || req.params.fileId;
    const { type, folderName } = req.query;
    const fileInfo = await fileService.resolvePhysicalPath(id, type, folderName);
    res.json({
      success: true,
      filePath: fileInfo.path,
      fileName: fileInfo.originalName
    });
  });

  /**
     * Get multiple physical file paths (for bulk prefetching)
     * POST /api/files/bulk-path
     */
  getBulkFilePaths = asyncHandler(async (req, res) => {
    const { fileIds, type } = req.body;
    if (!fileIds || !Array.isArray(fileIds)) {
      throw new ValidationError('fileIds array is required');
    }
    const results = await fileService.resolveBulkPhysicalPaths(fileIds, type);
    res.json({ success: true, results });
  });

  /**
     * Set file priority
     */
  setPriority = asyncHandler(async (req, res) => {
    const id = req.params.id || req.params.fileId;
    const { priority, dueDate } = req.body;
    await fileService.setFilePriority(id, priority, dueDate, req.user);
    res.json({ success: true, message: 'Priority updated successfully' });
  });

  /**
     * Open file with default application
     */
  openFile = asyncHandler(async (req, res) => {
    const { fileId } = req.body;
    await fileService.openFile(fileId);
    res.json({ success: true, message: 'File opened successfully' });
  });

  /**
     * Zip and download folder
     */
  zipFolder = asyncHandler(async (req, res) => {
    const { fileIds: fileIdsStr, folderName, type } = req.query;
    const fileIds = fileIdsStr.split(',').map(id => parseInt(id.trim())).filter(Boolean);

    const { zipPath, tmpDir } = await fileService.zipFolder(fileIds, folderName, type || 'file');

    const fs = require('fs');
    res.download(zipPath, `${folderName}.zip`, (err) => {
      // Cleanup
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (_) {}
      try {
        fs.unlinkSync(zipPath);
      } catch (_) {}
    });
  });

  /**
     * Bulk action (approve/reject)
     */
  bulkAction = asyncHandler(async (req, res) => {
    const { fileIds, action, comments } = req.body;
    const results = await fileService.bulkAction(fileIds, action, req.user, comments);
    invalidateCache();
    res.json({ success: true, ...results });
  });

  /**
     * Get all files for a specific team (Team Leader overview / 'total' filter).
     * GET /api/files/team/:team
     */
  getTeamFiles = asyncHandler(async (req, res) => {
    const { team } = req.params;
    if (req.user.role === 'TEAM_LEADER' && team !== req.user.team) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const limit = parseInt(req.query.limit) || 1000;
    const files = await fileService.getAllFiles({ team, limit });
    res.json({ success: true, files });
  });

  /**
     * Get files by status for a team (Analytics)
     */
  getFilesByStatus = asyncHandler(async (req, res) => {
    const { team, status } = req.params;
    let dbStatus;
    let dbStage;

    if (status === 'approved') {
      dbStatus = ['team_leader_approved', 'final_approved'];
    } else if (status === 'pending') {
      dbStage = ['pending_team_leader', 'pending_admin'];
    } else if (status === 'rejected') {
      dbStatus = ['rejected_by_team_leader', 'rejected_by_admin'];
    }

    const files = await fileService.getAllFiles({ team, status: dbStatus, stage: dbStage });
    res.json({ success: true, files });
  });

  /**
     * Sync deleted files (cleanup orphaned DB records)
     */
  syncDeleted = asyncHandler(async (req, res) => {
    const { syncDeletedFiles } = require('../services/fileSyncService');
    const { networkDataPath } = require('../config/database');
    const summary = await syncDeletedFiles(uploadsDir, networkDataPath);
    res.json({ success: true, ...summary });
  });

  // ─── Methods ported from THEIRS during merge resolution ──────────────────

  /**
     * Check if a file with the same name already exists for a user.
     * Used by the client before upload to prompt the user on conflicts.
     * POST /api/files/check-duplicate
     */
  checkDuplicate = asyncHandler(async (req, res) => {
    const { originalName, userId } = req.body;
    if (!originalName || !userId) {
      throw new ValidationError('originalName and userId are required');
    }
    const result = await fileService.checkDuplicate(originalName, userId);
    res.json({ success: true, isDuplicate: result.isDuplicate, existingFile: result.existingFile });
  });

  /**
     * Get all files for a specific team member (TL viewing one of their members).
     * GET /api/files/member/:memberId
     */
  getMemberFiles = asyncHandler(async (req, res) => {
    const { memberId } = req.params;
    const files = await fileService.getMemberFiles(memberId);
    res.json({ success: true, files });
  });

  /**
     * Get a user's files with pagination.
     * GET /api/files/user/:userId/pending
     */
  getUserFilesPaginated = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const result = await fileService.getUserFilesPaginated(userId, page, limit);
    res.json({ success: true, ...result });
  });

  /**
     * Paginated team leader review queue.
     * GET /api/files/team-leader/:team
     */
  getTeamLeaderQueue = asyncHandler(async (req, res) => {
    const { team } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const result = await fileService.getTeamLeaderQueue(team, page, limit);
    res.json({ success: true, ...result });
  });

  /**
     * Advanced filtering for the team leader review queue.
     * POST /api/files/team-leader/:team/filter
     */
  filterTeamLeaderQueue = asyncHandler(async (req, res) => {
    const { team } = req.params;
    const { filters, sort, page = 1, limit = 50 } = req.body;
    const result = await fileService.filterTeamLeaderQueue(team, filters, sort, page, limit);
    res.json({ success: true, ...result });
  });

  /**
     * Paginated admin review queue.
     * GET /api/files/admin
     */
  getAdminQueue = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const result = await fileService.getAdminQueue(page, limit);
    res.json({ success: true, ...result });
  });

  /**
     * Move an entire folder to the NAS destination.
     * Handles both regular files and assignment_attachments.
     * Sends smart grouped notifications per user.
     * POST /api/files/folder/move-to-nas
     */
  moveFolderToNas = asyncHandler(async (req, res) => {
    const { folderName, username, fileIds, destinationPath, adminId, adminUsername, adminRole, team, comments } = req.body;
    if (!folderName || !username || !fileIds?.length || !destinationPath) {
      throw new ValidationError('Missing required fields: folderName, username, fileIds, destinationPath');
    }
    const result = await fileService.moveFolderToNas(
      { folderName, username, fileIds, destinationPath, comments },
      { id: adminId, username: adminUsername, role: adminRole, team }
    );
    res.json({
      success: true,
      message: `Folder "${folderName}" approved and uploaded to NAS successfully`,
      nasPath: result.nasPath
    });
  });

  /**
     * Delete a folder (regular submissions + physical files)
     * POST /api/files/folder/delete
     */
  deleteFolder = asyncHandler(async (req, res) => {
    const { folderName, fileIds, userId, username, userRole, team } = req.body;
    // Construct a user object from the body if req.user is somehow incomplete,
    // though req.user from authenticateToken should normally be used.
    const user = req.user || { id: userId, username, role: userRole, team };

    // Look up which assignments contain these files BEFORE deletion so we can
    // revert any 'checked' assignment that loses all its submitted files.
    let affectedAssignmentIds = [];
    if (fileIds && fileIds.length > 0) {
      try {
        const { query: dbQuery } = require('../config/database');
        const rows = await dbQuery(
          `SELECT DISTINCT assignment_id FROM assignment_submissions WHERE file_id IN (${fileIds.map(() => '?').join(',')})`,
          fileIds
        );
        affectedAssignmentIds = rows.map(r => r.assignment_id).filter(Boolean);
      } catch (_) {}
    }

    await fileService.deleteFolder(folderName, fileIds, user);

    // Revert any affected assignments from 'checked' → 'for_checking' if they
    // now have no submitted files (or have unchecked files remaining).
    if (affectedAssignmentIds.length > 0) {
      try {
        const { revertCheckedIfNoFiles } = require('../routes/assignments');
        await Promise.all(affectedAssignmentIds.map(aid => revertCheckedIfNoFiles(aid)));
      } catch (e) {
        console.warn('⚠️  deleteFolder: revertCheckedIfNoFiles non-fatal error:', e.message);
      }
    }

    res.json({ success: true, message: `Folder "${folderName}" deleted successfully` });
  });

  /**
     * Delete an attachment folder (assignment_attachments records + physical files).
     * POST /api/files/folder/delete-attachments
     */
  deleteAttachmentFolder = asyncHandler(async (req, res) => {
    const { folderName, fileIds, adminId, adminUsername, adminRole, team } = req.body;
    await fileService.deleteAttachmentFolder(
      { folderName, fileIds },
      { id: adminId, username: adminUsername, role: adminRole, team }
    );
    res.json({ success: true, message: `Folder "${folderName}" deleted successfully` });
  });

  /**
     * Record a file view event (upserts per user per file).
     * POST /api/files/:id/view
     */
  recordView = asyncHandler(async (req, res) => {
    const id = req.params.id || req.params.fileId;
    const { userId, username, fullName, role } = req.body;
    const type = req.query.type || req.body.type || 'submission';
    if (!id || !userId) {
      throw new ValidationError('fileId and userId are required');
    }
    await fileService.recordView(id, { userId, username, fullName, role }, type);
    res.json({ success: true });
  });

  getViewers = asyncHandler(async (req, res) => {
    const id = req.params.id || req.params.fileId;
    const type = req.query.type || 'submission';
    const viewers = await fileService.getViewers(id, type);
    res.json({ success: true, viewers });
  });

  /**
     * Repair flat re-uploaded files for a given assignment — restores
     * folder_name + relative_path from sibling files that still have path context,
     * OR reconstructs the path by inferring which subfolder they belong to.
     * POST /api/files/repair-folder-paths
     * Body: { assignmentId }
     */
  repairFolderPaths = asyncHandler(async (req, res) => {
    const { assignmentId } = req.body;
    if (!assignmentId) {
      throw new ValidationError('assignmentId is required');
    }

    const { query } = require('../config/database');

    // 1. Get ALL files for this assignment with full context
    const allFiles = await query(`
            SELECT f.id, f.original_name, f.user_id, f.folder_name, f.relative_path, f.status
            FROM files f
            INNER JOIN assignment_submissions asub ON asub.file_id = f.id
            WHERE asub.assignment_id = ?
        `, [assignmentId]);

    // 2. Build path lookup from files that DO have folder context.
    //    Key: user_id:original_name -> { folder_name, relative_path }
    //    Prefer deepest path (most specific subfolder info).
    const pathMap = {};
    for (const f of allFiles) {
      if (f.folder_name && f.relative_path) {
        const key = `${f.user_id}:${f.original_name}`;
        const existing = pathMap[key];
        const depth = (f.relative_path.match(/\//g) || []).length;
        const existingDepth = existing ? (existing.relative_path.match(/\//g) || []).length : -1;
        if (depth > existingDepth) {
          pathMap[key] = { folder_name: f.folder_name, relative_path: f.relative_path };
        }
      }
    }

    // 3. For flat files with no direct path match, try to infer from subfolders.
    //    If a file has no folder context, find any sibling file in the same assignment
    //    whose relative_path ends with the same filename at a deeper path level.
    //    e.g. flat file "foo.pdf" -> find "TESTING!/New folder/foo.pdf" from a sibling.
    const flatFiles = allFiles.filter(f => !f.folder_name);
    for (const f of flatFiles) {
      if (pathMap[`${f.user_id}:${f.original_name}`]) {
        continue;
      }
      // Deep search: find any other file in the assignment for this user
      // whose relative_path ends with '/' + original_name
      const [deepMatch] = await query(`
                SELECT f2.folder_name, f2.relative_path
                FROM files f2
                INNER JOIN assignment_submissions asub2 ON asub2.file_id = f2.id
                WHERE asub2.assignment_id = ?
                  AND f2.user_id = ?
                  AND f2.folder_name IS NOT NULL
                  AND f2.relative_path LIKE ?
                ORDER BY CHAR_LENGTH(f2.relative_path) DESC
                LIMIT 1
            `, [assignmentId, f.user_id, `%/${f.original_name}`]);
      if (deepMatch) {
        pathMap[`${f.user_id}:${f.original_name}`] = {
          folder_name: deepMatch.folder_name,
          relative_path: deepMatch.relative_path
        };
      }
    }

    // 4. Apply fixes
    let repaired = 0;
    for (const f of flatFiles) {
      const pathInfo = pathMap[`${f.user_id}:${f.original_name}`];
      if (pathInfo) {
        await query(
          'UPDATE files SET folder_name = ?, relative_path = ?, is_folder = 1 WHERE id = ?',
          [pathInfo.folder_name, pathInfo.relative_path, f.id]
        );
        repaired++;
      }
    }

    res.json({
      success: true,
      message: `Repaired ${repaired} of ${flatFiles.length} flat file record${flatFiles.length !== 1 ? 's' : ''} for assignment ${assignmentId}`,
      repaired,
      total_flat: flatFiles.length
    });
  });

  /**
   * Apply penalty to checker for wrong checking
   */
  addCheckerPenalty = asyncHandler(async (req, res) => {
    const fileId = req.params.id;
    const { penalty_percentage } = req.body;

    if (penalty_percentage == null || isNaN(penalty_percentage) || penalty_percentage < 0 || penalty_percentage > 100) {
      throw new ValidationError('Invalid penalty percentage');
    }

    const { query } = require('../config/database');
    const [file] = await query(`
      SELECT f.id, f.original_name, f.checked_by, asub.assignment_id 
      FROM files f 
      LEFT JOIN assignment_submissions asub ON f.id = asub.file_id
      WHERE f.id = ?
    `, [fileId]);

    if (!file) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    if (!file.checked_by) {
      return res.status(400).json({ success: false, message: 'File has not been checked yet' });
    }

    await query('UPDATE files SET checker_penalty_percentage = ? WHERE id = ?', [penalty_percentage, fileId]);

    // Notify the checker
    try {
      const [checker] = await query('SELECT id FROM users WHERE fullName = ? OR username = ? LIMIT 1', [file.checked_by, file.checked_by]);
      
      if (checker && checker.id) {
        const actionById = req.user ? req.user.id : null;
        const actionByUsername = req.user ? (req.user.username || req.user.fullName) : 'System';
        const actionByRole = req.user ? req.user.role : null;
        
        await query(`
          INSERT INTO notifications (user_id, assignment_id, file_id, type, title, message, action_by_id, action_by_username, action_by_role)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          checker.id,
          file.assignment_id || null,
          fileId,
          'checker_penalty',
          'Wrong Checked File',
          `${actionByUsername} marked your checking on file "${file.original_name}" as wrong. Penalty: ${penalty_percentage}%`,
          actionById,
          actionByUsername,
          actionByRole
        ]);

        const { pushToUser } = require('../routes/notifications');
        pushToUser(checker.id);
      }
    } catch (err) {
      console.error('Failed to notify checker of penalty:', err);
    }

    res.json({
      success: true,
      message: `Penalty of ${penalty_percentage}% applied to checker for file.`
    });
  });
}

module.exports = new FileController();
