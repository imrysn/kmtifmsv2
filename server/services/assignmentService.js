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

module.exports = {
    createAssignment,
    getAssignmentById,
    getTeamAssignments,
    getAllAssignments,
    updateAssignment,
    deleteAssignment,
    submitAssignment,
    getAssignmentStats
};
