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
 */
async function create(fileData) {
    const {
        filename,
        original_name,
        file_path,
        file_size,
        file_type,
        mime_type = fileData.file_type || 'application/octet-stream',
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `;

    try {
        const result = await db.run(
            query,
            [
                filename,
                original_name,
                file_path,
                file_size,
                file_type,
                mime_type,
                description || null,
                user_id,
                username,
                user_team,
                status,
                current_stage,
                folder_name || null,
                relative_path || null,
                is_folder ? 1 : 0
            ]
        );
        return result.insertId || result.lastID;
    } catch (err) {
        throw new DatabaseError('Failed to create file record', err);
    }
}

/**
 * Find file by ID
 */
async function findById(fileId) {
    try {
        // Join with assignment_submissions and assignments to get task context
        const query = `
            SELECT f.*, a.title as assignment_title, a.id as assignment_id
            FROM files f
            LEFT JOIN assignment_submissions asub ON f.id = asub.file_id
            LEFT JOIN assignments a ON asub.assignment_id = a.id
            WHERE f.id = ?
        `;
        const file = await db.get(query, [fileId]);
        return file || null;
    } catch (err) {
        throw new DatabaseError('Failed to find file', err);
    }
}

/**
 * Find files by user ID
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
        rejected_by,
        public_network_url
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
        fields.push('team_leader_id = ?, team_leader_reviewed_at = NOW()');
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
        fields.push('admin_id = ?, admin_reviewed_at = NOW()');
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
        fields.push('rejection_reason = ?, rejected_at = NOW()');
        values.push(rejection_reason);
    }
    if (rejected_by !== undefined) {
        fields.push('rejected_by = ?');
        values.push(rejected_by);
    }
    if (public_network_url !== undefined) {
        fields.push('public_network_url = ?');
        values.push(public_network_url);
    }

    fields.push('updated_at = NOW()');

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
 */
async function updateBatchStatus(fileIds, updates) {
    if (!fileIds || fileIds.length === 0) return 0;

    const { status, current_stage, admin_id, admin_username, admin_comments } = updates;
    const fields = [];
    const values = [];

    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    if (current_stage !== undefined) { fields.push('current_stage = ?'); values.push(current_stage); }
    if (admin_id !== undefined) { fields.push('admin_id = ?, admin_reviewed_at = NOW()'); values.push(admin_id); }
    if (admin_username !== undefined) { fields.push('admin_username = ?'); values.push(admin_username); }
    if (admin_comments !== undefined) { fields.push('admin_comments = ?'); values.push(admin_comments); }

    fields.push('updated_at = NOW()');

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
 * Find files by name and user (for duplicate check).
 * If assignmentId is provided, only matches files already submitted to that assignment.
 * This allows the same file name to be uploaded to different tasks.
 */
async function findByNameAndUser(originalName, userId, folderName = null, assignmentId = null) {
    let query;
    const params = [];

    if (assignmentId) {
        // Scoped duplicate check: only flag as duplicate if the same file
        // is already submitted for THIS specific assignment.
        //
        // When folderName is provided, scope to that folder (prevents false matches
        // across different folders in the same assignment).
        // When folderName is null (e.g. user re-uploads a single file), search
        // across ALL folders — the service layer inherits the original path.
        //
        // ORDER BY ensures we get the most path-rich and most recently rejected
        // record first when multiple records exist for the same filename.
        let whereExtra = '';
        if (folderName) {
            whereExtra = ' AND f.folder_name = ?';
            params.push(assignmentId, userId, originalName, userId, folderName);
        } else {
            params.push(assignmentId, userId, originalName, userId);
        }
        query = `
            SELECT f.* FROM files f
            INNER JOIN assignment_submissions asub
                ON asub.file_id = f.id
                AND asub.assignment_id = ?
                AND asub.user_id = ?
            WHERE f.original_name = ? AND f.user_id = ?${whereExtra}
            ORDER BY
                CASE WHEN f.folder_name IS NOT NULL AND f.folder_name != '' THEN 0 ELSE 1 END,
                CASE WHEN f.status IN ('rejected_by_team_leader','rejected_by_admin') THEN 0 ELSE 1 END,
                f.uploaded_at DESC
            LIMIT 1`;
    } else {
        // Legacy fallback (no task context): check across all files for this user
        query = 'SELECT * FROM files WHERE original_name = ? AND user_id = ?';
        params.push(originalName, userId);
        if (folderName) {
            query += ' AND folder_name = ?';
            params.push(folderName);
        } else {
            query += ' AND (folder_name IS NULL OR folder_name = "")';
        }
    }

    try {
        const file = await db.get(query, params);
        return file || null;
    } catch (err) {
        throw new DatabaseError('Failed to find duplicate file', err);
    }
}

/**
 * Find ANY existing file for a given assignment+user+filename, regardless of status.
 * Used to recover original folder/path when re-uploading a file that was previously
 * submitted (rejected, revision, or any status) and may have lost its folder context.
 * Prefers records that have a folder_name set (most specific path info).
 */
async function findAnyByNameAndAssignment(originalName, userId, assignmentId) {
    const query = `
        SELECT f.* FROM files f
        INNER JOIN assignment_submissions asub
            ON asub.file_id = f.id
            AND asub.assignment_id = ?
            AND asub.user_id = ?
        WHERE f.original_name = ? AND f.user_id = ?
        ORDER BY
            CASE WHEN f.folder_name IS NOT NULL AND f.folder_name != '' THEN 0 ELSE 1 END,
            f.uploaded_at DESC
        LIMIT 1`;
    try {
        const file = await db.get(query, [assignmentId, userId, originalName, userId]);
        return file || null;
    } catch (err) {
        throw new DatabaseError('Failed to find file by name and assignment', err);
    }
}

/**
 * Find attachment by ID
 * FIX: Was defined twice in this file — the second bare definition was silently
 *      overwriting this richer one (which includes created_at AS uploaded_at).
 *      Duplicate removed, this single definition is now canonical.
 */
async function findAttachmentById(attachmentId) {
    const query = `
        SELECT att.*, att.created_at AS uploaded_at,
               a.title AS assignment_title,
               COALESCE(a.team, u.team) AS user_team,
               att.uploaded_by_username AS username
        FROM assignment_attachments att
        LEFT JOIN assignments a ON att.assignment_id = a.id
        LEFT JOIN users u ON att.uploaded_by_id = u.id
        WHERE att.id = ?
    `;
    try {
        const attachment = await db.get(query, [attachmentId]);
        return attachment || null;
    } catch (err) {
        throw new DatabaseError('Failed to find assignment attachment', err);
    }
}

/**
 * Update attachment status
 */
async function updateAttachmentStatus(attachmentId, updates) {
    const { status, current_stage, admin_comments, public_network_url } = updates;
    const nowSql = new Date().toISOString().slice(0, 19).replace('T', ' ');

    let query, params;
    if (status === 'final_approved') {
        query = `UPDATE assignment_attachments SET status = ?, current_stage = ?, admin_reviewed_at = ?, admin_comments = ?, final_approved_at = ? WHERE id = ?`;
        params = [status, current_stage, nowSql, admin_comments || null, nowSql, attachmentId];
    } else if (public_network_url !== undefined && status === undefined) {
        // Path-only update (e.g. after moveToProjects)
        query = `UPDATE assignment_attachments SET public_network_url = ? WHERE id = ?`;
        params = [public_network_url, attachmentId];
    } else {
        query = `UPDATE assignment_attachments SET status = ?, current_stage = ?, admin_reviewed_at = ?, admin_comments = ? WHERE id = ?`;
        params = [status, current_stage, nowSql, admin_comments || null, attachmentId];
    }

    try {
        const result = await db.run(query, params);
        return (result.changes || result.affectedRows) > 0;
    } catch (err) {
        // Soft failure: attachment table schema may be incomplete — non-fatal, caller proceeds
        return false;
    }
}

/**
 * Count files by criteria
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
 * Batch insert multiple attachments in a single query
 */
async function createAttachmentBatch(attachmentsData) {
    if (!attachmentsData || attachmentsData.length === 0) return [];

    const placeholders = attachmentsData.map(() =>
        '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
    ).join(', ');

    const values = attachmentsData.flatMap(d => [
        d.assignment_id,
        d.file_path,
        d.original_name,
        d.filename,
        d.file_size,
        d.file_type,
        d.uploaded_by_id || null,
        d.uploaded_by_username,
        d.folder_name || null,
        d.relative_path || null
    ]);

    const query = `
        INSERT INTO assignment_attachments (
            assignment_id, file_path, original_name, filename, file_size,
            file_type, uploaded_by_id, uploaded_by_username, folder_name, relative_path, created_at
        ) VALUES ${placeholders}
    `;

    try {
        const result = await db.run(query, values);
        return result;
    } catch (err) {
        throw new DatabaseError('Failed to batch create assignment attachments', err);
    }
}

/**
 * Create a new attachment for an assignment (from Team Leader)
 */
async function createAttachment(data) {
    const {
        assignment_id, file_path, original_name, filename, file_size,
        file_type, uploaded_by_id = null, uploaded_by_username, folder_name,
        relative_path = null
    } = data;

    const query = `
        INSERT INTO assignment_attachments (
            assignment_id, file_path, original_name, filename, file_size, 
            file_type, uploaded_by_id, uploaded_by_username, folder_name, relative_path, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    try {
        const result = await db.run(query, [
            assignment_id, file_path, original_name, filename, file_size,
            file_type, uploaded_by_id, uploaded_by_username, folder_name, relative_path
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
    findAnyByNameAndAssignment,
    findAttachmentById,
    createAttachment,
    createAttachmentBatch,
    updateAttachmentStatus,
    getComments,
    addComment,
    getHistory,
    findPendingByStage,
    findAllWithDetails,
    findAllAttachmentsWithDetails,
    count
};
