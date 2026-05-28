const assignmentRepository = require('../repositories/assignmentRepository');
const fileRepository = require('../repositories/fileRepository');
const notificationService = require('./notificationService');
const { logActivity, logInfo, logError } = require('../utils/logger');
const { db } = require('../config/database');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const fs = require('fs').promises;
const path = require('path');
const { uploadsDir } = require('../config/middleware');

// Batch submission tracker to group multiple file submissions into single notification
const pendingBatchSubmissions = new Map();

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
 * Create a grouped notification for multiple submissions
 */
async function createBatchedSubmissionNotification(teamLeaderId, assignmentId, submissions) {
    if (!submissions || submissions.length === 0) return;

    const firstSub = submissions[0];
    const userFullName = firstSub.userFullName;
    const assignmentTitle = firstSub.assignmentTitle;

    let message;
    if (submissions.length === 1) {
        message = `${userFullName} submitted "${firstSub.fileName}" for "${assignmentTitle}"`;
    } else {
        message = `${userFullName} submitted ${submissions.length} files for "${assignmentTitle}"`;
    }

    await notificationService.createNotification({
        user_id: teamLeaderId,
        assignment_id: assignmentId,
        type: 'assignment_submission',
        title: 'New Assignment Submission',
        message,
        is_read: 0,
        action_by_id: firstSub.userId,
        action_by_username: firstSub.username,
        action_by_role: firstSub.role
    });
}

/**
 * Create a new assignment
 */
async function createAssignment(data, attachments, user) {
    const {
        title, description, due_date, file_type_required,
        assigned_to, assignedMembers, team
    } = data;

    logInfo('Creating assignment', { title, teamLeaderId: user.id });

    // 1. Create assignment record
    const assignmentId = await assignmentRepository.create({
        title,
        description,
        due_date,
        file_type_required,
        assigned_to,
        team_leader_id: user.id,
        team_leader_username: user.username,
        team: team || user.team,
        status: 'active'
    });

    // Provision task project folder on NAS (non-blocking)
    setImmediate(async () => {
        try {
            const { projectsDataPath } = require('../config/database');
            const { sanitizeFilename } = require('../utils/fileUtils');
            const safeTitle = sanitizeFilename(title) || 'untitled_task';
            const taskFolderPath = path.join(projectsDataPath, user.username, safeTitle);
            await fs.mkdir(taskFolderPath, { recursive: true });
            logInfo('Task project folder provisioned on NAS', { taskFolderPath, assignmentId });
            // Persist the resolved path in the DB for fast lookups
            await db.run(
                'UPDATE assignments SET project_folder_path = ? WHERE id = ?',
                [taskFolderPath, assignmentId]
            );
        } catch (err) {
            logError(err, { context: 'createAssignment-provisionFolder', assignmentId });
        }
    });

    // 2. Handle attachments — move to NAS in parallel, then batch insert
    if (attachments && attachments.length > 0) {
        let relativePaths = [];
        try { relativePaths = JSON.parse(data.relativePaths || '[]'); } catch (_) {}

        const { moveToUserFolder } = require('../utils/fileUtils');
        const CONCURRENCY = 12;

        // Pre-compute metadata for each file
        const meta = attachments.map((file, i) => {
            const relativePath = relativePaths[i] || file.originalname;
            const pathParts = relativePath.split('/');
            return {
                relativePath,
                folderName: pathParts.length > 1 ? pathParts[0] : null,
                originalName: fixFilename(file.originalname)
            };
        });

        // Move files from local temp → NAS in parallel batches of CONCURRENCY
        const movedPaths = new Array(attachments.length).fill(null);
        for (let i = 0; i < attachments.length; i += CONCURRENCY) {
            const batch = attachments.slice(i, i + CONCURRENCY);
            const results = await Promise.allSettled(batch.map(async (file, j) => {
                const idx = i + j;
                const m = meta[idx];
                const moved = await moveToUserFolder(
                    file.path,
                    user.username,
                    m.originalName,
                    m.folderName,
                    m.relativePath,
                    null,
                    true  // isTeamLeaderAttachment → teamleader/<user>/...
                );
                movedPaths[idx] = moved;
            }));
            results.forEach((r, j) => {
                if (r.status === 'rejected')
                    logError(r.reason, { context: 'createAssignment-moveFile', idx: i + j });
            });
        }

        const attachmentsData = attachments.map((file, i) => ({
            assignment_id: assignmentId,
            file_path: movedPaths[i] || file.path,   // permanent NAS path (or local fallback)
            original_name: meta[i].originalName,
            filename: file.filename,
            file_size: file.size,
            file_type: file.mimetype,
            uploaded_by_id: user.id,
            uploaded_by_username: user.username,
            folder_name: meta[i].folderName,
            relative_path: meta[i].relativePath
        }));
        await fileRepository.createAttachmentBatch(attachmentsData);
    }

    let membersAdded = 0;
    const finalMembers = Array.isArray(assignedMembers) ? assignedMembers : JSON.parse(assignedMembers || '[]');

    // 3. Handle member assignment
    if (assigned_to === 'all') {
        const teamMembers = await db.all('SELECT id FROM users WHERE team = ? AND role = "USER"', [team || user.team]);
        if (teamMembers.length > 0) {
            const userIds = teamMembers.map(m => m.id);
            membersAdded = await assignmentRepository.createMembers(assignmentId, userIds);
            await Promise.all(userIds.map(uid => notificationService.createNotification({
                user_id: uid,
                type: 'assignment',
                title: 'New Assignment',
                message: `${user.username} assigned a new task: "${title}"`,
                assignment_id: assignmentId
            })));
        }
    } else if (finalMembers.length > 0) {
        membersAdded = await assignmentRepository.createMembers(assignmentId, finalMembers);
        await Promise.all(finalMembers.map(uid => notificationService.createNotification({
            user_id: uid,
            type: 'assignment',
            title: 'New Assignment',
            message: `${user.username} assigned a new task: "${title}"`,
            assignment_id: assignmentId
        })));
    }

    logActivity(db, user.id, user.username, user.role, team || user.team, `Created assignment: ${title}`);

    return { assignmentId, membersAdded };
}

