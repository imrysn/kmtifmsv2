/**
 * File Repository
 * 
 * Handles all database operations for files.
 * This layer is responsible for:
 * - Database queries
 * - Data persistence
 * - No business logic
 */

const { db } = require('../config/database');
const { DatabaseError } = require('../middleware/errorHandler');

/**
 * Create a new file record
 * @param {Object} fileData - File data to insert
 * @returns {Promise<number>} - Inserted file ID
 */
async function create(fileData) {
    const {
        filename,
        original_name,
        file_path,
        file_size,
        file_type,
        mime_type,
        description,
        user_id,
        username,
        user_team,
        status = 'uploaded',
        current_stage = 'pending_team_leader'
    } = fileData;

    const query = `
    INSERT INTO files (
      filename, original_name, file_path, file_size, file_type, mime_type,
      description, user_id, username, user_team, status, current_stage,
      uploaded_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;

    return new Promise((resolve, reject) => {
        db.run(
            query,
            [filename, original_name, file_path, file_size, file_type, mime_type,
                description, user_id, username, user_team, status, current_stage],
            function (err) {
                if (err) {
                    reject(new DatabaseError('Failed to create file record', err));
                } else {
                    resolve(this.lastID);
                }
            }
        );
    });
}

/**
 * Find file by ID
 * @param {number} fileId - File ID
 * @returns {Promise<Object|null>} - File object or null
 */
async function findById(fileId) {
    const query = 'SELECT * FROM files WHERE id = ?';

    return new Promise((resolve, reject) => {
        db.get(query, [fileId], (err, row) => {
            if (err) {
                reject(new DatabaseError('Failed to find file', err));
            } else {
                resolve(row || null);
            }
        });
    });
}

/**
 * Find files by user ID
 * @param {number} userId - User ID
 * @param {Object} options - Query options (limit, offset, status)
 * @returns {Promise<Array>} - Array of files
 */
async function findByUserId(userId, options = {}) {
    const { limit = 100, offset = 0, status } = options;

    let query = 'SELECT * FROM files WHERE user_id = ?';
    const params = [userId];

    if (status) {
        query += ' AND status = ?';
        params.push(status);
    }

    query += ' ORDER BY uploaded_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                reject(new DatabaseError('Failed to find files by user', err));
            } else {
                resolve(rows || []);
            }
        });
    });
}

/**
 * Find files by team
 * @param {string} team - Team name
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Array of files
 */
async function findByTeam(team, options = {}) {
    const { limit = 100, offset = 0, status, stage } = options;

    let query = 'SELECT * FROM files WHERE user_team = ?';
    const params = [team];

    if (status) {
        query += ' AND status = ?';
        params.push(status);
    }

    if (stage) {
        query += ' AND current_stage = ?';
        params.push(stage);
    }

    query += ' ORDER BY uploaded_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                reject(new DatabaseError('Failed to find files by team', err));
            } else {
                resolve(rows || []);
            }
        });
    });
}

/**
 * Update file status and stage
 * @param {number} fileId - File ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<boolean>} - Success status
 */
async function updateStatus(fileId, updates) {
    const {
        status,
        current_stage,
        team_leader_id,
        team_leader_username,
        team_leader_comments,
        admin_id,
        admin_username,
        admin_comments,
        rejection_reason,
        rejected_by
    } = updates;

    const fields = [];
    const values = [];

    if (status !== undefined) {
        fields.push('status = ?');
        values.push(status);
    }
    if (current_stage !== undefined) {
        fields.push('current_stage = ?');
        values.push(current_stage);
    }
    if (team_leader_id !== undefined) {
        fields.push('team_leader_id = ?, team_leader_reviewed_at = CURRENT_TIMESTAMP');
        values.push(team_leader_id);
    }
    if (team_leader_username !== undefined) {
        fields.push('team_leader_username = ?');
        values.push(team_leader_username);
    }
    if (team_leader_comments !== undefined) {
        fields.push('team_leader_comments = ?');
        values.push(team_leader_comments);
    }
    if (admin_id !== undefined) {
        fields.push('admin_id = ?, admin_reviewed_at = CURRENT_TIMESTAMP');
        values.push(admin_id);
    }
    if (admin_username !== undefined) {
        fields.push('admin_username = ?');
        values.push(admin_username);
    }
    if (admin_comments !== undefined) {
        fields.push('admin_comments = ?');
        values.push(admin_comments);
    }
    if (rejection_reason !== undefined) {
        fields.push('rejection_reason = ?, rejected_at = CURRENT_TIMESTAMP');
        values.push(rejection_reason);
    }
    if (rejected_by !== undefined) {
        fields.push('rejected_by = ?');
        values.push(rejected_by);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');

    const query = `UPDATE files SET ${fields.join(', ')} WHERE id = ?`;
    values.push(fileId);

    return new Promise((resolve, reject) => {
        db.run(query, values, function (err) {
            if (err) {
                reject(new DatabaseError('Failed to update file status', err));
            } else {
                resolve(this.changes > 0);
            }
        });
    });
}

/**
 * Delete file record
 * @param {number} fileId - File ID
 * @returns {Promise<boolean>} - Success status
 */
async function deleteById(fileId) {
    const query = 'DELETE FROM files WHERE id = ?';

    return new Promise((resolve, reject) => {
        db.run(query, [fileId], function (err) {
            if (err) {
                reject(new DatabaseError('Failed to delete file', err));
            } else {
                resolve(this.changes > 0);
            }
        });
    });
}

/**
 * Count files by criteria
 * @param {Object} criteria - Count criteria
 * @returns {Promise<number>} - File count
 */
async function count(criteria = {}) {
    const { user_id, team, status, stage } = criteria;

    let query = 'SELECT COUNT(*) as count FROM files WHERE 1=1';
    const params = [];

    if (user_id) {
        query += ' AND user_id = ?';
        params.push(user_id);
    }
    if (team) {
        query += ' AND user_team = ?';
        params.push(team);
    }
    if (status) {
        query += ' AND status = ?';
        params.push(status);
    }
    if (stage) {
        query += ' AND current_stage = ?';
        params.push(stage);
    }

    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) {
                reject(new DatabaseError('Failed to count files', err));
            } else {
                resolve(row?.count || 0);
            }
        });
    });
}

module.exports = {
    create,
    findById,
    findByUserId,
    findByTeam,
    updateStatus,
    deleteById,
    count
};
