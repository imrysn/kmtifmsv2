const fileRepository = require('../repositories/fileRepository');
const notificationService = require('./notificationService');
const { logActivity, logInfo, logError, logWarn, logFileStatusChange } = require('../utils/logger');
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

    let isRevision = false;
    const existing = await fileRepository.findByNameAndUser(
        originalName,
        user.id,
        fileData.folder_name,
        assignmentId
    );

    // ── Path inheritance ───────────────────────────────────────────────
    // When re-uploading a single file, the client sends no folder context.
    // Recover the original subfolder path from any previous submission of
    // this filename for this assignment (rejected, revision, or any status).
    if (assignmentId && !fileData.folder_name) {
        let pathSource = (existing && existing.folder_name) ? existing : null;
        if (!pathSource) {
            const historical = await fileRepository.findAnyByNameAndAssignment(
                originalName, user.id, assignmentId
            );
            if (historical && historical.folder_name) pathSource = historical;
        }
        if (pathSource) {
            fileData.folder_name = pathSource.folder_name;
            if (pathSource.relative_path &&
                (!fileData.relative_path || fileData.relative_path === originalName)) {
                fileData.relative_path = pathSource.relative_path;
            }
            fileData.is_folder = !!(fileData.relative_path && fileData.relative_path.includes('/'));
        }
    }

    if (existing) {
        if (assignmentId) {
            // Check if this specific file is a revision (replacing a rejected file)
            if (existing.status === 'rejected_by_team_leader' || existing.status === 'rejected_by_admin') {
                isRevision = true;
            }

            logInfo('Replacing existing file for same task', { oldFileId: existing.id, assignmentId, isRevision });
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
        status: isRevision ? 'revision' : 'uploaded',
        current_stage: 'pending_team_leader'
    };

    const fileId = await fileRepository.create(data);

    logActivity(db, user.id, user.username, user.role, user.team,
        `Uploaded file: ${fileData.original_name}`);

    // Notify team leader if this upload is linked to an assignment
    if (assignmentId) {
        try {
            const { pushToUser } = require('../routes/notifications');
            const assignment = await queryOne(
                'SELECT id, title, team_leader_id FROM assignments WHERE id = ?',
                [assignmentId]
            );
            if (assignment && assignment.team_leader_id) {
                await notificationService.createNotification(
                    assignment.team_leader_id,
                    fileId,
                    'file_submitted',
                    'New File Submission',
                    `${user.fullName || user.username} submitted "${originalName}" for "${assignment.title}".`,
                    user.id,
                    user.username,
                    user.role,
                    assignmentId
                );
                pushToUser(assignment.team_leader_id);
            }
        } catch (notifErr) {
            logError(notifErr, { context: 'uploadFile-TL-notification' });
        }
    }

    const file = await fileRepository.findById(fileId);
    logInfo('File uploaded successfully', { fileId, filename: fileData.original_name });
    return file;
}

/**
 * FAST bulk upload — Phase 1 only: duplicate check + DB inserts with temp paths.
 * No NAS I/O at all. Returns fileRecords (for the response) and assignmentLinks
 * (for the background NAS move phase).
 */
