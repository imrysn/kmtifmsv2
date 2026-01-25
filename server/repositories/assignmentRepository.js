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

    try {
        const result = await db.run(
            query,
            [title, description, due_date, file_type_required, assigned_to,
                max_file_size, team_leader_id, team_leader_username, team, status]
        );
        return result.lastID;
    } catch (err) {
        throw new DatabaseError('Failed to create assignment', err);
    }
}

/**
 * Find assignment by ID
 * @param {number} assignmentId - Assignment ID
 * @returns {Promise<Object|null>} - Assignment object or null
 */
async function findById(assignmentId) {
    try {
        const assignment = await db.get('SELECT * FROM assignments WHERE id = ?', [assignmentId]);
        return assignment || null;
    } catch (err) {
        throw new DatabaseError('Failed to find assignment', err);
    }
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

    try {
        const assignments = await db.all(query, params);
        return assignments || [];
    } catch (err) {
        throw new DatabaseError('Failed to find assignments by team', err);
    }
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

    try {
        const assignments = await db.all(query, params);
        return assignments || [];
    } catch (err) {
        throw new DatabaseError('Failed to find assignments', err);
    }
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

    try {
        const result = await db.run(query, values);
        return result.changes > 0;
    } catch (err) {
        throw new DatabaseError('Failed to update assignment', err);
    }
}

/**
 * Delete assignment
 * @param {number} assignmentId - Assignment ID
 * @returns {Promise<boolean>} - Success status
 */
async function deleteById(assignmentId) {
    try {
        const result = await db.run('DELETE FROM assignments WHERE id = ?', [assignmentId]);
        return result.changes > 0;
    } catch (err) {
        throw new DatabaseError('Failed to delete assignment', err);
    }
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

    try {
        const result = await db.run(query, [assignmentId, userId]);
        return result.lastID;
    } catch (err) {
        throw new DatabaseError('Failed to add assignment member', err);
    }
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

    try {
        const members = await db.all(query, [assignmentId]);
        return members || [];
    } catch (err) {
        throw new DatabaseError('Failed to get assignment members', err);
    }
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

    try {
        const result = await db.run(query, [status, assignmentId, userId]);
        return result.changes > 0;
    } catch (err) {
        throw new DatabaseError('Failed to update member status', err);
    }
}

/**
 * Find all assignments with full details (OPTIMIZED - Fixes N+1 Query Problem)
 * This method uses JOINs and batch queries instead of individual queries per assignment
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Assignments with pagination info
 */
async function findAllWithDetails(options = {}) {
    const { cursor, limit = 20, team } = options;

    try {
        // Build main query with team leader info
        let query = `
            SELECT 
                a.*,
                tl.fullName as team_leader_fullname,
                tl.username as team_leader_username,
                tl.email as team_leader_email
            FROM assignments a
            LEFT JOIN users tl ON a.team_leader_id = tl.id
        `;

        const params = [];
        const whereConditions = [];

        if (team) {
            whereConditions.push('a.team = ?');
            params.push(team);
        }
        if (cursor) {
            whereConditions.push('a.id > ?');
            params.push(cursor);
        }

        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }

        query += ' ORDER BY a.id DESC LIMIT ?';
        params.push(limit + 1); // Fetch one extra to check if there are more

        const assignments = await db.all(query, params);

        // Check for pagination
        const hasMore = assignments.length > limit;
        const assignmentsToReturn = hasMore ? assignments.slice(0, limit) : assignments;
        const nextCursor = hasMore && assignmentsToReturn.length > 0
            ? assignmentsToReturn[assignmentsToReturn.length - 1].id
            : null;

        // If no assignments, return early
        if (assignmentsToReturn.length === 0) {
            return { assignments: [], nextCursor: null, hasMore: false };
        }

        // Fetch all members for all assignments in ONE query (instead of N queries)
        const assignmentIds = assignmentsToReturn.map(a => a.id);
        const placeholders = assignmentIds.map(() => '?').join(',');

        const membersQuery = `
            SELECT 
                am.assignment_id,
                am.user_id,
                am.status as member_status,
                u.fullName,
                u.username,
                u.email
            FROM assignment_members am
            JOIN users u ON am.user_id = u.id
            WHERE am.assignment_id IN (${placeholders})
        `;

        const members = await db.all(membersQuery, assignmentIds);

        // Group members by assignment_id
        const membersByAssignment = members.reduce((acc, member) => {
            if (!acc[member.assignment_id]) {
                acc[member.assignment_id] = [];
            }
            acc[member.assignment_id].push({
                id: member.user_id,
                username: member.username,
                fullName: member.fullName,
                email: member.email,
                status: member.member_status
            });
            return acc;
        }, {});

        // Fetch counts for attachments and comments in TWO queries (instead of 2N queries)
        const attachmentCountsQuery = `
            SELECT assignment_id, COUNT(*) as count
            FROM assignment_attachments
            WHERE assignment_id IN (${placeholders})
            GROUP BY assignment_id
        `;

        const commentCountsQuery = `
            SELECT assignment_id, COUNT(*) as count
            FROM assignment_comments
            WHERE assignment_id IN (${placeholders})
            GROUP BY assignment_id
        `;

        const [attachmentCounts, commentCounts] = await Promise.all([
            db.all(attachmentCountsQuery, assignmentIds),
            db.all(commentCountsQuery, assignmentIds)
        ]);

        // Create lookup maps
        const attachmentCountMap = attachmentCounts.reduce((acc, row) => {
            acc[row.assignment_id] = row.count;
            return acc;
        }, {});

        const commentCountMap = commentCounts.reduce((acc, row) => {
            acc[row.assignment_id] = row.count;
            return acc;
        }, {});

        // Attach all related data to assignments
        const enrichedAssignments = assignmentsToReturn.map(assignment => ({
            ...assignment,
            members: membersByAssignment[assignment.id] || [],
            attachment_count: attachmentCountMap[assignment.id] || 0,
            comment_count: commentCountMap[assignment.id] || 0
        }));

        return {
            assignments: enrichedAssignments,
            nextCursor,
            hasMore
        };
    } catch (err) {
        throw new DatabaseError('Failed to fetch assignments with details', err);
    }
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

    try {
        const result = await db.get(query, params);
        return result?.count || 0;
    } catch (err) {
        throw new DatabaseError('Failed to count assignments', err);
    }
}

module.exports = {
    create,
    findById,
    findByTeam,
    findAll,
    findAllWithDetails,
    update,
    deleteById,
    addMember,
    getMembers,
    updateMemberStatus,
    count
};
