/**
 * Assignment Service
 * 
 * Business logic layer for assignment operations.
 * This layer is responsible for:
 * - Business rules and validation
 * - Orchestrating repository calls
 * - Handling notifications
 * - Activity logging
 */

const assignmentRepository = require('../repositories/assignmentRepository');
const { logActivity, logInfo } = require('../utils/logger');
const { db } = require('../config/database');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');

/**
 * Create a new assignment
 * @param {Object} assignmentData - Assignment data
 * @param {Object} teamLeader - Team leader creating the assignment
 * @returns {Promise<Object>} - Created assignment
 */
async function createAssignment(assignmentData, teamLeader) {
    logInfo('Creating assignment', {
        title: assignmentData.title,
        teamLeaderId: teamLeader.id
    });

    // Prepare assignment data
    const data = {
        ...assignmentData,
        team_leader_id: teamLeader.id,
        team_leader_username: teamLeader.username,
        team: teamLeader.team,
        status: 'active'
    };

    // Create assignment
    const assignmentId = await assignmentRepository.create(data);

    // Log activity
    logActivity(
        db,
        teamLeader.id,
        teamLeader.username,
        teamLeader.role,
        teamLeader.team,
        `Created assignment: ${assignmentData.title}`
    );

    // Get the created assignment
    const assignment = await assignmentRepository.findById(assignmentId);

    // If assigned to specific users, add them as members
    if (assignmentData.assigned_to && assignmentData.assigned_to !== 'all') {
        const userIds = assignmentData.assigned_to.split(',').map(id => parseInt(id.trim()));
        for (const userId of userIds) {
            await assignmentRepository.addMember(assignmentId, userId);
        }
    }

    logInfo('Assignment created successfully', { assignmentId, title: assignmentData.title });

    return assignment;
}

/**
 * Get assignment by ID
 * @param {number} assignmentId - Assignment ID
 * @param {Object} user - Authenticated user (for authorization)
 * @returns {Promise<Object>} - Assignment object with members
 */
async function getAssignmentById(assignmentId, user) {
    const assignment = await assignmentRepository.findById(assignmentId);

    if (!assignment) {
        throw new NotFoundError('Assignment');
    }

    // Authorization check
    const canView =
        user.role === 'ADMIN' ||
        assignment.team_leader_id === user.id ||
        assignment.team === user.team;

    if (!canView) {
        throw new ValidationError('You do not have permission to view this assignment');
    }

    // Get members
    const members = await assignmentRepository.getMembers(assignmentId);

    return {
        ...assignment,
        members
    };
}

/**
 * Get team assignments
 * @param {string} team - Team name
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Array of assignments
 */
async function getTeamAssignments(team, options = {}) {
    return await assignmentRepository.findByTeam(team, options);
}

/**
 * Get all assignments (admin only)
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Array of assignments
 */
async function getAllAssignments(options = {}) {
    return await assignmentRepository.findAll(options);
}

/**
 * Update assignment
 * @param {number} assignmentId - Assignment ID
 * @param {Object} updates - Updates to apply
 * @param {Object} teamLeader - Team leader updating the assignment
 * @returns {Promise<Object>} - Updated assignment
 */
async function updateAssignment(assignmentId, updates, teamLeader) {
    const assignment = await assignmentRepository.findById(assignmentId);

    if (!assignment) {
        throw new NotFoundError('Assignment');
    }

    // Validate team leader owns this assignment
    if (assignment.team_leader_id !== teamLeader.id && teamLeader.role !== 'ADMIN') {
        throw new ValidationError('You can only update your own assignments');
    }

    // Update assignment
    await assignmentRepository.update(assignmentId, updates);

    // Log activity
    logActivity(
        db,
        teamLeader.id,
        teamLeader.username,
        teamLeader.role,
        teamLeader.team,
        `Updated assignment: ${assignment.title}`
    );

    return await assignmentRepository.findById(assignmentId);
}

/**
 * Delete assignment
 * @param {number} assignmentId - Assignment ID
 * @param {Object} teamLeader - Team leader deleting the assignment
 * @returns {Promise<boolean>} - Success status
 */
async function deleteAssignment(assignmentId, teamLeader) {
    const assignment = await assignmentRepository.findById(assignmentId);

    if (!assignment) {
        throw new NotFoundError('Assignment');
    }

    // Validate team leader owns this assignment
    if (assignment.team_leader_id !== teamLeader.id && teamLeader.role !== 'ADMIN') {
        throw new ValidationError('You can only delete your own assignments');
    }

    // Delete assignment
    await assignmentRepository.deleteById(assignmentId);

    // Log activity
    logActivity(
        db,
        teamLeader.id,
        teamLeader.username,
        teamLeader.role,
        teamLeader.team,
        `Deleted assignment: ${assignment.title}`
    );

    return true;
}

/**
 * Submit assignment
 * @param {number} assignmentId - Assignment ID
 * @param {number} fileId - Submitted file ID
 * @param {Object} user - User submitting
 * @returns {Promise<boolean>} - Success status
 */
