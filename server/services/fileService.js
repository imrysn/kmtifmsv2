const fileRepository = require('../repositories/fileRepository');
const notificationService = require('./notificationService');
const { logActivity, logInfo, logError, logFileStatusChange } = require('../utils/logger');
const { db, query, queryOne } = require('../config/database');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const { uploadsDir } = require('../config/middleware');
const { safeDeleteFile, streamCopy } = require('../utils/fileUtils');

/**
 * Fix filename encoding issues (latin1 to utf8)
 */
function fixFilename(name) {
    if (!name) return name;
    try {
        const reDecoded = Buffer.from(name, 'latin1').toString('utf8');
        if (reDecoded !== name && !reDecoded.includes('\uFFFD')) return reDecoded;
    } catch (_) {}
    return name;
}

/**
 * Upload a new file
 */
async function uploadFile(fileData, user) {
    const originalName = fixFilename(fileData.original_name);
    const { moveToUserFolder } = require('../utils/fileUtils');
    const assignmentId = fileData.assignment_id ? parseInt(fileData.assignment_id) : null;
    
    logInfo('Uploading file', { filename: originalName, userId: user.id, assignmentId });

    const existing = await fileRepository.findByNameAndUser(
        originalName,
        user.id,
        fileData.folder_name,
        assignmentId
    );

    if (existing) {
        if (assignmentId) {
            // Same file name + same task → auto-replace:
            // Remove the old submission record and delete the old file from disk,
            // then fall through to upload the new version.
            logInfo('Replacing existing file for same task', { oldFileId: existing.id, assignmentId });
            const tempPath = fileData.file_path.startsWith('/uploads/')
                ? path.join(uploadsDir, fileData.file_path.substring('/uploads/'.length))
                : fileData.file_path;
            try {
                // Delete old physical file
                if (existing.file_path) {
                    const oldPhysical = existing.file_path.startsWith('/uploads/')
                        ? path.join(uploadsDir, existing.file_path.substring('/uploads/'.length))
                        : existing.file_path;
                    await safeDeleteFile(oldPhysical);
                }
                // Remove old submission + file record
                await require('../config/database').query(
                    'DELETE FROM assignment_submissions WHERE file_id = ? AND assignment_id = ?',
                    [existing.id, assignmentId]
                );
                await fileRepository.deleteById(existing.id);
            } catch (replaceErr) {
                logError(replaceErr, { context: 'uploadFile-replace', oldFileId: existing.id });
            }
            // Fall through — upload the new file below
        } else {
            // No task context and duplicate found → block (legacy behavior)
            logInfo('Duplicate file found (no task context), cleaning up...', { fileId: existing.id });
            const tempPath = path.join(uploadsDir, fileData.file_path.replace(/^\/uploads\//, ''));
            try { await fs.unlink(tempPath); } catch (e) {}
            return { isDuplicate: true, existingFile: existing };
        }
    }

    // Move the temp file from uploadsDir root into the user's folder
    // (and into the correct subfolder if folderName/relativePath are provided)
    // If this upload is scoped to a task AND has a folder, isolate it under
    // task_{assignmentId}/ so the same folder name in different tasks never collides.
    let finalFilePath = fileData.file_path; // fallback: keep temp path
    try {
        // tempPath is what multer wrote: uploadsDir/temp_timestamp_random
        const tempPath = fileData.file_path.startsWith('/uploads/')
            ? path.join(uploadsDir, fileData.file_path.substring('/uploads/'.length))
            : fileData.file_path;

        const taskPrefix = (assignmentId && fileData.folder_name)
            ? `task_${assignmentId}`
            : null;

        const movedPath = await moveToUserFolder(
            tempPath,
            user.username,
            originalName,
            fileData.folder_name || null,
            fileData.relative_path || null,
            taskPrefix
        );

        // Convert absolute path back to /uploads/... relative URL for DB storage
        const relativeToUploads = movedPath.startsWith(uploadsDir)
            ? movedPath.substring(uploadsDir.length).replace(/\\/g, '/')
            : movedPath;
        finalFilePath = `/uploads${relativeToUploads.startsWith('/') ? '' : '/'}${relativeToUploads}`;
    } catch (moveErr) {
        logError(moveErr, { context: 'uploadFile-moveToUserFolder', filename: originalName });
        // Keep temp path if move fails — file is still accessible
    }

    const data = {
        ...fileData,
        original_name: originalName,
        file_path: finalFilePath,
        user_id: user.id,
        username: user.username,
        user_team: user.team,
        status: 'uploaded',
        current_stage: 'pending_team_leader'
    };

    const fileId = await fileRepository.create(data);

    logActivity(db, user.id, user.username, user.role, user.team,
        `Uploaded file: ${fileData.original_name}`);

    const file = await fileRepository.findById(fileId);
    logInfo('File uploaded successfully', { fileId, filename: fileData.original_name });
    return file;
}

/**
 * Approve file by team leader
 */
async function approveByTeamLeader(fileId, teamLeader, comments = '') {
    const file = await fileRepository.findById(fileId);
    if (!file) throw new NotFoundError('File');

    if (file.user_team !== teamLeader.team && teamLeader.role !== 'ADMIN') {
        throw new ValidationError('You can only approve files from your team');
    }
    if (file.current_stage !== 'pending_team_leader') {
        throw new ValidationError('File is not in the correct stage for team leader approval');
    }

    const newStatus = 'team_leader_approved';
    const newStage = 'pending_admin';

    await fileRepository.updateStatus(fileId, {
        status: newStatus,
        current_stage: newStage,
        team_leader_id: teamLeader.id,
        team_leader_username: teamLeader.username,
        team_leader_comments: comments
    });

    logFileStatusChange(db, fileId, file.status, newStatus, file.current_stage, newStage,
        teamLeader.id, teamLeader.username, teamLeader.role,
        `Team leader approved: ${comments || 'No comments'}`);

    logActivity(db, teamLeader.id, teamLeader.username, teamLeader.role, teamLeader.team,
        `Approved file: ${file.original_name}`);

    await notificationService.createNotification(
        file.user_id, fileId, 'approval', 'File Approved by Team Leader',
        `Your file "${file.original_name}" has been approved by ${teamLeader.username} and is now pending admin review.`,
        teamLeader.id, teamLeader.username, teamLeader.role
    );

    await notificationService.createAdminNotification(
        fileId, 'team_leader_approved', 'File Approved by Team Leader',
        `${teamLeader.username} approved file "${file.original_name}" (Team: ${teamLeader.team}). Pending final review.`,
        teamLeader.id, teamLeader.username, teamLeader.role
    );

    return await fileRepository.findById(fileId);
}

/**
 * Reject file by team leader
 */
async function rejectByTeamLeader(fileId, teamLeader, reason) {
    const file = await fileRepository.findById(fileId);
    if (!file) throw new NotFoundError('File');

    if (file.user_team !== teamLeader.team && teamLeader.role !== 'ADMIN') {
        throw new ValidationError('You can only reject files from your team');
    }

    const newStatus = 'rejected_by_team_leader';
    const newStage = 'rejected_by_team_leader';

    await fileRepository.updateStatus(fileId, {
        status: newStatus,
        current_stage: newStage,
        team_leader_id: teamLeader.id,
        team_leader_username: teamLeader.username,
        team_leader_comments: reason,
        rejection_reason: reason,
        rejected_by: teamLeader.username
    });

    logFileStatusChange(db, fileId, file.status, newStatus, file.current_stage, newStage,
        teamLeader.id, teamLeader.username, teamLeader.role,
        `Team leader rejected: ${reason}`);

    logActivity(db, teamLeader.id, teamLeader.username, teamLeader.role, teamLeader.team,
        `Rejected file: ${file.original_name} - Reason: ${reason}`);

    await notificationService.createNotification(
        file.user_id, fileId, 'rejection', 'File Rejected by Team Leader',
        `Your file "${file.original_name}" has been rejected by ${teamLeader.username}. Reason: ${reason}`,
        teamLeader.id, teamLeader.username, teamLeader.role
    );

    return await fileRepository.findById(fileId);
}

/**
 * Approve file by admin (Final Approval)
 */
async function approveByAdmin(fileId, admin, comments = '') {
    const file = await fileRepository.findById(fileId);
    let isAttachment = false;
    let targetFile = file;

    if (!targetFile) {
        targetFile = await fileRepository.findAttachmentById(fileId);
        if (targetFile) isAttachment = true;
    }
    if (!targetFile) throw new NotFoundError('File');

    const newStatus = 'final_approved';
    const newStage = 'published_to_public';

    if (isAttachment) {
        await fileRepository.updateAttachmentStatus(fileId, {
            status: newStatus,
            current_stage: newStage,
            admin_comments: comments
        });
    } else {
        await fileRepository.updateStatus(fileId, {
            status: newStatus,
            current_stage: newStage,
            admin_id: admin.id,
            admin_username: admin.username,
            admin_comments: comments
        });
    }

    if (!isAttachment) {
        logFileStatusChange(db, fileId, targetFile.status, newStatus, targetFile.current_stage, newStage,
            admin.id, admin.username, admin.role,
            `Admin final approval: ${comments || 'No comments'}`);
    }

    logActivity(db, admin.id, admin.username, admin.role, admin.team,
        `Final approved ${isAttachment ? 'attachment' : 'file'}: ${targetFile.original_name}`);

    await notificationService.createNotification(
        targetFile.user_id || targetFile.uploaded_by_id,
        isAttachment ? null : fileId, 'approval', 'File Final Approved',
        `Your file "${targetFile.original_name}" has received final approval from the administrator and is now published.`,
        admin.id, admin.username, admin.role
    );

    return isAttachment ? await fileRepository.findAttachmentById(fileId) : await fileRepository.findById(fileId);
}

/**
 * Reject file by admin
 */
async function rejectByAdmin(fileId, admin, reason) {
    const file = await fileRepository.findById(fileId);
    let isAttachment = false;
    let targetFile = file;

    if (!targetFile) {
        targetFile = await fileRepository.findAttachmentById(fileId);
        if (targetFile) isAttachment = true;
    }
    if (!targetFile) throw new NotFoundError('File');

    const newStatus = 'rejected_by_admin';
    const newStage = 'rejected_by_admin';

    if (isAttachment) {
        await fileRepository.updateAttachmentStatus(fileId, {
            status: newStatus,
            current_stage: newStage,
            admin_comments: reason
        });
    } else {
        await fileRepository.updateStatus(fileId, {
            status: newStatus,
            current_stage: newStage,
            admin_id: admin.id,
            admin_username: admin.username,
            admin_comments: reason,
            rejection_reason: reason,
            rejected_by: admin.username
        });
    }

    if (!isAttachment) {
        logFileStatusChange(db, fileId, targetFile.status, newStatus, targetFile.current_stage, newStage,
            admin.id, admin.username, admin.role,
            `Admin rejection: ${reason}`);
    }

    logActivity(db, admin.id, admin.username, admin.role, admin.team,
        `Rejected ${isAttachment ? 'attachment' : 'file'}: ${targetFile.original_name} - Reason: ${reason}`);

    await notificationService.createNotification(
        targetFile.user_id || targetFile.uploaded_by_id,
        isAttachment ? null : fileId, 'rejection', 'File Rejected by Admin',
        `Your file "${targetFile.original_name}" has been rejected by the administrator. Reason: ${reason}`,
        admin.id, admin.username, admin.role
    );

    return isAttachment ? await fileRepository.findAttachmentById(fileId) : await fileRepository.findById(fileId);
}

/**
 * Move file to projects directory
 */
async function moveToProjects(fileId, destinationPath, admin, deleteFromUploads = false) {
    let file = await fileRepository.findById(fileId);
    let isAttachment = false;

    if (!file) {
        file = await fileRepository.findAttachmentById(fileId);
        if (file) isAttachment = true;
    }
    if (!file) throw new NotFoundError('File');

    let sourcePath;
    const dbPath = file.file_path;
    if (dbPath && dbPath.startsWith('/uploads/')) {
        sourcePath = path.join(uploadsDir, dbPath.substring(9));
    } else if (dbPath && (dbPath.startsWith('\\\\') || /^[a-zA-Z]:[\\/]/.test(dbPath))) {
        sourcePath = dbPath;
    } else {
        sourcePath = path.join(uploadsDir, dbPath || '');
    }

    try { await fs.access(sourcePath); } catch (err) {
        throw new ValidationError(`Source file not found: ${sourcePath}`);
    }

    await fs.mkdir(destinationPath, { recursive: true });
    const finalDestPath = path.join(destinationPath, file.original_name);

    try {
        await fs.access(finalDestPath);
        throw new ValidationError('File already exists in destination');
    } catch (err) {
        if (err.message.includes('already exists')) throw err;
    }

    await fs.copyFile(sourcePath, finalDestPath);
    logInfo('File copied to projects', { source: sourcePath, dest: finalDestPath });

    if (isAttachment) {
        await fileRepository.updateAttachmentStatus(fileId, { public_network_url: finalDestPath });
    } else {
        await fileRepository.updateStatus(fileId, { public_network_url: finalDestPath });
    }

    if (deleteFromUploads) {
        try {
            await fs.unlink(sourcePath);
            logInfo('Source file deleted after move', { path: sourcePath });
        } catch (err) {
            logError(err, { context: 'cleanup-source-after-move', path: sourcePath });
        }
    }

    logActivity(db, admin.id, admin.username, admin.role, admin.team,
        `Moved file to projects: ${file.original_name} -> ${destinationPath}`);

    return finalDestPath;
}

/**
 * Get file by ID
 */
async function getFileById(fileId) {
    const file = await fileRepository.findById(fileId);
    if (!file) throw new NotFoundError('File');
    return file;
}

/**
 * Get user files (unpaginated)
 */
async function getUserFiles(userId) {
    // Fetch regular uploaded files
    const files = await fileRepository.findByUserId(userId);

    // Also fetch task attachments uploaded by this user (e.g. team leader attachments)
    const attachments = await fileRepository.findAllAttachmentsWithDetails({ userId });

    // Merge, deduplicate by id+source, sort newest first
    const fileIds = new Set(files.map(f => `file_${f.id}`));
    const uniqueAttachments = attachments.filter(a => !fileIds.has(`file_${a.id}`));

    return [...files, ...uniqueAttachments].sort(
        (a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at)
    );
}

/**
 * Get pending reviews for team leader
 */
async function getPendingTeamLeaderReview(team) {
    return await fileRepository.findPendingByStage('pending_team_leader', team);
}

/**
 * Get pending reviews for admin
 */
async function getPendingAdminReview() {
    return await fileRepository.findPendingByStage('pending_admin');
}

/**
 * Get all files for admin (merges regular files and assignment attachments)
 */
async function getAllFiles(options = {}) {
    const files = await fileRepository.findAllWithDetails(options);
    const attachments = await fileRepository.findAllAttachmentsWithDetails(options);

    const fileIds = new Set(files.map(f => String(f.id)));
    const uniqueAttachments = attachments.filter(a => !fileIds.has(String(a.id)));

    return [...files, ...uniqueAttachments].sort((a, b) =>
        new Date(b.uploaded_at) - new Date(a.uploaded_at)
    );
}

/**
 * Get comments for a file
 */
async function getFileComments(fileId) {
    return await fileRepository.getComments(fileId);
}

/**
 * Add a comment to a file
 */
async function addFileComment(fileId, user, commentText) {
    const file = await fileRepository.findById(fileId);
    if (!file) throw new NotFoundError('File');

    await fileRepository.addComment(fileId, {
        user_id: user.id,
        username: user.username,
        comment: commentText
    });

    if (file.user_id !== user.id) {
        await notificationService.createNotification(
            file.user_id, fileId, 'comment', 'New Comment on Your File',
            `${user.username} commented on "${file.original_name}"`,
            user.id, user.username, user.role
        );
    }

    await notificationService.createAdminNotification(
        fileId, 'comment', 'New Comment on File',
        `${user.username} commented on "${file.original_name}" (Team: ${file.user_team})`,
        user.id, user.username, user.role
    );

    return await fileRepository.getComments(fileId);
}

/**
 * Get status history for a file
 */
async function getFileHistory(fileId) {
    return await fileRepository.getHistory(fileId);
}

/**
 * Set file priority and due date
 */
async function setFilePriority(fileId, priority, dueDate, user) {
    const file = await fileRepository.findById(fileId);
    if (!file) throw new NotFoundError('File');

    await fileRepository.updatePriority(fileId, priority, dueDate);

    const changes = [];
    if (priority !== undefined) changes.push(`priority: ${priority}`);
    if (dueDate !== undefined) changes.push(`due date: ${dueDate}`);

    logActivity(db, user.id, user.username, user.role, file.user_team,
        `Updated file ${file.original_name} - ${changes.join(', ')}`);

    return true;
}

/**
 * Open file with default application
 */
async function openFile(filePath) {
    let resolvedPath = filePath;
    if (filePath.startsWith('/uploads/')) {
        resolvedPath = path.join(uploadsDir, filePath.substring(9));
    }
    resolvedPath = path.normalize(resolvedPath);

    if (/[&;`|<>$!\r\n]/.test(resolvedPath)) throw new ValidationError('Invalid file path');

    let command;
    const escapedPath = resolvedPath.replace(/"/g, '\\"');
    if (process.platform === 'win32') {
        command = `start "" "${escapedPath}"`;
    } else if (process.platform === 'darwin') {
        command = `open "${escapedPath}"`;
    } else {
        command = `xdg-open "${escapedPath}"`;
    }

    return new Promise((resolve, reject) => {
        exec(command, (error) => {
            if (error) reject(error);
            else resolve(true);
        });
    });
}

/**
 * Delete a folder and its files
 */
async function deleteFolder(folderName, fileIds, user) {
    const dirsToDelete = new Set();
    // Legacy path (no task scope)
    dirsToDelete.add(path.join(uploadsDir, user.username, folderName));

    if (fileIds && fileIds.length > 0) {
        for (const fileId of fileIds) {
            const file = await fileRepository.findById(fileId);
            if (file) {
                const physicalPath = await resolvePhysicalPath(fileId);
                if (physicalPath.path) {
                    try { await fs.unlink(physicalPath.path); } catch (e) {}
                    // Add both the immediate parent AND the task_N parent so we clean up both
                    const parentDir = path.dirname(physicalPath.path);
                    dirsToDelete.add(parentDir);
                    dirsToDelete.add(path.dirname(parentDir));
                }
            }
        }
        await fileRepository.deleteBatch(fileIds);
    }

    for (const dirPath of dirsToDelete) {
        try {
            const stat = await fs.stat(dirPath);
            if (stat.isDirectory()) {
                // Only delete task_N dirs or the folder itself — never delete the root user dir
                const isUserRoot = dirPath === path.join(uploadsDir, user.username);
                const isUploadsRoot = dirPath === uploadsDir;
                if (!isUserRoot && !isUploadsRoot) {
                    // Check if the directory is now empty before deleting parent dirs
                    const entries = await fs.readdir(dirPath).catch(() => []);
                    if (entries.length === 0) {
                        await fs.rm(dirPath, { recursive: true, force: true });
                    } else if (dirPath.endsWith(folderName) || path.basename(dirPath).startsWith('task_')) {
                        await fs.rm(dirPath, { recursive: true, force: true });
                    }
                }
            }
        } catch (e) {}
    }

    logActivity(db, user.id, user.username, user.role, user.team,
        `Folder deleted: ${folderName} (${fileIds?.length || 0} files)`);

    return true;
}

/**
 * Zip a folder of files
 */
async function zipFolder(fileIds, folderName) {
    const tmpDir = path.join(os.tmpdir(), `kmti-folder-${Date.now()}`);
    const zipPath = path.join(os.tmpdir(), `${folderName}-${Date.now()}.zip`);

    await fs.mkdir(tmpDir, { recursive: true });

    for (const fileId of fileIds) {
        const file = await fileRepository.findById(fileId);
        if (file) {
            const resolved = await resolvePhysicalPath(fileId);
            if (resolved.path) {
                const relPath = file.relative_path
                    ? file.relative_path.replace(/\\/g, '/').split('/').slice(1).join('/')
                    : file.original_name;
                const destFile = path.join(tmpDir, relPath || file.original_name);
                await fs.mkdir(path.dirname(destFile), { recursive: true });
                await fs.copyFile(resolved.path, destFile);
            }
        }
    }

    const cmd = `powershell -NoProfile -Command "Compress-Archive -Path '${tmpDir}\\*' -DestinationPath '${zipPath}' -Force"`;
    await new Promise((resolve, reject) => {
        exec(cmd, (err) => { if (err) reject(err); else resolve(); });
    });

    return { zipPath, tmpDir };
}

/**
 * Resolve the physical path for a file
 */
async function resolvePhysicalPath(fileId) {
    let file = await fileRepository.findById(fileId);
    if (!file) file = await fileRepository.findAttachmentById(fileId);
    if (!file) throw new NotFoundError('File');

    let filePath = file.file_path;

    if (file.public_network_url && !file.public_network_url.startsWith('http')) {
        filePath = file.public_network_url;
    } else if (file.file_path && (file.file_path.startsWith('\\\\') || /^[A-Za-z]:[\\\\]/.test(file.file_path))) {
        filePath = file.file_path;
    } else if (file.file_path && file.file_path.startsWith('/uploads/')) {
        filePath = path.join(uploadsDir, file.file_path.replace(/^\/uploads\//, ''));
    } else if (file.file_path) {
        filePath = path.join(uploadsDir, file.file_path);
    }

    if (filePath && file.username) {
        try {
            await fs.access(filePath);
        } catch (e) {
            const userPath = path.join(uploadsDir, file.username, path.basename(file.file_path || file.filename));
            try {
                await fs.access(userPath);
                filePath = userPath;
            } catch (innerE) {}
        }
    }

    return { path: filePath, originalName: file.original_name, mimeType: file.file_type };
}

/**
 * Perform bulk actions on files (approve/reject)
 */
async function bulkAction(fileIds, action, user) {
    const results = { successful: [], failed: [] };

    for (const fileId of fileIds) {
        try {
            if (action === 'approve') {
                if (user.role === 'ADMIN') await approveByAdmin(fileId, user);
                else await approveByTeamLeader(fileId, user);
            } else if (action === 'reject') {
                if (user.role === 'ADMIN') await rejectByAdmin(fileId, user);
                else await rejectByTeamLeader(fileId, user);
            }
            results.successful.push(fileId);
        } catch (error) {
            results.failed.push({ fileId, error: error.message });
        }
    }

    return results;
}

// ─── Methods ported from THEIRS during merge resolution ───────────────────────

/**
 * Check for an existing file with the same name for a user.
 * Delegates to the repository's existing findByNameAndUser.
 */
async function checkDuplicate(originalName, userId) {
    const existing = await fileRepository.findByNameAndUser(originalName, userId, null);
    return { isDuplicate: !!existing, existingFile: existing || null };
}

/**
 * Get all files for a specific team member (with latest comment joined).
 * Used by team leaders to view individual member file lists.
 */
async function getMemberFiles(memberId) {
    return await fileRepository.findByUserId(memberId);
}

/**
 * Get a user's files with server-side pagination.
 * Returns { files, pagination }.
 */
async function getUserFilesPaginated(userId, page = 1, limit = 50) {
    const offset = (page - 1) * limit;

    const countRow = await queryOne('SELECT COUNT(*) as total FROM files WHERE user_id = ?', [userId]);
    const total = countRow ? countRow.total : 0;

    const files = await query(
        `SELECT f.*, GROUP_CONCAT(fc.comment SEPARATOR ' | ') as comments
         FROM files f
         LEFT JOIN file_comments fc ON f.id = fc.file_id
         WHERE f.user_id = ?
         GROUP BY f.id
         ORDER BY f.uploaded_at DESC LIMIT ? OFFSET ?`,
        [userId, limit, offset]
    );

    const processedFiles = files.map(file => ({
        ...file,
        comments: file.comments
            ? file.comments.split(' | ').map(comment => ({ comment }))
            : []
    }));

    return {
        files: processedFiles,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
}

/**
 * Paginated team leader review queue.
 * Returns { files, pagination }.
 */
async function getTeamLeaderQueue(team, page = 1, limit = 50) {
    const offset = (page - 1) * limit;

    const countRow = await queryOne(
        "SELECT COUNT(*) as total FROM files WHERE user_team = ? AND current_stage = 'pending_team_leader'",
        [team]
    );
    const total = countRow ? countRow.total : 0;

    const files = await query(
        `SELECT f.*, fc.comment as latest_comment
         FROM files f
         LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (
           SELECT MAX(id) FROM file_comments WHERE file_id = f.id
         )
         WHERE f.user_team = ? AND f.current_stage = 'pending_team_leader'
         ORDER BY f.uploaded_at DESC LIMIT ? OFFSET ?`,
        [team, limit, offset]
    );

    return {
        files,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
}

/**
 * Advanced filter + sort for the team leader review queue.
 * Accepts a filters object and sort descriptor.
 * Returns { files, pagination }.
 */
async function filterTeamLeaderQueue(team, filters = {}, sort = {}, page = 1, limit = 50) {
    const offset = (page - 1) * limit;

    const whereClauses = ['user_team = ?', "current_stage = 'pending_team_leader'"];
    const params = [team];

    if (filters.fileType?.length) {
        whereClauses.push(`file_type IN (${filters.fileType.map(() => '?').join(',')})`);
        params.push(...filters.fileType);
    }
    if (filters.submittedBy?.length) {
        whereClauses.push(`user_id IN (${filters.submittedBy.map(() => '?').join(',')})`);
        params.push(...filters.submittedBy);
    }
    if (filters.dateFrom) { whereClauses.push('uploaded_at >= ?'); params.push(filters.dateFrom); }
    if (filters.dateTo)   { whereClauses.push('uploaded_at <= ?'); params.push(filters.dateTo); }
    if (filters.priority) { whereClauses.push('priority = ?');     params.push(filters.priority); }
    if (filters.hasDeadline) whereClauses.push('due_date IS NOT NULL');
    if (filters.isOverdue) { whereClauses.push('due_date < ?'); params.push(new Date().toISOString()); }

    const allowedSortFields = ['uploaded_at', 'original_name', 'file_size', 'priority', 'due_date'];
    const sortField = allowedSortFields.includes(sort.field) ? sort.field : 'uploaded_at';
    const sortDir = sort.direction === 'ASC' ? 'ASC' : 'DESC';
    const where = whereClauses.join(' AND ');

    const countRow = await queryOne(`SELECT COUNT(*) as total FROM files WHERE ${where}`, params);
    const total = countRow ? countRow.total : 0;

    const files = await query(
        `SELECT f.*, fc.comment as latest_comment
         FROM files f
         LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (
           SELECT MAX(id) FROM file_comments WHERE file_id = f.id
         )
         WHERE ${where} ORDER BY ${sortField} ${sortDir} LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    return {
        files,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
}

/**
 * Paginated admin review queue (pending_admin stage only).
 * Returns { files, pagination }.
 */
async function getAdminQueue(page = 1, limit = 50) {
    const offset = (page - 1) * limit;

    const countRow = await queryOne(
        "SELECT COUNT(*) as total FROM files WHERE current_stage = 'pending_admin'"
    );
    const total = countRow ? countRow.total : 0;

    const files = await query(
        `SELECT f.*, fc.comment as latest_comment
         FROM files f
         LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (
           SELECT MAX(id) FROM file_comments WHERE file_id = f.id
         )
         WHERE f.current_stage = 'pending_admin'
         ORDER BY f.uploaded_at DESC LIMIT ? OFFSET ?`,
        [limit, offset]
    );

    return {
        files,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
}

/**
 * Move an entire folder (and all its files) to the NAS destination path.
 *
 * Handles both regular files (files table) and assignment attachments.
 * For regular folders: attempts a directory-level copy first, falls back to
 * file-by-file copy from DB paths if the source folder can't be resolved.
 * For attachment folders: always copies file-by-file from DB paths.
 * Updates DB records for each file (status, file_path, public_network_url).
 * Sends smart grouped notifications per user after all files are processed.
 *
 * @param {Object} params - { folderName, username, fileIds, destinationPath, comments }
 * @param {Object} admin  - { id, username, role, team }
 * @returns {Promise<{ nasPath: string }>}
 */
async function moveFolderToNas({ folderName, username, fileIds, destinationPath, comments }, admin) {
    // ── 1. Load all files from DB (check files table then assignment_attachments) ──
    const dbFiles = (await Promise.all(
        fileIds.map(async (fileId) => {
            let row = await queryOne('SELECT * FROM files WHERE id = ?', [fileId]);
            if (row) return row;
            const att = await queryOne(
                'SELECT *, created_at AS uploaded_at FROM assignment_attachments WHERE id = ?',
                [fileId]
            );
            if (att) {
                att.source_type = 'assignment_attachment';
                att.user_id = att.uploaded_by_id;
                att.username = att.uploaded_by_username;
                att.status = 'team_leader_approved';
            }
            return att || null;
        })
    )).filter(Boolean);

    if (dbFiles.length === 0) {
        throw new NotFoundError('No files found in database for provided IDs');
    }

    const isAttachmentFolder = dbFiles.some(f => f.source_type === 'assignment_attachment');
    const destFolderPath = path.join(destinationPath, folderName);
    await fs.mkdir(destFolderPath, { recursive: true });

    // ── 2. For regular folders, try a directory-level copy ───────────────────
    let sourceExists = false;

    if (!isAttachmentFolder) {
        let sourceFolderPath = path.join(uploadsDir, username, folderName);
        sourceExists = await fs.access(sourceFolderPath).then(() => true).catch(() => false);

        // Fallback 1: derive from first file's DB path
        if (!sourceExists && dbFiles[0]?.file_path) {
            const relPart = dbFiles[0].file_path.startsWith('/uploads/')
                ? dbFiles[0].file_path.substring(9)
                : dbFiles[0].file_path;
            const parts = relPart.replace(/\\/g, '/').split('/');
            if (parts.length >= 2) {
                const alt = path.join(uploadsDir, parts[0], parts[1]);
                if (await fs.access(alt).then(() => true).catch(() => false)) {
                    sourceFolderPath = alt;
                    sourceExists = true;
                }
            }
        }

        // Fallback 2: derive from relative_path top-level folder
        if (!sourceExists) {
            const topFolder = (dbFiles[0]?.relative_path || '').replace(/\\/g, '/').split('/')[0];
            if (topFolder) {
                const alt2 = path.join(uploadsDir, username, topFolder);
                if (await fs.access(alt2).then(() => true).catch(() => false)) {
                    sourceFolderPath = alt2;
                    sourceExists = true;
                }
            }
        }

        if (sourceExists) {
            // Parallel directory copy with 8 MB buffers; up to 8 files copy simultaneously.
            async function copyDir(src, dest) {
                const entries = await fs.readdir(src, { withFileTypes: true });
                const BATCH = 8;
                for (let i = 0; i < entries.length; i += BATCH) {
                    await Promise.all(entries.slice(i, i + BATCH).map(async entry => {
                        const srcPath = path.join(src, entry.name);
                        const destPath = path.join(dest, entry.name);
                        if (entry.isDirectory()) {
                            await fs.mkdir(destPath, { recursive: true });
                            await copyDir(srcPath, destPath);
                        } else {
                            await streamCopy(srcPath, destPath);
                        }
                    }));
                }
            }
            await copyDir(sourceFolderPath, destFolderPath);
            await fs.rm(sourceFolderPath, { recursive: true, force: true });
            logInfo('Folder copied to NAS and source deleted', { destFolderPath });
        } else {
            logInfo('Source folder not found — falling back to file-by-file copy', { sourceFolderPath });
        }
    }

    // ── 3. Update DB records and copy individual files if needed ─────────────
    const nowSql = new Date().toISOString().slice(0, 19).replace('T', ' ');

    for (const file of dbFiles) {
        if (!file) continue;

        // Preserve subfolder structure from relative_path
        let nasFilePath;
        if (file.relative_path) {
            const relParts = file.relative_path.replace(/\\/g, '/').split('/');
            const relativeInFolder = relParts.slice(1).join('/'); // strip top-level folder name
            nasFilePath = relativeInFolder
                ? path.join(destFolderPath, relativeInFolder)
                : path.join(destFolderPath, file.original_name);
        } else {
            nasFilePath = path.join(destFolderPath, file.original_name);
        }

        // File-by-file copy (used for attachment folders OR when directory copy wasn't possible)
        if (!sourceExists) {
            let srcFilePath;
            if (path.isAbsolute(file.file_path) || file.file_path.startsWith('\\\\')) {
                srcFilePath = file.file_path;
            } else if (file.file_path.startsWith('/uploads/')) {
                srcFilePath = path.join(uploadsDir, file.file_path.substring(9));
            } else {
                srcFilePath = path.join(uploadsDir, file.file_path);
            }

            await fs.mkdir(path.dirname(nasFilePath), { recursive: true });

            const srcOk = await fs.access(srcFilePath).then(() => true).catch(() => false);
            if (srcOk) {
                const normalSrc = path.normalize(srcFilePath).toLowerCase();
                const normalDst = path.normalize(nasFilePath).toLowerCase();
                if (normalSrc !== normalDst) {
                    await fs.copyFile(srcFilePath, nasFilePath);
                    await safeDeleteFile(srcFilePath);
                    logInfo('Copied file to NAS', { nasFilePath });
                } else {
                    logInfo('Source and destination are the same path, skipping copy', { srcFilePath });
                }
            } else {
                logInfo('Source file not found — may already have been moved', { srcFilePath });
            }
        }

        // Update DB record
        if (file.source_type === 'assignment_attachment') {
            await query(
                `UPDATE assignment_attachments SET
                    status = 'final_approved',
                    current_stage = 'published_to_public',
                    admin_reviewed_at = ?,
                    admin_comments = ?,
                    file_path = ?,
                    public_network_url = ?,
                    final_approved_at = ?
                 WHERE id = ?`,
                [nowSql, comments || null, nasFilePath, nasFilePath, nowSql, file.id]
            ).catch(err => logError(err, { context: 'moveFolderToNas-attachment-update' }));
        } else {
            await query(
                `UPDATE files SET
                    status = 'final_approved',
                    current_stage = 'published_to_public',
                    admin_id = ?,
                    admin_username = ?,
                    admin_reviewed_at = ?,
                    admin_comments = ?,
                    file_path = ?,
                    public_network_url = ?,
                    final_approved_at = ?
                 WHERE id = ?`,
                [admin.id, admin.username, nowSql, comments || null,
                 nasFilePath, nasFilePath, nowSql, file.id]
            );

            logFileStatusChange(db, file.id, file.status, 'final_approved',
                file.current_stage, 'published_to_public',
                admin.id, admin.username, admin.role,
                `Folder approved & moved to NAS: ${comments || 'No comments'}`);
        }
    }

    // ── 4. Smart grouped notifications per user ───────────────────────────────
    // All files in this call were approved (rejection happens via separate admin-reject endpoint).
    // Group by user and send one folder-level notification per user.
    const userFileMap = {};
    for (const file of dbFiles) {
        const uid = String(file.user_id);
        if (!userFileMap[uid]) userFileMap[uid] = [];
        userFileMap[uid].push(file);
    }

    for (const [userId, files] of Object.entries(userFileMap)) {
        const count = files.length;
        notificationService.createNotification(
            userId, null, 'final_approval',
            `Folder Approved: "${folderName}"`,
            `All ${count} file${count !== 1 ? 's' : ''} in your folder "${folderName}" have been approved and saved to the NAS.`,
            admin.id, admin.username, admin.role
        ).catch(() => {});
    }

    logActivity(db, admin.id, admin.username, admin.role, admin.team,
        `Folder approved & moved to NAS: ${folderName} (${fileIds.length} files) -> ${destFolderPath}`);

    return { nasPath: destFolderPath };
}

/**
 * Delete an attachment folder: removes physical files and assignment_attachments DB records.
 * @param {Object} params - { folderName, fileIds }
 * @param {Object} admin  - { id, username, role, team }
 */
async function deleteAttachmentFolder({ folderName, fileIds }, admin) {
    for (const fileId of (fileIds || [])) {
        const attachment = await queryOne(
            'SELECT * FROM assignment_attachments WHERE id = ?', [fileId]
        );

        if (attachment?.file_path) {
            let srcPath;
            if (path.isAbsolute(attachment.file_path) || attachment.file_path.startsWith('\\\\')) {
                srcPath = attachment.file_path;
            } else if (attachment.file_path.startsWith('/uploads/')) {
                srcPath = path.join(uploadsDir, attachment.file_path.substring(9));
            } else {
                srcPath = path.join(uploadsDir, attachment.file_path);
            }
            await safeDeleteFile(srcPath).catch(() => {});
        }

        await query('DELETE FROM assignment_attachments WHERE id = ?', [fileId]);
    }

    logActivity(db, admin.id, admin.username, admin.role, admin.team,
        `Attachment folder deleted: ${folderName} (${fileIds?.length || 0} files)`);

    return true;
}

/**
 * Record a file view event. Upserts so each user has at most one row per file.
 * Uses raw db.run because the file_views table is not in fileRepository yet.
 */
async function recordView(fileId, { userId, username, fullName, role }) {
    await query(
        `INSERT INTO file_views (file_id, user_id, username, full_name, role, viewed_at)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), role = VALUES(role), viewed_at = NOW()`,
        [fileId, userId, username || '', fullName || '', role || '']
    );
    return true;
}

/**
 * Get all viewers for a file, ordered by most recent view.
 */
async function getViewers(fileId) {
    const rows = await query(
        'SELECT user_id, username, full_name, role, viewed_at FROM file_views WHERE file_id = ? ORDER BY viewed_at DESC',
        [fileId]
    );
    return rows || [];
}

module.exports = {
    uploadFile,
    getFileById,
    getUserFiles,
    getUserFilesPaginated,
    getMemberFiles,
    checkDuplicate,
    getPendingTeamLeaderReview,
    getPendingAdminReview,
    getTeamLeaderQueue,
    filterTeamLeaderQueue,
    getAdminQueue,
    getAllFiles,
    getFileComments,
    addFileComment,
    getFileHistory,
    resolvePhysicalPath,
    setFilePriority,
    openFile,
    deleteFolder,
    zipFolder,
    bulkAction,
    approveByTeamLeader,
    rejectByTeamLeader,
    approveByAdmin,
    rejectByAdmin,
    moveToProjects,
    moveFolderToNas,
    deleteAttachmentFolder,
    recordView,
    getViewers,
    deleteFile: async (fileId, user) => {
        const file = await fileRepository.findById(fileId);
        if (!file) throw new NotFoundError('File');
        if (file.user_id !== user.id && user.role !== 'ADMIN') {
            throw new ValidationError('Permission denied');
        }
        await fileRepository.deleteById(fileId);
        logActivity(db, user.id, user.username, user.role, user.team, `Deleted file: ${file.original_name}`);
        return true;
    },
    getFileStats: async (criteria) => await fileRepository.count(criteria)
};