/**
 * Update an existing assignment
 */
async function updateAssignment(id, data, attachments, user) {
    const assignment = await assignmentRepository.findById(id);
    if (!assignment) throw new NotFoundError('Assignment');

    const updates = { ...data };
    delete updates.assignedMembers;
    delete updates.attachments;

    await assignmentRepository.update(id, updates);

    if (attachments && attachments.length > 0) {
        let relativePaths = [];
        try { relativePaths = JSON.parse(data.relativePaths || '[]'); } catch (_) {}

        const { moveToUserFolder } = require('../utils/fileUtils');
        const CONCURRENCY = 12;

        const meta = attachments.map((file, i) => {
            const relativePath = relativePaths[i] || file.originalname;
            const pathParts = relativePath.split('/');
            return {
                relativePath,
                folderName: pathParts.length > 1 ? pathParts[0] : null,
                originalName: fixFilename(file.originalname)
            };
        });

        // Move files from local temp → NAS in parallel batches
        const movedPaths = new Array(attachments.length).fill(null);
        for (let i = 0; i < attachments.length; i += CONCURRENCY) {
            const batch = attachments.slice(i, i + CONCURRENCY);
            const results = await Promise.allSettled(batch.map(async (file, j) => {
                const idx = i + j;
                const m = meta[idx];
                const moved = await moveToUserFolder(
                    file.path,
                    user.username,
                    m.originalName,
                    m.folderName,
                    m.relativePath,
                    null,
                    true
                );
                movedPaths[idx] = moved;
            }));
            results.forEach((r, j) => {
                if (r.status === 'rejected')
                    logError(r.reason, { context: 'updateAssignment-moveFile', idx: i + j });
            });
        }

        const attachmentsData = attachments.map((file, i) => ({
            assignment_id: id,
            file_path: movedPaths[i] || file.path,
            original_name: meta[i].originalName,
            filename: file.filename,
            file_size: file.size,
            file_type: file.mimetype,
            uploaded_by_id: user.id,
            uploaded_by_username: user.username,
            folder_name: meta[i].folderName,
            relative_path: meta[i].relativePath
        }));
        await fileRepository.createAttachmentBatch(attachmentsData);
    }

    logActivity(db, user.id, user.username, user.role, user.team, `Updated assignment: ${assignment.title}`);
    return true;
}