async function bulkUploadFast(filesData, user, assignmentId = null) {
    const MAX_CONCURRENT = 50;
    const assignmentLinks = [];   // {fileId, tempPath, fileData} — for background move
    const fileRecords = [];        // results sent to client

    let batchHasRevision = false;
    let revisionCount = 0;

    async function processFileFast(fileData) {
        try {
            const originalName = fixFilename(fileData.original_name);

            // 1. Duplicate check (DB only — fast)
            const existing = await fileRepository.findByNameAndUser(
                originalName, user.id, fileData.folder_name, assignmentId
            );

            // ── Path inheritance ─────────────────────────────────────────────────
            // When the user re-uploads a single file (no folder drag-drop), the
            // client sends relativePath = filename only and folderName = null.
            // We need to recover the original subfolder path from ANY previous
            // submission of this file to this assignment — not just rejected ones —
            // because a previous re-upload may have already replaced the rejected
            // record with a flat 'revision'/'uploaded' record.
            //
            // Strategy:
            //   A) If we found an existing record AND it has a folder_name → inherit.
            //   B) If the existing record is flat (no folder_name), do a secondary
            //      lookup for the most path-rich historical record for this assignment.
            if (assignmentId && !fileData.folder_name) {
                let pathSource = null;

                if (existing && existing.folder_name) {
                    // Existing record already has folder context — use it
                    pathSource = existing;
                } else {
                    // Either no existing record found, or existing is flat.
                    // Do a broader search to find any historical record with path info.
                    pathSource = await fileRepository.findAnyByNameAndAssignment(
                        originalName, user.id, assignmentId
                    );
                    // If this returns the same flat record, ignore it.
                    if (pathSource && !pathSource.folder_name) pathSource = null;
                }

                if (pathSource) {
                    fileData.folder_name = pathSource.folder_name;
                    if (pathSource.relative_path &&
                        (!fileData.relative_path || fileData.relative_path === originalName)) {
                        fileData.relative_path = pathSource.relative_path;
                    }
                    fileData.is_folder = !!(fileData.relative_path && fileData.relative_path.includes('/'));
                }
            }

            if (existing && assignmentId) {
                // Check if this specific file is a revision (replacing a rejected file)
                if (existing.status === 'rejected_by_team_leader' || existing.status === 'rejected_by_admin') {
                    batchHasRevision = true;
                    revisionCount++;
                    fileData.isThisFileRevision = true;
                }

                // Remove old record so we replace it
                const oldPhysical = existing.file_path.startsWith('/uploads/')
                    ? path.join(uploadsDir, existing.file_path.substring('/uploads/'.length))
                    : existing.file_path;
                await safeDeleteFile(oldPhysical);
                await query('DELETE FROM assignment_submissions WHERE file_id = ? AND assignment_id = ?',
                    [existing.id, assignmentId]);
                await fileRepository.deleteById(existing.id);
            }

            // 2. Insert DB record with the current temp path so the file appears in the UI
            //    instantly. The background job will update file_path once NAS move is done.
            const tempPath = fileData.file_path; // e.g. C:\Users\...\AppData\Local\Temp\temp_xxx

            // Relative path for the UI (we'll use a placeholder until NAS move completes)
            const dbData = {
                ...fileData,
                original_name: originalName,
                file_path: tempPath,
                user_id: user.id,
                username: user.username,
                user_team: user.team,
                current_stage: 'pending_team_leader',
                status: fileData.isThisFileRevision ? 'revision' : 'uploaded'
            };
            
            // Explicitly ensure status is set correctly even if fileData had a status property
            if (fileData.isThisFileRevision) dbData.status = 'revision';
            else if (!dbData.status || dbData.status === '') dbData.status = 'uploaded';

            const fileId = await fileRepository.create(dbData);

            // 3. Queue for background NAS move
            assignmentLinks.push({ fileId, tempPath, originalName, fileData });

            return { success: true, fileId, originalName };
        } catch (err) {
            logError(err, { context: 'bulkUploadFast-item', filename: fileData.original_name });
            return { success: false, error: err.message, filename: fileData.original_name };
        }
    }

    // Run all inserts concurrently
    const executing = new Set();
    const promises = [];
    for (const file of filesData) {
        const p = processFileFast(file);
        promises.push(p);
        executing.add(p);
        const clean = () => executing.delete(p);
        p.then(clean).catch(clean);
        if (executing.size >= MAX_CONCURRENT) await Promise.race(executing);
    }
    const settled = await Promise.all(promises);
    settled.forEach(r => fileRecords.push(r));

    // Batch-insert assignment_submissions right away so the task shows submitted
    const successLinks = assignmentLinks.filter(l => fileRecords.some(r => r.success && r.fileId === l.fileId));
    if (assignmentId && successLinks.length > 0) {
        try {
            const assignmentIdInt = parseInt(assignmentId, 10);
            const fileIds = successLinks.map(l => l.fileId);
            const subPlaceholders = fileIds.map(() => '(?, ?, ?, NOW())').join(', ');
            const subValues = fileIds.flatMap(fid => [assignmentIdInt, user.id, fid]);
            await query(
                `INSERT IGNORE INTO assignment_submissions (assignment_id, user_id, file_id, submitted_at) VALUES ${subPlaceholders}`,
                subValues
            );
            await query(
                'UPDATE assignment_members SET file_id = ?, submitted_at = NOW(), status = "submitted" WHERE assignment_id = ? AND user_id = ?',
                [fileIds[fileIds.length - 1], assignmentIdInt, user.id]
            );
        } catch (err) {
            logError('Failed to batch-link submissions in fast phase', { error: err.message });
        }
    }

    logActivity(db, user.id, user.username, user.role, user.team,
        `Bulk uploaded ${fileRecords.filter(r => r.success).length} files (fast path)`);

    // Notify team leader immediately (files are visible in DB already)
    if (assignmentId) {
        try {
            const { pushToUser } = require('../routes/notifications');
            const assignment = await queryOne(
                'SELECT id, title, team_leader_id FROM assignments WHERE id = ?',
                [parseInt(assignmentId, 10)]
            );
            if (assignment && assignment.team_leader_id) {
                const successCount = fileRecords.filter(r => r.success).length;
                const firstFileId = successLinks.length > 0 ? successLinks[0].fileId : null;
                const notificationTitle = batchHasRevision ? 'Revised File Submission' : 'New File Submission';
                const notificationMessage = batchHasRevision 
                    ? `${user.fullName || user.username} submitted ${successCount} file${successCount !== 1 ? 's' : ''} (including ${revisionCount} revision${revisionCount !== 1 ? 's' : ''}) for "${assignment.title}".`
                    : `${user.fullName || user.username} submitted ${successCount} file${successCount !== 1 ? 's' : ''} for "${assignment.title}".`;

                await notificationService.createNotification(
                    assignment.team_leader_id, firstFileId, 'file_submitted',
                    notificationTitle,
                    notificationMessage,
                    user.id, user.username, user.role, parseInt(assignmentId, 10)
                );
                pushToUser(assignment.team_leader_id);
            }
        } catch (notifErr) {
            logError(notifErr, { context: 'bulkUploadFast-TL-notification' });
        }
    }

    return { assignmentLinks, fileRecords };
}

