const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { upload } = require('../config/middleware');

/**
 * File Management Routes
 */

// Basic File Operations
router.post('/upload', authenticateToken, upload.single('file'), fileController.uploadFile);
router.get('/user/:userId', authenticateToken, fileController.getUserFiles);
router.get('/my-files', authenticateToken, fileController.getMyFiles);
router.get('/stats', authenticateToken, fileController.getStats);
router.delete('/:id', authenticateToken, fileController.deleteFile);
router.post('/sync-deleted', authenticateToken, fileController.syncDeleted);
router.get('/notifications/:team', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), fileController.getTeamNotifications);

// Review & Approval Routes
router.get('/pending-review', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), fileController.getPendingReview);
router.post('/:id/team-leader-review', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), fileController.approveByTeamLeader);
router.post('/:id/team-leader-reject', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), fileController.rejectByTeamLeader);

router.get('/admin-review', authenticateToken, authorizeRole(['ADMIN']), fileController.getAdminReview);
router.post('/:id/admin-review', authenticateToken, authorizeRole(['ADMIN']), fileController.approveByAdmin);
router.post('/:id/admin-reject', authenticateToken, authorizeRole(['ADMIN']), fileController.rejectByAdmin);

// Admin & Management
router.get('/all', authenticateToken, authorizeRole(['ADMIN']), fileController.getAllFiles);
router.get('/all-files', authenticateToken, authorizeRole(['ADMIN']), fileController.getAllFiles);
router.post('/:id/move-to-projects', authenticateToken, authorizeRole(['ADMIN']), fileController.moveToProjects);
router.post('/bulk-action', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), fileController.bulkAction);
router.post('/open-file', authenticateToken, fileController.openFile);
router.post('/folder/delete', authenticateToken, fileController.deleteFolder);
router.get('/folder/zip', authenticateToken, fileController.zipFolder);
router.get('/team/:team/status/:status', authenticateToken, fileController.getFilesByStatus);
router.patch('/:id/priority', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), fileController.setPriority);
router.patch('/:fileId/priority', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), fileController.setPriority);

// Details & Collaboration
router.get('/:id', authenticateToken, fileController.getFileById);
router.get('/:fileId', authenticateToken, fileController.getFileById);
router.get('/:id/comments', authenticateToken, fileController.getComments);
router.get('/:fileId/comments', authenticateToken, fileController.getComments);
router.post('/:id/comments', authenticateToken, fileController.addComment);
router.post('/:fileId/comments', authenticateToken, fileController.addComment);
router.get('/:id/history', authenticateToken, fileController.getHistory);
router.get('/:fileId/history', authenticateToken, fileController.getHistory);

// Download & Stream (Support both :id and :fileId)
router.get('/:id/download', authenticateToken, fileController.download);
router.get('/:fileId/download', authenticateToken, fileController.download);
router.get('/:id/stream', authenticateToken, fileController.stream);
router.get('/:fileId/stream', authenticateToken, fileController.stream);

module.exports = router;