/**
 * Notification Service
 * 
 * Centralizes notification creation logic for all application events.
 */

const { db } = require('../config/database');
const { DatabaseError } = require('../middleware/errorHandler');

/**
 * Create a notification for a specific user
 * @param {number|Object} userId - ID of user receiving the notification, or a full data object
 * @param {number|null} fileId - Related file ID
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {number} actionById - ID of user who performed the action
 * @param {string} actionByUsername - Username of user who performed the action
 * @param {string} actionByRole - Role of user who performed the action
 * @param {number|null} assignmentId - Related assignment ID
 * @returns {Promise<number>} - Inserted notification ID
 */
async function createNotification(
    userId,
    fileId = null,
    type = null,
    title = null,
    message = null,
    actionById = null,
    actionByUsername = null,
    actionByRole = null,
    assignmentId = null
) {
    // Support object style: createNotification({ user_id, ... })
    let data = {};
    if (typeof userId === 'object' && userId !== null) {
        data = userId;
    } else {
        data = {
            user_id: userId,
            file_id: fileId,
            type: type,
            title: title,
            message: message,
            action_by_id: actionById,
            action_by_username: actionByUsername,
            action_by_role: actionByRole,
            assignment_id: assignmentId
        };
    }

    const query = `
        INSERT INTO notifications (
            user_id, file_id, assignment_id, type, title, message,
            action_by_id, action_by_username, action_by_role, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    // Ensure all parameters are null instead of undefined for MySQL compatibility
    // Provide defaults for NOT NULL columns in database
    const params = [
        data.user_id ?? data.userId ?? null,
        data.file_id ?? data.fileId ?? null,
        data.assignment_id ?? data.assignmentId ?? null,
        data.type ?? null,
        data.title ?? null,
        data.message ?? null,
        data.action_by_id ?? data.actionById ?? null,
        data.action_by_username ?? data.actionByUsername ?? 'System',
        data.action_by_role ?? data.actionByRole ?? 'ADMIN'
    ];

    try {
        const result = await db.run(query, params);
        return result.insertId || result.lastID;
    } catch (err) {
        console.error('❌ Failed to create notification:', err);
        return null;
    }
}

/**
 * Create a notification for all administrators
 * @param {number|null} fileId - Related file ID
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {number} actionById - ID of user performing the action
 * @param {string} actionByUsername - Username of user performing the action
 * @param {string} actionByRole - Role of user performing the action
 * @param {number|null} assignmentId - Related assignment ID
 * @returns {Promise<number>} - Number of notifications created
 */
async function createAdminNotification(
    fileId,
    type,
    title,
    message,
    actionById,
    actionByUsername,
    actionByRole,
    assignmentId = null
) {
    try {
        // Find all admins
        const admins = await db.all('SELECT id FROM users WHERE role = "ADMIN"');
        if (!admins || admins.length === 0) return 0;

        let createdCount = 0;
        for (const admin of admins) {
            const id = await createNotification(
                admin.id,
                fileId,
                type,
                title,
                message,
                actionById,
                actionByUsername,
                actionByRole,
                assignmentId
            );
            if (id) createdCount++;
        }
        return createdCount;
    } catch (err) {
        console.error('❌ Failed to create admin notifications:', err);
        return 0;
    }
}

module.exports = {
    createNotification,
    createAdminNotification
};