/**
 * Bulk upload multiple files and link them to an assignment (legacy synchronous path).
 * Kept for reference; the active path is bulkUploadFast + bulkUploadMoveToNas.
 */
async function bulkUpload(filesData, user, assignmentId = null) {
    const { moveToUserFolder } = require('../utils/fileUtils');
    const MAX_CONCURRENT = 50;
    const assignmentLinks = [];

    async function processFile(fileData) {
        try {
            const originalName = fixFilename(fileData.original_name);
            const existing = await fileRepository.findByNameAndUser(originalName, user.id, fileData.folder_name, assignmentId);
            if (existing && assignmentId) {
                const oldPhysical = existing.file_path.startsWith('/uploads/')
                    ? path.join(uploadsDir, existing.file_path.substring('/uploads/'.length))
                    : existing.file_path;
                await safeDeleteFile(oldPhysical);
                await query('DELETE FROM assignment_submissions WHERE file_id = ? AND assignment_id = ?', [existing.id, assignmentId]);
                await fileRepository.deleteById(existing.id);
            }
            const tempPath = fileData.file_path.startsWith('/uploads/')
                ? path.join(uploadsDir, fileData.file_path.substring('/uploads/'.length))
                : fileData.file_path;
            const movedPath = await moveToUserFolder(tempPath, user.username, originalName, fileData.folder_name || null, fileData.relative_path || null, null);
            const relativeToUploads = movedPath.startsWith(uploadsDir)
                ? movedPath.substring(uploadsDir.length).replace(/\\/g, '/')
                : movedPath;
            const finalFilePath = `/uploads${relativeToUploads.startsWith('/') ? '' : '/'}${relativeToUploads}`;
            const dbData = { ...fileData, original_name: originalName, file_path: finalFilePath, user_id: user.id, username: user.username, user_team: user.team, status: 'uploaded', current_stage: 'pending_team_leader' };
            const fileId = await fileRepository.create(dbData);
            if (assignmentId) assignmentLinks.push(['INSERT INTO assignment_submissions (assignment_id, user_id, file_id, submitted_at) VALUES (?, ?, ?, NOW())', [assignmentId, user.id, fileId]]);
            return { success: true, fileId, originalName };
        } catch (err) {
            logError(err, { context: 'bulkUpload-item', filename: fileData.original_name });
            return { success: false, error: err.message, filename: fileData.original_name };
        }
    }

    const results = [];
    const executing = new Set();
    for (const file of filesData) {
        const p = processFile(file);
        results.push(p);
        executing.add(p);
        const clean = () => executing.delete(p);
        p.then(clean).catch(clean);
        if (executing.size >= MAX_CONCURRENT) await Promise.race(executing);
    }
    const finalResults = await Promise.all(results);

    if (assignmentLinks.length > 0) {
        try {
            const assignmentIdInt = parseInt(assignmentId, 10);
            const fileIds = assignmentLinks.map(([, params]) => params[2]);
            const subPlaceholders = fileIds.map(() => '(?, ?, ?, NOW())').join(', ');
            const subValues = fileIds.flatMap(fid => [assignmentIdInt, user.id, fid]);
            await query(`INSERT IGNORE INTO assignment_submissions (assignment_id, user_id, file_id, submitted_at) VALUES ${subPlaceholders}`, subValues);
            await query('UPDATE assignment_members SET file_id = ?, submitted_at = NOW(), status = "submitted" WHERE assignment_id = ? AND user_id = ?', [fileIds[fileIds.length - 1], assignmentIdInt, user.id]);
        } catch (err) {
            logError('Failed to batch link assignment submissions', { error: err.message });
        }
    }

    logActivity(db, user.id, user.username, user.role, user.team, `Bulk uploaded ${finalResults.filter(r => r.success).length} files`);

    if (assignmentId) {
        try {
            const { pushToUser } = require('../routes/notifications');
            const assignment = await queryOne('SELECT id, title, team_leader_id FROM assignments WHERE id = ?', [parseInt(assignmentId, 10)]);
            if (assignment && assignment.team_leader_id) {
                const successCount = finalResults.filter(r => r.success).length;
                await notificationService.createNotification(assignment.team_leader_id, null, 'file_submitted', 'New File Submission', `${user.fullName || user.username} submitted ${successCount} file${successCount !== 1 ? 's' : ''} for "${assignment.title}".`, user.id, user.username, user.role, parseInt(assignmentId, 10));
                pushToUser(assignment.team_leader_id);
                logInfo('Team leader notified of bulk submission', { tlId: assignment.team_leader_id, assignmentId, successCount });
            }
        } catch (notifErr) {
            logError(notifErr, { context: 'bulkUpload-TL-notification' });
        }
    }

    return finalResults;
}

