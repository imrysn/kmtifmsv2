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
        current_stage = 'pending_team_leader',
        folder_name = null,
        relative_path = null,
        is_folder = false
    } = fileData;

    const query = `
    INSERT INTO files (
      filename, original_name, file_path, file_size, file_type, mime_type,
      description, user_id, username, user_team, status, current_stage,
      folder_name, relative_path, is_folder,
      uploaded_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;

    try {
        const result = await db.run(
            query,
            [filename, original_name, file_path, file_size, file_type, mime_type,
                description, user_id, username, user_team, status, current_stage,
                folder_name, relative_path, is_folder ? 1 : 0]
        );
        return result.lastID;
    } catch (err) {
        throw new DatabaseError('Failed to create file record', err);
    }
}

/**
 * Find file by ID
 * @param {number} fileId - File ID
 * @returns {Promise<Object|null>} - File object or null
 */
async function findById(fileId) {
    try {
        const file = await db.get('SELECT * FROM files WHERE id = ?', [fileId]);
        return file || null;
    } catch (err) {
        throw new DatabaseError('Failed to find file', err);
    }
}

/**
 * Find files by user ID
 * @param {number} userId - User ID
 * @param {Object} options - Query options (limit, offset, status)
 * @returns {Promise<Array>} - Array of files
 */
async function findByUserId(userId, options = {}) {
    const { limit = 100, offset = 0, status } = options;

    let query = `
        SELECT f.*, u.username as username, u.fullName as user_fullname, u.team as user_team
        FROM files f
        JOIN users u ON f.user_id = u.id
        WHERE f.user_id = ?
    `;
    const params = [userId];

    if (status) {
        query += ' AND f.status = ?';
        params.push(status);
    }

    query += ' ORDER BY f.uploaded_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    try {
        const files = await db.all(query, params);
        return files || [];
    } catch (err) {
        throw new DatabaseError('Failed to find files by user', err);
    }
}

/**
 * Find files by team
 * @param {string} team - Team name
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Array of files
 */
async function findByTeam(team, options = {}) {
    const { limit = 100, offset = 0, status, stage } = options;

    let query = `
        SELECT f.*, u.username as username, u.fullName as user_fullname, u.team as user_team
        FROM files f
        JOIN users u ON f.user_id = u.id
        WHERE f.user_team = ?
    `;
    const params = [team];

    if (status) {
        query += ' AND f.status = ?';
        params.push(status);
    }

    if (stage) {
        query += ' AND f.current_stage = ?';
        params.push(stage);
    }

    query += ' ORDER BY f.uploaded_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    try {
        const files = await db.all(query, params);
        return files || [];
    } catch (err) {
        throw new DatabaseError('Failed to find files by team', err);
    }
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

    try {
        const result = await db.run(query, values);
        return (result.changes || result.affectedRows) > 0;
    } catch (err) {
        throw new DatabaseError('Failed to update file status', err);
    }
}

/**
 * Update multiple files status (batch)
 * @param {Array<number>} fileIds - Array of file IDs
 * @param {Object} updates - Updates to apply
 * @returns {Promise<number>} - Number of files updated
 */
async function updateBatchStatus(fileIds, updates) {
    if (!fileIds || fileIds.length === 0) return 0;

    const { status, current_stage, admin_id, admin_username, admin_comments } = updates;
    const fields = [];
    const values = [];

    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    if (current_stage !== undefined) { fields.push('current_stage = ?'); values.push(current_stage); }
    if (admin_id !== undefined) { fields.push('admin_id = ?, admin_reviewed_at = CURRENT_TIMESTAMP'); values.push(admin_id); }
    if (admin_username !== undefined) { fields.push('admin_username = ?'); values.push(admin_username); }
    if (admin_comments !== undefined) { fields.push('admin_comments = ?'); values.push(admin_comments); }

    fields.push('updated_at = CURRENT_TIMESTAMP');

    const placeholders = fileIds.map(() => '?').join(',');
    const query = `UPDATE files SET ${fields.join(', ')} WHERE id IN (${placeholders})`;
    values.push(...fileIds);

    try {
        const result = await db.run(query, values);
        return result.changes || result.affectedRows || 0;
    } catch (err) {
        throw new DatabaseError('Failed to batch update file status', err);
    }
}

/**
 * Delete file record
 * @param {number} fileId - File ID
 * @returns {Promise<boolean>} - Success status
 */
async function deleteById(fileId) {
    try {
        const result = await db.run('DELETE FROM files WHERE id = ?', [fileId]);
        return (result.changes || result.affectedRows) > 0;
    } catch (err) {
        throw new DatabaseError('Failed to delete file', err);
    }
}

/**
 * Find file with its latest comment
 * @param {number} fileId - File ID
 * @returns {Promise<Object|null>} - File object with latest_comment or null
 */
async function findByIdWithLatestComment(fileId) {
    const query = `
        SELECT f.*, fc.comment as latest_comment
        FROM files f
        LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (
            SELECT MAX(id) FROM file_comments WHERE file_id = f.id
        )
        WHERE f.id = ?
    `;
    try {
        const file = await db.get(query, [fileId]);
        return file || null;
    } catch (err) {
        throw new DatabaseError('Failed to find file with latest comment', err);
    }
}

/**
 * Find files by name and user (for duplicate check)
 * @param {string} originalName - Original filename
 * @param {number} userId - User ID
 * @param {string} folderName - Optional folder name
 * @returns {Promise<Object|null>} - File object or null
 */
async function findByNameAndUser(originalName, userId, folderName = null) {
    let query = 'SELECT * FROM files WHERE original_name = ? AND user_id = ?';
    const params = [originalName, userId];

    if (folderName) {
        query += ' AND folder_name = ?';
        params.push(folderName);
    } else {
        query += ' AND (folder_name IS NULL OR folder_name = "")';
    }

    try {
        const file = await db.get(query, params);
        return file || null;
    } catch (err) {
        throw new DatabaseError('Failed to find duplicate file', err);
    }
}

/**
 * Find all files and attachments for comprehensive view
 * @returns {Promise<Array>} - Combined array of files and attachments
 */
async function findAllWithAttachments() {
    const filesQuery = `
        SELECT f.*, fc.comment as latest_comment
        FROM files f
        LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (
            SELECT MAX(id) FROM file_comments WHERE file_id = f.id
        )
        ORDER BY f.uploaded_at DESC
    `;

    const attachmentsQuery = `
        SELECT
            aa.id, aa.original_name, aa.filename, aa.file_path, aa.file_size, aa.file_type,
            aa.created_at AS uploaded_at,
            COALESCE(aa.status, 'team_leader_approved') AS status,
            COALESCE(aa.current_stage, 'pending_admin') AS current_stage,
            aa.uploaded_by_username AS username, aa.uploaded_by_id AS user_id,
            u.team AS user_team,
            COALESCE(aa.folder_name, NULL) AS folder_name,
            COALESCE(aa.relative_path, NULL) AS relative_path,
            'assignment_attachment' AS source_type,
            a.id AS assignment_id
        FROM assignment_attachments aa
        LEFT JOIN assignments a ON aa.assignment_id = a.id
        LEFT JOIN users u ON aa.uploaded_by_id = u.id
        ORDER BY aa.created_at DESC
    `;

    try {
        const files = await db.all(filesQuery);
        const attachments = await db.all(attachmentsQuery);
        return { files: files || [], attachments: attachments || [] };
    } catch (err) {
        throw new DatabaseError('Failed to fetch all files and attachments', err);
    }
}

/**
 * Find attachment by ID
 * @param {number} attachmentId - Attachment ID
 * @returns {Promise<Object|null>} - Attachment object or null
 */
async function findAttachmentById(attachmentId) {
    const query = 'SELECT *, created_at AS uploaded_at FROM assignment_attachments WHERE id = ?';
    try {
        const attachment = await db.get(query, [attachmentId]);
        return attachment || null;
    } catch (err) {
        throw new DatabaseError('Failed to find assignment attachment', err);
    }
}

/**
 * Update attachment status
 * @param {number} attachmentId - Attachment ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<boolean>} - Success status
 */
async function updateAttachmentStatus(attachmentId, updates) {
    const { status, current_stage, admin_comments } = updates;
    const nowSql = new Date().toISOString().slice(0, 19).replace('T', ' ');

    let query, params;
    if (status === 'final_approved') {
        query = `UPDATE assignment_attachments SET status = ?, current_stage = ?, admin_reviewed_at = ?, admin_comments = ?, final_approved_at = ? WHERE id = ?`;
        params = [status, current_stage, nowSql, admin_comments || null, nowSql, attachmentId];
    } else {
        query = `UPDATE assignment_attachments SET status = ?, current_stage = ?, admin_reviewed_at = ?, admin_comments = ? WHERE id = ?`;
        params = [status, current_stage, nowSql, admin_comments || null, attachmentId];
    }

    try {
        const result = await db.run(query, params);
        return (result.changes || result.affectedRows) > 0;
    } catch (err) {
        // Fallback for cases where columns might not exist yet during migration
        console.warn('⚠️ Repository warning: updateAttachmentStatus failed (schema may be incomplete)', err.message);
        return false;
    }
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

    try {
        const result = await db.get(query, params);
        return result?.count || 0;
    } catch (err) {
        throw new DatabaseError('Failed to count files', err);
    }
}

/**
 * Get comments for a file
 * @param {number} fileId - File ID
 * @returns {Promise<Array>} - Array of comments
 */
async function getComments(fileId) {
    const query = `
        SELECT fc.*, u.username, u.fullName
        FROM file_comments fc
        LEFT JOIN users u ON fc.user_id = u.id
        WHERE fc.file_id = ?
        ORDER BY fc.created_at DESC
    `;
    try {
        return await db.all(query, [fileId]);
    } catch (err) {
        throw new DatabaseError('Failed to fetch file comments', err);
    }
}

/**
 * Add a comment to a file
 * @param {number} fileId - File ID
 * @param {Object} commentData - Comment data
 * @returns {Promise<number>} - Inserted comment ID
 */
async function addComment(fileId, commentData) {
    const { user_id, username, comment } = commentData;
    const query = 'INSERT INTO file_comments (file_id, user_id, username, comment, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)';
    try {
        const result = await db.run(query, [fileId, user_id, username, comment]);
        return result.insertId || result.lastID;
    } catch (err) {
        throw new DatabaseError('Failed to add file comment', err);
    }
}

/**
 * Get status history for a file
 * @param {number} fileId - File ID
 * @returns {Promise<Array>} - Array of history records
 */
async function getHistory(fileId) {
    const query = 'SELECT * FROM file_status_history WHERE file_id = ? ORDER BY changed_at DESC';
    try {
        return await db.all(query, [fileId]);
    } catch (err) {
        throw new DatabaseError('Failed to fetch file history', err);
    }
}

/**
 * Find files pending review
 * @param {string} stage - Review stage
 * @param {string} team - Optional team filter
 * @returns {Promise<Array>} - Array of files
 */
async function findPendingByStage(stage, team = null) {
    let query = `
        SELECT f.*, u.username as username, u.fullName as user_fullname, u.team as user_team, 
               tl.username as team_leader_name
        FROM files f
        JOIN users u ON f.user_id = u.id
        LEFT JOIN users tl ON f.team_leader_id = tl.id
        WHERE f.current_stage = ?
    `;
    const params = [stage];

    if (team) {
        query += ' AND f.user_team = ?';
        params.push(team);
    }

    query += ' ORDER BY f.uploaded_at DESC';

    try {
        return await db.all(query, params);
    } catch (err) {
        throw new DatabaseError(`Failed to fetch files pending ${stage} review`, err);
    }
}

/**
 * Find all files for admin view with comprehensive details
 * @param {Object} options - Pagination/Filter options
 * @returns {Promise<Array>} - Array of files
 */
async function findAllWithDetails(options = {}) {
    const { team, status, stage, limit = 1000, offset = 0 } = options;
    let query = `
        SELECT f.*, u.username as username, u.fullName as user_fullname, u.team as user_team,
               fc.comment as latest_comment
        FROM files f
        JOIN users u ON f.user_id = u.id
        LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (
            SELECT MAX(id) FROM file_comments WHERE file_id = f.id
        )
        WHERE 1=1
    `;
    const params = [];

    if (team) {
        query += ' AND f.user_team = ?';
        params.push(team);
    }
    
    if (status) {
        if (Array.isArray(status)) {
            query += ` AND f.status IN (${status.map(() => '?').join(',')})`;
            params.push(...status);
        } else {
            query += ' AND f.status = ?';
            params.push(status);
        }
    }

    if (stage) {
        if (Array.isArray(stage)) {
            query += ` AND f.current_stage IN (${stage.map(() => '?').join(',')})`;
            params.push(...stage);
        } else {
            query += ' AND f.current_stage = ?';
            params.push(stage);
        }
    }

    query += ' ORDER BY f.uploaded_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    try {
        return await db.all(query, params);
    } catch (err) {
        throw new DatabaseError('Failed to fetch all files with details', err);
    }
}

/**
 * Update file priority and due date
 */
async function updatePriority(fileId, priority, dueDate) {
    const fields = [];
    const params = [];
    if (priority !== undefined) { fields.push('priority = ?'); params.push(priority); }
    if (dueDate !== undefined) { fields.push('due_date = ?'); params.push(dueDate); }
    if (fields.length === 0) return false;
    params.push(fileId);
    const query = `UPDATE files SET ${fields.join(', ')} WHERE id = ?`;
    try {
        const result = await db.run(query, params);
        return (result.changes || result.affectedRows) > 0;
    } catch (err) {
        throw new DatabaseError('Failed to update file priority', err);
    }
}

/**
 * Find attachment by ID (from assignment_attachments)
 */
async function findAttachmentById(id) {
    try {
        return await db.get('SELECT * FROM assignment_attachments WHERE id = ?', [id]);
    } catch (err) {
        throw new DatabaseError('Failed to find attachment', err);
    }
}

/**
 * Delete multiple files and their assignment submissions
 */
async function deleteBatch(fileIds) {
    if (!fileIds || fileIds.length === 0) return;
    const placeholders = fileIds.map(() => '?').join(',');
    try {
        await db.run(`DELETE FROM assignment_submissions WHERE file_id IN (${placeholders})`, fileIds);
        await db.run(`DELETE FROM files WHERE id IN (${placeholders})`, fileIds);
    } catch (err) {
        throw new DatabaseError('Failed to batch delete files', err);
    }
}

/**
 * Create a new attachment for an assignment (from Team Leader)
 */
async function createAttachment(data) {
    const {
        assignment_id, file_path, original_name, filename, file_size, 
        file_type, uploaded_by_username, folder_name
    } = data;

    const query = `
        INSERT INTO assignment_attachments (
            assignment_id, file_path, original_name, filename, file_size, 
            file_type, uploaded_by_username, folder_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    try {
        const result = await db.run(query, [
            assignment_id, file_path, original_name, filename, file_size, 
            file_type, uploaded_by_username, folder_name
        ]);
        return result.insertId || result.lastID;
    } catch (err) {
        throw new DatabaseError('Failed to create assignment attachment', err);
    }
}

