/**
 * File Routes
 *
 * MERGE RESOLUTION:
 * - HEAD had: clean controller-based thin routes with full authenticateToken/authorizeRole coverage.
 * - THEIRS had: fat inline routes with more features but zero auth middleware.
 *
 * RESOLUTION: Keep HEAD's architecture (thin routes → controller → service).
 * Port the 9 missing routes from THEIRS as new controller methods.
 * All routes have authenticateToken. Role guards applied where THEIRS had implicit role checks.
 * Duplicate /:fileId/download from THEIRS is intentionally collapsed to one.
 * The THEIRS-only IIFEs (fixTeamLeaderUploadedFiles, ensureAttachmentColumns) are NOT ported
 * here — they belong in a migration/startup script, not a route file.
 */

const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { upload } = require('../config/middleware');

// ─── Basic File Operations ────────────────────────────────────────────────────

router.post('/upload', authenticateToken, upload.single('file'), fileController.uploadFile);
router.post('/bulk-upload', authenticateToken, upload.array('files', 10000), fileController.bulkUpload);
router.post('/check-duplicate', authenticateToken, fileController.checkDuplicate);
router.get('/my-files', authenticateToken, fileController.getMyFiles);
router.get('/stats', authenticateToken, fileController.getStats);
router.post('/sync-deleted', authenticateToken, fileController.syncDeleted);

// ─── User / Member File Queries ───────────────────────────────────────────────

router.get('/user/:userId', authenticateToken, fileController.getUserFiles);
router.get('/user/:userId/pending', authenticateToken, fileController.getUserFilesPaginated);
router.get('/member/:memberId', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), fileController.getMemberFiles);

// ─── Team Leader Review ───────────────────────────────────────────────────────

router.get('/pending-review', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), fileController.getPendingReview);
router.get('/team-leader/:team', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), fileController.getTeamLeaderQueue);
router.post('/team-leader/:team/filter', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), fileController.filterTeamLeaderQueue);
router.get('/notifications/:team', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), fileController.getTeamNotifications);

router.post('/:id/team-leader-review', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), fileController.approveByTeamLeader);
router.post('/:id/team-leader-reject', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), fileController.rejectByTeamLeader);

// ─── Admin Review ─────────────────────────────────────────────────────────────

router.get('/admin-review', authenticateToken, authorizeRole(['ADMIN']), fileController.getAdminReview);
router.get('/admin', authenticateToken, authorizeRole(['ADMIN']), fileController.getAdminQueue);
router.get('/all', authenticateToken, authorizeRole(['ADMIN']), fileController.getAllFiles);

router.post('/:id/admin-review', authenticateToken, authorizeRole(['ADMIN']), fileController.adminReview);
router.post('/:id/admin-reject', authenticateToken, authorizeRole(['ADMIN']), fileController.rejectByAdmin);

// ─── Admin File Management ────────────────────────────────────────────────────

router.post('/:id/move-to-projects', authenticateToken, authorizeRole(['ADMIN']), fileController.moveToProjects);
router.post('/folder/move-to-nas', authenticateToken, authorizeRole(['ADMIN']), fileController.moveFolderToNas);
router.post('/bulk-action', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), fileController.bulkAction);
router.patch('/:id/priority', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), fileController.setPriority);
router.get('/team/:team/status/:status', authenticateToken, fileController.getFilesByStatus);

// ─── Folder Operations ────────────────────────────────────────────────────────

router.post('/folder/delete', authenticateToken, fileController.deleteFolder);
router.post('/folder/delete-attachments', authenticateToken, authorizeRole(['ADMIN']), fileController.deleteAttachmentFolder);
router.get('/folder/zip', authenticateToken, fileController.zipFolder);

// ─── File Actions ─────────────────────────────────────────────────────────────

router.post('/open-file', authenticateToken, fileController.openFile);
router.delete('/:id', authenticateToken, fileController.deleteFile);

// ─── File Details & Collaboration ─────────────────────────────────────────────
// NOTE: Specific sub-resource routes MUST be registered before the /:id catch-all.

router.get('/:id/path', authenticateToken, fileController.getFilePath);
router.post('/bulk-path', authenticateToken, fileController.getBulkFilePaths);
router.get('/:id/comments', authenticateToken, fileController.getComments);
router.post('/:id/comments', authenticateToken, fileController.addComment);
router.get('/:id/history', authenticateToken, fileController.getHistory);
router.post('/:id/view', authenticateToken, fileController.recordView);
router.get('/:id/views', authenticateToken, fileController.getViewers);

// ─── Download & Stream ────────────────────────────────────────────────────────

router.get('/:id/download', authenticateToken, fileController.download);
router.get('/:id/stream', authenticateToken, fileController.stream);

// ─── Catch-all: must be last ──────────────────────────────────────────────────

router.get('/:id', authenticateToken, fileController.getFileById);

module.exports = router;
