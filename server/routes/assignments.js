const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { upload } = require('../config/middleware');

/**
 * Assignment Management Routes
 */

// Admin/Team Leader routes
router.get('/admin/all', authenticateToken, authorizeRole(['ADMIN']), assignmentController.getAllAssignments);
router.get('/all', authenticateToken, authorizeRole(['ADMIN']), assignmentController.getAllAssignments); // legacy alias
router.get('/submissions', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), assignmentController.getAllSubmissions);
router.post('/', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), upload.array('attachments', 100), assignmentController.createAssignment);
router.put('/:id', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), upload.array('attachments', 100), assignmentController.updateAssignment);
router.delete('/:id', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), assignmentController.deleteAssignment);

// General/User routes
router.get('/user/:userId', authenticateToken, assignmentController.getUserAssignmentsById);
router.get('/my-assignments', authenticateToken, assignmentController.getUserAssignments);
router.get('/team-leader/:userId', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), assignmentController.getTeamLeaderAssignments);
router.get('/team-leader/:userId/all-submissions', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), assignmentController.getAllSubmissionsForTL);
router.get('/team/:team/all-tasks', authenticateToken, assignmentController.getTeamAssignments);
router.get('/:id', authenticateToken, assignmentController.getAssignmentById);
router.get('/:id/details', authenticateToken, assignmentController.getAssignmentDetails);
router.put('/:id/mark-done', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), assignmentController.markDone);

// Comments & Replies
router.get('/:id/comments', authenticateToken, assignmentController.getComments);
router.post('/:id/comments', authenticateToken, assignmentController.addComment);
router.post('/:id/comments/:commentId/reply', authenticateToken, assignmentController.addReply);

// Individual comment actions - Flattened paths (no assignment ID needed)
router.put('/comments/:commentId', authenticateToken, assignmentController.editComment);
router.delete('/comments/:commentId', authenticateToken, assignmentController.deleteComment);

// Submissions & Attachments
router.post('/submit', authenticateToken, assignmentController.submitAssignment);
router.delete('/:id/files/:fileId', authenticateToken, assignmentController.deleteSubmissionFile);
router.delete('/:id/attachments/folder/:folderName', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), assignmentController.deleteAttachmentFolder);
router.delete('/:id/attachments/:attachmentId', authenticateToken, authorizeRole(['TEAM_LEADER', 'ADMIN']), assignmentController.deleteAttachment);

module.exports = router;
