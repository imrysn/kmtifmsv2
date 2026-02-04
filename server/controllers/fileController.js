const fileService = require('../services/fileService');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const response = require('../utils/responseFormatter');

/**
 * File Controller
 * Handles HTTP requests for file operations
 * Delegates business logic to fileService
 */
class FileController {
    /**
     * Upload a new file
     * POST /api/files/upload
     */
    uploadFile = asyncHandler(async (req, res) => {
        if (!req.file) {
            throw new ValidationError('No file uploaded');
        }

        const { description, userId, username, userTeam, tag, replaceExisting, folderName, relativePath, isFolder } = req.body;

        // Call service layer
        const file = await fileService.uploadFile({
            file: req.file,
            description,
            userId,
            username,
            userTeam,
            tag,
            replaceExisting: replaceExisting === 'true',
            folderName: folderName || null,
            relativePath: relativePath || null,
            isFolder: isFolder === 'true'
        });

        res.json(response.created(file, 'File uploaded successfully'));
    });

    /**
     * Get files for a specific user
     * GET /api/files/user/:userId
     */
    getUserFiles = asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;

        const result = await fileService.getUserFiles(userId, { page, limit });

        res.json({
            success: true,
            ...result
        });
    });

    /**
     * Get pending files for a user
     * GET /api/files/user/:userId/pending
     */
    getPendingFiles = asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;

        const result = await fileService.getPendingFiles(userId, { page, limit });

        res.json({
            success: true,
            ...result
        });
    });

    /**
     * Get files for team leader review
     * GET /api/files/team-leader/:team
     */
    getTeamFiles = asyncHandler(async (req, res) => {
        const { team } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;

        const result = await fileService.getTeamFiles(team, { page, limit });

        res.json({
            success: true,
            ...result
        });
    });

    /**
     * Get all files (admin)
     * GET /api/files/all
     */
    getAllFiles = asyncHandler(async (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;

        const result = await fileService.getAllFiles({ page, limit });

        res.json({
            success: true,
            ...result
        });
    });

    /**
     * Approve file (team leader)
     * POST /api/files/:fileId/approve-team-leader
     */
    approveByTeamLeader = asyncHandler(async (req, res) => {
        const { fileId } = req.params;
        const { teamLeaderId, teamLeaderUsername, comments } = req.body;

        const file = await fileService.approveByTeamLeader(fileId, {
            teamLeaderId,
            teamLeaderUsername,
            comments
        });

        res.json({
            success: true,
            message: 'File approved by team leader',
            file
        });
    });

    /**
     * Approve file (admin)
     * POST /api/files/:fileId/approve-admin
     */
    approveByAdmin = asyncHandler(async (req, res) => {
        const { fileId } = req.params;
        const { adminId, adminUsername, comments } = req.body;

        const file = await fileService.approveByAdmin(fileId, {
            adminId,
            adminUsername,
            comments
        });

        res.json({
            success: true,
            message: 'File approved by admin',
            file
        });
    });

    /**
     * Reject file
     * POST /api/files/:fileId/reject
     */
    rejectFile = asyncHandler(async (req, res) => {
        const { fileId } = req.params;
        const { reason, rejectedBy, role } = req.body;

        const file = await fileService.rejectFile(fileId, {
            reason,
            rejectedBy,
            role
        });

        res.json({
            success: true,
            message: 'File rejected',
            file
        });
    });

    /**
     * Delete file
     * DELETE /api/files/:fileId
     */
    deleteFile = asyncHandler(async (req, res) => {
        const { fileId } = req.params;
        const { userId, username } = req.body;

        await fileService.deleteFile(fileId, userId, username);

        res.json({
            success: true,
            message: 'File deleted successfully'
        });
    });

    /**
     * Update file tag
     * PUT /api/files/:fileId/tag
     */
    updateTag = asyncHandler(async (req, res) => {
        const { fileId } = req.params;
        const { tag } = req.body;

        const file = await fileService.updateTag(fileId, tag);

        res.json({
            success: true,
            message: 'File tag updated',
            file
        });
    });

    /**
     * Check for duplicate file
     * POST /api/files/check-duplicate
     */
    checkDuplicate = asyncHandler(async (req, res) => {
        const { filename, userId } = req.body;

        const isDuplicate = await fileService.checkDuplicate(filename, userId);

        res.json({
            success: true,
            isDuplicate,
            existingFile: isDuplicate || null
        });
    });

    /**
     * Open file in system
     * POST /api/files/:fileId/open
     */
    openFile = asyncHandler(async (req, res) => {
        const { fileId } = req.params;

        await fileService.openFile(fileId);

        res.json({
            success: true,
            message: 'File opened'
        });
    });
}

module.exports = new FileController();
