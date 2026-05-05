const assignmentService = require('../services/assignmentService');
const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/errorHandler');

/**
 * Assignment Controller
 * Handles HTTP requests for assignment operations
 *
 * FIXES APPLIED:
 * - Removed duplicate method definitions (getAllSubmissions x2, getTeamLeaderAssignments x2)
 * - Fixed submitAssignment argument order: was (id, req.user.id, finalFileIds),
 *   now correctly (id, finalFileIds, req.user)
 * - editComment and deleteComment moved to use assignmentService instead of raw db
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
     * Get all submitted files for file collection (Team Leader)
     * Route: GET /submissions
     * Uses authenticated user's ID — no param needed
     */
    getAllSubmissions = asyncHandler(async (req, res) => {
        const result = await assignmentService.getAllSubmissionsForTL(req.user.id);
        res.json({ success: true, ...result });
    });

    /**
     * Get all submissions for a specific team leader (by param)
     * Route: GET /team-leader/:userId/all-submissions
     */
    getAllSubmissionsForTL = asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const result = await assignmentService.getAllSubmissionsForTL(userId);
        res.json({ success: true, submissions: result.submissions || [] });
    });

    /**
     * Get assignments for team leader (authenticated user)
     * Route: GET /team-leader/:userId
     */
    getTeamLeaderAssignments = asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const result = await assignmentService.getTeamLeaderAssignments(userId);
        res.json({ success: true, assignments: result.assignments || [] });
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
     * FIX: Was using raw db.run directly — now goes through service layer
     */
    editComment = asyncHandler(async (req, res) => {
        const { commentId } = req.params;
        const { comment } = req.body;
        if (!comment || !comment.trim()) throw new ValidationError('Comment text is required');
        await assignmentService.editComment(commentId, comment, req.user);
        res.json({ success: true, message: 'Comment updated successfully' });
    });

    /**
     * Delete a comment or reply
     * FIX: Was using raw db.run directly — now goes through service layer
     */
    deleteComment = asyncHandler(async (req, res) => {
        const { commentId } = req.params;
        await assignmentService.deleteComment(commentId, req.user);
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
     * Submit assignment
     * FIX: Arguments were in wrong order — was (id, req.user.id, finalFileIds)
     *      Service expects (assignmentId, fileIds, user)
     */
    submitAssignment = asyncHandler(async (req, res) => {
        const id = req.params.id || req.body.assignmentId;
        const { fileIds, fileId } = req.body;

        if (!id) throw new ValidationError('Assignment ID is required');

        // Handle single fileId or array of fileIds
        const finalFileIds = Array.isArray(fileIds) ? fileIds : (fileId ? [fileId] : []);

        if (finalFileIds.length === 0) throw new ValidationError('At least one file ID is required');

        await assignmentService.submitAssignment(id, finalFileIds, req.user);
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
        const id = req.params.id || req.params.assignmentId;
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
    /**
     * Delete a submitted file from an assignment
     */
    deleteSubmissionFile = asyncHandler(async (req, res) => {
        const { id, fileId } = req.params;
        await assignmentService.deleteSubmissionFile(id, fileId, req.user);
        res.json({ success: true, message: 'Submission file removed' });
    });
}

module.exports = new AssignmentController();
