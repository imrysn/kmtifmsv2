const fileRepository = require('../repositories/fileRepository');
const notificationService = require('./notificationService');
const { logActivity, logInfo, logError, logFileStatusChange } = require('../utils/logger');
const { db } = require('../config/database');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const { uploadsDir } = require('../config/middleware');

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
 * @param {Object} fileData - File upload data
 * @param {Object} user - Authenticated user
 * @returns {Promise<Object>} - Created file record
 */
async function uploadFile(fileData, user) {
    const originalName = fixFilename(fileData.original_name);
    
    logInfo('Uploading file', {
        filename: originalName,
        userId: user.id
    });

    // Check for duplicate
    const existing = await fileRepository.findByNameAndUser(
        originalName, 
        user.id, 
        fileData.folder_name
    );

    if (existing) {
        logInfo('Duplicate file found, cleaning up...', { fileId: existing.id });
        // Delete the newly uploaded file physical path
        const tempPath = path.join(uploadsDir, fileData.file_path.replace(/^\/uploads\//, ''));
        try { await fs.unlink(tempPath); } catch (e) {}
        
        // Return information about the existing file
        return {
            isDuplicate: true,
            existingFile: existing
        };
    }

    // Prepare file data
    const data = {
        ...fileData,
        original_name: originalName,
        user_id: user.id,
        username: user.username,
        user_team: user.team,
        status: 'uploaded',
        current_stage: 'pending_team_leader'
    };

    // Create file record
    const fileId = await fileRepository.create(data);

    // Log activity
    logActivity(
        db,
        user.id,
        user.username,
        user.role,
        user.team,
        `Uploaded file: ${fileData.original_name}`
    );

    // Get the created file
    const file = await fileRepository.findById(fileId);

    logInfo('File uploaded successfully', { fileId, filename: fileData.original_name });

    return file;
}

/**
 * Approve file by team leader
 * @param {number} fileId - File ID
 * @param {Object} teamLeader - Team leader user object
 * @param {string} comments - Optional comments
 * @returns {Promise<Object>} - Updated file
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

    // Update file status
    await fileRepository.updateStatus(fileId, {
        status: newStatus,
        current_stage: newStage,
        team_leader_id: teamLeader.id,
        team_leader_username: teamLeader.username,
        team_leader_comments: comments
    });

    // Log status history
    logFileStatusChange(
        db, fileId, file.status, newStatus, file.current_stage, newStage,
        teamLeader.id, teamLeader.username, teamLeader.role,
        `Team leader approved: ${comments || 'No comments'}`
    );

    // Log activity
    logActivity(
        db, teamLeader.id, teamLeader.username, teamLeader.role, teamLeader.team,
        `Approved file: ${file.original_name}`
    );

    // Create notification for user
    await notificationService.createNotification(
        file.user_id, fileId, 'approval', 'File Approved by Team Leader',
        `Your file "${file.original_name}" has been approved by ${teamLeader.username} and is now pending admin review.`,
        teamLeader.id, teamLeader.username, teamLeader.role
    );

    // Notify admins
    await notificationService.createAdminNotification(
        fileId, 'team_leader_approved', 'File Approved by Team Leader',
        `${teamLeader.username} approved file "${file.original_name}" (Team: ${teamLeader.team}). Pending final review.`,
        teamLeader.id, teamLeader.username, teamLeader.role
    );

    return await fileRepository.findById(fileId);
}

/**
 * Reject file by team leader
 * @param {number} fileId - File ID
 * @param {Object} teamLeader - Team leader user object
 * @param {string} reason - Rejection reason
 * @returns {Promise<Object>} - Updated file
 */
async function rejectByTeamLeader(fileId, teamLeader, reason) {
    const file = await fileRepository.findById(fileId);

    if (!file) throw new NotFoundError('File');

    if (file.user_team !== teamLeader.team && teamLeader.role !== 'ADMIN') {
        throw new ValidationError('You can only reject files from your team');
    }

    const newStatus = 'rejected_by_team_leader';
    const newStage = 'rejected_by_team_leader';

    // Update file status
    await fileRepository.updateStatus(fileId, {
        status: newStatus,
        current_stage: newStage,
        team_leader_id: teamLeader.id,
        team_leader_username: teamLeader.username,
        team_leader_comments: reason,
        rejection_reason: reason,
        rejected_by: teamLeader.username
    });

    // Log status history
    logFileStatusChange(
        db, fileId, file.status, newStatus, file.current_stage, newStage,
        teamLeader.id, teamLeader.username, teamLeader.role,
        `Team leader rejected: ${reason}`
    );

    // Log activity
    logActivity(
        db, teamLeader.id, teamLeader.username, teamLeader.role, teamLeader.team,
        `Rejected file: ${file.original_name} - Reason: ${reason}`
    );

    // Create notification for user
    await notificationService.createNotification(
        file.user_id, fileId, 'rejection', 'File Rejected by Team Leader',
        `Your file "${file.original_name}" has been rejected by ${teamLeader.username}. Reason: ${reason}`,
        teamLeader.id, teamLeader.username, teamLeader.role
    );

    return await fileRepository.findById(fileId);
}

/**
 * Approve file by admin (Final Approval)
 * @param {number} fileId - File ID
 * @param {Object} admin - Admin user object
 * @param {string} comments - Optional comments
 * @returns {Promise<Object>} - Updated file
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

    // Log status history (if not attachment, or if attachment table supports it)
    if (!isAttachment) {
        logFileStatusChange(
            db, fileId, targetFile.status, newStatus, targetFile.current_stage, newStage,
            admin.id, admin.username, admin.role,
            `Admin final approval: ${comments || 'No comments'}`
        );
    }

    // Log activity
    logActivity(
        db, admin.id, admin.username, admin.role, admin.team,
        `Final approved ${isAttachment ? 'attachment' : 'file'}: ${targetFile.original_name}`
    );

    // Create notification for user
    await notificationService.createNotification(
        targetFile.user_id || targetFile.uploaded_by_id, 
        fileId, 'approval', 'File Final Approved',
        `Your file "${targetFile.original_name}" has received final approval from the administrator and is now published.`,
        admin.id, admin.username, admin.role
    );

    return isAttachment ? await fileRepository.findAttachmentById(fileId) : await fileRepository.findById(fileId);
}

/**
 * Reject file by admin
 * @param {number} fileId - File ID
 * @param {Object} admin - Admin user object
 * @param {string} reason - Rejection reason
 * @returns {Promise<Object>} - Updated file
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
        logFileStatusChange(
            db, fileId, targetFile.status, newStatus, targetFile.current_stage, newStage,
            admin.id, admin.username, admin.role,
            `Admin rejection: ${reason}`
        );
    }

    logActivity(
        db, admin.id, admin.username, admin.role, admin.team,
        `Rejected ${isAttachment ? 'attachment' : 'file'}: ${targetFile.original_name} - Reason: ${reason}`
    );

    await notificationService.createNotification(
        targetFile.user_id || targetFile.uploaded_by_id, 
        fileId, 'rejection', 'File Rejected by Admin',
        `Your file "${targetFile.original_name}" has been rejected by the administrator. Reason: ${reason}`,
        admin.id, admin.username, admin.role
    );

    return isAttachment ? await fileRepository.findAttachmentById(fileId) : await fileRepository.findById(fileId);
}

/**
 * Move file to projects directory
 * @param {number} fileId - File ID
 * @param {string} destinationPath - Full network destination path
 * @param {Object} admin - Admin user object
 * @param {boolean} deleteFromUploads - Whether to delete source file
 * @returns {Promise<string>} - New file path
 */
async function moveToProjects(fileId, destinationPath, admin, deleteFromUploads = false) {
    let file = await fileRepository.findById(fileId);
    let isAttachment = false;

    if (!file) {
        file = await fileRepository.findAttachmentById(fileId);
        if (file) isAttachment = true;
    }

    if (!file) throw new NotFoundError('File');

    // Resolve source path
    let sourcePath;
    const dbPath = file.file_path;
    if (dbPath && dbPath.startsWith('/uploads/')) {
        sourcePath = path.join(uploadsDir, dbPath.substring(9));
    } else if (dbPath && (dbPath.startsWith('\\\\') || /^[a-zA-Z]:[\\/]/.test(dbPath))) {
        sourcePath = dbPath;
    } else {
        sourcePath = path.join(uploadsDir, dbPath || '');
    }

    // Verify source exists
    try {
        await fs.access(sourcePath);
    } catch (err) {
        throw new ValidationError(`Source file not found: ${sourcePath}`);
    }

    // Ensure destination exists
    await fs.mkdir(destinationPath, { recursive: true });
    const finalDestPath = path.join(destinationPath, file.original_name);

    // Check for collision
    try {
        await fs.access(finalDestPath);
        throw new ValidationError('File already exists in destination');
    } catch (err) {
        if (err.message.includes('already exists')) throw err;
        // Proceed if file doesn't exist
    }

    // Copy file
    await fs.copyFile(sourcePath, finalDestPath);
    logInfo('File copied to projects', { source: sourcePath, dest: finalDestPath });

    // Update DB
    if (isAttachment) {
        await fileRepository.updateAttachmentStatus(fileId, { public_network_url: finalDestPath });
    } else {
        await fileRepository.updateStatus(fileId, { public_network_url: finalDestPath });
    }

    // Cleanup source if requested
    if (deleteFromUploads) {
        try {
            await fs.unlink(sourcePath);
            logInfo('Source file deleted after move', { path: sourcePath });
        } catch (err) {
            logError(err, { context: 'cleanup-source-after-move', path: sourcePath });
        }
    }

    logActivity(
        db, admin.id, admin.username, admin.role, admin.team,
        `Moved file to projects: ${file.original_name} -> ${destinationPath}`
    );

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
 * Get user files
 */
async function getUserFiles(userId) {
    return await fileRepository.findByUserId(userId);
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
    
    // Also fetch Team Leader assignment attachments (if not filtering by specific user/stage that wouldn't apply)
    // To maintain parity with legacy /all endpoint
    const attachments = await fileRepository.findAllAttachmentsWithDetails(options);

    // Merge and avoid duplicates
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

    // Notify stakeholders
    // If user is not the owner, notify owner
    if (file.user_id !== user.id) {
        await notificationService.createNotification(
            file.user_id, fileId, 'comment', 'New Comment on Your File',
            `${user.username} commented on "${file.original_name}"`,
            user.id, user.username, user.role
        );
    }

    // Always notify admins of new comments on files
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

    logActivity(
        db, user.id, user.username, user.role, file.user_team,
        `Updated file ${file.original_name} - ${changes.join(', ')}`
    );

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

    // Sanitize
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
        // Collect paths and delete from DB
        for (const fileId of fileIds) {
            const file = await fileRepository.findById(fileId);
            if (file) {
                const physicalPath = await resolvePhysicalPath(fileId);
                if (physicalPath.path) {
                    try { await fs.unlink(physicalPath.path); } catch (e) {}
                    dirsToDelete.add(path.dirname(physicalPath.path));
                }
            }
        }
        await fileRepository.deleteBatch(fileIds);
    }

    // Delete directories
    for (const dirPath of dirsToDelete) {
        try {
            const stat = await fs.stat(dirPath);
            if (stat.isDirectory()) {
                await fs.rm(dirPath, { recursive: true, force: true });
            }
        } catch (e) {}
    }

    logActivity(
        db, user.id, user.username, user.role, user.team,
        `Folder deleted: ${folderName} (${fileIds?.length || 0} files)`
    );

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

    // PowerShell Zip
    const cmd = `powershell -NoProfile -Command "Compress-Archive -Path '${tmpDir}\\*' -DestinationPath '${zipPath}' -Force"`;
    await new Promise((resolve, reject) => {
        exec(cmd, (err) => {
            if (err) reject(err); else resolve();
        });
    });

    return { zipPath, tmpDir };
}

/**
 * Resolve the physical path for a file
 */
async function resolvePhysicalPath(fileId) {
    let file = await fileRepository.findById(fileId);
    
    // If not found in files table, check assignment_attachments
    if (!file) {
        file = await fileRepository.findAttachmentById(fileId);
    }
    
    if (!file) throw new NotFoundError('File');

    let filePath = file.file_path;
    
    // Resolve logic based on legacy implementation
    if (file.public_network_url && !file.public_network_url.startsWith('http')) {
        filePath = file.public_network_url;
    } else if (file.file_path && (file.file_path.startsWith('\\\\') || /^[A-Za-z]:[\\\\]/.test(file.file_path))) {
        filePath = file.file_path;
    } else if (file.file_path && file.file_path.startsWith('/uploads/')) {
        filePath = path.join(uploadsDir, file.file_path.replace(/^\/uploads\//, ''));
    } else if (file.file_path) {
        filePath = path.join(uploadsDir, file.file_path);
    }

    // Advanced Resolution: Fallback to username directory if path not found
    if (filePath && file.username) {
        try {
            await fs.access(filePath);
        } catch (e) {
            // Try username directory
            const userPath = path.join(uploadsDir, file.username, path.basename(file.file_path || file.filename));
            try {
                await fs.access(userPath);
                filePath = userPath;
            } catch (innerE) {
                // Not found in user dir either
            }
        }
    }

    return {
        path: filePath,
        originalName: file.original_name,
        mimeType: file.file_type
    };
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

module.exports = {
    uploadFile,
    getFileById,
    getUserFiles,
    getPendingTeamLeaderReview,
    getPendingAdminReview,
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
