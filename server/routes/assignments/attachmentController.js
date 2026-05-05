const express = require('express');
const router = express.Router();
const { db, query, queryOne } = require('../../config/database-mysql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadsDir, moveToUserFolder } = require('../../config/middleware');

const { createAdminNotification } = require('../notifications');

// Configure multer for file uploads using existing uploads directory
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Upload to temp location first, then move to user folder
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Use temp filename like regular uploads
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    cb(null, `temp_${timestamp}_${randomString}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 * 1024 // 50GB limit (limitless)
  }
});

// Helper: fix garbled UTF-8 filenames that multer/busboy decoded as latin1.
// Japanese, Chinese, Korean and other multibyte filenames arrive as latin1-garbled
// strings. Re-encoding to latin1 bytes and decoding as UTF-8 recovers the real name.
function fixFilename(name) {
  if (!name) return name;
  try {
    const reDecoded = Buffer.from(name, 'latin1').toString('utf8');
    if (reDecoded !== name && !reDecoded.includes('\uFFFD')) return reDecoded;
  } catch (_) {}
  return name;
}

// Batch submission tracker to group multiple file submissions into single notification
const pendingBatchSubmissions = new Map();

// Function to create grouped notification
async function createBatchedSubmissionNotification(teamLeaderId, assignmentId, submissions) {
  try {
    const assignment = await queryOne('SELECT title FROM assignments WHERE id = ?', [assignmentId]);
    const firstSubmission = submissions[0];

    // Get the REAL total count of files submitted for this assignment by this user from DB
    // This ensures the count is accurate even if some files were skipped as duplicates
    const realCount = await queryOne(
      'SELECT COUNT(*) as total FROM assignment_submissions WHERE assignment_id = ? AND user_id = ?',
      [assignmentId, firstSubmission.userId]
    );
    const totalFileCount = realCount ? realCount.total : submissions.length;

    // Get folder name — use DB data for accuracy
    const folderName = firstSubmission.folderName;
    const isFolder = folderName && totalFileCount > 1;

    let message;
    let title = 'New File Submitted for Review';

    if (isFolder) {
      title = 'New Folder Submitted for Review';
      message = `${firstSubmission.submitterName} submitted folder "${folderName}" (${totalFileCount} files) for the assignment "${assignment.title}"`;
    } else if (totalFileCount === 1) {
      message = `${firstSubmission.submitterName} submitted "${firstSubmission.fileName}" for the assignment "${assignment.title}"`;
    } else {
      message = `${firstSubmission.submitterName} submitted ${totalFileCount} files for the assignment "${assignment.title}"`;
    }

    // Find the team leader — first try assignment.team_leader_id, then look up by team
    let finalTeamLeaderId = teamLeaderId;
    if (!finalTeamLeaderId) {
      const tl = await queryOne(
        'SELECT u.id FROM users u JOIN team_leaders tl ON u.id = tl.user_id JOIN teams t ON tl.team_id = t.id JOIN assignments a ON a.team = t.name WHERE a.id = ? LIMIT 1',
        [assignmentId]
      );
      finalTeamLeaderId = tl ? tl.id : null;
    }

    if (!finalTeamLeaderId) {
      console.warn(`⚠️ No team leader found for assignment ${assignmentId} — skipping notification`);
      return;
    }

    await query(`
      INSERT INTO notifications (
        user_id,
        assignment_id,
        file_id,
        type,
        title,
        message,
        action_by_id,
        action_by_username,
        action_by_role
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      finalTeamLeaderId,
      assignmentId,
      firstSubmission.fileId,
      'submission',
      title,
      message,
      firstSubmission.userId,
      firstSubmission.username,
      'USER'
    ]);

    console.log(`✅ Created batched notification for team leader ${finalTeamLeaderId}: ${isFolder ? `folder "${folderName}" (${totalFileCount} files)` : `${totalFileCount} file(s)`}`);
  } catch (error) {
    console.error('⚠️ Failed to create batched submission notification:', error);
  }
}

