/**
 * Notification Service
 *
 * Centralizes notification creation logic for all application events.
 */

const { db, query } = require('../config/database');
const { DatabaseError } = require('../middleware/errorHandler');

/**
 * Create a notification for a specific user
 */
async function createNotification(
    userId,
    fileId        = null,
    type          = null,
    title         = null,
    message       = null,
    actionById    = null,
    actionByUsername = null,
    actionByRole  = null,
    assignmentId  = null
) {
    // Support object style: createNotification({ user_id, ... })
    let data = {};
    if (typeof userId === 'object' && userId !== null) {
        data = userId;
    } else {
        data = {
            user_id:           userId,
            file_id:           fileId,
            type,
            title,
            message,
            action_by_id:      actionById,
            action_by_username: actionByUsername,
            action_by_role:    actionByRole,
            assignment_id:     assignmentId
        };
    }

    const sql = `
        INSERT INTO notifications (
            user_id, file_id, assignment_id, type, title, message,
            action_by_id, action_by_username, action_by_role, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    const params = [
        data.user_id           ?? data.userId           ?? null,
        data.file_id           ?? data.fileId           ?? null,
        data.assignment_id     ?? data.assignmentId     ?? null,
        data.type              ?? null,
        data.title             ?? null,
        data.message           ?? null,
        data.action_by_id      ?? data.actionById       ?? null,
        data.action_by_username ?? data.actionByUsername ?? 'System',
        data.action_by_role    ?? data.actionByRole     ?? 'ADMIN'
    ];

    try {
        const result = await db.run(sql, params);
        return result.insertId || result.lastID;
    } catch (err) {
        console.error('❌ Failed to create notification:', err);
        return null;
    }
}

/**
 * Create a notification for all administrators.
 *
 * FIX #7 — replaced sequential per-admin INSERTs with a single batch INSERT.
 * N admins previously meant N sequential round-trips to NAS MySQL; now it is
 * always one round-trip regardless of admin count.
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
        const admins = await db.all('SELECT id FROM users WHERE role = "ADMIN"');
        if (!admins || admins.length === 0) return 0;

        // Filter out the user who performed the action (don't self-notify)
        const targets = admins.filter(a => !actionById || a.id !== parseInt(actionById, 10));
        if (targets.length === 0) return 0;

        // Build a single INSERT … VALUES (…),(…),(…) statement
        const valuePlaceholders = targets.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').join(', ');
        const params = [];
        for (const admin of targets) {
            params.push(
                admin.id,
                fileId        ?? null,
                assignmentId  ?? null,
                type          ?? null,
                title         ?? null,
                message       ?? null,
                actionById    ?? null,
                actionByUsername ?? 'System',
                actionByRole  ?? 'ADMIN'
            );
        }

        await query(
            `INSERT INTO notifications
               (user_id, file_id, assignment_id, type, title, message,
                action_by_id, action_by_username, action_by_role, created_at)
             VALUES ${valuePlaceholders}`,
            params
        );

        return targets.length;
    } catch (err) {
        console.error('❌ Failed to create admin notifications:', err);
        return 0;
    }
}

module.exports = { createNotification, createAdminNotification };
