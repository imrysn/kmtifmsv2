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
 * @param {Object} data - Assignment and members data
 * @param {Array} attachments - Array of uploaded files
 * @param {Object} user - User creating the assignment (Team Leader or Admin)
 * @returns {Promise<Object>} - Created assignment with members
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

    // 2. Handle attachments
    if (attachments && attachments.length > 0) {
        for (const file of attachments) {
            await fileRepository.createAttachment({
                assignment_id: assignmentId,
                file_path: file.path,
                original_name: fixFilename(file.originalname),
                filename: file.filename,
                file_size: file.size,
                file_type: file.mimetype,
                uploaded_by_username: user.username,
                folder_name: data.folderName || 'Default'
            });
        }
    }

    let membersAdded = 0;
    const finalMembers = Array.isArray(assignedMembers) ? assignedMembers : JSON.parse(assignedMembers || '[]');

    // 3. Handle member assignment
    if (assigned_to === 'all') {
        const teamMembers = await db.all('SELECT id FROM users WHERE team = ? AND role = "USER"', [team || user.team]);
        if (teamMembers.length > 0) {
            const userIds = teamMembers.map(m => m.id);
            membersAdded = await assignmentRepository.createMembers(assignmentId, userIds);
            for (const uid of userIds) {
                await notificationService.createNotification({
                    user_id: uid,
                    type: 'assignment',
                    title: 'New Assignment',
                    message: `${user.username} assigned a new task: "${title}"`,
                    assignment_id: assignmentId
                });
            }
        }
    } else if (finalMembers.length > 0) {
        membersAdded = await assignmentRepository.createMembers(assignmentId, finalMembers);
        for (const uid of finalMembers) {
            await notificationService.createNotification({
                user_id: uid,
                type: 'assignment',
                title: 'New Assignment',
                message: `${user.username} assigned a new task: "${title}"`,
                assignment_id: assignmentId
            });
        }
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
    delete updates.assignedMembers; // Handle members separately if needed
    delete updates.attachments;

    await assignmentRepository.update(id, updates);

    // Handle new attachments
    if (attachments && attachments.length > 0) {
        for (const file of attachments) {
            await fileRepository.createAttachment({
                assignment_id: id,
                file_path: file.path,
                original_name: fixFilename(file.originalname),
                filename: file.filename,
                file_size: file.size,
                file_type: file.mimetype,
                uploaded_by_username: user.username,
                folder_name: data.folderName || 'Default'
            });
        }
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
    
    // For now, reuse findAllWithDetails but we might need a specific TL view if filtering by multiple teams
    // Simple approach: Fetch for each team or update repository to support array of teams
    
    const allAssignments = [];
    for (const team of teams) {
        const result = await assignmentRepository.findAllWithDetails({ team });
        allAssignments.push(...result.assignments);
    }
    
    return { assignments: allAssignments.sort((a, b) => b.id - a.id) };
}

/**
 * Get all submissions for team leader view
 */
async function getAllSubmissionsForTL(userId) {
    const teams = await assignmentRepository.findLedTeams(userId);
    if (teams.length === 0) return { submissions: [] };
    
        // 1. Get submissions from team members
    const memberSubmissions = await assignmentRepository.findTeamSubmissions(teams);
    
    // 2. Get files uploaded directly by the Team Leader
    const tlFiles = await fileRepository.findByUserId(userId);
    
    // 3. Get TL attachment files
    const tlAttachments = await fileRepository.findAllAttachmentsWithDetails({ userId });

    // Merge and avoid duplicates
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
 * Submit an assignment
 */
async function submitAssignment(assignmentId, fileId, user) {
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) throw new NotFoundError('Assignment');

    const file = await fileRepository.findById(fileId);
    if (!file) throw new NotFoundError('File');

    // Link file to assignment
    await db.run(
        'INSERT INTO assignment_submissions (assignment_id, user_id, file_id, submitted_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        [assignmentId, user.id, fileId]
    );

    // Update member status
    await assignmentRepository.updateMemberStatus(assignmentId, user.id, 'submitted');

    // Batch Notification Logic
    const batchKey = `${user.id}_${assignmentId}`;
    if (!pendingBatchSubmissions.has(batchKey)) {
        pendingBatchSubmissions.set(batchKey, []);
        
        // Schedule notification dispatch after 5 seconds
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

    logActivity(db, user.id, user.username, user.role, user.team, `Submitted file ${file.original_name} for assignment: ${assignment.title}`);

    return true;
}

/**
 * Get comments for an assignment (with nested replies)
 */
async function getComments(assignmentId) {
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) throw new NotFoundError('Assignment');

    // Fetch all rows - both top-level comments and replies
    const rows = await assignmentRepository.getComments(assignmentId);

    // Build nested structure: top-level comments with replies[] array
    const topLevel = rows.filter(r => !r.parent_id);
    const replies  = rows.filter(r => !!r.parent_id);

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
    
    // Notifications
    const user = await db.get('SELECT username, fullName, role, team FROM users WHERE id = ?', [userId]);
    if (user) {
        // Notify Team Leader
        if (assignment.team_leader_id !== userId) {
            await notificationService.createNotification({
                user_id: assignment.team_leader_id,
                type: 'comment',
                title: 'New Comment on Assignment',
                message: `${user.username} commented on "${assignment.title}"`,
                assignment_id: assignmentId
            });
        }
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
    if (user) {
        // Notify Team Leader
        if (assignment.team_leader_id !== userId) {
            await notificationService.createNotification({
                user_id: assignment.team_leader_id,
                type: 'comment',
                title: 'New Reply on Assignment',
                message: `${user.username} replied to a comment on "${assignment.title}"`,
                assignment_id: assignmentId
            });
        }
    }
    
    return reply;
}

/**
 * Mark assignment as done
 */
async function markAssignmentDone(assignmentId, user) {
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) throw new NotFoundError('Assignment');

    await assignmentRepository.update(assignmentId, { status: 'completed' });

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
    submitAssignment,
    markAssignmentDone,
    addComment,
    addReply,
    getComments,
    deleteAttachment,
    deleteAttachmentFolder,
        getAssignmentById: async (id) => {
        const result = await assignmentRepository.findAllWithDetails({ cursor: parseInt(id) + 1, limit: 1 });
        const assignment = result.assignments.find(a => a.id == id);
        if (!assignment) throw new NotFoundError('Assignment');
        return assignment;
    },

    deleteAssignment: async (id, user) => {
        const assignment = await assignmentRepository.findById(id);
        if (!assignment) throw new NotFoundError('Assignment');
        if (assignment.team_leader_id !== user.id && user.role !== 'ADMIN') throw new ValidationError('Permission denied');
        return await assignmentRepository.deleteById(id);
    },
    getUserAssignments: async (userId, options = {}) => await assignmentRepository.findByUserId(userId, options)
};