/**
 * FAST bulk upload — Phase 2: move files from local temp to NAS and update DB paths.
 * Runs in the background after the HTTP response has already been sent.
 */
async function bulkUploadMoveToNas(fileRecords, user, assignmentId, assignmentLinks) {
    const { moveToUserFolder } = require('../utils/fileUtils');
    // Run all NAS moves concurrently — sequential for-loop was the main cause of slow
    // background finalization when uploading many files at once.
    const MAX_CONCURRENT = 8; // conservative to avoid hammering the NAS SMB share
    const validLinks = assignmentLinks.filter(l => l.tempPath && l.fileId);

    const moveOne = async (link) => {
        try {
            const movedPath = await moveToUserFolder(
                link.tempPath,
                user.username,
                link.originalName,
                link.fileData.folder_name || null,
                link.fileData.relative_path || null,
                null   // no taskPrefix
            );
            const relativeToUploads = movedPath.startsWith(uploadsDir)
                ? movedPath.substring(uploadsDir.length).replace(/\\/g, '/')
                : movedPath;
            const finalFilePath = `/uploads${relativeToUploads.startsWith('/') ? '' : '/'}${relativeToUploads}`;
            await query('UPDATE files SET file_path = ? WHERE id = ?', [finalFilePath, link.fileId]);
        } catch (err) {
            logError(err, { context: 'bulkUploadMoveToNas-item', fileId: link.fileId, filename: link.originalName });
        }
    };

    const executing = new Set();
    for (const link of validLinks) {
        const p = moveOne(link);
        executing.add(p);
        p.finally(() => executing.delete(p));
        if (executing.size >= MAX_CONCURRENT) await Promise.race(executing);
    }
    await Promise.all(executing);
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

    if (teamLeader.role !== 'ADMIN') {
        const isLeader = await queryOne(
            'SELECT 1 FROM team_leaders tl JOIN teams t ON tl.team_id = t.id WHERE tl.user_id = ? AND t.name = ?',
            [teamLeader.id, file.user_team]
        );
        if (!isLeader) {
            throw new ValidationError('You can only approve files from your team');
        }
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

    // Look up the assignment_id so the notification click routes to Tasks tab, not My Files
    let fileAssignmentIdTL = null;
    try {
        const subRow = await queryOne(
            'SELECT assignment_id FROM assignment_submissions WHERE file_id = ? LIMIT 1',
            [fileId]
        );
        fileAssignmentIdTL = subRow ? subRow.assignment_id : null;
    } catch (_) {}

    await notificationService.createNotification(
        file.user_id || file.uploaded_by_id, isAttachment ? null : fileId, 'approval', 'File Approved by Team Leader',
        `Your file "${file.original_name}" has been approved by ${teamLeader.username} and is now pending admin review.`,
        teamLeader.id, teamLeader.username, teamLeader.role,
        fileAssignmentIdTL
    );

    await notificationService.createAdminNotification(
        fileId, 'team_leader_approved', 'File Approved by Team Leader',
        `${teamLeader.username} approved file "${file.original_name}" (Team: ${file.user_team || teamLeader.team}). Pending final review.`,
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

    if (teamLeader.role !== 'ADMIN') {
        const isLeader = await queryOne(
            'SELECT 1 FROM team_leaders tl JOIN teams t ON tl.team_id = t.id WHERE tl.user_id = ? AND t.name = ?',
            [teamLeader.id, file.user_team]
        );
        if (!isLeader) {
            throw new ValidationError('You can only reject files from your team');
        }
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

    // Look up the assignment_id so the notification click routes to Tasks tab, not My Files
    let fileAssignmentId = null;
    try {
        const subRow = await queryOne(
            'SELECT assignment_id FROM assignment_submissions WHERE file_id = ? LIMIT 1',
            [fileId]
        );
        fileAssignmentId = subRow ? subRow.assignment_id : null;
    } catch (_) {}

    await notificationService.createNotification(
        file.user_id || file.uploaded_by_id, isAttachment ? null : fileId, 'rejection', 'File Rejected by Team Leader',
        `Your file "${file.original_name}" has been rejected by ${teamLeader.username}. Reason: ${reason}`,
        teamLeader.id, teamLeader.username, teamLeader.role,
        fileAssignmentId
    );

    // CRITICAL: We should NOT call createAdminNotification here unless explicitly needed,
    // but if we do, it must be for REJECTION, not approval.
    // For now, keeping it consistent with approveByTeamLeader but with correct labels.
    await notificationService.createAdminNotification(
        fileId, 'team_leader_rejected', 'File Rejected by Team Leader',
        `${teamLeader.username} rejected file "${file.original_name}" (Team: ${file.user_team || teamLeader.team}). Reason: ${reason}`,
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

    // Look up the assignment_id so the notification click routes to Tasks tab, not My Files
    let fileAssignmentIdAdmin = null;
    try {
        const subRow = await queryOne(
            'SELECT assignment_id FROM assignment_submissions WHERE file_id = ? LIMIT 1',
            [fileId]
        );
        fileAssignmentIdAdmin = subRow ? subRow.assignment_id : null;
    } catch (_) {}

    await notificationService.createNotification(
        targetFile.user_id || targetFile.uploaded_by_id,
        isAttachment ? null : fileId, 'approval', 'File Final Approved',
        `Your file "${targetFile.original_name}" has received final approval from the administrator and is now published.`,
        admin.id, admin.username, admin.role,
        fileAssignmentIdAdmin
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

    // Look up the assignment_id so the notification click routes to Tasks tab, not My Files
    let fileAssignmentIdAdmin = null;
    try {
        const subRow = await queryOne(
            'SELECT assignment_id FROM assignment_submissions WHERE file_id = ? LIMIT 1',
            [fileId]
        );
        fileAssignmentIdAdmin = subRow ? subRow.assignment_id : null;
    } catch (_) {}

    await notificationService.createNotification(
        targetFile.user_id || targetFile.uploaded_by_id,
        isAttachment ? null : fileId, 'rejection', 'File Rejected by Admin',
        `Your file "${targetFile.original_name}" has been rejected by the administrator. Reason: ${reason}`,
        admin.id, admin.username, admin.role,
        fileAssignmentIdAdmin
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
    let file = await fileRepository.findById(fileId);
    if (!file) {
        file = await fileRepository.findAttachmentById(fileId);
    }
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
    // Use namespaced keys to avoid ID collisions between the two separate tables
    const fileKeys = new Set(files.map(f => `file:${f.id}`));
    const uniqueAttachments = attachments.filter(a => !fileKeys.has(`attachment:${a.id}`));
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
 * NOTE: PowerShell Compress-Archive cannot handle non-ASCII characters in the
 * *path* of the zip file itself (it will create a corrupt/empty archive).
 * We therefore use a plain ASCII temp name on disk and let the HTTP layer set
 * the correct Unicode filename via Content-Disposition.
 */
async function zipFolder(fileIds, folderName) {
    const safeId = `kmti-${Date.now()}`; // ASCII-only — safe for PowerShell paths
    const tmpDir  = path.join(os.tmpdir(), safeId);
    const zipPath = path.join(os.tmpdir(), `${safeId}.zip`);

    await fs.mkdir(tmpDir, { recursive: true });

    let copiedCount = 0;
    const failedFiles = [];

    for (const fileId of fileIds) {
        // zipFolder must handle both regular files and attachments
        const regularFile = await fileRepository.findById(fileId);
        const file = regularFile || await fileRepository.findAttachmentById(fileId);
        if (!file) {
            failedFiles.push({ id: fileId, reason: 'Not found in DB' });
            continue;
        }

        const resolved = await resolvePhysicalPath(fileId);
        if (!resolved.path) {
            failedFiles.push({ id: fileId, name: file.original_name, reason: 'Path could not be resolved' });
            continue;
        }

        // Verify the physical file actually exists on disk before trying to copy
        try { await fs.access(resolved.path); } catch (_) {
            failedFiles.push({ id: fileId, name: file.original_name, reason: `File not on disk: ${resolved.path}` });
            continue;
        }

        const relPath = file.relative_path
            ? file.relative_path.replace(/\\/g, '/').split('/').slice(1).join('/')
            : file.original_name;
        const destFile = path.join(tmpDir, relPath || file.original_name);
        await fs.mkdir(path.dirname(destFile), { recursive: true });
        try {
            await fs.copyFile(resolved.path, destFile);
            copiedCount++;
        } catch (copyErr) {
            failedFiles.push({ id: fileId, name: file.original_name, reason: `Copy failed: ${copyErr.message}` });
        }
    }

    if (failedFiles.length > 0) {
        logWarn('zipFolder: some files could not be included', { folderName, copiedCount, failed: failedFiles });
    }

    if (copiedCount === 0) {
        // Clean up empty tmp dir and throw — no point sending a corrupt zip
        try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch (_) {}
        const { ValidationError } = require('../middleware/errorHandler');
        throw new ValidationError(
            `None of the ${fileIds.length} file(s) in "${folderName}" could be found on disk. ` +
            `Details: ${failedFiles.map(f => `${f.name || f.id}: ${f.reason}`).join('; ')}`
        );
    }

    // Use ASCII-only paths for PowerShell — non-ASCII characters in the path
    // cause Compress-Archive to silently produce a corrupt/empty archive.
    const cmd = `powershell -NoProfile -Command "Compress-Archive -Path '${tmpDir}\\*' -DestinationPath '${zipPath}' -Force"`;
    await new Promise((resolve, reject) => {
        exec(cmd, (err, stdout, stderr) => {
            if (err) {
                logError(err, { context: 'zipFolder-compress', stderr, folderName });
                reject(new Error(`Compress-Archive failed: ${stderr || err.message}`));
            } else {
                resolve();
            }
        });
    });

    return { zipPath, tmpDir, folderName };
}

/**
 * Resolve the physical path for a file or team leader attachment.
 * Team leader attachments: NAS/teamleader/<username>/...
 * Regular user files:      NAS/uploads/<username>/...
 *
 * Handles stale OS temp paths in DB (caused by a previously failed NAS move)
 * by reconstructing the correct NAS path from stored metadata fields.
 */
async function resolvePhysicalPath(fileId, requestedType = null, folderName = null) {
    const cacheKey = `${requestedType || 'auto'}_${fileId}_${folderName || 'none'}`;
    
    // ── Trust Cache ──────────────────────────────────────────────────────────
    const cached = physicalPathCache.get(cacheKey);
    if (cached && (Date.now() - (cached.timestamp || 0) < CACHE_TTL_MS)) {
        return cached;
    }

    const { networkDataPath } = require('../config/database');
    const { uploadsDir } = require('../config/middleware');
    
    // Correct teamleader base directory is inside the 'data' folder on the NAS
    const teamleaderDir = path.join(networkDataPath, 'teamleader');
    
    logInfo('Resolving path for file', { fileId, requestedType, folderName });

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
        let finalPath = p;
        // If folderName is provided, we want to open the parent folder, not the file itself.
        if (folderName && folderName !== 'Folder Path') {
            const parts = p.split(path.sep);
            // Search for the folder name in the resolved path to get the exact directory
            const folderIdx = parts.lastIndexOf(folderName);
            if (folderIdx !== -1) {
                finalPath = parts.slice(0, folderIdx + 1).join(path.sep);
            } else {
                finalPath = path.dirname(p);
            }
        }
        const res = { path: finalPath, originalName: file.original_name, mimeType: file.file_type, timestamp: Date.now() };
        physicalPathCache.set(cacheKey, res);
        return res;
    };

    // Helper: true if path exists on disk
    const diskExists = async (p) => { try { if (!p) return false; await fs.access(p); return true; } catch (_) { return false; } };

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

    // ── Priority 2: absolute Windows/UNC path — includes valid temp paths ──────
    if (file.file_path && !file.file_path.startsWith('/uploads/') &&
        (file.file_path.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(file.file_path))) {
        if (await diskExists(file.file_path)) {
            return returnAndCache(file.file_path);
        } else {
            // Smart healing heuristic for folder prefix mismatches and extension subfolders on NAS
            try {
                const parentDir = path.dirname(file.file_path);
                const grandparentDir = path.dirname(parentDir);
                const fileName = path.basename(file.file_path);
                const folderName = path.basename(parentDir);

                if (await diskExists(grandparentDir)) {
                    const cleanFolder = folderName.replace(/^\d+_/, '').toLowerCase();
                    const entries = await fs.readdir(grandparentDir, { withFileTypes: true });
                    
                    let matchedDir = null;
                    for (const entry of entries) {
                        if (entry.isDirectory()) {
                            const entryName = entry.name;
                            const cleanEntry = entryName.replace(/^\d+_/, '').toLowerCase();
                            
                            if (entryName.toLowerCase() === folderName.toLowerCase() ||
                                cleanEntry === cleanFolder ||
                                entryName.toLowerCase() === cleanFolder ||
                                cleanEntry === folderName.toLowerCase()) {
                                matchedDir = path.join(grandparentDir, entryName);
                                break;
                            }
                        }
                    }

                    if (matchedDir) {
                        // Check if file exists directly under matchedDir
                        const directCandidate = path.join(matchedDir, fileName);
                        if (await diskExists(directCandidate)) {
                            return returnAndCache(directCandidate);
                        }
                        
                        // Otherwise, do a recursive scan up to depth 3 inside matchedDir (e.g. for DWG/PDF/ICAD subdirs)
                        const scanDir = async (dir, depth = 0) => {
                            if (depth > 3) return null;
                            try {
                                const subEntries = await fs.readdir(dir, { withFileTypes: true });
                                for (const subEntry of subEntries) {
                                    const subPath = path.join(dir, subEntry.name);
                                    if (subEntry.isDirectory()) {
                                        const found = await scanDir(subPath, depth + 1);
                                        if (found) return found;
                                    } else if (subEntry.name.toLowerCase() === fileName.toLowerCase()) {
                                        return subPath;
                                    }
                                }
                            } catch (_) {}
                            return null;
                        };
                        const deepWinner = await scanDir(matchedDir);
                        if (deepWinner) return returnAndCache(deepWinner);
                    }
                }
            } catch (e) {
                logWarn('Smart path healing failed', { error: e.message });
            }
        }
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
            // Priority: provided folderName in teamleader
            folderName && folderName !== 'Folder Path' ? path.join(userDir, folderName) : null,
            folderName && folderName !== 'Folder Path' && taskDir ? path.join(taskDir, folderName) : null,

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

        // ── Deep scan: search entire teamleader NAS directory for old attachments ──
        if (file.original_name) {
            try {
                const deepScan = async (dir, depth = 0) => {
                    if (depth > 4) return null;
                    let entries;
                    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch (_) { return null; }
                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry.name);
                        if (entry.isDirectory()) {
                            if (folderName && entry.name === folderName) return fullPath;
                            const found = await deepScan(fullPath, depth + 1);
                            if (found) return found;
                        } else if (entry.name === file.original_name || entry.name === path.basename(file.file_path || '')) {
                            return fullPath;
                        }
                    }
                    return null;
                };
                const deepWinner = await deepScan(path.join(teamleaderDir, u));
                if (deepWinner) return returnAndCache(deepWinner);
            } catch (e) {
                logWarn('Deep scan failed for attachment', { error: e.message });
            }
        }
    }

    // ── Priority 5: reconstruct uploads NAS path for regular files ───────────
    if (!isAttachment && file.username) {
        const u = file.username;
        const userDir = path.join(uploadsDir, u);
        const rel = file.relative_path ? file.relative_path.replace(/\/+/g, path.sep) : null;

        const candidates = [
            // Priority: provided folderName in uploads
            folderName && folderName !== 'Folder Path' ? path.join(userDir, folderName) : null,

            // Try uploads directory (Primary for regular files)
            rel ? path.join(userDir, rel) : null,
            file.file_path && !isTempPath(file.file_path) ? path.join(userDir, path.basename(file.file_path)) : null,
            file.original_name ? path.join(userDir, file.original_name) : null,

            // Fallback: teamleader directory (some files might have been moved or uploaded there)
            rel ? path.join(teamleaderDir, u, rel) : null,
            file.original_name ? path.join(teamleaderDir, u, file.original_name) : null
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

        // ── Deep scan: search entire user NAS directory for the file by name ────
        // Handles old files whose DB path is stale (moved, renamed folder, etc.)
        if (file.original_name) {
            try {
                const deepScan = async (dir, depth = 0) => {
                    if (depth > 4) return null;
                    let entries;
                    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch (_) { return null; }
                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry.name);
                        if (entry.isDirectory()) {
                            // If looking for a folder, check folder name match first
                            if (folderName && entry.name === folderName) return fullPath;
                            const found = await deepScan(fullPath, depth + 1);
                            if (found) return found;
                        } else if (entry.name === file.original_name || entry.name === path.basename(file.file_path || '')) {
                            return fullPath;
                        }
                    }
                    return null;
                };
                const deepWinner = await deepScan(userDir);
                if (deepWinner) return returnAndCache(deepWinner);
            } catch (e) {
                logWarn('Deep scan failed for regular file', { error: e.message });
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
    const nowSql = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // ── Phase 1: Update DB status immediately so UI reflects approval at once ──
    for (const file of dbFiles) {
        if (!file) continue;
        // Compute the expected NAS path for this file (used as public_network_url)
        let nasFilePath;
        if (file.relative_path) {
            const relParts = file.relative_path.replace(/\\/g, '/').split('/');
            const relativeInFolder = relParts.slice(1).join('/');
            nasFilePath = relativeInFolder ? path.join(destFolderPath, relativeInFolder) : path.join(destFolderPath, file.original_name);
        } else {
            nasFilePath = path.join(destFolderPath, file.original_name);
        }

        if (file.source_type === 'assignment_attachment') {
            await query(
                `UPDATE assignment_attachments SET status='final_approved', current_stage='published_to_public',
                    admin_reviewed_at=?, admin_comments=?, public_network_url=?, final_approved_at=? WHERE id=?`,
                [nowSql, comments || null, nasFilePath, nowSql, file.id]
            ).catch(err => logError(err, { context: 'moveFolderToNas-attachment-update' }));
        } else {
            await query(
                `UPDATE files SET status='final_approved', current_stage='published_to_public',
                    admin_id=?, admin_username=?, admin_reviewed_at=?, admin_comments=?,
                    public_network_url=?, final_approved_at=? WHERE id=?`,
                [admin.id, admin.username, nowSql, comments || null, nasFilePath, nowSql, file.id]
            );
            // NOTE: file_path is intentionally NOT updated — the original uploads path
            // must remain intact so the user can still see and download their file.
            logFileStatusChange(db, file.id, file.status, 'final_approved', file.current_stage, 'published_to_public',
                admin.id, admin.username, admin.role, `Folder approved & moved to NAS: ${comments || 'No comments'}`);
        }
    }

    // ── Phase 2: Send notifications immediately ────────────────────────────────
    const userFileMap = {};
    for (const file of dbFiles) {
        const uid = String(file.user_id);
        if (!userFileMap[uid]) userFileMap[uid] = [];
        userFileMap[uid].push(file);
    }
    for (const [userId, files] of Object.entries(userFileMap)) {
        const count = files.length;
        let folderAssignmentId = null;
        try {
            const anyFile = files.find(f => f.source_type !== 'assignment_attachment');
            if (anyFile) {
                const sub = await queryOne(
                    'SELECT assignment_id FROM assignment_submissions WHERE file_id = ? LIMIT 1',
                    [anyFile.id]
                );
                folderAssignmentId = sub ? sub.assignment_id : null;
            }
        } catch (_) {}
        notificationService.createNotification(
            userId, null, 'final_approval', `Folder Approved: "${folderName}"`,
            `All ${count} file${count !== 1 ? 's' : ''} in your folder "${folderName}" have been approved and saved to the NAS.`,
            admin.id, admin.username, admin.role, folderAssignmentId
        ).catch(() => {});
    }

    logActivity(db, admin.id, admin.username, admin.role, admin.team,
        `Folder approved & moved to NAS: ${folderName} (${fileIds.length} files) -> ${destFolderPath}`);

    // ── Phase 3: Copy files to NAS in the background (non-blocking) ───────────
    // The client already got its response — NAS I/O happens after.
    setImmediate(async () => {
        try {
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
                    const copyDir = async (src, dest) => {
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
                    };
                    await copyDir(sourceFolderPath, destFolderPath);
                    // DO NOT delete source — user files must remain accessible after admin approval
                    logInfo('Folder copied to NAS in background (source kept intact)', { destFolderPath });
                } else {
                    logInfo('Source folder not found — falling back to file-by-file copy in background', { sourceFolderPath: path.join(uploadsDir, username, folderName) });
                }
            }

            // File-by-file fallback if folder copy wasn't possible
            if (!sourceExists || isAttachmentFolder) {
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
                            await streamCopy(srcFilePath, nasFilePath);
                            logInfo('Copied file to NAS in background (source kept intact)', { nasFilePath });
                        }
                    } else {
                        logInfo('Background NAS copy: source file not found', { srcFilePath });
                    }
                }
            }
        } catch (err) {
            logError(err, { context: 'moveFolderToNas-background-copy', folderName });
        }
    });

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
    bulkUploadFast,
    bulkUploadMoveToNas,
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
    resolveBulkPhysicalPaths,
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
