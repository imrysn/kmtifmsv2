const fileService = require('../services/fileService');
const { uploadsDir } = require('../config/middleware');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');

/**
 * File Controller
 * Handles HTTP requests for file operations
 */
class FileController {
    /**
     * Upload a file
     */
    uploadFile = asyncHandler(async (req, res) => {
        if (!req.file) throw new ValidationError('No file uploaded');

        const fileData = {
            original_name: req.file.originalname,
            filename: req.file.filename,
            file_path: req.file.path,
            file_size: req.file.size,
            file_type: req.file.mimetype,
            tag: req.body.tag,
            description: req.body.description,
            folder_name: req.body.folderName,
            relative_path: req.body.relativePath,
            is_folder: req.body.isFolder === 'true'
        };

        const result = await fileService.uploadFile(fileData, req.user);

        if (result.isDuplicate) {
            return res.status(409).json({
                success: false,
                isDuplicate: true,
                message: 'File with this name already exists',
                existingFile: result.existingFile
            });
        }

        res.status(201).json({
            success: true,
            message: 'File uploaded successfully',
            file: result
        });
    });

    /**
     * Approve file by team leader
     */
    approveByTeamLeader = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { comments } = req.body;

        const file = await fileService.approveByTeamLeader(id, req.user, comments);