/**
 * Get assignments for admin view (all)
 */
async function getAllAssignments(options = {}) {
    return await assignmentRepository.findAllWithDetails(options);
}

/**
 * Get assignments for team view
 */
async function getTeamAssignments(team, options = {}) {
    return await assignmentRepository.findAllWithDetails({ ...options, team });
}

/**
 * Get assignments for team leader
 */
async function getTeamLeaderAssignments(userId) {
    const teams = await assignmentRepository.findLedTeams(userId);
    if (teams.length === 0) return { assignments: [] };

    // Fetch all assignments for all led teams in a single query (fixes N+1)
    const result = await assignmentRepository.findAllWithDetails({ team: teams });

    return { assignments: result.assignments };
}

/**
 * Get all submissions for team leader view
 */
async function getAllSubmissionsForTL(userId) {
    const teams = await assignmentRepository.findLedTeams(userId);
    if (teams.length === 0) return { submissions: [] };

    const memberSubmissions = await assignmentRepository.findTeamSubmissions(teams);
    const tlFiles = await fileRepository.findByUserId(userId);
    const tlAttachments = await fileRepository.findAllAttachmentsWithDetails({ userId });

    const memberFileIds = new Set(memberSubmissions.map(f => String(f.id)));
    const uniqueTLFiles = tlFiles.filter(f => !memberFileIds.has(String(f.id)));
    const allExistingIds = new Set([...memberFileIds, ...uniqueTLFiles.map(f => String(f.id))]);
    const uniqueAttachments = tlAttachments.filter(f => !allExistingIds.has(String(f.id)));

    const allSubmissions = [...memberSubmissions, ...uniqueTLFiles, ...uniqueAttachments].sort((a, b) =>
        new Date(b.submitted_at || b.uploaded_at) - new Date(a.submitted_at || a.uploaded_at)
    );

    return { submissions: allSubmissions };
}

/**
 * Get assignment by ID
 * FIX: Was a cursor hack (findAllWithDetails({ cursor: id+1, limit:1 })) that
 *      produced false 404s. Now uses the correct direct lookup via findById,
 *      then enriches with full details via findAllWithDetails only when found.
 */
async function getAssignmentById(id, user) {
    const assignment = await assignmentRepository.findByIdWithDetails(id);
    if (!assignment) throw new NotFoundError('Assignment');
    return assignment;
}

/**
 * Submit an assignment
 * FIX: Signature was (assignmentId, fileId, user) but controller was calling it as
 *      (id, req.user.id, finalFileIds) — arguments in wrong positions.
 *      Corrected signature: (assignmentId, fileIds, user) — accepts array of fileIds.
 */
async function submitAssignment(assignmentId, fileIds, user) {
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) throw new NotFoundError('Assignment');

    // Normalise: accept a single ID or an array
    const ids = Array.isArray(fileIds) ? fileIds : [fileIds];
    if (ids.length === 0) throw new ValidationError('At least one file ID is required');

    for (const fileId of ids) {
        const file = await fileRepository.findById(fileId);
        if (!file) throw new NotFoundError(`File ${fileId}`);

        // Link file to assignment
        await db.run(
            'INSERT INTO assignment_submissions (assignment_id, user_id, file_id, submitted_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
            [assignmentId, user.id, fileId]
        );

        // Batch notification accumulation
        const batchKey = `${user.id}_${assignmentId}`;
        if (!pendingBatchSubmissions.has(batchKey)) {
            pendingBatchSubmissions.set(batchKey, []);

            // Dispatch batched notification after 5 seconds of inactivity
            setTimeout(async () => {
                const submissions = pendingBatchSubmissions.get(batchKey);
                pendingBatchSubmissions.delete(batchKey);
                if (submissions && submissions.length > 0) {
                    await createBatchedSubmissionNotification(
                        assignment.team_leader_id,
                        assignmentId,
                        submissions
                    );
                }
            }, 5000);
        }

        pendingBatchSubmissions.get(batchKey).push({
            fileName: file.original_name,
            userFullName: user.fullName || user.username,
            assignmentTitle: assignment.title,
            userId: user.id,
            username: user.username,
            role: user.role
        });

        logActivity(db, user.id, user.username, user.role, user.team,
            `Submitted file ${file.original_name} for assignment: ${assignment.title}`);
    }

    // Update member status to submitted after all files processed
    await assignmentRepository.updateMemberStatus(assignmentId, user.id, 'submitted');

    return true;
}

