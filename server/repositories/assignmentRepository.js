/**
 * Assignment Repository
 * 
 * Handles all database operations for assignments.
 * This layer is responsible for:
 * - Database queries
 * - Data persistence
 * - No business logic
 */

const { db } = require('../config/database');
const { DatabaseError } = require('../middleware/errorHandler');

/**
 * Create a new assignment
 * @param {Object} assignmentData - Assignment data
 * @returns {Promise<number>} - Inserted assignment ID
 */
async function create(assignmentData) {
    const {
        title,
        description,
        due_date,
        file_type_required,
        assigned_to = 'all',
        max_file_size = 10485760,
        team_leader_id,
        team_leader_username,
        team,
        status = 'active'
    } = assignmentData;

    const query = `
    INSERT INTO assignments (
      title, description, due_date, file_type_required, assigned_to,
      max_file_size, team_leader_id, team_leader_username, team,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;

    return new Promise((resolve, reject) => {
        db.run(
            query,
            [title, description, due_date, file_type_required, assigned_to,
                max_file_size, team_leader_id, team_leader_username, team, status],
            function (err) {
                if (err) {
                    reject(new DatabaseError('Failed to create assignment', err));
                } else {
                    resolve(this.lastID);
                }
            }
        );
    });
}

/**
 * Find assignment by ID
 * @param {number} assignmentId - Assignment ID
 * @returns {Promise<Object|null>} - Assignment object or null
 */
async function findById(assignmentId) {
    const query = 'SELECT * FROM assignments WHERE id = ?';

    return new Promise((resolve, reject) => {
        db.get(query, [assignmentId], (err, row) => {
            if (err) {
                reject(new DatabaseError('Failed to find assignment', err));
            } else {
                resolve(row || null);
            }
        });
    });
}

/**
 * Find assignments by team
 * @param {string} team - Team name
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Array of assignments
 */
async function findByTeam(team, options = {}) {
    const { limit = 100, offset = 0, status } = options;

    let query = 'SELECT * FROM assignments WHERE team = ?';
    const params = [team];

    if (status) {
        query += ' AND status = ?';
        params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                reject(new DatabaseError('Failed to find assignments by team', err));
            } else {
                resolve(rows || []);
            }
        });
    });
}

/**
 * Find all assignments
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Array of assignments
 */
async function findAll(options = {}) {
    const { limit = 100, offset = 0, status } = options;

    let query = 'SELECT * FROM assignments WHERE 1=1';
    const params = [];

    if (status) {
        query += ' AND status = ?';
        params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                reject(new DatabaseError('Failed to find assignments', err));
            } else {
                resolve(rows || []);
            }
        });
    });
}

/**
 * Update assignment
 * @param {number} assignmentId - Assignment ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<boolean>} - Success status
 */
async function update(assignmentId, updates) {
    const { title, description, due_date, status } = updates;

    const fields = [];
    const values = [];

    if (title !== undefined) {
        fields.push('title = ?');
        values.push(title);
    }
    if (description !== undefined) {
        fields.push('description = ?');
        values.push(description);
    }
    if (due_date !== undefined) {
        fields.push('due_date = ?');
        values.push(due_date);
    }
    if (status !== undefined) {
        fields.push('status = ?');
        values.push(status);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');

    const query = `UPDATE assignments SET ${fields.join(', ')} WHERE id = ?`;
    values.push(assignmentId);

    return new Promise((resolve, reject) => {
        db.run(query, values, function (err) {
            if (err) {
                reject(new DatabaseError('Failed to update assignment', err));
            } else {
                resolve(this.changes > 0);
            }
        });
    });
}

/**
 * Delete assignment
 * @param {number} assignmentId - Assignment ID
 * @returns {Promise<boolean>} - Success status
 */
async function deleteById(assignmentId) {
    const query = 'DELETE FROM assignments WHERE id = ?';

    return new Promise((resolve, reject) => {
        db.run(query, [assignmentId], function (err) {
            if (err) {
                reject(new DatabaseError('Failed to delete assignment', err));
            } else {
                resolve(this.changes > 0);
            }
        });
    });
}

/**
 * Add member to assignment
 * @param {number} assignmentId - Assignment ID
 * @param {number} userId - User ID
 * @returns {Promise<number>} - Inserted member ID
 */
async function addMember(assignmentId, userId) {
    const query = `
    INSERT INTO assignment_members (assignment_id, user_id, status, created_at)
    VALUES (?, ?, 'pending', CURRENT_TIMESTAMP)
  `;

    return new Promise((resolve, reject) => {
        db.run(query, [assignmentId, userId], function (err) {
            if (err) {
                reject(new DatabaseError('Failed to add assignment member', err));
            } else {
                resolve(this.lastID);
            }
        });
    });
}

/**
 * Get assignment members
 * @param {number} assignmentId - Assignment ID
 * @returns {Promise<Array>} - Array of members
 */
async function getMembers(assignmentId) {
    const query = `
    SELECT am.*, u.fullName, u.username, u.email
    FROM assignment_members am
    JOIN users u ON am.user_id = u.id
    WHERE am.assignment_id = ?
  `;

    return new Promise((resolve, reject) => {
        db.all(query, [assignmentId], (err, rows) => {
            if (err) {
                reject(new DatabaseError('Failed to get assignment members', err));
            } else {
                resolve(rows || []);
            }
        });
    });
}

/**
 * Update member status
 * @param {number} assignmentId - Assignment ID
 * @param {number} userId - User ID
 * @param {string} status - New status
 * @returns {Promise<boolean>} - Success status
 */
async function updateMemberStatus(assignmentId, userId, status) {
    const query = `
    UPDATE assignment_members 
    SET status = ?, submitted_at = CURRENT_TIMESTAMP
    WHERE assignment_id = ? AND user_id = ?
  `;

    return new Promise((resolve, reject) => {
        db.run(query, [status, assignmentId, userId], function (err) {
            if (err) {
                reject(new DatabaseError('Failed to update member status', err));
            } else {
                resolve(this.changes > 0);
            }
        });
    });
}

/**
 * Count assignments by criteria
 * @param {Object} criteria - Count criteria
 * @returns {Promise<number>} - Assignment count
 */
async function count(criteria = {}) {
    const { team, status } = criteria;

    let query = 'SELECT COUNT(*) as count FROM assignments WHERE 1=1';
    const params = [];

    if (team) {
        query += ' AND team = ?';
        params.push(team);
    }
    if (status) {
        query += ' AND status = ?';
        params.push(status);
    }

    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) {
                reject(new DatabaseError('Failed to count assignments', err));
            } else {
                resolve(row?.count || 0);
            }
        });
    });
}

module.exports = {
    create,
    findById,
    findByTeam,
    findAll,
    update,
    deleteById,
    addMember,
    getMembers,
    updateMemberStatus,
    count
};