        res.json({
            success: true,
            message: 'File approved by team leader',
            file
        });
    });

    /**
     * Reject file by team leader
     */
    rejectByTeamLeader = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { reason } = req.body;

        const file = await fileService.rejectByTeamLeader(id, req.user, reason);

        res.json({
            success: true,
            message: 'File rejected by team leader',
            file
        });
    });

    /**
     * Approve file by admin (Final Approval)
     */
    approveByAdmin = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { comments } = req.body;

        const file = await fileService.approveByAdmin(id, req.user, comments);

        res.json({
            success: true,
            message: 'File final approved by administrator',
            file
        });
    });

    /**
     * Reject file by admin
     */
    rejectByAdmin = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { reason } = req.body;

        const file = await fileService.rejectByAdmin(id, req.user, reason);

        res.json({
            success: true,
            message: 'File rejected by administrator',
            file
        });
    });

    /**
     * Move file to projects directory
     */
    moveToProjects = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { destinationPath, deleteFromUploads } = req.body;

        if (!destinationPath) throw new ValidationError('Destination path is required');

        const newPath = await fileService.moveToProjects(
            id,
            destinationPath,
            req.user,
            deleteFromUploads === true || deleteFromUploads === 'true'
        );

        res.json({
            success: true,
            message: 'File moved to projects successfully',
            path: newPath
        });
    });

    /**
     * Delete file
     */
    deleteFile = asyncHandler(async (req, res) => {
        const { id } = req.params;
        await fileService.deleteFile(id, req.user);

        res.json({
            success: true,
            message: 'File deleted successfully'
        });
    });

    /**
     * Get file stats
     */
    getStats = asyncHandler(async (req, res) => {
        const criteria = {};
        if (req.user.role === 'TEAM_LEADER') criteria.team = req.user.team;
        if (req.user.role === 'USER') criteria.user_id = req.user.id;

        const stats = await fileService.getFileStats(criteria);
        res.json({ success: true, stats });
    });

    /**
     * Get files for a specific user
     */
    getUserFiles = asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const files = await fileService.getUserFiles(userId);
        res.json({ success: true, files });
    });

    /**
     * Get current user's files
     */
    getMyFiles = asyncHandler(async (req, res) => {
        const files = await fileService.getUserFiles(req.user.id);
        res.json({ success: true, files });
    });

    /**
     * Get pending reviews for team leader
     */
    getPendingReview = asyncHandler(async (req, res) => {
        const team = req.user.role === 'ADMIN' ? null : req.user.team;
        const files = await fileService.getPendingTeamLeaderReview(team);
        res.json({ success: true, files });
    });

    /**
     * Get team notifications and counts
     */
    getTeamNotifications = asyncHandler(async (req, res) => {
        const { team } = req.params;
        const pendingFiles = await fileService.getPendingTeamLeaderReview(team);

        res.json({
            success: true,
            notifications: [],
            counts: {
                pending: pendingFiles ? pendingFiles.length : 0,
                urgent: pendingFiles ? pendingFiles.filter(f => f.priority === 'urgent').length : 0,
                overdue: 0
            }
        });
    });

    /**
     * Get pending reviews for admin
     */
    getAdminReview = asyncHandler(async (req, res) => {
        const files = await fileService.getPendingAdminReview();
        res.json({ success: true, files });
    });

    /**
     * Get all files for admin
     */
    getAllFiles = asyncHandler(async (req, res) => {
        const files = await fileService.getAllFiles(req.query);
        res.json({ success: true, files });
    });

    /**
     * Get file comments
     */
    getComments = asyncHandler(async (req, res) => {
        const id = req.params.id || req.params.fileId;
        const comments = await fileService.getFileComments(id);
        res.json({ success: true, comments });
    });

    /**
     * Add file comment
     */
    addComment = asyncHandler(async (req, res) => {
        const id = req.params.id || req.params.fileId;
        const { comment } = req.body;
        const comments = await fileService.addFileComment(id, req.user, comment);
        res.json({ success: true, message: 'Comment added', comments });
    });

    /**
     * Get file history
     */
    getHistory = asyncHandler(async (req, res) => {
        const id = req.params.id || req.params.fileId;
        const history = await fileService.getFileHistory(id);
        res.json({ success: true, history });
    });

    /**
     * Download file
     */
    download = asyncHandler(async (req, res) => {
        const id = req.params.id || req.params.fileId;
        const fileInfo = await fileService.resolvePhysicalPath(id);
        res.download(fileInfo.path, fileInfo.originalName);
    });

    /**
     * Stream file
     */
    stream = asyncHandler(async (req, res) => {
        const id = req.params.id || req.params.fileId;
        const fileInfo = await fileService.resolvePhysicalPath(id);
        res.sendFile(fileInfo.path);
    });

    /**
     * Get file by ID
     */
    getFileById = asyncHandler(async (req, res) => {
        const id = req.params.id || req.params.fileId;
        const file = await fileService.getFileById(id);
        res.json({ success: true, file });
    });

    /**
     * Get physical file path (for Electron)
     */
    getFilePath = asyncHandler(async (req, res) => {
        const id = req.params.id || req.params.fileId;
        const fileInfo = await fileService.resolvePhysicalPath(id);
        res.json({ 
            success: true, 
            filePath: fileInfo.path,
            fileName: fileInfo.originalName 
        });
    });

    /**
     * Set file priority
     */
    setPriority = asyncHandler(async (req, res) => {
        const id = req.params.id || req.params.fileId;
        const { priority, dueDate } = req.body;
        await fileService.setFilePriority(id, priority, dueDate, req.user);
        res.json({ success: true, message: 'Priority updated successfully' });
    });

    /**
     * Open file with default application
     */
    openFile = asyncHandler(async (req, res) => {
        const { filePath } = req.body;
        await fileService.openFile(filePath);
        res.json({ success: true, message: 'File opened successfully' });
    });

    /**
     * Delete folder
     */
    deleteFolder = asyncHandler(async (req, res) => {
        const { folderName, fileIds } = req.body;
        await fileService.deleteFolder(folderName, fileIds, req.user);
        res.json({ success: true, message: `Folder "${folderName}" deleted successfully` });
    });

    /**
     * Zip and download folder
     */
    zipFolder = asyncHandler(async (req, res) => {
        const { fileIds: fileIdsStr, folderName } = req.query;
        const fileIds = fileIdsStr.split(',').map(id => parseInt(id.trim())).filter(Boolean);

        const { zipPath, tmpDir } = await fileService.zipFolder(fileIds, folderName);

        const fs = require('fs');
        res.download(zipPath, `${folderName}.zip`, (err) => {
            // Cleanup
            try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
            try { fs.unlinkSync(zipPath); } catch (_) {}
        });
    });

    /**
     * Bulk action (approve/reject)
     */
    bulkAction = asyncHandler(async (req, res) => {
        const { fileIds, action } = req.body;
        const results = await fileService.bulkAction(fileIds, action, req.user);
        res.json({ success: true, ...results });
    });

    /**
     * Get files by status for a team (Analytics)
     */
    getFilesByStatus = asyncHandler(async (req, res) => {
        const { team, status } = req.params;
        let dbStatus;
        let dbStage;

        if (status === 'approved') dbStatus = ['team_leader_approved', 'final_approved'];
        else if (status === 'pending') dbStage = ['pending_team_leader', 'pending_admin'];
        else if (status === 'rejected') dbStatus = ['rejected_by_team_leader', 'rejected_by_admin'];

        const files = await fileService.getAllFiles({ team, status: dbStatus, stage: dbStage });
        res.json({ success: true, files });
    });

    /**
     * Sync deleted files (cleanup orphaned DB records)
     * FIX: uploadsDir was missing — now imported at top of file
     */
    syncDeleted = asyncHandler(async (req, res) => {
        const { syncDeletedFiles } = require('../services/fileSyncService');
        const { networkDataPath } = require('../config/database');
        const summary = await syncDeletedFiles(uploadsDir, networkDataPath);
        res.json({ success: true, ...summary });
    });
}

module.exports = new FileController();