async function submitAssignment(assignmentId, fileId, user) {
    const assignment = await assignmentRepository.findById(assignmentId);

    if (!assignment) {
        throw new NotFoundError('Assignment');
    }

    // Check if assignment is active
    if (assignment.status !== 'active') {
        throw new ValidationError('This assignment is no longer active');
    }

    // Check if due date has passed
    if (assignment.due_date && new Date(assignment.due_date) < new Date()) {
        throw new ValidationError('This assignment is past its due date');
    }

    // Update member status
    await assignmentRepository.updateMemberStatus(assignmentId, user.id, 'submitted');

    // Log activity
    logActivity(
        db,
        user.id,
        user.username,
        user.role,
        user.team,
        `Submitted assignment: ${assignment.title}`
    );

    // TODO: Create notification for team leader
    // await notificationService.notifyTeamLeader(assignment.team_leader_id, 'assignment_submitted', assignment);

    return true;
}

/**
 * Get assignment statistics
 * @param {Object} criteria - Statistics criteria
 * @returns {Promise<Object>} - Assignment statistics
 */
async function getAssignmentStats(criteria = {}) {
    const total = await assignmentRepository.count(criteria);
    const active = await assignmentRepository.count({ ...criteria, status: 'active' });
    const completed = await assignmentRepository.count({ ...criteria, status: 'completed' });
    const archived = await assignmentRepository.count({ ...criteria, status: 'archived' });

    return {
        total,
        active,
        completed,
        archived
    };
}

// Import shared notification functions
const { createNotification, createAdminNotification } = require('../routes/notifications');

/**
 * Add comment to assignment
 * @param {number} assignmentId - Assignment ID
 * @param {number} userId - User ID
 * @param {string} comment - Comment text
 * @returns {Promise<Object>} - Created comment
 */
async function addComment(assignmentId, userId, comment) {
    console.log('🐞 DEBUG: addComment called', { assignmentId, userId, comment });
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) throw new NotFoundError('Assignment');

    // Add comment
    const newComment = await assignmentRepository.addComment(assignmentId, userId, comment);
    console.log('🐞 DEBUG: Comment added to DB:', newComment);

    // Get user details for logging/notification context
    const user = await new Promise((resolve, reject) => {
        db.get('SELECT username, fullName, role, team FROM users WHERE id = ?', [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });

    console.log('🐞 DEBUG: User lookup result:', user);

    if (user) {
        console.log('🐞 DEBUG: User found, attempting to log and notify');
        // Log activity
        logActivity(
            db,
            user.id || userId,
            user.username,
            user.role,
            user.team,
            `Added comment to assignment: ${assignment.title}`
        );

        // 1. Notify Team Leader (if not the one commenting)
        if (assignment.team_leader_id !== userId) {
            createNotification(
                assignment.team_leader_id,
                null,
                'comment',
                'New Comment on Assignment',
                `${user.fullName || user.username} commented on "${assignment.title}"`,
                userId,
                user.username,
                user.role,
                assignmentId
            ).catch(err => console.error('Failed to notify team leader:', err));
        }

        // 2. Notify Assigned Members (if applicable) - Simplified for now to avoid spam,
        // typically logic is complex (don't notify self).
        // Let's focus on Admin Requirement.

        // 3. Notify ALL Admins (Vital Requirement)
        try {
            const adminCount = await createAdminNotification(
                null, // fileId
                'comment',
                'New Comment on Assignment',
                `${user.fullName || user.username} commented on "${assignment.title}" (Team: ${assignment.team})`,
                userId,
                user.username,
                user.role,
                assignmentId
            );
            console.log('🐞 DEBUG: Admin notification result:', adminCount);
        } catch (err) {
            console.error('🐞 DEBUG: Failed to notify admins:', err);
        }
    } else {
        console.warn('🐞 DEBUG: User NOT found for ID:', userId);
    }

    return newComment;
}

/**
 * Add reply to comment
 * @param {number} assignmentId - Assignment ID
 * @param {number} commentId - Parent Comment ID
 * @param {number} userId - User ID
 * @param {string} reply - Reply text
 * @returns {Promise<Object>} - Created reply
 */
async function addReply(assignmentId, commentId, userId, reply) {
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) throw new NotFoundError('Assignment');

    // Add reply
    const newReply = await assignmentRepository.addReply(assignmentId, commentId, userId, reply);

    // Get user details
    const user = await new Promise((resolve, reject) => {
        db.get('SELECT username, fullName, role, team FROM users WHERE id = ?', [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });

    if (user) {
        // Log activity
        logActivity(
            db,
            user.id || userId,
            user.username,
            user.role,
            user.team,
            `Replied to comment on assignment: ${assignment.title}`
        );

        // 1. Notify Team Leader (if not commenter)
        if (assignment.team_leader_id !== userId) {
            createNotification(
                assignment.team_leader_id,
                null,
                'comment', // Use 'comment' type for compatibility, or 'reply' if standard
                'New Reply on Assignment',
                `${user.fullName || user.username} replied to a comment on "${assignment.title}"`,
                userId,
                user.username,
                user.role,
                assignmentId
            ).catch(err => console.error('Failed to notify team leader of reply:', err));
        }

        // 2. Notify ALL Admins (Vital Requirement)
        createAdminNotification(
            null,
            'comment', // Admin dashboard handles 'comment' type well
            'New Reply on Assignment',
            `${user.fullName || user.username} replied to a comment on "${assignment.title}" (Team: ${assignment.team})`,
            userId,
            user.username,
            user.role,
            assignmentId
        ).catch(err => console.error('Failed to notify admins of reply:', err));
    }

    return newReply;
}

module.exports = {
    createAssignment,
    getAssignmentById,
    getTeamAssignments,
    getAllAssignments,
    updateAssignment,
    deleteAssignment,
    submitAssignment,
    getAssignmentStats,
    addComment,
    addReply
};