/**
 * Find all assignment attachments with details
 */
async function findAllAttachmentsWithDetails(options = {}) {
    const { team, limit = 1000, offset = 0, userId } = options;
    let query = `
        SELECT
            aa.id, aa.original_name, aa.filename, aa.file_path, aa.file_size, aa.file_type,
            aa.created_at AS uploaded_at,
            COALESCE(aa.status, 'team_leader_approved') AS status,
            COALESCE(aa.current_stage, 'pending_admin') AS current_stage,
            aa.uploaded_by_username AS username, aa.uploaded_by_id AS user_id,
            u.team AS user_team, u.fullName AS user_fullname,
            COALESCE(aa.folder_name, NULL) AS folder_name,
            COALESCE(aa.relative_path, NULL) AS relative_path,
            'assignment_attachment' AS source_type,
            aa.assignment_id
        FROM assignment_attachments aa
        LEFT JOIN users u ON aa.uploaded_by_id = u.id
        WHERE 1=1
    `;
    const params = [];

    if (team) {
        query += ' AND u.team = ?';
        params.push(team);
    }

    if (userId) {
        query += ' AND aa.uploaded_by_id = ?';
        params.push(userId);
    }

    query += ' ORDER BY aa.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    try {
        return await db.all(query, params);
    } catch (err) {
        throw new DatabaseError('Failed to fetch assignment attachments with details', err);
    }
}

module.exports = {
    create,
    findById,
    findByUserId,
    findByTeam,
    updateStatus,
    updateBatchStatus,
    updatePriority,
    deleteById,
    deleteBatch,
    findByIdWithLatestComment,
    findByNameAndUser,
    findAllWithAttachments,
    findAttachmentById,
    createAttachment,
    updateAttachmentStatus,
    getComments,
    addComment,
    getHistory,
    findPendingByStage,
    findAllWithDetails,
    findAllAttachmentsWithDetails,
    count
};
