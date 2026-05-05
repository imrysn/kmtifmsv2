const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { db, query, queryOne, networkDataPath } = require('../../config/database-mysql');
const { upload, uploadsDir, moveToUserFolder } = require('../../config/middleware');
const { logActivity, logFileStatusChange } = require('../../utils/logger');
const { getFileTypeDescription } = require('../../utils/fileHelpers');
const { safeDeleteFile } = require('../../utils/fileUtils');
const { createNotification, createAdminNotification } = require('../notifications');
const { syncDeletedFiles } = require('../../services/fileSyncService');

const router = express.Router();

// ── Manual file sync endpoint ─────────────────────────────────────────────
router.post('/sync-deleted', async (req, res) => {
  try {
    console.log('🔄 [Sync] Manual sync triggered');
    const summary = await syncDeletedFiles(uploadsDir, networkDataPath);
    res.json({
      success: true,
      message: `Sync complete — removed ${summary.removed} orphaned record(s)`,
      ...summary
    });
  } catch (err) {
    console.error('❌ [Sync] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Move whole folder to NAS and approve all files inside it
router.post('/folder/move-to-nas', async (req, res) => {
  const { folderName, username, fileIds, destinationPath, adminId, adminUsername, adminRole, team, comments } = req.body

  if (!folderName || !username || !fileIds?.length || !destinationPath) {
    return res.status(400).json({ success: false, message: 'Missing required fields' })
  }

  try {
    const dbFiles = (await Promise.all(
      fileIds.map(async (fileId) => {
        let row = await queryOne('SELECT * FROM files WHERE id = ?', [fileId]);
        if (row) return row;
        let row2 = await queryOne('SELECT *, created_at AS uploaded_at FROM assignment_attachments WHERE id = ?', [fileId]);
        if (row2) {
          row2.source_type = 'assignment_attachment';
          row2.user_id = row2.uploaded_by_id;
          row2.username = row2.uploaded_by_username;
          row2.status = 'team_leader_approved';
        }
        return row2 || null;
      })
    )).filter(Boolean)

    if (dbFiles.length === 0) return res.status(404).json({ success: false, message: 'No files found' })

    const isAttachmentFolder = dbFiles.some(f => f.source_type === 'assignment_attachment')
    const destFolderPath = path.join(destinationPath, folderName)
    await fs.mkdir(destFolderPath, { recursive: true })

    let sourceExists = false
    if (!isAttachmentFolder) {
      let sourceFolderPath = path.join(uploadsDir, username, folderName)
      sourceExists = await fs.access(sourceFolderPath).then(() => true).catch(() => false)
      
      if (sourceExists) {
        async function copyDir(src, dest) {
          const entries = await fs.readdir(src, { withFileTypes: true })
          for (const entry of entries) {
            const srcPath = path.join(src, entry.name), destPath = path.join(dest, entry.name)
            if (entry.isDirectory()) { await fs.mkdir(destPath, { recursive: true }); await copyDir(srcPath, destPath) }
            else await fs.copyFile(srcPath, destPath)
          }
        }
        await copyDir(sourceFolderPath, destFolderPath)
        await fs.rm(sourceFolderPath, { recursive: true, force: true })
        console.log(`✅ Folder copied to NAS: ${destFolderPath}`)
      }
    }

    const nowSql = new Date().toISOString().slice(0, 19).replace('T', ' ')

    for (const file of dbFiles) {
      let nasFilePath = file.relative_path 
        ? path.join(destFolderPath, file.relative_path.replace(/\\/g, '/').split('/').slice(1).join('/') || file.original_name)
        : path.join(destFolderPath, file.original_name)

      if (!sourceExists) {
        let srcFilePath = path.isAbsolute(file.file_path) || file.file_path.startsWith('\\\\') 
          ? file.file_path : path.join(uploadsDir, file.file_path.startsWith('/uploads/') ? file.file_path.substring(9) : file.file_path)
        
        await fs.mkdir(path.dirname(nasFilePath), { recursive: true })
        if (await fs.access(srcFilePath).then(() => true).catch(() => false)) {
          if (path.normalize(srcFilePath).toLowerCase() !== path.normalize(nasFilePath).toLowerCase()) {
            await fs.copyFile(srcFilePath, nasFilePath); await safeDeleteFile(srcFilePath)
          }
        }
      }

      if (file.source_type === 'assignment_attachment') {
        await query(`UPDATE assignment_attachments SET status = 'final_approved', current_stage = 'published_to_public', admin_reviewed_at = ?, admin_comments = ?, public_network_url = ?, final_approved_at = ? WHERE id = ?`,
          [nowSql, comments || null, nasFilePath, nowSql, file.id])
      } else {
        await query(`UPDATE files SET status = 'final_approved', current_stage = 'published_to_public', admin_id = ?, admin_username = ?, admin_reviewed_at = ?, admin_comments = ?, public_network_url = ?, final_approved_at = ? WHERE id = ?`,
          [adminId, adminUsername, nowSql, comments || null, nasFilePath, nowSql, file.id])
        logFileStatusChange(query, file.id, file.status, 'final_approved', file.current_stage, 'published_to_public', adminId, adminUsername, adminRole, `Folder approved & moved to NAS`)
      }
    }

    logActivity(query, adminId, adminUsername, adminRole, team, `Folder approved & moved to NAS: ${folderName} (${fileIds.length} files)`)
    res.json({ success: true, message: `Folder "${folderName}" approved successfully`, nasPath: destFolderPath })
  } catch (error) {
    console.error('❌ Error moving folder to NAS:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// Check for duplicate file names
router.post('/check-duplicate', async (req, res) => {
  const { originalName, userId } = req.body;
  try {
    const existingFile = await queryOne('SELECT * FROM files WHERE original_name = ? AND user_id = ?', [originalName, userId]);
    res.json({ success: true, isDuplicate: !!existingFile, existingFile: existingFile || null });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to check duplicates' });
  }
});

// Upload file (User only)
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { description, userId, username, userTeam, userRole, tag, replaceExisting, isRevision, folderName, relativePath, isFolder } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' })

    let originalFilename = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    if (originalFilename.includes('\uFFFD')) originalFilename = req.file.originalname;

    try {
      const finalPath = await moveToUserFolder(req.file.path, username, originalFilename, folderName, relativePath);
      req.file.path = finalPath; req.file.filename = originalFilename; req.file.originalname = originalFilename;
    } catch (moveError) {
      await safeDeleteFile(req.file.path); return res.status(500).json({ success: false, message: moveError.message })
    }

    const checkRejectedQuery = `SELECT * FROM files WHERE original_name = ? AND user_id = ? AND (status = 'rejected_by_team_leader' OR status = 'rejected_by_admin') ORDER BY uploaded_at DESC LIMIT 1`;
    const previouslyRejected = await queryOne(checkRejectedQuery, [req.file.originalname, userId]);

    if (replaceExisting === 'true' || !!previouslyRejected) {
      const existingFile = previouslyRejected || await queryOne('SELECT * FROM files WHERE original_name = ? AND user_id = ? AND folder_name = ?', [req.file.originalname, userId, folderName || null]);
      if (existingFile) {
        await safeDeleteFile(path.join(uploadsDir, existingFile.file_path.startsWith('/uploads/') ? existingFile.file_path.substring(9) : existingFile.file_path));
        const relPath = path.relative(uploadsDir, req.file.path).replace(/\\/g, '/');
        const isTL = userRole?.toUpperCase().includes('TEAM_LEADER');
        const initialStatus = isRevision === 'true' ? 'under_revision' : (isTL ? 'team_leader_approved' : 'uploaded');
        const initialStage = isTL ? 'pending_admin' : 'pending_team_leader';

        await query(`UPDATE files SET filename = ?, file_path = ?, file_size = ?, file_type = ?, mime_type = ?, description = ?, tag = ?, status = ?, current_stage = ?, folder_name = ?, relative_path = ?, is_folder = ?, uploaded_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [req.file.filename, `/uploads/${relPath}`, req.file.size, getFileTypeDescription(req.file.mimetype, req.file.originalname), req.file.mimetype, description || '', tag || '', initialStatus, initialStage, folderName || null, relativePath || null, isFolder === 'true' ? 1 : 0, existingFile.id]);

        logActivity(query, userId, username, 'USER', userTeam, `File ${isRevision === 'true' ? 'revised' : 'replaced'}: ${req.file.originalname}`);
        logFileStatusChange(query, existingFile.id, existingFile.status, initialStatus, existingFile.current_stage, 'pending_team_leader', userId, username, 'USER', `File ${isRevision === 'true' ? 'revised' : 'replaced'} by user`);
        
        if (isTL) createAdminNotification(existingFile.id, 'new_upload', `TL Upload`, `${username} uploaded "${req.file.originalname}"`, userId, username, userRole).catch(() => {});
        return res.json({ success: true, message: 'File replaced successfully', file: { id: existingFile.id, original_name: req.file.originalname, status: initialStatus }, replaced: true });
      }
    }

    // New File
    const relPath = path.relative(uploadsDir, req.file.path).replace(/\\/g, '/');
    const isTL = userRole?.toUpperCase().includes('TEAM_LEADER');
    const initialStatus = isTL ? 'team_leader_approved' : 'uploaded';
    const initialStage = isTL ? 'pending_admin' : 'pending_team_leader';

    const result = await query(`INSERT INTO files (filename, original_name, file_path, file_size, file_type, mime_type, description, tag, user_id, username, user_team, status, current_stage, folder_name, relative_path, is_folder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.file.filename, req.file.originalname, `/uploads/${relPath}`, req.file.size, getFileTypeDescription(req.file.mimetype, req.file.originalname), req.file.mimetype, description || '', tag || '', userId, username, userTeam, initialStatus, initialStage, folderName || null, relativePath || null, isFolder === 'true' ? 1 : 0]);
    
    logActivity(query, userId, username, 'USER', userTeam, `File uploaded: ${req.file.originalname}`);
    logFileStatusChange(query, result.insertId, null, initialStatus, null, 'pending_team_leader', userId, username, 'USER', `File uploaded by user`);
    
    if (isTL) createAdminNotification(result.insertId, 'new_upload', `TL Upload`, `${username} uploaded "${req.file.originalname}"`, userId, username, userRole).catch(() => {});
    res.json({ success: true, message: 'File uploaded successfully', file: { id: result.insertId, original_name: req.file.originalname, status: initialStatus } });

  } catch (error) {
    console.error('❌ Error handling file upload:', error);
    res.status(500).json({ success: false, message: 'File upload failed' });
  }
});

module.exports = router;