/**
 * Get comments for an assignment (with nested replies)
 */
async function getComments(assignmentId) {
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) throw new NotFoundError('Assignment');

    const rows = await assignmentRepository.getComments(assignmentId);

    const topLevel = rows.filter(r => !r.parent_id);
    const replies = rows.filter(r => !!r.parent_id);

    return topLevel.map(comment => ({
        ...comment,
        replies: replies.filter(r => r.parent_id === comment.id)
    }));
}

/**
 * Add comment to assignment
 */
async function addComment(assignmentId, userId, commentText) {
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) throw new NotFoundError('Assignment');

    const comment = await assignmentRepository.addComment(assignmentId, userId, commentText);

    const user = await db.get('SELECT username, fullName, role, team FROM users WHERE id = ?', [userId]);
    if (user && assignment.team_leader_id !== userId) {
        await notificationService.createNotification({
            user_id: assignment.team_leader_id,
            type: 'comment',
            title: 'New Comment on Assignment',
            message: `${user.username} commented on "${assignment.title}"`,
            assignment_id: assignmentId
        });
    }

    return comment;
}

/**
 * Add reply to comment
 */
async function addReply(assignmentId, commentId, userId, replyText) {
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) throw new NotFoundError('Assignment');

    const reply = await assignmentRepository.addReply(assignmentId, commentId, userId, replyText);

    const user = await db.get('SELECT username, fullName, role, team FROM users WHERE id = ?', [userId]);
    if (user && assignment.team_leader_id !== userId) {
        await notificationService.createNotification({
            user_id: assignment.team_leader_id,
            type: 'comment',
            title: 'New Reply on Assignment',
            message: `${user.username} replied to a comment on "${assignment.title}"`,
            assignment_id: assignmentId
        });
    }

    return reply;
}

/**
 * Edit a comment or reply
 * FIX: Was done with raw db.run in the controller — now in the service layer
 *      via the repository, consistent with the rest of the codebase.
 */
async function editComment(commentId, commentText, user) {
    return await assignmentRepository.editComment(commentId, commentText, user.id);
}

/**
 * Delete a comment or reply (also deletes child replies)
 * FIX: Was done with raw db.run in the controller — now in the service layer.
 */
async function deleteComment(commentId, user) {
    return await assignmentRepository.deleteComment(commentId, user.id);
}

/**
 * Mark assignment as done
 * Also deletes the team leader's attachment folders from the NAS teamleader directory.
 */
