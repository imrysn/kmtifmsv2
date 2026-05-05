const assignmentService = require('../services/assignmentService');
const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/errorHandler');

/**
 * Assignment Controller
 * Handles HTTP requests for assignment operations
 */
class AssignmentController {
    /**
     * Get all assignments (Admin view)
     */
    getAllAssignments = asyncHandler(async (req, res) => {
        const { cursor, limit = 20 } = req.query;
        const result = await assignmentService.getAllAssignments({
            cursor,
            limit: parseInt(limit, 10)
        });
        res.json({ success: true, ...result });
    });

    /**
     * Get assignments for a team
     */
    getTeamAssignments = asyncHandler(async (req, res) => {
        const { team } = req.params;
        const { cursor, limit = 20 } = req.query;
        const result = await assignmentService.getTeamAssignments(team, {
            cursor,
            limit: parseInt(limit, 10)
        });
        res.json({ success: true, ...result });
    });

    /**
     * Get all submissions for team leader
     */
    getAllSubmissions = asyncHandler(async (req, res) => {
        const result = await assignmentService.getAllSubmissionsForTL(req.user.id);
        res.json({ success: true, ...result });
    });

    /**
     * Get assignments for team leader
     */
    getTeamLeaderAssignments = asyncHandler(async (req, res) => {
        // Now uses authenticated user ID to find led teams
        const result = await assignmentService.getTeamLeaderAssignments(req.user.id);
        res.json({ success: true, ...result });
    });

    /**
     * Get all submitted files for file collection (Team Leader)
     */
    getAllSubmissions = asyncHandler(async (req, res) => {
        const result = await assignmentService.getAllSubmissionsForTL(req.user.id);
        res.json({ success: true, ...result });
    });

    /**
     * Get assignment by ID
     */
    getAssignmentById = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const assignment = await assignmentService.getAssignmentById(id, req.user);
        res.json({ success: true, assignment });
    });

    /**
     * Create assignment
     */
    createAssignment = asyncHandler(async (req, res) => {
        const result = await assignmentService.createAssignment(req.body, req.files, req.user);
        res.status(201).json({ success: true, ...result });
    });

    /**
     * Update assignment
     */
    updateAssignment = asyncHandler(async (req, res) => {
        const { id } = req.params;
        await assignmentService.updateAssignment(id, req.body, req.files, req.user);
        res.json({ success: true, message: 'Assignment updated successfully' });
    });

    /**
     * Delete assignment
     */
    deleteAssignment = asyncHandler(async (req, res) => {
        const { id } = req.params;
        await assignmentService.deleteAssignment(id, req.user);
        res.json({ success: true, message: 'Assignment deleted successfully' });
    });

    /**
     * Get comments for assignment
     */
    getComments = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const comments = await assignmentService.getComments(id);
        res.json({ success: true, comments });
    });

    /**
     * Add comment to assignment
     */
    addComment = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { comment } = req.body;
        const newComment = await assignmentService.addComment(id, req.user.id, comment);

        res.json({
            success: true,
            message: 'Comment added successfully',
            comment: newComment
        });
    });

    /**
     * Add reply to comment
     */
    addReply = asyncHandler(async (req, res) => {
        const { id, commentId } = req.params;
        const { reply } = req.body;
        const newReply = await assignmentService.addReply(id, commentId, req.user.id, reply);

        res.json({
            success: true,
            message: 'Reply added successfully',
            reply: newReply
        });
    });

    /**
     * Edit a comment or reply
     */
    editComment = asyncHandler(async (req, res) => {
        const { commentId } = req.params;
        const { comment } = req.body;
        const { db } = require('../config/database');
        await db.run(
            'UPDATE assignment_comments SET comment = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [comment, commentId]
        );
        res.json({ success: true, message: 'Comment updated successfully' });
    });

    /**
     * Delete a comment or reply
     */
    deleteComment = asyncHandler(async (req, res) => {
        const { commentId } = req.params;
        const { db } = require('../config/database');
        // Delete child replies first, then the parent comment
        await db.run('DELETE FROM assignment_comments WHERE parent_id = ?', [commentId]);
        await db.run('DELETE FROM assignment_comments WHERE id = ?', [commentId]);
        res.json({ success: true, message: 'Comment deleted successfully' });
    });
    /**
     * Get assignments for a specific user (admin/team leader view)
     */
    getUserAssignmentsById = asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const result = await assignmentService.getUserAssignments(userId, req.query);
        res.json({ success: true, assignments: result });
    });

    /**
     * Get current user assignments
     */
    getUserAssignments = asyncHandler(async (req, res) => {
        const result = await assignmentService.getUserAssignments(req.user.id, req.query);
        res.json({ success: true, assignments: result });
    });

    /**
     * Get assignments created by a team leader
     */
    getTeamLeaderAssignments = asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const result = await assignmentService.getTeamLeaderAssignments(userId);
        res.json({ success: true, assignments: result.assignments || [] });
    });

    /**
     * Get all submissions for a team leader
     */
    getAllSubmissionsForTL = asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const result = await assignmentService.getAllSubmissionsForTL(userId);
        res.json({ success: true, submissions: result.submissions || [] });
    });

    /**
     * Submit assignment
     */
    submitAssignment = asyncHandler(async (req, res) => {
        const id = req.params.id || req.body.assignmentId;
        const { fileIds, fileId } = req.body;
        
        if (!id) throw new ValidationError('Assignment ID is required');
        
        // Handle single fileId or array of fileIds
        const finalFileIds = Array.isArray(fileIds) ? fileIds : (fileId ? [fileId] : []);
        
        await assignmentService.submitAssignment(id, req.user.id, finalFileIds);
        res.json({ success: true, message: 'Assignment submitted successfully' });
    });
    /**
     * Get assignment details
     */
    getAssignmentDetails = asyncHandler(async (req, res) => {
        const id = req.params.id || req.params.assignmentId;
        const assignment = await assignmentService.getAssignmentById(id, req.user);
        res.json({ success: true, assignment });
    });
    /**
     * Mark assignment as done
     */
    markDone = asyncHandler(async (req, res) => {
        const { id } = req.params;
        await assignmentService.markAssignmentDone(id, req.user);
        res.json({ success: true, message: 'Assignment marked as completed' });
    });

    /**
     * Delete attachment
     */
    deleteAttachment = asyncHandler(async (req, res) => {
        const { id, attachmentId } = req.params;
        await assignmentService.deleteAttachment(id, attachmentId, req.user);
        res.json({ success: true, message: 'Attachment deleted successfully' });
    });
    /**
     * Delete attachment folder
     */
    deleteAttachmentFolder = asyncHandler(async (req, res) => {
        const { id, folderName } = req.params;
        await assignmentService.deleteAttachmentFolder(id, folderName, req.user);
        res.json({ success: true, message: `Folder "${folderName}" deleted successfully` });
    });
}

module.exports = new AssignmentController();
