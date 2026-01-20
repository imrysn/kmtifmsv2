/**
 * File Service
 * 
 * Business logic layer for file operations.
 * This layer is responsible for:
 * - Business rules and validation
 * - Orchestrating repository calls
 * - Handling notifications
 * - Activity logging
 */

const fileRepository = require('../repositories/fileRepository');
const { logActivity, logInfo, logError } = require('../utils/logger');
const { db } = require('../config/database');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const fs = require('fs').promises;

/**
 * Upload a new file
 * @param {Object} fileData - File upload data
 * @param {Object} user - Authenticated user
 * @returns {Promise<Object>} - Created file record
 */
async function uploadFile(fileData, user) {
    logInfo('Uploading file', {
        filename: fileData.original_name,
        userId: user.id
    });

    // Prepare file data
    const data = {
        ...fileData,
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
 * Get file by ID
 * @param {number} fileId - File ID
 * @param {Object} user - Authenticated user (for authorization)
 * @returns {Promise<Object>} - File object
 */
async function getFileById(fileId, user) {
    const file = await fileRepository.findById(fileId);

    if (!file) {
        throw new NotFoundError('File');
    }

    // Authorization check
    const canView =
        file.user_id === user.id ||
        user.role === 'ADMIN' ||
        (user.role === 'TEAM_LEADER' && file.user_team === user.team);

    if (!canView) {
        throw new ValidationError('You do not have permission to view this file');
    }

    return file;
}

/**
 * Get user's files
 * @param {number} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Array of files
 */
async function getUserFiles(userId, options = {}) {
    return await fileRepository.findByUserId(userId, options);
}

/**
 * Get team files
 * @param {string} team - Team name
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Array of files
 */
async function getTeamFiles(team, options = {}) {
    return await fileRepository.findByTeam(team, options);
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

    if (!file) {
        throw new NotFoundError('File');
    }

    // Validate team leader can approve this file
    if (file.user_team !== teamLeader.team) {
        throw new ValidationError('You can only approve files from your team');
    }

    if (file.current_stage !== 'pending_team_leader') {
        throw new ValidationError('File is not in the correct stage for team leader approval');
    }

    // Update file status
    await fileRepository.updateStatus(fileId, {
        status: 'team_leader_approved',
        current_stage: 'pending_admin',
        team_leader_id: teamLeader.id,
        team_leader_username: teamLeader.username,
        team_leader_comments: comments
    });

    // Log activity
    logActivity(
        db,
        teamLeader.id,
        teamLeader.username,
        teamLeader.role,
        teamLeader.team,
        `Approved file: ${file.original_name}`
    );

    // TODO: Create notification for admin
    // await notificationService.notifyAdmin(file, 'team_leader_approved');

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

    if (!file) {
        throw new NotFoundError('File');
    }

    if (file.user_team !== teamLeader.team) {
        throw new ValidationError('You can only reject files from your team');
    }

    // Update file status
    await fileRepository.updateStatus(fileId, {
        status: 'rejected',
        current_stage: 'rejected_by_team_leader',
        team_leader_id: teamLeader.id,
        team_leader_username: teamLeader.username,
        team_leader_comments: reason,
        rejection_reason: reason,
        rejected_by: teamLeader.username
    });

    // Log activity
    logActivity(
        db,
        teamLeader.id,
        teamLeader.username,
        teamLeader.role,
        teamLeader.team,
        `Rejected file: ${file.original_name} - Reason: ${reason}`
    );

    // TODO: Create notification for user
    // await notificationService.notifyUser(file.user_id, 'file_rejected', file);

    return await fileRepository.findById(fileId);
}

/**
 * Approve file by admin
 * @param {number} fileId - File ID
 * @param {Object} admin - Admin user object
 * @param {string} comments - Optional comments
 * @returns {Promise<Object>} - Updated file
 */
async function approveByAdmin(fileId, admin, comments = '') {
    const file = await fileRepository.findById(fileId);

    if (!file) {
        throw new NotFoundError('File');
    }

    if (file.current_stage !== 'pending_admin') {
        throw new ValidationError('File is not in the correct stage for admin approval');
    }

    // Update file status
    await fileRepository.updateStatus(fileId, {
        status: 'approved',
        current_stage: 'approved',
        admin_id: admin.id,
        admin_username: admin.username,
        admin_comments: comments
    });

    // Log activity
    logActivity(
        db,
        admin.id,
        admin.username,
        admin.role,
        admin.team,
        `Approved file: ${file.original_name}`
    );

    // TODO: Create notification for user
    // await notificationService.notifyUser(file.user_id, 'file_approved', file);

    return await fileRepository.findById(fileId);
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

    if (!file) {
        throw new NotFoundError('File');
    }

    // Update file status
    await fileRepository.updateStatus(fileId, {
        status: 'rejected',
        current_stage: 'rejected_by_admin',
        admin_id: admin.id,
        admin_username: admin.username,
        admin_comments: reason,
        rejection_reason: reason,
        rejected_by: admin.username
    });

    // Log activity
    logActivity(
        db,
        admin.id,
        admin.username,
        admin.role,
        admin.team,
        `Rejected file: ${file.original_name} - Reason: ${reason}`
    );

    // TODO: Create notification for user
    // await notificationService.notifyUser(file.user_id, 'file_rejected', file);

    return await fileRepository.findById(fileId);
}

/**
 * Delete file
 * @param {number} fileId - File ID
 * @param {Object} user - User deleting the file
 * @returns {Promise<boolean>} - Success status
 */
async function deleteFile(fileId, user) {
    const file = await fileRepository.findById(fileId);

    if (!file) {
        throw new NotFoundError('File');
    }

    // Authorization check
    const canDelete =
        file.user_id === user.id ||
        user.role === 'ADMIN';

    if (!canDelete) {
        throw new ValidationError('You do not have permission to delete this file');
    }

    // Delete physical file
    try {
        await fs.unlink(file.file_path);
        logInfo('Physical file deleted', { path: file.file_path });
    } catch (error) {
        logError(error, { context: 'delete-physical-file', fileId });
        // Continue even if physical file deletion fails
    }

    // Delete database record
    await fileRepository.deleteById(fileId);

    // Log activity
    logActivity(
        db,
        user.id,
        user.username,
        user.role,
        user.team,
        `Deleted file: ${file.original_name}`
    );

    return true;
}

/**
 * Get file statistics
 * @param {Object} criteria - Statistics criteria
 * @returns {Promise<Object>} - File statistics
 */
async function getFileStats(criteria = {}) {
    const total = await fileRepository.count(criteria);
    const uploaded = await fileRepository.count({ ...criteria, status: 'uploaded' });
    const approved = await fileRepository.count({ ...criteria, status: 'approved' });
    const rejected = await fileRepository.count({ ...criteria, status: 'rejected' });

    return {
        total,
        uploaded,
        approved,
        rejected,
        pending: total - approved - rejected
    };
}

module.exports = {
    uploadFile,
    getFileById,
    getUserFiles,
    getTeamFiles,
    approveByTeamLeader,
    rejectByTeamLeader,
    approveByAdmin,
    rejectByAdmin,
    deleteFile,
    getFileStats
};
