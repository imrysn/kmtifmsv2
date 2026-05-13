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

// In-memory cache to speed up physical path resolution (prevents multiple slow NAS scans)
const physicalPathCache = new Map(); // key -> {path, originalName, mimeType, timestamp}
const CACHE_TTL_MS = 3600000; // 1 hour trust duration for NAS paths (reduces NAS traffic)

/**
 * Helper: true if path exists on disk
 */
const diskExists = async (p) => { 
    if (!p) return false;
    try { await fs.access(p); return true; } catch (_) { return false; } 
};

/**
 * Helper: find first existing path from a list in parallel
 */
const findFirstExisting = async (paths) => {
    const candidates = paths.filter(Boolean);
    if (candidates.length === 0) return null;
    
    // Check all candidates simultaneously to avoid sequential NAS latency
    const results = await Promise.all(candidates.map(async (p) => {
        if (await diskExists(p)) return p;
        return null;
    }));
    return results.find(r => r !== null);
};

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
            logInfo('Replacing existing file for same task', { oldFileId: existing.id, assignmentId });
            const tempPath = fileData.file_path.startsWith('/uploads/')
                ? path.join(uploadsDir, fileData.file_path.substring('/uploads/'.length))
                : fileData.file_path;
            try {
                if (existing.file_path) {
                    const oldPhysical = existing.file_path.startsWith('/uploads/')
                        ? path.join(uploadsDir, existing.file_path.substring('/uploads/'.length))
                        : existing.file_path;
                    await safeDeleteFile(oldPhysical);
                }
                await require('../config/database').query(
                    'DELETE FROM assignment_submissions WHERE file_id = ? AND assignment_id = ?',
                    [existing.id, assignmentId]
                );
                await fileRepository.deleteById(existing.id);
            } catch (replaceErr) {
                logError(replaceErr, { context: 'uploadFile-replace', oldFileId: existing.id });
            }
        } else {
            logInfo('Duplicate file found (no task context), cleaning up...', { fileId: existing.id });
            const tempPath = path.join(uploadsDir, fileData.file_path.replace(/^\/uploads\//, ''));
            try { await fs.unlink(tempPath); } catch (e) {}
            return { isDuplicate: true, existingFile: existing };
        }
    }

    let finalFilePath = fileData.file_path;
    try {
        const tempPath = fileData.file_path.startsWith('/uploads/')
            ? path.join(uploadsDir, fileData.file_path.substring('/uploads/'.length))
            : fileData.file_path;

        // Group individual files by task, but let folders be at the root of the user directory 
        // so they maintain their original names as requested by the user.
        const taskPrefix = null; // No task_N subfolders as requested

        const movedPath = await moveToUserFolder(
            tempPath,
            user.username,
            originalName,
            fileData.folder_name || null,
            fileData.relative_path || null,
            taskPrefix
        );

        const relativeToUploads = movedPath.startsWith(uploadsDir)
            ? movedPath.substring(uploadsDir.length).replace(/\\/g, '/')
            : movedPath;
        finalFilePath = `/uploads${relativeToUploads.startsWith('/') ? '' : '/'}${relativeToUploads}`;
    } catch (moveErr) {
        logError(moveErr, { context: 'uploadFile-moveToUserFolder', filename: originalName });
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
 * Bulk upload multiple files and link them to an assignment
 */
async function bulkUpload(filesData, user, assignmentId = null) {
    const { moveToUserFolder } = require('../utils/fileUtils');
    const results = [];
    const CONCURRENCY = 25;

    for (let i = 0; i < filesData.length; i += CONCURRENCY) {
        const batch = filesData.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.all(batch.map(async (fileData) => {
            try {
                const originalName = fixFilename(fileData.original_name);
                
                // 1. Check for duplicates (and replace if in task context)
                const existing = await fileRepository.findByNameAndUser(
                    originalName,
                    user.id,
                    fileData.folder_name,
                    assignmentId
                );

                if (existing && assignmentId) {
                    const oldPhysical = existing.file_path.startsWith('/uploads/')
                        ? path.join(uploadsDir, existing.file_path.substring('/uploads/'.length))
                        : existing.file_path;
                    await safeDeleteFile(oldPhysical);
                    await query('DELETE FROM assignment_submissions WHERE file_id = ? AND assignment_id = ?', [existing.id, assignmentId]);
                    await fileRepository.deleteById(existing.id);
                }

                // 2. Move to permanent location
                const tempPath = fileData.file_path.startsWith('/uploads/')
                    ? path.join(uploadsDir, fileData.file_path.substring('/uploads/'.length))
                    : fileData.file_path;

                const taskPrefix = null; // Removed task-prefixed subfolders as per user request
                const movedPath = await moveToUserFolder(
                    tempPath, user.username, originalName,
                    fileData.folder_name || null, fileData.relative_path || null,
                    taskPrefix
                );

                const relativeToUploads = movedPath.startsWith(uploadsDir)
                    ? movedPath.substring(uploadsDir.length).replace(/\\/g, '/')
                    : movedPath;
                const finalFilePath = `/uploads${relativeToUploads.startsWith('/') ? '' : '/'}${relativeToUploads}`;

                // 3. Create DB record
                const dbData = {
                    ...fileData,
                    original_name: originalName,
                    file_path: finalFilePath,
                    user_id: user.id,
                    username: user.username,
                    user_team: user.team,
                    status: 'uploaded',
                    current_stage: 'pending_team_leader'
                };

                const fileId = await fileRepository.create(dbData);

                // 4. Link to assignment if provided
                if (assignmentId) {
                    await query(
                        'INSERT INTO assignment_submissions (assignment_id, user_id, file_id, submitted_at) VALUES (?, ?, ?, NOW())',
                        [assignmentId, user.id, fileId]
                    );
                    await query(
                        'UPDATE assignment_members SET file_id = ?, submitted_at = NOW(), status = "submitted" WHERE assignment_id = ? AND user_id = ?',
                        [fileId, assignmentId, user.id]
                    );
                }

                return { success: true, fileId, originalName };
            } catch (err) {
                logError(err, { context: 'bulkUpload-item', filename: fileData.original_name });
                return { success: false, error: err.message, filename: fileData.original_name };
            }
        }));
        results.push(...batchResults);
    }

    logActivity(db, user.id, user.username, user.role, user.team, `Bulk uploaded ${results.filter(r => r.success).length} files`);
    return results;
}

/**
 * Approve file by team leader
 */
async function approveByTeamLeader(fileId, teamLeader, comments = '') {
    let file = await fileRepository.findById(fileId);
    let isAttachment = false;

    if (!file) {
        file = await fileRepository.findAttachmentById(fileId);
        if (file) isAttachment = true;
    }
    if (!file) throw new NotFoundError('File');

    if (file.user_team !== teamLeader.team && teamLeader.role !== 'ADMIN') {
        throw new ValidationError('You can only approve files from your team');
    }

    // Attachments might not have a current_stage in the same way, but we can check status
    const currentStage = file.current_stage || file.status;
    if (currentStage !== 'pending_team_leader' && currentStage !== 'uploaded' && currentStage !== 'submitted') {
        throw new ValidationError('File is not in the correct stage for team leader approval');
    }

    const newStatus = 'team_leader_approved';
    const newStage = 'pending_admin';

    if (isAttachment) {
        await fileRepository.updateAttachmentStatus(fileId, {
            status: newStatus,
            current_stage: newStage,
            team_leader_id: teamLeader.id,
            team_leader_username: teamLeader.username,
            team_leader_comments: comments
        });
    } else {
        await fileRepository.updateStatus(fileId, {
            status: newStatus,
            current_stage: newStage,
            team_leader_id: teamLeader.id,
            team_leader_username: teamLeader.username,
            team_leader_comments: comments
        });
    }

    logFileStatusChange(db, fileId, file.status, newStatus, currentStage, newStage,
        teamLeader.id, teamLeader.username, teamLeader.role,
        `Team leader approved: ${comments || 'No comments'}`);

    logActivity(db, teamLeader.id, teamLeader.username, teamLeader.role, teamLeader.team,
        `Approved ${isAttachment ? 'attachment' : 'file'}: ${file.original_name}`);

    await notificationService.createNotification(
        file.user_id || file.uploaded_by_id, isAttachment ? null : fileId, 'approval', 'File Approved by Team Leader',
        `Your file "${file.original_name}" has been approved by ${teamLeader.username} and is now pending admin review.`,
        teamLeader.id, teamLeader.username, teamLeader.role
    );

    await notificationService.createAdminNotification(
        fileId, 'team_leader_approved', 'File Approved by Team Leader',
        `${teamLeader.username} approved file "${file.original_name}" (Team: ${teamLeader.team}). Pending final review.`,
        teamLeader.id, teamLeader.username, teamLeader.role
    );

    return isAttachment ? await fileRepository.findAttachmentById(fileId) : await fileRepository.findById(fileId);
}

/**
 * Reject file by team leader
 */
async function rejectByTeamLeader(fileId, teamLeader, reason) {
    let file = await fileRepository.findById(fileId);
    let isAttachment = false;

    if (!file) {
        file = await fileRepository.findAttachmentById(fileId);
        if (file) isAttachment = true;
    }
    if (!file) throw new NotFoundError('File');

    if (file.user_team !== teamLeader.team && teamLeader.role !== 'ADMIN') {
        throw new ValidationError('You can only reject files from your team');
    }

    const newStatus = 'rejected_by_team_leader';
    const newStage = 'rejected_by_team_leader';

    const updateData = {
        status: newStatus,
        current_stage: newStage,
        team_leader_id: teamLeader.id,
        team_leader_username: teamLeader.username,
        team_leader_comments: reason,
        rejection_reason: reason,
        rejected_by: teamLeader.username
    };

    if (isAttachment) {
        await fileRepository.updateAttachmentStatus(fileId, updateData);
    } else {
        await fileRepository.updateStatus(fileId, updateData);
    }

    logFileStatusChange(db, fileId, file.status, newStatus, file.current_stage || file.status, newStage,
        teamLeader.id, teamLeader.username, teamLeader.role,
        `Team leader rejected: ${reason}`);

    logActivity(db, teamLeader.id, teamLeader.username, teamLeader.role, teamLeader.team,
        `Rejected ${isAttachment ? 'attachment' : 'file'}: ${file.original_name} - Reason: ${reason}`);

    await notificationService.createNotification(
        file.user_id || file.uploaded_by_id, isAttachment ? null : fileId, 'rejection', 'File Rejected by Team Leader',
        `Your file "${file.original_name}" has been rejected by ${teamLeader.username}. Reason: ${reason}`,
        teamLeader.id, teamLeader.username, teamLeader.role
    );

    // CRITICAL: We should NOT call createAdminNotification here unless explicitly needed,
    // but if we do, it must be for REJECTION, not approval.
    // For now, keeping it consistent with approveByTeamLeader but with correct labels.
    await notificationService.createAdminNotification(
        fileId, 'team_leader_rejected', 'File Rejected by Team Leader',
        `${teamLeader.username} rejected file "${file.original_name}" (Team: ${teamLeader.team}). Reason: ${reason}`,
        teamLeader.id, teamLeader.username, teamLeader.role
    );

    return isAttachment ? await fileRepository.findAttachmentById(fileId) : await fileRepository.findById(fileId);
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
    const files = await fileRepository.findByUserId(userId);
    const attachments = await fileRepository.findAllAttachmentsWithDetails({ userId });
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
async function openFile(fileId) {
    const resolved = await resolvePhysicalPath(fileId);
    if (!resolved || !resolved.path) throw new ValidationError('File path could not be resolved');
    
    let resolvedPath = path.normalize(resolved.path);

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
    dirsToDelete.add(path.join(uploadsDir, user.username, folderName));

    if (fileIds && fileIds.length > 0) {
        // Resolve and delete physical files in parallel
        await Promise.all(fileIds.map(async (fileId) => {
            const file = await fileRepository.findById(fileId);
            if (file) {
                const physicalPath = await resolvePhysicalPath(fileId);
                if (physicalPath.path) {
                    try { await fs.unlink(physicalPath.path); } catch (e) {}
                    const parentDir = path.dirname(physicalPath.path);
                    dirsToDelete.add(parentDir);
                    dirsToDelete.add(path.dirname(parentDir));
                }
            }
        }));
        await fileRepository.deleteBatch(fileIds);
    }

    for (const dirPath of dirsToDelete) {
        try {
            const stat = await fs.stat(dirPath);
            if (stat.isDirectory()) {
                const isUserRoot = dirPath === path.join(uploadsDir, user.username);
                const isUploadsRoot = dirPath === uploadsDir;
                if (!isUserRoot && !isUploadsRoot) {
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
        // zipFolder must handle both regular files and attachments
        const regularFile = await fileRepository.findById(fileId);
        const file = regularFile || await fileRepository.findAttachmentById(fileId);
        if (file) {
            const resolved = await resolvePhysicalPath(fileId);
            if (resolved.path) {
                const relPath = file.relative_path
                    ? file.relative_path.replace(/\\/g, '/').split('/').slice(1).join('/')
                    : file.original_name;
                const destFile = path.join(tmpDir, relPath || file.original_name);
                await fs.mkdir(path.dirname(destFile), { recursive: true });
                try { await fs.copyFile(resolved.path, destFile); } catch (_) {}
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
 * Resolve the physical path for a file or team leader attachment.
 * Team leader attachments: NAS/teamleader/<username>/...
 * Regular user files:      NAS/uploads/<username>/...
 *
 * Handles stale OS temp paths in DB (caused by a previously failed NAS move)
 * by reconstructing the correct NAS path from stored metadata fields.
 */
async function resolvePhysicalPath(fileId, requestedType = null) {
    const cacheKey = `${requestedType || 'auto'}_${fileId}`;
    
    // ── Trust Cache ──────────────────────────────────────────────────────────
    const cached = physicalPathCache.get(cacheKey);
    if (cached && (Date.now() - (cached.timestamp || 0) < CACHE_TTL_MS)) {
        return cached;
    }

    const { networkDataPath } = require('../config/database');
    const { uploadsDir } = require('../config/middleware');
    
    // Correct teamleader base directory is a peer to the 'data' folder on the NAS
    const teamleaderDir = path.join(path.dirname(networkDataPath), 'teamleader');
    
    logInfo('Resolving path for file', { fileId, requestedType });

    let file = requestedType !== 'attachment' ? await fileRepository.findById(fileId) : null;
    const isAttachment = !file;
    if (!file) file = await fileRepository.findAttachmentById(fileId);
    if (!file) {
        logError('File not found in any table', { fileId });
        throw new NotFoundError('File');
    }
    
    logInfo('File found', { isAttachment, originalName: file.original_name, username: file.username || file.uploaded_by_username });
    
    // Helper to return and cache the result
    const returnAndCache = (p) => {
        const res = { path: p, originalName: file.original_name, mimeType: file.file_type, timestamp: Date.now() };
        physicalPathCache.set(cacheKey, res);
        return res;
    };

    // Helper: true if path exists on disk
    const diskExists = async (p) => { try { await fs.access(p); return true; } catch (_) { return false; } };

    // Detect stale OS temp paths (e.g. C:\Users\...\AppData\Local\Temp\temp_xxx)
    const isTempPath = (p) => !p ? false : (
        /[\\/]temp_\d+_[a-z0-9]+$/i.test(p) ||
        p.toLowerCase().includes('\\temp\\') ||
        p.toLowerCase().includes('/tmp/')
    );

    // ── Priority 1: public_network_url set after admin approval ──────────────
    if (file.public_network_url && !file.public_network_url.startsWith('http')) {
        if (await diskExists(file.public_network_url)) return returnAndCache(file.public_network_url);
    }

    // ── Priority 2: absolute Windows/UNC path — skip stale temp paths ────────
    if (file.file_path && !isTempPath(file.file_path) &&
        (file.file_path.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(file.file_path))) {
        if (await diskExists(file.file_path)) return returnAndCache(file.file_path);
    }

    // ── Priority 3: /uploads/-relative path — skip stale temp paths ──────────
    if (file.file_path && file.file_path.startsWith('/uploads/') && !isTempPath(file.file_path)) {
        const candidate = path.join(uploadsDir, file.file_path.replace(/^\/uploads\//, ''));
        if (await diskExists(candidate)) return returnAndCache(candidate);
    }

    // ── Priority 4: reconstruct teamleader NAS path for attachments ───────────
    if (isAttachment && file.uploaded_by_username) {
        const u = file.uploaded_by_username;
        const aid = file.assignment_id;
        const taskDir = aid ? path.join(teamleaderDir, u, `task_${aid}`) : null;
        const userDir = path.join(teamleaderDir, u);
        const rel = file.relative_path ? file.relative_path.replace(/\/+/g, path.sep) : null;

        const candidates = [
            rel ? path.join(userDir, rel) : null, // NEW: Root user folder (flat structure)
            rel && taskDir ? path.join(taskDir, rel) : null, // OLD: Legacy task_N structure
            file.folder_name && file.original_name ? path.join(userDir, file.folder_name, file.original_name) : null,
            taskDir && file.folder_name && file.original_name ? path.join(taskDir, file.folder_name, file.original_name) : null,
            file.original_name ? path.join(userDir, file.original_name) : null,
            taskDir && file.original_name ? path.join(taskDir, file.original_name) : null,
            // Fallback to legacy location if needed
            rel ? path.join(uploadsDir, 'teamleader', u, rel) : null
        ];

        const winner = await findFirstExisting(candidates);
        if (winner) return returnAndCache(winner);
    }

    // ── Priority 5: reconstruct uploads NAS path for regular files ───────────
    if (!isAttachment && file.username) {
        const u = file.username;
        const userDir = path.join(uploadsDir, u);
        const rel = file.relative_path ? file.relative_path.replace(/\/+/g, path.sep) : null;

        const candidates = [
            // Try teamleader directory first (matching Image 2)
            rel ? path.join(teamleaderDir, u, rel) : null,
            file.original_name ? path.join(teamleaderDir, u, file.original_name) : null,
            
            // Try uploads directory (matching Image 1)
            rel ? path.join(userDir, rel) : null,
            file.file_path ? path.join(userDir, path.basename(file.file_path)) : null,
            file.original_name ? path.join(userDir, file.original_name) : null
        ];

        const winner = await findFirstExisting(candidates);
        if (winner) return returnAndCache(winner);

        // Try scanning for task-scoped folders if the root check fails
        if (file.is_folder || file.folder_name) {
            try {
                const items = await fs.readdir(userDir);
                const taskFolders = items.filter(item => item.startsWith('task_'));
                const scanCandidates = taskFolders.map(item => path.join(userDir, item, file.folder_name || file.original_name));
                const scanWinner = await findFirstExisting(scanCandidates);
                if (scanWinner) return returnAndCache(scanWinner);
            } catch (e) {
                logWarn('Failed to scan for task-scoped fallback', { error: e.message });
            }
        }
    }

    // ── Last resort: return best guess, let caller surface the error ──────────
    let fallback = file.file_path || '';
    if (fallback.startsWith('/uploads/')) fallback = path.join(uploadsDir, fallback.replace(/^\/uploads\//, ''));
    else if (fallback && !path.isAbsolute(fallback)) fallback = path.join(uploadsDir, fallback);
    
    logWarn('Returning fallback path (last resort)', { fallback });
    const result = { path: fallback, originalName: file.original_name, mimeType: file.file_type, timestamp: Date.now() };
    physicalPathCache.set(cacheKey, result);
    return result;
}

/**
 * Resolve multiple physical paths in parallel
 */
async function resolveBulkPhysicalPaths(fileIds, requestedType = 'file') {
    return await Promise.all(fileIds.map(async (id) => {
        try {
            const info = await resolvePhysicalPath(id, requestedType);
            return { id, success: true, ...info };
        } catch (e) {
            return { id, success: false, error: e.message };
        }
    }));
}
/**
 * Perform bulk actions on files (approve/reject)
 */
async function bulkAction(fileIds, action, user, comments = '') {
    const results = { successful: [], failed: [] };

    // Process actions in parallel batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < fileIds.length; i += BATCH_SIZE) {
        const batch = fileIds.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (fileId) => {
            try {
                if (action === 'approve') {
                    if (user.role === 'ADMIN') await approveByAdmin(fileId, user, comments);
                    else await approveByTeamLeader(fileId, user, comments);
                } else if (action === 'reject') {
                    if (user.role === 'ADMIN') await rejectByAdmin(fileId, user, comments);
                    else await rejectByTeamLeader(fileId, user, comments);
                }
                results.successful.push(fileId);
            } catch (error) {
                results.failed.push({ fileId, error: error.message });
            }
        }));
    }

    return results;
}

async function checkDuplicate(originalName, userId) {
    const existing = await fileRepository.findByNameAndUser(originalName, userId, null);
    return { isDuplicate: !!existing, existingFile: existing || null };
}

async function getMemberFiles(memberId) {
    return await fileRepository.findByUserId(memberId);
}

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
        comments: file.comments ? file.comments.split(' | ').map(comment => ({ comment })) : []
    }));
    return { files: processedFiles, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function getTeamLeaderQueue(team, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const countRow = await queryOne(
        "SELECT COUNT(*) as total FROM files WHERE user_team = ? AND current_stage = 'pending_team_leader'", [team]
    );
    const total = countRow ? countRow.total : 0;
    const files = await query(
        `SELECT f.*, fc.comment as latest_comment
         FROM files f
         LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (SELECT MAX(id) FROM file_comments WHERE file_id = f.id)
         WHERE f.user_team = ? AND f.current_stage = 'pending_team_leader'
         ORDER BY f.uploaded_at DESC LIMIT ? OFFSET ?`,
        [team, limit, offset]
    );
    return { files, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function filterTeamLeaderQueue(team, filters = {}, sort = {}, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const whereClauses = ['user_team = ?', "current_stage = 'pending_team_leader'"];
    const params = [team];
    if (filters.fileType?.length) { whereClauses.push(`file_type IN (${filters.fileType.map(() => '?').join(',')})`); params.push(...filters.fileType); }
    if (filters.submittedBy?.length) { whereClauses.push(`user_id IN (${filters.submittedBy.map(() => '?').join(',')})`); params.push(...filters.submittedBy); }
    if (filters.dateFrom) { whereClauses.push('uploaded_at >= ?'); params.push(filters.dateFrom); }
    if (filters.dateTo)   { whereClauses.push('uploaded_at <= ?'); params.push(filters.dateTo); }
    if (filters.priority) { whereClauses.push('priority = ?'); params.push(filters.priority); }
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
         LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (SELECT MAX(id) FROM file_comments WHERE file_id = f.id)
         WHERE ${where} ORDER BY ${sortField} ${sortDir} LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );
    return { files, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function getAdminQueue(page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const countRow = await queryOne("SELECT COUNT(*) as total FROM files WHERE current_stage = 'pending_admin'");
    const total = countRow ? countRow.total : 0;
    const files = await query(
        `SELECT f.*, fc.comment as latest_comment
         FROM files f
         LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (SELECT MAX(id) FROM file_comments WHERE file_id = f.id)
         WHERE f.current_stage = 'pending_admin'
         ORDER BY f.uploaded_at DESC LIMIT ? OFFSET ?`,
        [limit, offset]
    );
    return { files, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function moveFolderToNas({ folderName, username, fileIds, destinationPath, comments }, admin) {
    const dbFiles = (await Promise.all(
        fileIds.map(async (fileId) => {
            let row = await queryOne('SELECT * FROM files WHERE id = ?', [fileId]);
            if (row) return row;
            const att = await queryOne('SELECT *, created_at AS uploaded_at FROM assignment_attachments WHERE id = ?', [fileId]);
            if (att) {
                att.source_type = 'assignment_attachment';
                att.user_id = att.uploaded_by_id;
                att.username = att.uploaded_by_username;
                att.status = 'team_leader_approved';
            }
            return att || null;
        })
    )).filter(Boolean);

    if (dbFiles.length === 0) throw new NotFoundError('No files found in database for provided IDs');

    const isAttachmentFolder = dbFiles.some(f => f.source_type === 'assignment_attachment');
    const destFolderPath = path.join(destinationPath, folderName);
    await fs.mkdir(destFolderPath, { recursive: true });

    let sourceExists = false;

    if (!isAttachmentFolder) {
        let sourceFolderPath = path.join(uploadsDir, username, folderName);
        sourceExists = await fs.access(sourceFolderPath).then(() => true).catch(() => false);

        if (!sourceExists && dbFiles[0]?.file_path) {
            const relPart = dbFiles[0].file_path.startsWith('/uploads/') ? dbFiles[0].file_path.substring(9) : dbFiles[0].file_path;
            const parts = relPart.replace(/\\/g, '/').split('/');
            if (parts.length >= 2) {
                const alt = path.join(uploadsDir, parts[0], parts[1]);
                if (await fs.access(alt).then(() => true).catch(() => false)) { sourceFolderPath = alt; sourceExists = true; }
            }
        }

        if (!sourceExists) {
            const topFolder = (dbFiles[0]?.relative_path || '').replace(/\\/g, '/').split('/')[0];
            if (topFolder) {
                const alt2 = path.join(uploadsDir, username, topFolder);
                if (await fs.access(alt2).then(() => true).catch(() => false)) { sourceFolderPath = alt2; sourceExists = true; }
            }
        }

        if (sourceExists) {
            async function copyDir(src, dest) {
                const entries = await fs.readdir(src, { withFileTypes: true });
                const BATCH = 8;
                for (let i = 0; i < entries.length; i += BATCH) {
                    await Promise.all(entries.slice(i, i + BATCH).map(async entry => {
                        const srcPath = path.join(src, entry.name);
                        const destPath = path.join(dest, entry.name);
                        if (entry.isDirectory()) { await fs.mkdir(destPath, { recursive: true }); await copyDir(srcPath, destPath); }
                        else { await streamCopy(srcPath, destPath); }
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

    const nowSql = new Date().toISOString().slice(0, 19).replace('T', ' ');

    for (const file of dbFiles) {
        if (!file) continue;

        let nasFilePath;
        if (file.relative_path) {
            const relParts = file.relative_path.replace(/\\/g, '/').split('/');
            const relativeInFolder = relParts.slice(1).join('/');
            nasFilePath = relativeInFolder ? path.join(destFolderPath, relativeInFolder) : path.join(destFolderPath, file.original_name);
        } else {
            nasFilePath = path.join(destFolderPath, file.original_name);
        }

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
                }
            } else {
                logInfo('Source file not found — may already have been moved', { srcFilePath });
            }
        }

        if (file.source_type === 'assignment_attachment') {
            await query(
                `UPDATE assignment_attachments SET status='final_approved', current_stage='published_to_public',
                    admin_reviewed_at=?, admin_comments=?, file_path=?, public_network_url=?, final_approved_at=? WHERE id=?`,
                [nowSql, comments || null, nasFilePath, nasFilePath, nowSql, file.id]
            ).catch(err => logError(err, { context: 'moveFolderToNas-attachment-update' }));
        } else {
            await query(
                `UPDATE files SET status='final_approved', current_stage='published_to_public',
                    admin_id=?, admin_username=?, admin_reviewed_at=?, admin_comments=?,
                    file_path=?, public_network_url=?, final_approved_at=? WHERE id=?`,
                [admin.id, admin.username, nowSql, comments || null, nasFilePath, nasFilePath, nowSql, file.id]
            );
            logFileStatusChange(db, file.id, file.status, 'final_approved', file.current_stage, 'published_to_public',
                admin.id, admin.username, admin.role, `Folder approved & moved to NAS: ${comments || 'No comments'}`);
        }
    }

    const userFileMap = {};
    for (const file of dbFiles) {
        const uid = String(file.user_id);
        if (!userFileMap[uid]) userFileMap[uid] = [];
        userFileMap[uid].push(file);
    }
    for (const [userId, files] of Object.entries(userFileMap)) {
        const count = files.length;
        notificationService.createNotification(
            userId, null, 'final_approval', `Folder Approved: "${folderName}"`,
            `All ${count} file${count !== 1 ? 's' : ''} in your folder "${folderName}" have been approved and saved to the NAS.`,
            admin.id, admin.username, admin.role
        ).catch(() => {});
    }

    logActivity(db, admin.id, admin.username, admin.role, admin.team,
        `Folder approved & moved to NAS: ${folderName} (${fileIds.length} files) -> ${destFolderPath}`);

    return { nasPath: destFolderPath };
}

async function deleteAttachmentFolder({ folderName, fileIds }, admin) {
    for (const fileId of (fileIds || [])) {
        const attachment = await queryOne('SELECT * FROM assignment_attachments WHERE id = ?', [fileId]);
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

async function recordView(fileId, { userId, username, fullName, role }) {
    await query(
        `INSERT INTO file_views (file_id, user_id, username, full_name, role, viewed_at)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), role = VALUES(role), viewed_at = NOW()`,
        [fileId, userId, username || '', fullName || '', role || '']
    );
    return true;
}

async function getViewers(fileId) {
    const rows = await query(
        'SELECT user_id, username, full_name, role, viewed_at FROM file_views WHERE file_id = ? ORDER BY viewed_at DESC',
        [fileId]
    );
    return rows || [];
}

module.exports = {
    uploadFile,
    bulkUpload,
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
        if (file.user_id !== user.id && user.role !== 'ADMIN') throw new ValidationError('Permission denied');
        await fileRepository.deleteById(fileId);
        logActivity(db, user.id, user.username, user.role, user.team, `Deleted file: ${file.original_name}`);
        return true;
    },
    getFileStats: async (criteria) => await fileRepository.count(criteria)
};
