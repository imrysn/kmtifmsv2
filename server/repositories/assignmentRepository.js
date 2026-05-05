/**
 * Assignment Repository
 * Handles all database operations for assignments.
 */

const { db } = require('../config/database');
const { DatabaseError } = require('../middleware/errorHandler');

/**
 * Create a new assignment
 * @param {Object} data - Assignment data
 * @returns {Promise<number>} - Inserted assignment ID
 */
async function create(data) {
    const {
        title, description, due_date, file_type_required, assigned_to = 'all',
        max_file_size = 10485760, team_leader_id, team_leader_username, team,
        status = 'active'
    } = data;

    const query = `
        INSERT INTO assignments (
            title, description, due_date, file_type_required, assigned_to,
            max_file_size, team_leader_id, team_leader_username, team,
            status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    try {
        const result = await db.run(query, [
            title, description, due_date, file_type_required, assigned_to,
            max_file_size, team_leader_id, team_leader_username, team, status
        ]);
        return result.insertId || result.lastID;
    } catch (err) {
        throw new DatabaseError('Failed to create assignment', err);
    }
}

/**
 * Find assignment by ID
 */
async function findById(id) {
    try {
        const assignment = await db.get('SELECT * FROM assignments WHERE id = ?', [id]);
        return assignment || null;
    } catch (err) {
        throw new DatabaseError('Failed to find assignment', err);
    }
}

/**
 * Find assignments by team
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
        return await db.all(query, params);
    } catch (err) {
        throw new DatabaseError('Failed to find assignments by team', err);
    }
}

/**
 * Find assignments for a specific user
 */
async function findByUserId(userId, options = {}) {
    const { limit = 20, offset = 0 } = options;
    const query = `
        SELECT a.*, am.status as user_status, am.created_at as joined_at,
               tl.fullName as team_leader_fullname,
               (SELECT COUNT(*) FROM assignment_comments WHERE assignment_id = a.id) as comment_count
        FROM assignments a
        JOIN assignment_members am ON a.id = am.assignment_id
        LEFT JOIN users tl ON a.team_leader_id = tl.id
        WHERE am.user_id = ?
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
    `;
    try {
        const assignments = await db.all(query, [userId, limit, offset]);
        if (assignments.length === 0) return assignments;

        const assignmentIds = assignments.map(a => a.id);
        const placeholders = assignmentIds.map(() => '?').join(',');

        // Fetch attachments
        const attachmentsQuery = `
            SELECT id, assignment_id, original_name, filename, file_path, file_size, file_type, folder_name, relative_path, created_at,
                   COALESCE(status, 'team_leader_approved') AS status,
                   COALESCE(current_stage, 'pending_admin') AS current_stage
            FROM assignment_attachments
            WHERE assignment_id IN (${placeholders})
        `;
        const attachments = await db.all(attachmentsQuery, assignmentIds);
        const attachmentsMap = attachments.reduce((acc, att) => {
            if (!acc[att.assignment_id]) acc[att.assignment_id] = [];
            acc[att.assignment_id].push(att);
            return acc;
        }, {});

        // Fetch user's own submissions for these assignments
        const submissionsQuery = `
            SELECT f.*, u.username, u.fullName, asub.submitted_at, asub.assignment_id
            FROM assignment_submissions asub
            JOIN files f ON asub.file_id = f.id
            JOIN users u ON asub.user_id = u.id
            WHERE asub.assignment_id IN (${placeholders}) AND asub.user_id = ?
            ORDER BY asub.submitted_at DESC
        `;
        const submissions = await db.all(submissionsQuery, [...assignmentIds, userId]);
        const submissionsMap = submissions.reduce((acc, s) => {
            if (!acc[s.assignment_id]) acc[s.assignment_id] = [];
            acc[s.assignment_id].push(s);
            return acc;
        }, {});

        // Fetch all assigned members for these assignments
        const membersQuery = `
            SELECT am.assignment_id, u.id, u.username, u.fullName, u.role
            FROM assignment_members am
            JOIN users u ON am.user_id = u.id
            WHERE am.assignment_id IN (${placeholders})
        `;
        const members = await db.all(membersQuery, assignmentIds);
        const membersMap = members.reduce((acc, m) => {
            if (!acc[m.assignment_id]) acc[m.assignment_id] = [];
            acc[m.assignment_id].push(m);
            return acc;
        }, {});

        return assignments.map(a => ({
            ...a,
            attachments: attachmentsMap[a.id] || [],
            submitted_files: submissionsMap[a.id] || [],
            assigned_member_details: membersMap[a.id] || []
        }));
    } catch (err) {
        throw new DatabaseError('Failed to fetch user assignments', err);
    }
}

/**
 * Add member to assignment
 */
async function addMember(assignmentId, userId) {
    const query = 'INSERT INTO assignment_members (assignment_id, user_id, status) VALUES (?, ?, "pending")';
    try {
        const result = await db.run(query, [assignmentId, userId]);
        return result.insertId || result.lastID;
    } catch (err) {
        throw new DatabaseError('Failed to add assignment member', err);
    }
}

/**
 * Batch add members to assignment
 */
async function createMembers(assignmentId, userIds) {
    if (!userIds || userIds.length === 0) return 0;
    const placeholders = userIds.map(() => '(?, ?)').join(', ');
    const params = userIds.flatMap(uid => [assignmentId, uid]);
    const query = `INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`;
    try {
        const result = await db.run(query, params);
        return result.affectedRows || userIds.length;
    } catch (err) {
        throw new DatabaseError('Failed to batch create assignment members', err);
    }
}

/**
 * Update member status
 */
async function updateMemberStatus(assignmentId, userId, status) {
    const query = 'UPDATE assignment_members SET status = ?, submitted_at = CURRENT_TIMESTAMP WHERE assignment_id = ? AND user_id = ?';
    try {
        const result = await db.run(query, [status, assignmentId, userId]);
        return (result.changes || result.affectedRows) > 0;
    } catch (err) {
        throw new DatabaseError('Failed to update member status', err);
    }
}

/**
 * Get teams led by a user
 */
async function findLedTeams(userId) {
    const query = `
        SELECT DISTINCT t.name
        FROM team_leaders tl
        JOIN teams t ON tl.team_id = t.id
        WHERE tl.user_id = ?
    `;
    try {
        const teams = await db.all(query, [userId]);
        return (teams || []).map(t => t.name);
    } catch (err) {
        throw new DatabaseError('Failed to find led teams', err);
    }
}

/**
 * Get all submissions for multiple teams
 */
async function findTeamSubmissions(teamNames) {
    if (!teamNames || teamNames.length === 0) return [];
    const placeholders = teamNames.map(() => '?').join(',');
    const query = `
        SELECT f.*, u.username, u.fullName, asub.submitted_at, 
               a.id as assignment_id, a.title as assignment_title
        FROM assignment_submissions asub
        JOIN files f ON asub.file_id = f.id
        JOIN users u ON asub.user_id = u.id
        JOIN assignments a ON asub.assignment_id = a.id
        WHERE a.team IN (${placeholders})
        ORDER BY asub.submitted_at DESC
    `;
    try {
        return await db.all(query, teamNames);
    } catch (err) {
        throw new DatabaseError('Failed to fetch team submissions', err);
    }
}

/**
 * Optimized method to find assignments with all related details
 */
async function findAllWithDetails(options = {}) {
    const { cursor, limit = 1000, team } = options;
    try {
        let query = `
            SELECT 
                a.*, 
                tl.fullName as team_leader_fullname,
                (SELECT COUNT(*) FROM assignment_members WHERE assignment_id = a.id) as assigned_members_count,
                (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id) as submission_count,
                (SELECT COUNT(*) FROM assignment_comments WHERE assignment_id = a.id) as comment_count
            FROM assignments a 
            LEFT JOIN users tl ON a.team_leader_id = tl.id
        `;
        const params = [];
        const where = [];

        if (team) { where.push('a.team = ?'); params.push(team); }
        if (cursor) { where.push('a.id < ?'); params.push(cursor); }
        if (where.length > 0) query += ' WHERE ' + where.join(' AND ');

        query += ' ORDER BY a.id DESC LIMIT ?';
        params.push(limit + 1);

        const assignments = await db.all(query, params);
        const hasMore = assignments.length > limit;
        const resultAssignments = hasMore ? assignments.slice(0, limit) : assignments;
        const nextCursor = hasMore && resultAssignments.length > 0 ? resultAssignments[resultAssignments.length - 1].id : null;

        if (resultAssignments.length === 0) return { assignments: [], nextCursor: null, hasMore: false };

        const assignmentIds = resultAssignments.map(a => a.id);
        const placeholders = assignmentIds.map(() => '?').join(',');

        // Fetch member details
        const membersQuery = `SELECT am.assignment_id, u.id, u.username, u.fullName, am.status FROM assignment_members am JOIN users u ON am.user_id = u.id WHERE am.assignment_id IN (${placeholders})`;
        const members = await db.all(membersQuery, assignmentIds);
        
        const membersMap = members.reduce((acc, m) => {
            if (!acc[m.assignment_id]) acc[m.assignment_id] = [];
            acc[m.assignment_id].push(m);
            return acc;
        }, {});

        // Fetch attachments
        const attachmentsQuery = `
            SELECT id, assignment_id, original_name, filename, file_path, file_size, file_type, folder_name, relative_path, created_at,
                   COALESCE(status, 'team_leader_approved') AS status,
                   COALESCE(current_stage, 'pending_admin') AS current_stage
            FROM assignment_attachments
            WHERE assignment_id IN (${placeholders})
        `;
        const attachments = await db.all(attachmentsQuery, assignmentIds);
        const attachmentsMap = attachments.reduce((acc, att) => {
            if (!acc[att.assignment_id]) acc[att.assignment_id] = [];
            acc[att.assignment_id].push(att);
            return acc;
        }, {});

        // Fetch recent submissions
        const submissionsQuery = `
            SELECT f.*, u.username, u.fullName, asub.submitted_at, asub.assignment_id
            FROM assignment_submissions asub
            JOIN files f ON asub.file_id = f.id
            JOIN users u ON asub.user_id = u.id
            WHERE asub.assignment_id IN (${placeholders})
            ORDER BY asub.submitted_at DESC
        `;
        const submissions = await db.all(submissionsQuery, assignmentIds);
        const submissionsMap = submissions.reduce((acc, s) => {
            if (!acc[s.assignment_id]) acc[s.assignment_id] = [];
            acc[s.assignment_id].push(s);
            return acc;
        }, {});

        return {
            assignments: resultAssignments.map(a => ({
                ...a,
                assigned_member_details: membersMap[a.id] || [],
                attachments: attachmentsMap[a.id] || [],
                recent_submissions: submissionsMap[a.id] || []
            })),
            nextCursor,
            hasMore
        };
    } catch (err) {
        throw new DatabaseError('Failed to fetch detailed assignments', err);
    }
}

/**
 * Comments & Replies
 */
async function getComments(assignmentId) {
    const query = `
        SELECT
            ac.id,
            ac.assignment_id,
            ac.user_id,
            ac.comment,
            ac.comment AS reply,
            ac.parent_id,
            ac.created_at,
            ac.updated_at,
            u.username,
            u.fullName,
            u.role AS user_role
        FROM assignment_comments ac
        LEFT JOIN users u ON ac.user_id = u.id
        WHERE ac.assignment_id = ?
        ORDER BY ac.created_at ASC
    `;
    try {
        return await db.all(query, [assignmentId]);
    } catch (err) {
        throw new DatabaseError('Failed to get assignment comments', err);
    }
}

async function addComment(assignmentId, userId, commentText) {
    const query = 'INSERT INTO assignment_comments (assignment_id, user_id, comment, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)';
    try {
        const result = await db.run(query, [assignmentId, userId, commentText]);
        const id = result.insertId || result.lastID;
        return await db.get('SELECT ac.*, u.username, u.fullName FROM assignment_comments ac JOIN users u ON ac.user_id = u.id WHERE ac.id = ?', [id]);
    } catch (err) {
        throw new DatabaseError('Failed to add assignment comment', err);
    }
}

async function addReply(assignmentId, commentId, userId, replyText) {
    const query = 'INSERT INTO assignment_comments (assignment_id, user_id, comment, parent_id, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)';
    try {
        const result = await db.run(query, [assignmentId, userId, replyText, commentId]);
        const id = result.insertId || result.lastID;
        return await db.get('SELECT ac.*, u.username, u.fullName FROM assignment_comments ac JOIN users u ON ac.user_id = u.id WHERE ac.id = ?', [id]);
    } catch (err) {
        throw new DatabaseError('Failed to add assignment reply', err);
    }
}

/**
 * Update assignment
 */
async function update(id, updates) {
    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(updates)) {
        fields.push(`${key} = ?`);
        params.push(value);
    }
    if (fields.length === 0) return false;
    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const query = `UPDATE assignments SET ${fields.join(', ')} WHERE id = ?`;
    try {
        const result = await db.run(query, params);
        return (result.changes || result.affectedRows) > 0;
    } catch (err) {
        throw new DatabaseError('Failed to update assignment', err);
    }
}

/**
 * Delete attachment from an assignment
 */
async function deleteAttachment(attachmentId) {
    try {
        await db.run('DELETE FROM assignment_attachments WHERE id = ?', [attachmentId]);
        return true;
    } catch (err) {
        throw new DatabaseError('Failed to delete assignment attachment', err);
    }
}

module.exports = {
    create,
    findById,
    findByTeam,
    findByUserId,
    update,
    addMember,
    createMembers,
    updateMemberStatus,
    findLedTeams,
    findTeamSubmissions,
    findAllWithDetails,
    getComments,
    addComment,
    addReply,
    deleteAttachment,
    deleteById: async (id) => {
        await db.run('DELETE FROM assignment_members WHERE assignment_id = ?', [id]);
        await db.run('DELETE FROM assignments WHERE id = ?', [id]);
        return true;
    }
};