async function markAssignmentDone(assignmentId, user) {
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) throw new NotFoundError('Assignment');

    // 1. Mark completed in DB
    await assignmentRepository.update(assignmentId, { status: 'completed' });

    // 2. Delete the team leader's attachment folders from NAS
    //    Path: \\KMTI-NAS\Shared\data\teamleader\<username>\<folder_name>
    setImmediate(async () => {
        try {
            const { networkDataPath } = require('../config/database');
            const teamleaderBase = path.join(networkDataPath, 'teamleader');
            const userDir = path.join(teamleaderBase, user.username);

            // Get all attachment folders for this assignment
            const attachments = await db.all(
                'SELECT DISTINCT folder_name, file_path FROM assignment_attachments WHERE assignment_id = ?',
                [assignmentId]
            );

            const deletedFolders = new Set();

            for (const att of (attachments || [])) {
                // Delete by folder_name if available
                if (att.folder_name && !deletedFolders.has(att.folder_name)) {
                    const folderPath = path.join(userDir, att.folder_name);
                    try {
                        await fs.rm(folderPath, { recursive: true, force: true });
                        deletedFolders.add(att.folder_name);
                        logInfo('Deleted TL attachment folder on mark-done', { folderPath });
                    } catch (e) {
                        logError(e, { context: 'markDone-deleteFolder', folderPath });
                    }
                }

                // Also delete by the top-level directory of the file_path
                if (att.file_path) {
                    const normalised = att.file_path.replace(/\\/g, '/');
                    // Resolve absolute path to a path under userDir and grab top segment
                    let rel = null;
                    const userDirNorm = userDir.replace(/\\/g, '/');
                    if (normalised.startsWith(userDirNorm)) {
                        rel = normalised.slice(userDirNorm.length).replace(/^\//, '');
                    }
                    if (rel) {
                        const topFolder = rel.split('/')[0];
                        if (topFolder && !deletedFolders.has(topFolder)) {
                            const folderPath = path.join(userDir, topFolder);
                            try {
                                await fs.rm(folderPath, { recursive: true, force: true });
                                deletedFolders.add(topFolder);
                                logInfo('Deleted TL attachment folder (path-derived) on mark-done', { folderPath });
                            } catch (e) {
                                logError(e, { context: 'markDone-deleteFolder-path', folderPath });
                            }
                        }
                    }
                }
            }

            if (deletedFolders.size > 0) {
                logActivity(db, user.id, user.username, user.role, user.team,
                    `Deleted ${deletedFolders.size} attachment folder(s) on mark-done: ${assignment.title}`);
            }
        } catch (err) {
            logError(err, { context: 'markAssignmentDone-folderCleanup', assignmentId });
        }
    });

    logActivity(
        db, user.id, user.username, user.role, user.team,
        `Marked assignment as completed: ${assignment.title}`
    );

    return true;
}

/**
 * Delete an attachment from an assignment
 */
async function deleteAttachment(assignmentId, attachmentId, user) {
    const fileService = require('./fileService');
    const resolved = await fileService.resolvePhysicalPath(attachmentId);

    if (resolved.path) {
        try { await fs.unlink(resolved.path); } catch (e) {}
    }

    await assignmentRepository.deleteAttachment(attachmentId);
    return true;
}

/**
 * Delete a folder of attachments from an assignment
 */
async function deleteAttachmentFolder(assignmentId, folderName, user) {
    const attachments = await db.all(
        'SELECT id FROM assignment_attachments WHERE assignment_id = ? AND folder_name = ?',
        [assignmentId, folderName]
    );

    if (!attachments || attachments.length === 0) return true;

    for (const att of attachments) {
        await deleteAttachment(assignmentId, att.id, user);
    }

    logActivity(
        db, user.id, user.username, user.role, user.team,
        `Deleted attachment folder: ${folderName} from assignment #${assignmentId}`
    );

    return true;
}

module.exports = {
    createAssignment,
    updateAssignment,
    getAllAssignments,
    getTeamAssignments,
    getTeamLeaderAssignments,
    getAllSubmissionsForTL,
    getAssignmentById,
    submitAssignment,
    markAssignmentDone,
    addComment,
    addReply,
    editComment,
    deleteComment,
    getComments,
    deleteAttachment,
    deleteAttachmentFolder,
    /**
     * Remove a submitted file from an assignment
     */
    deleteSubmissionFile: async (assignmentId, fileId, user) => {
        const assignment = await assignmentRepository.findById(assignmentId);
        if (!assignment) throw new NotFoundError('Assignment');

        await db.run(
            'DELETE FROM assignment_submissions WHERE assignment_id = ? AND file_id = ?',
            [assignmentId, fileId]
        );

        logActivity(db, user.id, user.username, user.role, user.team,
            `Removed submitted file #${fileId} from assignment: ${assignment.title}`);
        return true;
    },
    deleteAssignment: async (id, user) => {
        const assignment = await assignmentRepository.findById(id);
        if (!assignment) throw new NotFoundError('Assignment');
        if (assignment.team_leader_id !== user.id && user.role !== 'ADMIN') {
            throw new ValidationError('Permission denied');
        }
        return await assignmentRepository.deleteById(id);
    },
    getUserAssignments: async (userId, options = {}) => await assignmentRepository.findByUserId(userId, options)
};
