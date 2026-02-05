const assignmentService = require('../services/assignmentService');
const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/errorHandler');

/**
 * Assignment Controller
 * Handles HTTP requests for assignment operations
 * Delegates business logic to assignmentService
 */
class AssignmentController {
    /**
     * Get all assignments (admin view)
     * GET /api/assignments/admin/all
     */
    getAllAssignments = asyncHandler(async (req, res) => {
        const { cursor, limit = 20 } = req.query;
        const parsedLimit = parseInt(limit, 10);

        const result = await assignmentService.getAllAssignments({
            cursor,
            limit: parsedLimit
        });

        res.json({
            success: true,
            ...result
        });
    });

    /**
     * Get assignments for a team
     * GET /api/assignments/team/:team/all-tasks
     */
    getTeamAssignments = asyncHandler(async (req, res) => {
        const { team } = req.params;
        const { cursor, limit = 20 } = req.query;
        const parsedLimit = parseInt(limit, 10);

        const result = await assignmentService.getTeamAssignments(team, {
            cursor,
            limit: parsedLimit
        });

        res.json({
            success: true,
            ...result
        });
    });

    /**
     * Get assignments for team leader
     * GET /api/assignments/team-leader/:team
     */
    getTeamLeaderAssignments = asyncHandler(async (req, res) => {
        const { team } = req.params;
        const { cursor, limit = 20 } = req.query;
        const parsedLimit = parseInt(limit, 10);

        const result = await assignmentService.getTeamLeaderAssignments(team, {
            cursor,
            limit: parsedLimit
        });

        res.json({
            success: true,
            ...result
        });
    });

    /**
     * Get assignments for a specific user
     * GET /api/assignments/user/:userId
     */
    getUserAssignments = asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const { cursor, limit = 20 } = req.query;
        const parsedLimit = parseInt(limit, 10);

        const result = await assignmentService.getUserAssignments(userId, {
            cursor,
            limit: parsedLimit
        });

        res.json({
            success: true,
            ...result
        });
    });

    /**
     * Get assignment by ID
     * GET /api/assignments/:id
     */
    getAssignmentById = asyncHandler(async (req, res) => {
        const { id } = req.params;

        const assignment = await assignmentService.getAssignmentById(id);
        if (!assignment) {
            throw new NotFoundError('Assignment');
        }

        res.json({
            success: true,
            assignment
        });
    });

    /**
     * Create new assignment
     * POST /api/assignments
     */
    createAssignment = asyncHandler(async (req, res) => {
        const assignmentData = req.body;

        const assignment = await assignmentService.createAssignment(assignmentData);

        res.json({
            success: true,
            message: 'Assignment created successfully',
            assignment
        });
    });

    /**
     * Update assignment
     * PUT /api/assignments/:id
     */
    updateAssignment = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const updates = req.body;

        const assignment = await assignmentService.updateAssignment(id, updates);

        res.json({
            success: true,
            message: 'Assignment updated successfully',
            assignment
        });
    });

    /**
     * Delete assignment
     * DELETE /api/assignments/:id
     */
    deleteAssignment = asyncHandler(async (req, res) => {
        const { id } = req.params;

        await assignmentService.deleteAssignment(id);

        res.json({
            success: true,
            message: 'Assignment deleted successfully'
        });
    });

    /**
     * Submit assignment
     * POST /api/assignments/:id/submit
     */
    submitAssignment = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { userId, files } = req.body;

        const assignment = await assignmentService.submitAssignment(id, userId, files);

        res.json({
            success: true,
            message: 'Assignment submitted successfully',
            assignment
        });
    });

    /**
     * Add comment to assignment
     * POST /api/assignments/:id/comments
     */
    addComment = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { userId, comment } = req.body;

        const newComment = await assignmentService.addComment(id, userId, comment);

        res.json({
            success: true,
            message: 'Comment added successfully',
            comment: newComment
        });
    });

    /**
     * Add reply to comment
     * POST /api/assignments/:id/comments/:commentId/reply
     */
    addReply = asyncHandler(async (req, res) => {
        const { id, commentId } = req.params;
        const { userId, reply } = req.body;

        const newReply = await assignmentService.addReply(id, commentId, userId, reply);

        res.json({
            success: true,
            message: 'Reply added successfully',
            reply: newReply
        });
    });

    /**
     * Add attachment to assignment
     * POST /api/assignments/:id/attachments
     */
    addAttachment = asyncHandler(async (req, res) => {
        const { id } = req.params;

        if (!req.file) {
            throw new ValidationError('No file uploaded');
        }

        const attachment = await assignmentService.addAttachment(id, req.file, req.body.uploadedBy);

        res.json({
            success: true,
            message: 'Attachment added successfully',
            attachment
        });
    });

    /**
     * Get all submitted files for file collection (Team Leader)
     * GET /api/assignments/team-leader/:team/all-submissions
     */
    getAllSubmissions = asyncHandler(async (req, res) => {
        const { team } = req.params;

        const submissions = await assignmentService.getAllSubmissions(team);

        res.json({
            success: true,
            submissions
        });
    });
}

module.exports = new AssignmentController();