router.put('/:id', upload.array('attachments', 10000), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      dueDate,
      due_date,
      fileTypeRequired,
      file_type_required,
      assignedTo,
      assigned_to,
      maxFileSize,
      max_file_size,
      assignedMembers,
      assigned_members,
      teamLeaderId,
      team_leader_id,
      teamLeaderUsername,
      team_leader_username,
      team
    } = req.body;

    // Support both camelCase and snake_case
    const finalDueDate = dueDate || due_date;
    const finalFileType = fileTypeRequired || file_type_required;
    const finalAssignedTo = assignedTo || assigned_to;
    const finalMaxSize = maxFileSize || max_file_size || 10485760;
    const finalMembers = typeof assignedMembers === 'string' ? JSON.parse(assignedMembers) : (assignedMembers || assigned_members);
    const finalTeamLeaderId = teamLeaderId || team_leader_id;
    const finalTeamLeaderUsername = teamLeaderUsername || team_leader_username;

    // NONCE VALIDATION for PUT (edit with attachments)
    // Only enforce nonce for multipart requests — plain JSON updates (no file changes) skip this check.
    const isMultipart = req.is('multipart/form-data');
    const requestNonce = req.body.uploadNonce;
    const rawFiles = req.files || [];

    if (isMultipart) {
      if (!requestNonce || !uploadNonces.has(requestNonce)) {
        console.warn(`⚠️ [PUT] rejected: missing or invalid uploadNonce. Discarding ${rawFiles.length} file(s).`);
        for (const f of rawFiles) {
          try { fs.unlinkSync(f.path); } catch (e) { /* ignore */ }
        }
        return res.status(400).json({ success: false, message: 'Invalid or missing upload nonce. Please try again.' });
      }

      const nonceEntry = uploadNonces.get(requestNonce);
      if (nonceEntry.used) {
        console.warn(`⚠️ [PUT] rejected: nonce already used. Discarding ${rawFiles.length} file(s).`);
        for (const f of rawFiles) {
          try { fs.unlinkSync(f.path); } catch (e) { /* ignore */ }
        }
        return res.status(400).json({ success: false, message: 'Upload nonce already used. Please try again.' });
      }
      nonceEntry.used = true;
    }

    // parse list of attachment IDs the client wants removed
    let removeAttachmentIds = [];
    if (typeof req.body.removeAttachmentIds === 'string') {
      try {
        removeAttachmentIds = JSON.parse(req.body.removeAttachmentIds || '[]');
        if (!Array.isArray(removeAttachmentIds)) removeAttachmentIds = [];
      } catch (e) {
        console.warn('⚠️ [PUT] Could not parse removeAttachmentIds:', e.message);
        removeAttachmentIds = [];
      }
    } else if (Array.isArray(req.body.removeAttachmentIds)) {
      removeAttachmentIds = req.body.removeAttachmentIds;
    }

    if (removeAttachmentIds.length > 0) {
      console.log(`🗑️ [PUT] Removing ${removeAttachmentIds.length} existing attachment(s) for assignment ${id}:`, removeAttachmentIds);
      for (const attId of removeAttachmentIds) {
        try {
          const attachment = await queryOne(
            'SELECT * FROM assignment_attachments WHERE id = ? AND assignment_id = ?',
            [attId, id]
          );
          if (attachment) {
            if (attachment.file_path) {
              try {
                const filePath = attachment.file_path.startsWith('/uploads/')
                  ? require('path').join(uploadsDir, attachment.file_path.substring(9))
                  : attachment.file_path;
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
              } catch (e) { console.warn('⚠️ Could not delete physical attachment file during removal:', e.message); }
            }
            await query('DELETE FROM assignment_attachments WHERE id = ?', [attId]);
            console.log(`✅ Removed attachment ${attId}`);
          }
        } catch (e) {
          console.warn('⚠️ Failed to remove attachment', attId, e.message);
        }
      }
    }

    const clientSentAttachments = req.body.hasAttachments === 'true';

    if (!clientSentAttachments && rawFiles.length > 0) {
      console.warn(`⚠️ [PUT] Discarding ${rawFiles.length} unexpected temp file(s) — client did not flag hasAttachments`);
      for (const f of rawFiles) {
        try { fs.unlinkSync(f.path); } catch (e) { /* ignore */ }
      }
    }

    const uploadedFiles = clientSentAttachments ? rawFiles : [];

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    // Check if assignment exists
    const existingAssignment = await queryOne(
      'SELECT * FROM assignments WHERE id = ?',
      [id]
    );

    if (!existingAssignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Update assignment
    await query(`
      UPDATE assignments SET
        title = ?,
        description = ?,
        due_date = ?,
        file_type_required = ?,
        assigned_to = ?,
        max_file_size = ?
      WHERE id = ?
    `, [
      title,
      description || null,
      finalDueDate || null,
      finalFileType || null,
      finalAssignedTo || existingAssignment.assigned_to,
      finalMaxSize,
      id
    ]);

    let membersAssigned = 0;
    let attachmentsCreated = 0;

    // Save new attachment file records if any files were uploaded
    if (uploadedFiles.length > 0) {
      try {
        console.log(`📎 Saving ${uploadedFiles.length} new attachment(s) for assignment ${id}`);

        // parse relative paths from client if present
        let relativePaths = [];
        try {
          relativePaths = JSON.parse(req.body.relativePaths || '[]');
          console.log(`📂 [PUT] relativePaths received: ${JSON.stringify(relativePaths)}`);
        } catch (e) {
          console.warn('⚠️ [PUT] Could not parse relativePaths:', e.message);
          relativePaths = [];
        }

        for (let fileIndex = 0; fileIndex < uploadedFiles.length; fileIndex++) {
          const file = uploadedFiles[fileIndex];

          // Move file from temp location to team leader's folder
          let finalPath;
          const fixedOriginalname = fixFilename(file.originalname);
          try {
            finalPath = await moveToUserFolder(file.path, finalTeamLeaderUsername, fixedOriginalname);
            console.log(`✅ Moved attachment to: ${finalPath}`);
          } catch (moveError) {
            console.error('⚠️ Failed to move attachment file:', moveError);
            // If move fails, use the original temp path
            finalPath = file.path;
          }

          const relPath = relativePaths[fileIndex] || fixedOriginalname;
          const folderName = relPath.includes('/') ? relPath.split('/')[0] : null;
          console.log(`📎 [PUT] File ${fileIndex}: ${fixedOriginalname} → relPath: ${relPath}, folderName: ${folderName}`);

          // Re-move the file into the correct folder structure now that we know it.
          if (folderName) {
            try {
              const movedPath = await moveToUserFolder(finalPath, finalTeamLeaderUsername, fixedOriginalname, folderName, relPath);
              finalPath = movedPath;
              console.log(`✅ [PUT] Re-moved into folder structure: ${finalPath}`);
            } catch (reMoveError) {
              console.error('⚠️ [PUT] Failed to re-move file into folder structure:', reMoveError.message);
            }
          }

          await query(`
            INSERT INTO assignment_attachments (
              assignment_id,
              original_name,
              filename,
              file_path,
              file_size,
              file_type,
              uploaded_by_id,
              uploaded_by_username,
              folder_name,
              relative_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            id,
            fixedOriginalname,
            path.basename(finalPath),
            finalPath,
            file.size,
            file.mimetype,
            finalTeamLeaderId,
            finalTeamLeaderUsername,
            folderName,
            relPath !== fixedOriginalname ? relPath : null
          ]);
          attachmentsCreated++;
        }

        console.log(`✅ Saved ${attachmentsCreated} new attachment(s) for assignment ${id}`);
      } catch (attachmentError) {
        console.error('⚠️ Failed to save attachments:', attachmentError);
        // Don't fail the request if attachments fail
      }
    }

    try {
      // Update assigned members if provided
      if (finalMembers && Array.isArray(finalMembers)) {
        // Delete existing assignments
        await query('DELETE FROM assignment_members WHERE assignment_id = ?', [id]);

        // Insert new assignments
        if (finalMembers.length > 0) {
          const memberValues = finalMembers.map(userId => [id, userId]);
          const placeholders = memberValues.map(() => '(?, ?)').join(', ');
          const flattenedValues = memberValues.flat();

          await query(
            `INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`,
            flattenedValues
          );
          membersAssigned = finalMembers.length;
        }
      }

      // Log activity
      try {
        await query(`
          INSERT INTO activity_logs (
            user_id,
            username,
            role,
            team,
            activity
          ) VALUES (?, ?, ?, ?, ?)
        `, [
          finalTeamLeaderId || existingAssignment.team_leader_id,
          finalTeamLeaderUsername || existingAssignment.team_leader_username,
          'TEAM_LEADER',
          team || existingAssignment.team,
          `Updated assignment: ${title}`
        ]);
      } catch (logError) {
        console.warn('Activity log insertion failed:', logError.message);
      }

      // Notify admins if team leader added attachments while editing
      if (attachmentsCreated > 0) {
        const tlId = finalTeamLeaderId || existingAssignment.team_leader_id;
        const tlUsername = finalTeamLeaderUsername || existingAssignment.team_leader_username;
        createAdminNotification(
          null,
          'new_upload',
          'Team Leader Uploaded Attachment(s)',
          `${tlUsername} (Team Leader) uploaded ${attachmentsCreated} file${attachmentsCreated !== 1 ? 's' : ''} as attachment(s) for assignment "${title}".`,
          tlId, tlUsername, 'TEAM_LEADER', id
        ).catch(err => console.error('Failed to notify admins of TL attachment upload (edit):', err));
      }

      res.json({
        success: true,
        message: 'Assignment updated successfully',
        assignmentId: id,
        membersAssigned,
        attachmentsCreated
      });

    } catch (memberError) {
      console.error('Error updating members:', memberError);
      res.json({
        success: true,
        message: 'Assignment updated successfully',
        assignmentId: id,
        membersAssigned: 0,
        warning: 'Assignment updated but member assignment failed'
      });
    }

  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update assignment',
      error: error.message
    });
  }
});



// Get assignments for a specific user with all submitted files
router.delete('/:assignmentId', async (req, res) => {
  try {
    const { assignmentId } = req.params;

    // Verify assignment exists
    const assignment = await queryOne(
      'SELECT * FROM assignments WHERE id = ?',
      [assignmentId]
    );

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Get all file IDs associated with this assignment
    const submittedFiles = await query(
      'SELECT file_id FROM assignment_submissions WHERE assignment_id = ?',
      [assignmentId]
    );

    console.log(`✅ Assignment ${assignmentId} has ${submittedFiles ? submittedFiles.length : 0} submitted file(s)`);
    console.log('ℹ️ Files will be kept in database and NAS - they will return to users\' "My Files"');

    // ✅ IMPORTANT: Do NOT delete files from the files table
    // Files should persist after assignment deletion so users can access them in "My Files"
    // Only delete the assignment_submissions links (done below via cascade)

    // Delete related records (replies will cascade delete when comments are deleted)
    await query('DELETE FROM assignment_submissions WHERE assignment_id = ?', [assignmentId]);
    await query('DELETE FROM assignment_members WHERE assignment_id = ?', [assignmentId]);
    await query('DELETE FROM assignment_comments WHERE assignment_id = ?', [assignmentId]);

    // Delete the assignment
    await query('DELETE FROM assignments WHERE id = ?', [assignmentId]);

    console.log(`✅ Assignment ${assignmentId} deleted successfully with all related data`);

    res.json({
      success: true,
      message: 'Assignment and associated files deleted permanently',
      deletedFiles: submittedFiles ? submittedFiles.length : 0
    });
  } catch (error) {
    console.error('Error in delete assignment route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete assignment',
      error: error.message
    });
  }
});

// Remove a submitted file from an assignment
router.delete('/:assignmentId/files/:fileId', async (req, res) => {
  try {
    const { assignmentId, fileId } = req.params;
    const { userId } = req.body;

    console.log(`🗑️ Removing file ${fileId} from assignment ${assignmentId} for user ${userId}`);

    // Verify the file belongs to this user and assignment
    const submission = await queryOne(
      'SELECT * FROM assignment_submissions WHERE assignment_id = ? AND file_id = ? AND user_id = ?',
      [assignmentId, fileId, userId]
    );

    if (!submission) {
      console.log('❌ Submission not found or user not authorized');
      return res.status(404).json({
        success: false,
        message: 'File not found or you are not authorized to remove it'
      });
    }

    // Get file info before deleting — fetch BOTH file_path AND public_network_url
    // public_network_url holds the real NAS path for approved files
    const fileInfo = await queryOne(
      'SELECT file_path, public_network_url, username FROM files WHERE id = ?',
      [fileId]
    );
    console.log('📄 File to delete:', fileInfo);

    // Check if there are any OTHER submissions for this assignment by this user
    const remainingSubmissions = await query(
      'SELECT file_id, submitted_at FROM assignment_submissions WHERE assignment_id = ? AND user_id = ? AND file_id != ? ORDER BY submitted_at DESC',
      [assignmentId, userId, fileId]
    );
    console.log(`📊 Found ${remainingSubmissions?.length || 0} remaining submission(s) after deleting file ${fileId}`);
    if (remainingSubmissions && remainingSubmissions.length > 0) {
      console.log('Remaining files:', remainingSubmissions.map(s => s.file_id));
    }

    // 🗑️ DELETE EVERYTHING - Start by removing ALL foreign key references
    console.log('🔗 Step 1: Removing ALL foreign key references...');

    // 1. CRITICAL: Set file_id = NULL in assignment_members FIRST (before deleting anything)
    // This clears the foreign key reference to the file we're about to delete
    console.log(`⚙️ Setting file_id=NULL for assignment ${assignmentId}, user ${userId}, file ${fileId}`);
    await query(
      'UPDATE assignment_members SET file_id = NULL WHERE assignment_id = ? AND user_id = ? AND file_id = ?',
      [assignmentId, userId, fileId]
    );
    console.log('✅ Cleared file_id reference in assignment_members');

    // Now update status based on remaining submissions
    if (!remainingSubmissions || remainingSubmissions.length === 0) {
      console.log('🚧 No remaining files - setting status to pending');
      await query(
        'UPDATE assignment_members SET status = ?, submitted_at = NULL WHERE assignment_id = ? AND user_id = ?',
        ['pending', assignmentId, userId]
      );
      console.log('✅ Updated assignment_members: status=pending (no more files)');
    } else {
      const mostRecentFile = remainingSubmissions[0];
      console.log(`🔄 Pointing to most recent remaining file: ${mostRecentFile.file_id}`);

      // Verify the file we're pointing to actually exists and is NOT the one being deleted
      if (mostRecentFile.file_id === fileId) {
        console.error('❌❌❌ ERROR: Trying to set file_id to the file being deleted!');
        throw new Error('Logic error: Cannot set file_id to file being deleted');
      }

      await query(
        'UPDATE assignment_members SET file_id = ?, submitted_at = ?, status = ? WHERE assignment_id = ? AND user_id = ?',
        [mostRecentFile.file_id, mostRecentFile.submitted_at, 'submitted', assignmentId, userId]
      );
      console.log('✅ Updated assignment_members to point to most recent remaining file');
    }

    // 2. Delete from assignment_submissions
    await query(
      'DELETE FROM assignment_submissions WHERE assignment_id = ? AND file_id = ? AND user_id = ?',
      [assignmentId, fileId, userId]
    );
    console.log('✅ Deleted from assignment_submissions');

    // 3. Delete from notifications (if any reference this file)
    try {
      await query('DELETE FROM notifications WHERE file_id = ?', [fileId]);
      console.log('✅ Deleted notifications');
    } catch (err) {
      console.log('⚠️ No notifications to delete');
    }

    // 4. Delete from file_comments
    try {
      await query('DELETE FROM file_comments WHERE file_id = ?', [fileId]);
      console.log('✅ Deleted file comments');
    } catch (err) {
      console.log('⚠️ No file comments to delete');
    }

    // 5. Delete from file_status_history
    try {
      await query('DELETE FROM file_status_history WHERE file_id = ?', [fileId]);
      console.log('✅ Deleted file status history');
    } catch (err) {
      console.log('⚠️ No file status history to delete');
    }

    // 6. Check for any other references in assignment_attachments
    try {
      await query('DELETE FROM assignment_attachments WHERE file_id = ?', [fileId]);
      console.log('✅ Deleted from assignment_attachments');
    } catch (err) {
      console.log('⚠️ No assignment_attachments to delete');
    }

    console.log('💾 Step 2: Deleting physical file...');

    // 7. Delete physical file — check public_network_url FIRST (NAS final path for approved files)
    // file_path holds the old /uploads/ relative path which won’t exist on NAS after approval
    if (fileInfo) {
      try {
        let physicalPath = null;

        if (fileInfo.public_network_url && !fileInfo.public_network_url.startsWith('http')) {
          // Approved file — use NAS path directly
          physicalPath = fileInfo.public_network_url;
          console.log('📁 Approved file on NAS, using public_network_url:', physicalPath);
        } else if (fileInfo.file_path) {
          // Pending file still in uploads staging area
          if (fileInfo.file_path.startsWith('/uploads/')) {
            const { uploadsDir } = require('../../config/middleware');
            const relativePath = fileInfo.file_path.substring('/uploads/'.length);
            physicalPath = require('path').join(uploadsDir, relativePath);
          } else {
            physicalPath = fileInfo.file_path;
          }
          console.log('📁 Pending file in uploads, using file_path:', physicalPath);
        }

        if (physicalPath) {
          if (fs.existsSync(physicalPath)) {
            fs.unlinkSync(physicalPath);
            console.log('✅ Physical file deleted from:', physicalPath);
          } else {
            console.log('⚠️ Physical file not found at:', physicalPath);
          }
        }
      } catch (fsError) {
        console.error('❌ Failed to delete physical file:', fsError.message);
      }
    }

    console.log('📀 Step 3: Deleting file record from database...');

    // 8. Finally, delete file record from database
    await query('DELETE FROM files WHERE id = ?', [fileId]);
    console.log('✅ File record deleted from database');

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error removing submitted file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove file',
      error: error.message
    });
  }
});

// Debug endpoint - Get raw assignment_members data
router.delete('/:assignmentId/attachments/folder/:folderName', async (req, res) => {
  try {
    const { assignmentId, folderName } = req.params;
    const decodedFolderName = decodeURIComponent(folderName);

    // Get all attachments in this folder for this assignment
    const folderAttachments = await query(
      'SELECT * FROM assignment_attachments WHERE assignment_id = ? AND folder_name = ?',
      [assignmentId, decodedFolderName]
    );

    if (!folderAttachments || folderAttachments.length === 0) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    console.log(`🗑️ Deleting folder "${decodedFolderName}" with ${folderAttachments.length} file(s) from assignment ${assignmentId}`);

    // Get the folder directory path from the first file
    let folderDirPath = null;
    for (const att of folderAttachments) {
      if (att.file_path) {
        const candidate = path.dirname(att.file_path);
        if (candidate && candidate !== '.') {
          folderDirPath = candidate;
          break;
        }
      }
    }

    // Delete physical folder (and all contents) using recursive rm
    if (folderDirPath) {
      try {
        if (fs.existsSync(folderDirPath)) {
          // Node 14.14+ supports fs.rmSync with recursive
          if (fs.rmSync) {
            fs.rmSync(folderDirPath, { recursive: true, force: true });
          } else {
            // Fallback: delete each file individually then rmdir
            for (const att of folderAttachments) {
              try {
                if (att.file_path && fs.existsSync(att.file_path)) {
                  fs.unlinkSync(att.file_path);
                }
              } catch (e) { console.warn('⚠️ Could not delete file:', e.message); }
            }
            try { fs.rmdirSync(folderDirPath); } catch (e) { console.warn('⚠️ Could not remove folder dir:', e.message); }
          }
          console.log(`✅ Physical folder deleted: ${folderDirPath}`);
        } else {
          console.log(`⚠️ Physical folder not found at: ${folderDirPath} — skipping filesystem delete`);
        }
      } catch (fsErr) {
        console.warn(`⚠️ Could not delete physical folder: ${fsErr.message}`);
      }
    }

    // Delete all DB records for this folder
    await query(
      'DELETE FROM assignment_attachments WHERE assignment_id = ? AND folder_name = ?',
      [assignmentId, decodedFolderName]
    );

    console.log(`✅ Folder "${decodedFolderName}" deleted from assignment ${assignmentId}`);
    res.json({ success: true, message: 'Folder deleted successfully', deletedCount: folderAttachments.length });
  } catch (error) {
    console.error('Error deleting attachment folder:', error);
    res.status(500).json({ success: false, message: 'Failed to delete folder', error: error.message });
  }
});

// Delete a single assignment attachment (Team Leader only)
// NOTE: This must stay BELOW the /folder/:folderName route to avoid shadowing it
router.delete('/:assignmentId/attachments/:attachmentId', async (req, res) => {
  // Guard: reject if attachmentId is literally "folder" (means the folder route didn't match)
  if (req.params.attachmentId === 'folder') {
    return res.status(404).json({ success: false, message: 'Route not found' });
  }

  try {
    const { assignmentId, attachmentId } = req.params;

    const attachment = await queryOne(
      'SELECT * FROM assignment_attachments WHERE id = ? AND assignment_id = ?',
      [attachmentId, assignmentId]
    );

    if (!attachment) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }

    // Delete physical file
    if (attachment.file_path) {
      try {
        const filePath = attachment.file_path.startsWith('/uploads/')
          ? path.join(uploadsDir, attachment.file_path.substring(9))
          : attachment.file_path;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`✅ Physical file deleted: ${filePath}`);
        }
      } catch (e) { console.warn('⚠️ Could not delete physical attachment file:', e.message); }
    }

    await query('DELETE FROM assignment_attachments WHERE id = ?', [attachmentId]);

    console.log(`✅ Attachment ${attachmentId} deleted from assignment ${assignmentId}`);
    res.json({ success: true, message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({ success: false, message: 'Failed to delete attachment', error: error.message });
  }
});

// NOTE: Comment and reply routes are already registered above with full inline logic.
// The assignmentController duplicates are intentionally removed to prevent route conflicts.

console.log('✅ Assignments routes registered, including comments endpoint');

module.exports = router;
