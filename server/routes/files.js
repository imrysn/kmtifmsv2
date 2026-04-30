const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { db } = require('../config/database');
const { upload, uploadsDir, moveToUserFolder } = require('../config/middleware');
const { logActivity, logFileStatusChange } = require('../utils/logger');
const { getFileTypeDescription } = require('../utils/fileHelpers');
const { safeDeleteFile } = require('../utils/fileUtils');
const { createNotification, createAdminNotification } = require('./notifications');
const { syncDeletedFiles } = require('../services/fileSyncService');
const { networkDataPath } = require('../config/database');

const router = express.Router();

// ── Manual file sync endpoint ─────────────────────────────────────────────
// POST /api/files/sync-deleted
// Scans all DB file records against disk and removes orphans.
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

// One-time fix: promote any files uploaded by a TEAM_LEADER that are still stuck on
// 'uploaded' / 'pending_team_leader' — they should skip TL review and go to Pending Admin.
;(async function fixTeamLeaderUploadedFiles() {
  try {
    const { query } = require('../../database/config')
    const result = await query(`
      UPDATE files f
      JOIN users u ON LOWER(f.username) = LOWER(u.username)
      SET f.status = 'team_leader_approved',
          f.current_stage = 'pending_admin'
      WHERE f.current_stage = 'pending_team_leader'
        AND f.status = 'uploaded'
        AND UPPER(u.role) LIKE '%TEAM_LEADER%'
    `)
    const affected = result && result.affectedRows ? result.affectedRows : 0
    console.log(`✅ TL uploaded files fix applied — ${affected} row(s) updated`)
  } catch (err) {
    console.warn('⚠️ TL uploaded files fix failed:', err.message)
  }
})()

// Ensure assignment_attachments has the review columns
// Uses INFORMATION_SCHEMA checks instead of IF NOT EXISTS (compatible with MySQL 5.7+)
;(async function ensureAttachmentColumns() {
  const { query } = require('../../database/config');
  const cols = [
    { name: 'status',            sql: `ALTER TABLE assignment_attachments ADD COLUMN status VARCHAR(50) DEFAULT 'team_leader_approved'` },
    { name: 'current_stage',     sql: `ALTER TABLE assignment_attachments ADD COLUMN current_stage VARCHAR(50) DEFAULT 'pending_admin'` },
    { name: 'admin_reviewed_at', sql: `ALTER TABLE assignment_attachments ADD COLUMN admin_reviewed_at DATETIME` },
    { name: 'admin_comments',    sql: `ALTER TABLE assignment_attachments ADD COLUMN admin_comments TEXT` },
    { name: 'public_network_url',sql: `ALTER TABLE assignment_attachments ADD COLUMN public_network_url TEXT` },
    { name: 'final_approved_at', sql: `ALTER TABLE assignment_attachments ADD COLUMN final_approved_at DATETIME` },
  ];
  for (const col of cols) {
    try {
      const exists = await query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignment_attachments' AND COLUMN_NAME = ?`,
        [col.name]
      );
      if (!exists || exists.length === 0) {
        await query(col.sql);
        console.log(`✅ Added column assignment_attachments.${col.name}`);
      }
    } catch (err) {
      console.warn(`⚠️ Could not add column ${col.name}:`, err.message);
    }
  }
})()

// Move whole folder to NAS and approve all files inside it
router.post('/folder/move-to-nas', async (req, res) => {
  const { folderName, username, fileIds, destinationPath, adminId, adminUsername, adminRole, team, comments } = req.body

  if (!folderName || !username || !fileIds?.length || !destinationPath) {
    return res.status(400).json({ success: false, message: 'Missing required fields: folderName, username, fileIds, destinationPath' })
  }

  try {
    // Load all files from DB — check both files table AND assignment_attachments
    const dbFiles = await Promise.all(
      fileIds.map(fileId => new Promise((resolve, reject) => {
        db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, row) => {
          if (err) return reject(err)
          if (row) return resolve(row)
          // Not in files table — check assignment_attachments
          db.get('SELECT *, created_at AS uploaded_at FROM assignment_attachments WHERE id = ?', [fileId], (err2, row2) => {
            if (err2) return reject(err2)
            // Normalize fields to match files table shape
            if (row2) {
              row2.source_type = 'assignment_attachment'  // use DB field, not JS property
              row2.user_id = row2.uploaded_by_id
              row2.username = row2.uploaded_by_username
              row2.status = 'team_leader_approved'
            }
            resolve(row2 || null)
          })
        })
      }))
    ).then(rows => rows.filter(Boolean))

    if (dbFiles.length === 0) {
      return res.status(404).json({ success: false, message: 'No files found in database for provided IDs' })
    }

    // Determine if these are attachment files (from assignment_attachments table)
    const isAttachmentFolder = dbFiles.some(f => f.source_type === 'assignment_attachment')

    // For attachment folders, ALWAYS copy file-by-file using DB paths
    // (the source folder structure is different from regular user uploads)
    const destFolderPath = path.join(destinationPath, folderName)
    await fs.mkdir(destFolderPath, { recursive: true })

    let sourceExists = false

    if (!isAttachmentFolder) {
      // Regular user upload: try to find source folder and do directory copy
      let sourceFolderPath = path.join(uploadsDir, username, folderName)
      sourceExists = await fs.access(sourceFolderPath).then(() => true).catch(() => false)

      // Fallback: derive source folder from first file's stored file_path
      if (!sourceExists && dbFiles[0]?.file_path) {
        const firstFilePath = dbFiles[0].file_path
        const relPart = firstFilePath.startsWith('/uploads/') ? firstFilePath.substring(9) : firstFilePath
        const parts = relPart.replace(/\\/g, '/').split('/')
        if (parts.length >= 2) {
          const altFolderPath = path.join(uploadsDir, parts[0], parts[1])
          if (await fs.access(altFolderPath).then(() => true).catch(() => false)) {
            sourceFolderPath = altFolderPath
            sourceExists = true
          }
        }
        if (!sourceExists) {
          const topFolder = (dbFiles[0].relative_path || '').replace(/\\/g, '/').split('/')[0]
          if (topFolder) {
            const alt2 = path.join(uploadsDir, username, topFolder)
            if (await fs.access(alt2).then(() => true).catch(() => false)) {
              sourceFolderPath = alt2
              sourceExists = true
            }
          }
        }
      }

      if (sourceExists) {
        // Recursive copy helper
        async function copyDir(src, dest) {
          const entries = await fs.readdir(src, { withFileTypes: true })
          for (const entry of entries) {
            const srcPath = path.join(src, entry.name)
            const destPath = path.join(dest, entry.name)
            if (entry.isDirectory()) {
              await fs.mkdir(destPath, { recursive: true })
              await copyDir(srcPath, destPath)
            } else {
              await fs.copyFile(srcPath, destPath)
            }
          }
        }
        await copyDir(sourceFolderPath, destFolderPath)
        await fs.rm(sourceFolderPath, { recursive: true, force: true })
        console.log(`✅ Folder copied to NAS and source deleted: ${destFolderPath}`)
      } else {
        console.warn(`⚠️ Source folder not found at ${sourceFolderPath}, will copy file-by-file from DB paths`)
      }
    } else {
      console.log(`📋 Attachment folder — copying files individually from DB paths`)
    }

    const now = new Date()
    const nowSql = now.toISOString().slice(0, 19).replace('T', ' ')

    for (const file of dbFiles) {
      const fileId = file.id
      if (!file) continue

      // Compute the correct NAS path preserving subfolder structure
      // relative_path is like "folderName/subfolder/file.ext" or "folderName/file.ext"
      let nasFilePath
      if (file.relative_path) {
        // Strip ONLY the top-level folderName prefix from relative_path
        // e.g. "MyFolder/subdir/file.txt" -> "subdir/file.txt"
        // e.g. "MyFolder/file.txt" -> "file.txt"
        const relParts = file.relative_path.replace(/\\/g, '/').split('/')
        // relParts[0] is the folderName, rest is the path inside the folder
        const relativeInFolder = relParts.slice(1).join('/')
        if (relativeInFolder) {
          nasFilePath = path.join(destFolderPath, relativeInFolder)
        } else {
          nasFilePath = path.join(destFolderPath, file.original_name)
        }
      } else {
        nasFilePath = path.join(destFolderPath, file.original_name)
      }

      if (!sourceExists) {
        // Resolve source path from DB
        // attachment file_path may be absolute (e.g. \\NAS\...\file.docx)
        // or relative with /uploads/ prefix
        let srcFilePath
        if (path.isAbsolute(file.file_path) || file.file_path.startsWith('\\\\')) {
          // Already an absolute path — use as-is
          srcFilePath = file.file_path
        } else if (file.file_path.startsWith('/uploads/')) {
          srcFilePath = path.join(uploadsDir, file.file_path.substring(9))
        } else {
          srcFilePath = path.join(uploadsDir, file.file_path)
        }
        // Ensure destination subdirectory exists (preserves subfolder structure)
        await fs.mkdir(path.dirname(nasFilePath), { recursive: true })
        console.log(`🔍 Attachment src: ${srcFilePath}`)
        console.log(`🔍 Attachment dst: ${nasFilePath}`)
        const srcOk = await fs.access(srcFilePath).then(() => true).catch(() => false)
        if (srcOk) {
          // Only copy+delete if src and dst are different paths
          const normalSrc = path.normalize(srcFilePath).toLowerCase()
          const normalDst = path.normalize(nasFilePath).toLowerCase()
          if (normalSrc === normalDst) {
            console.log(`ℹ️ Source and destination are the same path, skipping copy: ${srcFilePath}`)
          } else {
            await fs.copyFile(srcFilePath, nasFilePath)
            await safeDeleteFile(srcFilePath)
            console.log(`✅ Copied file to NAS: ${nasFilePath}`)
          }
        } else {
          console.warn(`⚠️ Source file not found at: ${srcFilePath} — may already have been moved on a previous approval`)
        }
      }

      if (file.source_type === 'assignment_attachment') {
        // Update assignment_attachments table
        await new Promise((resolve, reject) => {
          db.run(
            `UPDATE assignment_attachments SET
              status = 'final_approved',
              current_stage = 'published_to_public',
              admin_reviewed_at = ?,
              admin_comments = ?,
              public_network_url = ?,
              final_approved_at = ?
            WHERE id = ?`,
            [nowSql, comments || null, nasFilePath, nowSql, fileId],
            (err) => { if (err) { console.warn('Could not update attachment status:', err.message); resolve() } else resolve() }
          )
        })
      } else {
        await new Promise((resolve, reject) => {
          db.run(`UPDATE files SET
            status = 'final_approved',
            current_stage = 'published_to_public',
            admin_id = ?,
            admin_username = ?,
            admin_reviewed_at = ?,
            admin_comments = ?,
            public_network_url = ?,
            final_approved_at = ?
            WHERE id = ?`,
            [adminId, adminUsername, nowSql, comments || null, nasFilePath, nowSql, fileId],
            (err) => { if (err) reject(err); else resolve() }
          )
        })

        logFileStatusChange(db, fileId, file.status, 'final_approved', file.current_stage,
          'published_to_public', adminId, adminUsername, adminRole,
          `Folder approved & moved to NAS: ${comments || 'No comments'}`)
      }

    }

    // --- Smart folder notification logic ---
    // Group all processed files by user, then send one grouped notification per user.
    // If ALL files for a user are approved → single folder-level notification.
    // If MOST files are rejected but a few approved → individual notifications for each approved.
    // If MOST files are approved but a few rejected → individual notifications for each rejected.
    // Individual file notifications are always sent when the minority count is ≤ 2.
    const userFileMap = {};
    for (const file of dbFiles) {
      if (!userFileMap[file.user_id]) {
        userFileMap[file.user_id] = { approved: [], rejected: [] };
      }
      userFileMap[file.user_id].approved.push(file);
    }

    for (const [userId, { approved, rejected }] of Object.entries(userFileMap)) {
      const totalFiles = approved.length + rejected.length;
      const approvedCount = approved.length;
      const rejectedCount = rejected.length;

      if (rejectedCount === 0) {
        // All approved — send one folder-level notification
        createNotification(
          userId, null, 'final_approval',
          `Folder Approved: "${folderName}"`,
          `All ${approvedCount} file${approvedCount !== 1 ? 's' : ''} in your folder "${folderName}" have been approved and saved to the NAS.`,
          adminId, adminUsername, adminRole
        ).catch(() => {});
      } else if (approvedCount === 0) {
        // All rejected — send one folder-level rejection notification
        createNotification(
          userId, null, 'final_rejection',
          `Folder Rejected: "${folderName}"`,
          `All ${rejectedCount} file${rejectedCount !== 1 ? 's' : ''} in your folder "${folderName}" have been rejected. Please review and resubmit.`,
          adminId, adminUsername, adminRole
        ).catch(() => {});
      } else if (approvedCount <= 2) {
        // Majority rejected, minority approved — individual notifications for approved only
        for (const file of approved) {
          createNotification(
            userId, file.id, 'final_approval',
            'File Approved',
            `Your file "${file.original_name}" in folder "${folderName}" has been approved and saved to the NAS.`,
            adminId, adminUsername, adminRole
          ).catch(() => {});
        }
        // Plus one grouped rejection for the rest
        createNotification(
          userId, null, 'final_rejection',
          `Folder Partially Rejected: "${folderName}"`,
          `${rejectedCount} file${rejectedCount !== 1 ? 's' : ''} in your folder "${folderName}" have been rejected. Please review and resubmit.`,
          adminId, adminUsername, adminRole
        ).catch(() => {});
      } else if (rejectedCount <= 2) {
        // Majority approved, minority rejected — individual notifications for rejected only
        for (const file of rejected) {
          createNotification(
            userId, file.id, 'final_rejection',
            'File Rejected',
            `Your file "${file.original_name}" in folder "${folderName}" has been rejected. Please review and resubmit.`,
            adminId, adminUsername, adminRole
          ).catch(() => {});
        }
        // Plus one grouped approval for the rest
        createNotification(
          userId, null, 'final_approval',
          `Folder Mostly Approved: "${folderName}"`,
          `${approvedCount} file${approvedCount !== 1 ? 's' : ''} in your folder "${folderName}" have been approved and saved to the NAS.`,
          adminId, adminUsername, adminRole
        ).catch(() => {});
      } else {
        // Mixed, neither side is a small minority — send grouped notifications for each outcome
        createNotification(
          userId, null, 'final_approval',
          `Folder Partially Approved: "${folderName}"`,
          `${approvedCount} of ${totalFiles} file${totalFiles !== 1 ? 's' : ''} in your folder "${folderName}" have been approved and saved to the NAS.`,
          adminId, adminUsername, adminRole
        ).catch(() => {});
        createNotification(
          userId, null, 'final_rejection',
          `Folder Partially Rejected: "${folderName}"`,
          `${rejectedCount} of ${totalFiles} file${totalFiles !== 1 ? 's' : ''} in your folder "${folderName}" have been rejected. Please review and resubmit.`,
          adminId, adminUsername, adminRole
        ).catch(() => {});
      }
    }
    // --- End smart folder notification logic ---

    logActivity(db, adminId, adminUsername, adminRole, team,
      `Folder approved & moved to NAS: ${folderName} (${fileIds.length} files) -> ${destFolderPath}`)

    console.log(`✅ Folder "${folderName}" fully approved and on NAS`)
    res.json({
      success: true,
      message: `Folder "${folderName}" approved and uploaded to NAS successfully`,
      nasPath: destFolderPath
    })
  } catch (error) {
    console.error('❌ Error moving folder to NAS:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to move folder to NAS: ' + error.message
    })
  }
})

// Check for duplicate file names
router.post('/check-duplicate', (req, res) => {
  const { originalName, userId } = req.body;
  console.log(`🔍 Checking for duplicate file: ${originalName} by user ${userId}`);

  db.get('SELECT * FROM files WHERE original_name = ? AND user_id = ?', [originalName, userId], (err, existingFile) => {
    if (err) {
      console.error('❌ Error checking for duplicate file:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to check for duplicate files'
      });
    }
    res.json({
      success: true,
      isDuplicate: !!existingFile,
      existingFile: existingFile || null
    });
  });
});

// Upload file (User only)
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { description, userId, username, userTeam, userRole, tag, replaceExisting, isRevision, folderName, relativePath, isFolder } = req.body;
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // WORKFLOW: Check if this filename was previously rejected
    const checkRejectedQuery = `
      SELECT * FROM files 
      WHERE original_name = ? 
      AND user_id = ? 
      AND (status = 'rejected_by_team_leader' OR status = 'rejected_by_admin')
      ORDER BY uploaded_at DESC LIMIT 1
    `;

    const previouslyRejected = await new Promise((resolve, reject) => {
      db.get(checkRejectedQuery, [req.file.originalname, userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // If previously rejected file found, enable automatic replacement
    const autoReplace = !!previouslyRejected;
    if (autoReplace) {
      console.log(`📝 Auto-replacing previously rejected file (ID: ${previouslyRejected.id})`);
    }

    // Get the original filename and ensure proper UTF-8 encoding
    let originalFilename = req.file.originalname;

    // Fix garbled UTF-8 filenames (latin1 mis-decoded as binary)
    try {
      if (/[\xC3\xC4\xC6\xC8]/.test(originalFilename)) {
        const buffer = Buffer.from(originalFilename, 'binary');
        const utf8Attempt = buffer.toString('utf8');
        if (utf8Attempt !== originalFilename) originalFilename = utf8Attempt;
      }
    } catch (e) { /* keep original */ }

    console.log(`📁 Upload by ${username} (${userTeam}): ${originalFilename}${isRevision === 'true' ? ' [REVISION]' : ''}`);

    // Move file from temp location to user's folder on NAS
    try {
      const finalPath = await moveToUserFolder(req.file.path, username, originalFilename, folderName, relativePath);
      req.file.path = finalPath;
      req.file.filename = originalFilename;
      req.file.originalname = originalFilename;
    } catch (moveError) {
      console.error('❌ Error moving file to user folder:', moveError.message);
      await safeDeleteFile(req.file.path);
      return res.status(500).json({
        success: false,
        message: 'Failed to organize uploaded file: ' + moveError.message
      });
    }

    // Check for duplicate file if replaceExisting is not explicitly set AND not auto-replacing rejected
    // IMPORTANT: Match on folder_name too — a file inside a folder and a standalone file with the same
    // name are NOT duplicates of each other. Without this, folder uploads create phantom individual records.
    if (replaceExisting !== 'true' && !autoReplace) {
      const dupQuery = folderName
        ? 'SELECT * FROM files WHERE original_name = ? AND user_id = ? AND folder_name = ?'
        : 'SELECT * FROM files WHERE original_name = ? AND user_id = ? AND (folder_name IS NULL OR folder_name = "")';
      const dupParams = folderName
        ? [req.file.originalname, userId, folderName]
        : [req.file.originalname, userId];
      db.get(dupQuery, dupParams, async (err, existingFile) => {
        if (err) {
          console.error('❌ Error checking for duplicate:', err);
          await safeDeleteFile(req.file.path);
          return res.status(500).json({
            success: false,
            message: 'Failed to check for duplicate files'
          });
        }
        if (existingFile) {
          // Delete the newly uploaded file since we found a duplicate
          await safeDeleteFile(req.file.path);
          return res.status(409).json({
            success: false,
            isDuplicate: true,
            message: 'File with this name already exists',
            existingFile: {
              id: existingFile.id,
              original_name: existingFile.original_name,
              uploaded_at: existingFile.uploaded_at,
              status: existingFile.status
            }
          });
        }

        // No duplicate found, proceed with upload
        insertFileRecord();
      });
    } else {
      // Replace existing file - UPDATE the record instead of deleting it
      // Priority: Auto-replace rejected files, then manual replacement
      // Match on folder_name so folder files don’t replace standalone files with the same name
      const fileToReplace = previouslyRejected || await new Promise((resolve, reject) => {
        const repQuery = folderName
          ? 'SELECT * FROM files WHERE original_name = ? AND user_id = ? AND folder_name = ?'
          : 'SELECT * FROM files WHERE original_name = ? AND user_id = ? AND (folder_name IS NULL OR folder_name = "")';
        const repParams = folderName
          ? [req.file.originalname, userId, folderName]
          : [req.file.originalname, userId];
        db.get(repQuery, repParams, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      (async () => {
        const existingFile = fileToReplace;
        if (existingFile) {
          // Delete old physical file only (substring(9) strips '/uploads/')
          const oldRelativePath = existingFile.file_path.startsWith('/uploads/') ? existingFile.file_path.substring(9) : existingFile.file_path;
          const oldFilePath = path.join(uploadsDir, oldRelativePath);
          await safeDeleteFile(oldFilePath);

          // Get the relative path for the new file (renamed to avoid shadowing req.body.relativePath)
          const fileSystemRelPath = path.relative(uploadsDir, req.file.path).replace(/\\/g, '/');
          const isTeamLeaderUpload = userRole && userRole.toUpperCase().includes('TEAM_LEADER');
          const initialStatus = (isRevision === 'true') ? 'under_revision' : (isTeamLeaderUpload ? 'team_leader_approved' : 'uploaded');
          const initialStage = isTeamLeaderUpload ? 'pending_admin' : 'pending_team_leader';

          // UPDATE the existing database record instead of deleting it
          db.run(`UPDATE files SET 
            filename = ?,
            file_path = ?,
            file_size = ?,
            file_type = ?,
            mime_type = ?,
            description = ?,
            tag = ?,
            status = ?,
            current_stage = ?,
            folder_name = ?,
            relative_path = ?,
            is_folder = ?,
            uploaded_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
            [
              req.file.filename,
              `/uploads/${fileSystemRelPath}`,
              req.file.size,
              getFileTypeDescription(req.file.mimetype, req.file.originalname),
              req.file.mimetype,
              description || '',
              tag || '',
              initialStatus,
              initialStage,
              folderName || null,
              relativePath || null,
              isFolder === 'true' ? 1 : 0,
              existingFile.id  // Keep the same ID!
            ], async function (updateErr) {
              if (updateErr) {
                console.error('❌ Error updating file record:', updateErr);
                await safeDeleteFile(req.file.path);
                return res.status(500).json({
                  success: false,
                  message: 'Failed to update file information'
                });
              }

              const fileId = existingFile.id; // Use the same ID

              // Log the file replacement
              const action = isRevision === 'true' ? 'revised' : 'replaced';
              logActivity(db, userId, username, 'USER', userTeam, `File ${action}: ${req.file.originalname}`);

              // Log status history
              logFileStatusChange(
                db,
                fileId,
                existingFile.status,
                initialStatus,
                existingFile.current_stage,
                'pending_team_leader',
                userId,
                username,
                'USER',
                `File ${action} by user${isRevision === 'true' ? ' (revision of rejected file)' : ''}`
              );

              console.log(`✅ File ${action} (ID: ${fileId})`);

              // Notify admins if uploader is a Team Leader
              if (userRole && userRole.toUpperCase().includes('TEAM_LEADER')) {
                createAdminNotification(
                  fileId,
                  'new_upload',
                  `Team Leader ${isRevision === 'true' ? 'Revised' : 'Uploaded'} a File`,
                  `${username} (Team Leader) ${isRevision === 'true' ? 'revised' : 'uploaded'} "${req.file.originalname}" — pending review.`,
                  userId, username, userRole
                ).catch(err => console.error('Failed to notify admins of TL upload:', err));
              }

              res.json({
                success: true,
                message: `File ${action} successfully`,
                file: {
                  id: fileId,
                  filename: req.file.filename,
                  original_name: req.file.originalname,
                  file_size: req.file.size,
                  file_type: getFileTypeDescription(req.file.mimetype, req.file.originalname),
                  description: description || '',
                  status: initialStatus,
                  current_stage: 'pending_team_leader',
                  uploaded_at: new Date()
                },
                replaced: true,
                isRevision: isRevision === 'true'
              });
            });
        } else {
          // No existing file found to replace
          insertFileRecord();
        }
      })();
    }

    function insertFileRecord() {
      const fileSystemPath = path.relative(uploadsDir, req.file.path).replace(/\\/g, '/');
      const isTeamLeader = userRole && userRole.toUpperCase().includes('TEAM_LEADER');
      // Team Leaders skip the TL review stage — their files go straight to Pending Admin
      const initialStatus = (isRevision === 'true') ? 'under_revision' : (isTeamLeader ? 'team_leader_approved' : 'uploaded');
      const initialStage = isTeamLeader ? 'pending_admin' : 'pending_team_leader';

      // Insert file record into database
      db.run(`INSERT INTO files (
        filename, original_name, file_path, file_size, file_type, mime_type, description, tag,
        user_id, username, user_team, status, current_stage, folder_name, relative_path, is_folder
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.file.filename,
          req.file.originalname,
          `/uploads/${fileSystemPath}`,
          req.file.size,
          getFileTypeDescription(req.file.mimetype, req.file.originalname),
          req.file.mimetype,
          description || '',
          tag || '',
          userId,
          username,
          userTeam,
          initialStatus,
          initialStage,
          folderName || null,
          relativePath || null,
          isFolder === 'true' ? 1 : 0
        ], async function (err) {
          if (err) {
            console.error('❌ Error saving file to database:', err);
            // Delete the uploaded file if database save fails
            await safeDeleteFile(req.file.path);
            return res.status(500).json({
              success: false,
              message: 'Failed to save file information'
            });
          }
          const fileId = this.lastID;

          // Log the file upload
          const action = replaceExisting === 'true' ? 'replaced' : (isRevision === 'true' ? 'revised' : 'uploaded');
          logActivity(db, userId, username, 'USER', userTeam, `File ${action}: ${req.file.originalname}`);

          // Log status history
          logFileStatusChange(
            db,
            fileId,
            null,
            initialStatus,
            null,
            'pending_team_leader',
            userId,
            username,
            'USER',
            `File ${action} by user${isRevision === 'true' ? ' (revision of rejected file)' : ''}`
          );

          console.log(`✅ File ${action} (ID: ${fileId})`);

          // Notify admins if uploader is a Team Leader
          if (userRole && userRole.toUpperCase().includes('TEAM_LEADER')) {
            createAdminNotification(
              fileId,
              'new_upload',
              `Team Leader ${isRevision === 'true' ? 'Revised' : 'Uploaded'} a File`,
              `${username} (Team Leader) ${isRevision === 'true' ? 'revised' : 'uploaded'} "${req.file.originalname}" — pending review.`,
              userId, username, userRole
            ).catch(err => console.error('Failed to notify admins of TL upload:', err));
          }

          res.json({
            success: true,
            message: `File ${action} successfully`,
            file: {
              id: fileId,
              filename: req.file.filename,
              original_name: req.file.originalname,
              file_size: req.file.size,
              file_type: getFileTypeDescription(req.file.mimetype, req.file.originalname),
              description: description || '',
              status: initialStatus,
              current_stage: 'pending_team_leader',
              uploaded_at: new Date()
            },
            replaced: replaceExisting === 'true',
            isRevision: isRevision === 'true'
          });
        });
    }
  } catch (error) {
    console.error('❌ Error handling file upload:', error);
    res.status(500).json({
      success: false,
      message: 'File upload failed'
    });
  }
});

// Get local file path for Electron (All authenticated users)
router.get('/:id/path', (req, res) => {
  const { id } = req.params;
  console.log(`📄 Getting file path for file ${id}`);

  db.get('SELECT file_path, original_name, public_network_url, status FROM files WHERE id = ?', [id], (err, file) => {
    if (err) {
      console.error('❌ Error getting file path:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch file path'
      });
    }

    if (!file) {
      // Not found in files table, check assignment_attachments
      console.log(`   File ${id} not found in 'files' table, checking 'assignment_attachments'...`);
      return db.get('SELECT file_path, original_name, public_network_url, status FROM assignment_attachments WHERE id = ?', [id], (err2, attachment) => {
        if (err2) {
          console.error('❌ Error checking attachment:', err2);
          return res.status(500).json({
            success: false,
            message: 'Failed to check attachments'
          });
        }

        if (!attachment) {
          return res.status(404).json({
            success: false,
            message: 'File not found'
          });
        }

        // Found in attachments - resolve path
        console.log(`   Found in 'assignment_attachments' table`);

        // Prefer public_network_url (NAS final path) if available
        if (attachment.public_network_url && !attachment.public_network_url.startsWith('http')) {
          console.log(`✅ Using public_network_url for attachment: ${attachment.public_network_url}`);
          return res.json({
            success: true,
            filePath: attachment.public_network_url,
            originalName: attachment.original_name
          });
        }

        let absolutePath = attachment.file_path;

        // If it's already a UNC path (\\server\...) or absolute Windows path, use as-is
        // Do NOT call path.resolve() on UNC paths — it corrupts them
        if (absolutePath && (absolutePath.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(absolutePath))) {
          console.log(`✅ File path is already absolute (attachment): ${absolutePath}`);
        } else if (absolutePath && absolutePath.startsWith('/uploads/')) {
          const relativePath = absolutePath.replace(/^\/uploads\//, '');
          absolutePath = path.join(uploadsDir, relativePath);
        } else if (absolutePath) {
          absolutePath = path.join(uploadsDir, absolutePath);
        }

        console.log(`✅ File path resolved (attachment) for ID ${id}: ${absolutePath}`);

        return res.json({
          success: true,
          filePath: absolutePath,
          originalName: attachment.original_name
        });
      });
    }

    // Construct absolute path for Electron
    let absolutePath = file.file_path;

    // Use network URL if file is approved and published
    if (file.public_network_url && !file.public_network_url.startsWith('http')) {
      absolutePath = file.public_network_url;
      console.log(`📡 Using public network URL for file: ${absolutePath}`);
    } else {
      // If it's already a UNC path (\\server\...) or absolute Windows path, use as-is
      // Do NOT call path.resolve() on UNC paths — it corrupts them
      if (absolutePath && (absolutePath.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(absolutePath))) {
        console.log(`✅ File path is already absolute: ${absolutePath}`);
      } else if (file.file_path && file.file_path.startsWith('/uploads/')) {
        const relativePath = file.file_path.replace(/^\/uploads\//, '');
        absolutePath = path.join(uploadsDir, relativePath);
      } else if (file.file_path && !path.isAbsolute(file.file_path)) {
        absolutePath = path.join(uploadsDir, file.file_path);
      }
    }

    console.log(`✅ File path resolved for ID ${id}: ${absolutePath}`);

    res.json({
      success: true,
      filePath: absolutePath,
      originalName: file.original_name
    });
  });
});

// Get files for a specific team member (Team Leader only)
router.get('/member/:memberId', (req, res) => {
  const { memberId } = req.params;
  console.log(`📄 Getting files for team member ${memberId}`);

  db.all(
    `SELECT f.*, fc.comment as latest_comment
     FROM files f
     LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (
       SELECT MAX(id) FROM file_comments WHERE file_id = f.id
     )
     WHERE f.user_id = ?
     ORDER BY f.uploaded_at DESC`,
    [memberId],
    (err, files) => {
      if (err) {
        console.error('❌ Error getting member files:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch member files'
        });
      }
      console.log(`✅ Retrieved ${files.length} files for member ${memberId}`);
      res.json({
        success: true,
        files
      });
    }
  );
});

// Get files for user (User only - their own files) with pagination
router.get('/user/:userId', (req, res) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 1000; // High default so all files load
  const offset = (page - 1) * limit;

  console.log(`📁 Getting files for user ${userId} - Page ${page}, Limit ${limit}`);

  // Get total count
  db.get('SELECT COUNT(*) as total FROM files WHERE user_id = ?', [userId], (err, countResult) => {
    if (err) {
      console.error('❌ Error getting user file count:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch files'
      });
    }

    db.all(
      `SELECT f.*, fc.comment as latest_comment
       FROM files f
       LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (
         SELECT MAX(id) FROM file_comments WHERE file_id = f.id
       )
       WHERE f.user_id = ?
       ORDER BY f.uploaded_at DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset],
      (err, files) => {
        if (err) {
          console.error('❌ Error getting user files:', err);
          return res.status(500).json({
            success: false,
            message: 'Failed to fetch files'
          });
        }
        console.log(`✅ Retrieved ${files.length} files for user ${userId}`);
        res.json({
          success: true,
          files,
          pagination: {
            page,
            limit,
            total: countResult.total,
            pages: Math.ceil(countResult.total / limit)
          }
        });
      }
    );
  });
});

// Get pending files for user (files that are not final_approved) with pagination
router.get('/user/:userId/pending', (req, res) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  console.log(`📁 Getting pending files for user ${userId} - Page ${page}, Limit ${limit}`);

  // Get total count
  db.get('SELECT COUNT(*) as total FROM files WHERE user_id = ? AND status != ?', [userId, 'final_approved'], (err, countResult) => {
    if (err) {
      console.error('❌ Error getting user pending file count:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch pending files'
      });
    }

    db.all(
      `SELECT f.*,
              GROUP_CONCAT(fc.comment, ' | ') as comments
       FROM files f
       LEFT JOIN file_comments fc ON f.id = fc.file_id
       WHERE f.user_id = ? AND f.status != 'final_approved'
       GROUP BY f.id
       ORDER BY f.uploaded_at DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset],
      (err, files) => {
        if (err) {
          console.error('❌ Error getting user pending files:', err);
          return res.status(500).json({
            success: false,
            message: 'Failed to fetch pending files'
          });
        }

        // Process the files to include comments as an array
        const processedFiles = files.map(file => {
          const comments = file.comments ?
            file.comments.split(' | ').map(comment => ({ comment })) : [];
          return {
            ...file,
            comments
          };
        });

        console.log(`✅ Retrieved ${processedFiles.length} pending files for user ${userId}`);
        res.json({
          success: true,
          files: processedFiles,
          pagination: {
            page,
            limit,
            total: countResult.total,
            pages: Math.ceil(countResult.total / limit)
          }
        });
      }
    );
  });
});

// Get files for team leader review (Team Leader only) with pagination
router.get('/team-leader/:team', (req, res) => {
  const { team } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  console.log(`📁 Getting files for team leader review: ${team} team - Page ${page}, Limit ${limit}`);

  // Get total count
  db.get('SELECT COUNT(*) as total FROM files WHERE user_team = ? AND current_stage = ?', [team, 'pending_team_leader'], (err, countResult) => {
    if (err) {
      console.error('❌ Error getting team leader file count:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch files for review'
      });
    }

    db.all(
      `SELECT f.*, fc.comment as latest_comment
       FROM files f
       LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (
         SELECT MAX(id) FROM file_comments WHERE file_id = f.id
       )
       WHERE f.user_team = ? AND f.current_stage = 'pending_team_leader'
       ORDER BY f.uploaded_at DESC LIMIT ? OFFSET ?`,
      [team, limit, offset],
      (err, files) => {
        if (err) {
          console.error('❌ Error getting team leader files:', err);
          return res.status(500).json({
            success: false,
            message: 'Failed to fetch files for review'
          });
        }
        console.log(`✅ Retrieved ${files.length} files for ${team} team leader review`);
        res.json({
          success: true,
          files,
          pagination: {
            page,
            limit,
            total: countResult.total,
            pages: Math.ceil(countResult.total / limit)
          }
        });
      }
    );
  });
});

// Get files for admin review (Admin only) with pagination
router.get('/admin', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  console.log(`📁 Getting files for admin review - Page ${page}, Limit ${limit}`);

  // Get total count
  db.get('SELECT COUNT(*) as total FROM files WHERE current_stage = ?', ['pending_admin'], (err, countResult) => {
    if (err) {
      console.error('❌ Error getting admin file count:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch files for admin review'
      });
    }

    db.all(
      `SELECT f.*, fc.comment as latest_comment
       FROM files f
       LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (
         SELECT MAX(id) FROM file_comments WHERE file_id = f.id
       )
       WHERE f.current_stage = 'pending_admin'
       ORDER BY f.uploaded_at DESC LIMIT ? OFFSET ?`,
      [limit, offset],
      (err, files) => {
        if (err) {
          console.error('❌ Error getting admin files:', err);
          return res.status(500).json({
            success: false,
            message: 'Failed to fetch files for admin review'
          });
        }
        console.log(`✅ Retrieved ${files.length} files for admin review`);
        res.json({
          success: true,
          files,
          pagination: {
            page,
            limit,
            total: countResult.total,
            pages: Math.ceil(countResult.total / limit)
          }
        });
      }
    );
  });
});

// Get all files (Admin only - for comprehensive view) - no server-side limit so frontend can paginate fully
// Also includes Team Leader assignment attachments so admin can review/approve them
router.get('/all', (req, res) => {
  console.log(`📁 Getting all files (admin view)`);

  db.all(
    `SELECT f.*, fc.comment as latest_comment
     FROM files f
     LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (
       SELECT MAX(id) FROM file_comments WHERE file_id = f.id
     )
     ORDER BY f.uploaded_at DESC`,
    [],
    (err, files) => {
      if (err) {
        console.error('❌ Error getting all files:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch all files'
        });
      }

      // Also fetch Team Leader assignment attachments
      db.all(
        `SELECT
           aa.id,
           aa.original_name,
           aa.filename,
           aa.file_path,
           aa.file_size,
           aa.file_type,
           aa.created_at AS uploaded_at,
           COALESCE(aa.status, 'team_leader_approved') AS status,
           COALESCE(aa.current_stage, 'pending_admin') AS current_stage,
           aa.uploaded_by_username AS username,
           aa.uploaded_by_id AS user_id,
           u.team AS user_team,
           COALESCE(aa.folder_name, NULL) AS folder_name,
           COALESCE(aa.relative_path, NULL) AS relative_path,
           'assignment_attachment' AS source_type,
           a.id AS assignment_id
         FROM assignment_attachments aa
         LEFT JOIN assignments a ON aa.assignment_id = a.id
         LEFT JOIN users u ON aa.uploaded_by_id = u.id
         ORDER BY aa.created_at DESC`,
        [],
        (err2, attachments) => {
          if (err2) {
            console.warn('⚠️ Could not fetch assignment attachments:', err2.message);
            // Still return regular files even if attachments fail
            console.log(`✅ Retrieved ${files.length} files (all files view, attachments unavailable)`);
            return res.json({ success: true, files });
          }

          // Merge — avoid duplicates (attachment already in files table)
          const fileIds = new Set(files.map(f => String(f.id)))
          const newAttachments = attachments.filter(a => !fileIds.has(String(a.id)))

          const allFiles = [...files, ...newAttachments]
          console.log(`✅ Retrieved ${files.length} files + ${newAttachments.length} TL attachments (all files view)`);
          res.json({ success: true, files: allFiles });
        }
      );
    }
  );
});

// Team leader approve/reject file
router.post('/:fileId/team-leader-review', (req, res) => {
  const { fileId } = req.params;
  const { action, comments, teamLeaderId, teamLeaderUsername, teamLeaderRole, team } = req.body;
  console.log(`📋 Team leader ${action} for file ${fileId} by ${teamLeaderUsername}`);

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid action. Must be approve or reject'
    });
  }

  // Get current file status
  db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
    if (err) {
      console.error('❌ Error getting file:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch file'
      });
    }

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    if (file.current_stage !== 'pending_team_leader') {
      return res.status(400).json({
        success: false,
        message: 'File is not in pending team leader review stage'
      });
    }

    // Use MySQL-friendly DATETIME format: YYYY-MM-DD HH:MM:SS
    const now = new Date();
    const nowSql = now.toISOString().slice(0, 19).replace('T', ' ');
    let newStatus, newStage;
    if (action === 'approve') {
      newStatus = 'team_leader_approved';
      newStage = 'pending_admin';
    } else {
      newStatus = 'rejected_by_team_leader';
      newStage = 'rejected_by_team_leader';
    }

    // Update file status - build SQL and params so we can log them for debugging
    const tlSql = `UPDATE files SET
      status = ?,
      current_stage = ?,
      team_leader_id = ?,
      team_leader_username = ?,
      team_leader_reviewed_at = ?,
      team_leader_comments = ?${action === 'reject' ? ', rejection_reason = ?, rejected_by = ?, rejected_at = ?' : ''}
    WHERE id = ?`;

    const tlParams = action === 'reject' ? [
      newStatus, newStage, teamLeaderId, teamLeaderUsername, nowSql, comments,
      comments, teamLeaderUsername, nowSql, fileId
    ] : [
      newStatus, newStage, teamLeaderId, teamLeaderUsername, nowSql, comments, fileId
    ];

    console.log('DEBUG: Executing SQL (team-leader):', tlSql.replace(/\s+/g, ' '));
    console.log('DEBUG: Params (team-leader):', tlParams);

    db.run(tlSql, tlParams, function (err) {
      if (err) {
        console.error('❌ Error updating file status:', err);
        // Return DB error message to client in dev for easier debugging
        return res.status(500).json({
          success: false,
          message: 'Failed to update file status',
          error: err.message
        });
      }

      // Add comment if provided AND create notification for it
      if (comments) {
        const commentType = action === 'approve' ? 'approval' : 'rejection';
        db.run(
          'INSERT INTO file_comments (file_id, user_id, username, user_role, comment, comment_type) VALUES (?, ?, ?, ?, ?, ?)',
          [fileId, teamLeaderId, teamLeaderUsername, teamLeaderRole, comments, commentType],
          (err) => {
            if (err) {
              console.error('❌ Error adding team leader comment:', err);
              console.error('Comment details:', { fileId, teamLeaderId, teamLeaderUsername, teamLeaderRole, comments, commentType });
            } else {
              console.log('✅ Team leader comment added successfully');

              // Create a separate notification for the comment itself
              const commentNotifTitle = `Team Leader ${action === 'approve' ? 'Approved' : 'Rejected'} with Comments`;
              const commentNotifMessage = `${teamLeaderUsername} left ${commentType} comments on your file: "${comments.substring(0, 150)}${comments.length > 150 ? '...' : ''}"`.replace(/\\"/g, '"');

              createNotification(
                file.user_id,
                fileId,
                'comment',
                commentNotifTitle,
                commentNotifMessage,
                teamLeaderId,
                teamLeaderUsername,
                teamLeaderRole
              ).catch(err => {
                console.error('❌ Failed to create comment notification:', err);
              });
            }
          }
        );
      }

      // Log activity
      logActivity(
        db,
        teamLeaderId,
        teamLeaderUsername,
        teamLeaderRole,
        team,
        `File ${action}d: ${file.filename} (Team Leader Review)`
      );

      // Log status history
      logFileStatusChange(
        db,
        fileId,
        file.status,
        newStatus,
        file.current_stage,
        newStage,
        teamLeaderId,
        teamLeaderUsername,
        teamLeaderRole,
        `Team leader ${action}: ${comments || 'No comments'}`
      );

      // Create notification for the file owner
      const notificationType = action === 'approve' ? 'approval' : 'rejection';
      const notificationTitle = action === 'approve'
        ? 'File Approved by Team Leader'
        : 'File Rejected by Team Leader';
      const notificationMessage = action === 'approve'
        ? `Your file "${file.original_name}" has been approved by ${teamLeaderUsername} and is now pending admin review.`
        : `Your file "${file.original_name}" has been rejected by ${teamLeaderUsername}. ${comments ? 'Reason: ' + comments : 'Please review and resubmit.'}`;
      // ... (existing code)

      createNotification(
        file.user_id,
        fileId,
        notificationType,
        notificationTitle,
        notificationMessage,
        teamLeaderId,
        teamLeaderUsername,
        teamLeaderRole
      ).catch(err => {
        console.error('Failed to create notification:', err);
      });

      // NEW: Notify Admins
      if (action === 'approve') {
        createAdminNotification(
          fileId,
          'team_leader_approved',
          'File Approved by Team Leader',
          `${teamLeaderUsername} approved file "${file.original_name}" (Team: ${team.name || file.user_team}). Pending final review.`,
          teamLeaderId,
          teamLeaderUsername,
          teamLeaderRole
        ).catch(err => console.error('Failed to notify admins:', err));
      }

      console.log(`✅ File ${action}d by team leader: ${file.filename}`);
      res.json({
        success: true,
        message: `File ${action}d successfully`,
        file: {
          ...file,
          status: newStatus,
          current_stage: newStage,
          team_leader_reviewed_at: nowSql,
          team_leader_comments: comments
        }
      });
    });
  });
});

// Move approved file to network projects path
router.post('/:fileId/move-to-projects', async (req, res) => {
  const { fileId } = req.params;
  const { destinationPath, adminId, adminUsername, adminRole, team, deleteFromUploads } = req.body;
  console.log(`📦 Moving file ${fileId} to destination: ${destinationPath}`);

  try {
    // Get file info — check files table first, then assignment_attachments
    let file = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });

    let isAttachment = false;
    if (!file) {
      // Try assignment_attachments
      file = await new Promise((resolve, reject) => {
        db.get('SELECT *, created_at AS uploaded_at FROM assignment_attachments WHERE id = ?', [fileId], (err, row) => {
          if (err) reject(err); else resolve(row);
        });
      });
      if (file) {
        isAttachment = true;
        file.username = file.uploaded_by_username;
      }
    }

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Get source file path — handle both absolute (attachment) and relative paths.
    // IMPORTANT: Check /uploads/ prefix FIRST. On Windows, path.isAbsolute('/uploads/...')
    // returns true (leading / = rooted to current drive), so we must handle these relative
    // DB paths before reaching the isAbsolute branch.
    let sourcePath;
    if (file.file_path && file.file_path.startsWith('/uploads/')) {
      // Relative path stored in DB — resolve against the NAS uploads directory
      sourcePath = path.join(uploadsDir, file.file_path.substring(9));
    } else if (file.file_path && (file.file_path.startsWith('\\\\') || /^[a-zA-Z]:[\\/]/.test(file.file_path))) {
      // Already a real absolute path (UNC or Windows drive letter)
      sourcePath = file.file_path;
    } else {
      // Fallback: join with uploadsDir as-is
      sourcePath = path.join(uploadsDir, file.file_path || '');
    }

    // Check if source file exists
    const sourceExists = await fs.access(sourcePath).then(() => true).catch(() => false);
    if (!sourceExists) {
      console.error('❌ Source file not found:', sourcePath);
      return res.status(404).json({
        success: false,
        message: 'Source file not found'
      });
    }

    // destinationPath now comes as full Windows path from file picker
    // e.g., "C:\\Users\\...\\PROJECTS\\Engineering\\2025"
    // or "\\\\KMTI-NAS\\Shared\\Public\\PROJECTS\\Engineering\\2025"
    //
    // Always place the file directly in the chosen destinationPath.
    // The admin already chose the exact destination folder — no extra wrapping.
    const effectiveDestPath = destinationPath;

    console.log('📂 Destination path:', effectiveDestPath);

    // Ensure destination directory exists
    await fs.mkdir(effectiveDestPath, { recursive: true });

    // Place file using just its original_name — no subfolder structure
    const relativeInFolder = file.original_name;

    const destinationFilePath = path.join(effectiveDestPath, relativeInFolder);
    // Ensure any intermediate sub-directories exist
    await fs.mkdir(path.dirname(destinationFilePath), { recursive: true });

    // Check if destination file already exists
    const destExists = await fs.access(destinationFilePath).then(() => true).catch(() => false);
    if (destExists) {
      return res.status(409).json({
        success: false,
        message: 'File already exists in destination',
        existingPath: destinationFilePath
      });
    }

    // Copy file to destination
    await fs.copyFile(sourcePath, destinationFilePath);
    console.log('✅ File copied to:', destinationFilePath);

    // Delete file from uploads folder if requested
    if (deleteFromUploads) {
      const deleteResult = await safeDeleteFile(sourcePath);
      if (deleteResult.success) {
        console.log('✅ File deleted from uploads folder:', sourcePath);
      } else {
        console.warn('⚠️ Could not delete file from uploads folder:', deleteResult.message);
      }
    }

    // Update database with new path — write to correct table
    if (isAttachment) {
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE assignment_attachments SET public_network_url = ? WHERE id = ?',
          [destinationFilePath, fileId],
          (err) => { if (err) { console.warn('Could not update attachment public_network_url:', err.message); resolve(); } else resolve(); }
        );
      });
    } else {
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE files SET public_network_url = ? WHERE id = ?',
          [destinationFilePath, fileId],
          (err) => { if (err) reject(err); else resolve(); }
        );
      });
    }

    // Log activity
    logActivity(
      db,
      adminId,
      adminUsername,
      adminRole,
      team,
      `File moved to projects: ${file.original_name} -> ${effectiveDestPath}${deleteFromUploads ? ' (deleted from uploads)' : ''}`
    );

    console.log(`✅ File moved successfully: ${file.original_name}`);
    res.json({
      success: true,
      message: 'File moved to projects directory successfully',
      destinationPath: destinationFilePath
    });
  } catch (error) {
    console.error('❌ Error moving file to projects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to move file to projects directory',
      error: error.message
    });
  }
});

// Admin approve/reject file (Final approval)
router.post('/:fileId/admin-review', async (req, res) => {
  const { fileId } = req.params;
  const { action, comments, adminId, adminUsername, adminRole, team } = req.body;
  console.log(`📋 Admin ${action} for file ${fileId} by ${adminUsername}`);

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid action. Must be approve or reject'
    });
  }

  // Get current file status — check files table first, then assignment_attachments
  db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
    if (err) return res.status(500).json({ success: false, message: 'DB error' });

    if (!file) {
      // Try assignment_attachments
      return db.get('SELECT *, created_at AS uploaded_at, uploaded_by_id AS user_id, uploaded_by_username AS username FROM assignment_attachments WHERE id = ?', [fileId], (err2, attachment) => {
        if (err2 || !attachment) {
          return res.status(404).json({ success: false, message: 'File not found' });
        }
        // Handle attachment approval/rejection
        const nowSql = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const newStatus = action === 'approve' ? 'final_approved' : 'rejected_by_admin';
        const newStage = action === 'approve' ? 'published_to_public' : 'rejected_by_admin';

        const updateSql = action === 'approve'
          ? `UPDATE assignment_attachments SET status = ?, current_stage = ?, admin_reviewed_at = ?, admin_comments = ?, final_approved_at = ? WHERE id = ?`
          : `UPDATE assignment_attachments SET status = ?, current_stage = ?, admin_reviewed_at = ?, admin_comments = ? WHERE id = ?`;
        const updateParams = action === 'approve'
          ? [newStatus, newStage, nowSql, comments || null, nowSql, fileId]
          : [newStatus, newStage, nowSql, comments || null, fileId];

        db.run(updateSql, updateParams, function(updateErr) {
          if (updateErr) {
            console.warn('⚠️ Could not update attachment status (columns may not exist yet):', updateErr.message);
            // Still return success — the columns may not be migrated yet
          }
          return res.json({ success: true, message: `Attachment ${action}d successfully`, file: { ...attachment, status: newStatus, current_stage: newStage } });
        });
      });
    }
    // Admin can approve files in both 'uploaded' (Pending Team Leader) and 'team_leader_approved' (Pending Admin) status
    const canApprove = file.status === 'uploaded' || file.status === 'team_leader_approved';
    if (!canApprove && action === 'approve') {
      return res.status(400).json({
        success: false,
        message: 'File is not in a state that can be approved by admin'
      });
    }
    console.log(`Current stage: ${file.current_stage}, Status: ${file.status}, Can approve: ${canApprove}`);

    // Use MySQL-friendly DATETIME format
    const now = new Date();
    const nowSql = now.toISOString().slice(0, 19).replace('T', ' ');
    let newStatus, newStage, publicNetworkUrl = null;
    if (action === 'approve') {
      newStatus = 'final_approved';
      newStage = 'published_to_public';
      // Only set public network URL if not already set by move-to-projects
      // (e.g., if files were approved without moving, but in practice they are moved first)
      publicNetworkUrl = file.public_network_url || `https://public-network.example.com/files/${file.filename}`;
    } else {
      newStatus = 'rejected_by_admin';
      newStage = 'rejected_by_admin';
    }

    // Update file status - build SQL and params so we can log them for debugging
    const adminSql = `UPDATE files SET
      status = ?,
      current_stage = ?,
      admin_id = ?,
      admin_username = ?,
      admin_reviewed_at = ?,
      admin_comments = ?${action === 'approve' ? ', final_approved_at = ?' : ''}${action === 'reject' ? ', rejection_reason = ?, rejected_by = ?, rejected_at = ?' : ''}
    WHERE id = ?`;

    const adminParams = action === 'approve' ? [
      newStatus, newStage, adminId, adminUsername, nowSql, comments,
      nowSql, fileId
    ] : action === 'reject' ? [
      newStatus, newStage, adminId, adminUsername, nowSql, comments,
      comments, adminUsername, nowSql, fileId
    ] : [
      newStatus, newStage, adminId, adminUsername, nowSql, comments, fileId
    ];

    console.log('DEBUG: Executing SQL (admin):', adminSql.replace(/\s+/g, ' '));
    console.log('DEBUG: Params (admin):', adminParams);

    db.run(adminSql, adminParams, function (err) {
      if (err) {
        console.error('❌ Error updating file status (admin):', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to update file status',
          error: err.message
        });
      }

      console.log(`✅ Database updated successfully. Rows affected: ${this.changes}`);

      // Add comment if provided
      if (comments) {
        const commentType = action === 'approve' ? 'approval' : 'rejection';
        db.run(
          'INSERT INTO file_comments (file_id, user_id, username, user_role, comment, comment_type) VALUES (?, ?, ?, ?, ?, ?)',
          [fileId, adminId, adminUsername, adminRole, comments, commentType],
          (err) => {
            if (err) {
              console.error('❌ Error adding admin comment:', err);
              console.error('Comment details:', { fileId, adminId, adminUsername, adminRole, comments, commentType });
            } else {
              console.log('✅ Admin comment added successfully');

              // Create a separate notification for the admin comment
              const commentNotifTitle = `Admin ${action === 'approve' ? 'Approved' : 'Rejected'} with Comments`;
              const commentNotifMessage = `${adminUsername} (Admin) left ${commentType} comments on your file: "${comments.substring(0, 150)}${comments.length > 150 ? '...' : ''}"`;

              createNotification(
                file.user_id,
                fileId,
                'comment',
                commentNotifTitle,
                commentNotifMessage,
                adminId,
                adminUsername,
                adminRole
              ).catch(err => {
                console.error('❌ Failed to create admin comment notification:', err);
              });
            }
          }
        );
      }

      // Log activity
      logActivity(
        db,
        adminId,
        adminUsername,
        adminRole,
        team,
        `File ${action}d: ${file.filename} (Admin Final Review)${action === 'approve' ? ' - Published to Public Network' : ''}`
      );

      // Log status history
      logFileStatusChange(
        db,
        fileId,
        file.status,
        newStatus,
        file.current_stage,
        newStage,
        adminId,
        adminUsername,
        adminRole,
        `Admin ${action}: ${comments || 'No comments'}${action === 'approve' ? ' - Published to Public Network' : ''}`
      );

      // Create notification for the file owner
      const notificationType = action === 'approve' ? 'final_approval' : 'final_rejection';
      const notificationTitle = action === 'approve'
        ? 'File Final Approved'
        : 'File Rejected by Admin';
      const notificationMessage = action === 'approve'
        ? `Your file "${file.original_name}" has been final approved by ${adminUsername} and published to the public network!`
        : `Your file "${file.original_name}" has been rejected by ${adminUsername}. ${comments ? 'Reason: ' + comments : 'Please review and resubmit.'}`;

      createNotification(
        file.user_id,
        fileId,
        notificationType,
        notificationTitle,
        notificationMessage,
        adminId,
        adminUsername,
        adminRole
      ).catch(err => {
        console.error('Failed to create notification:', err);
      });

      // Create notification for team leader about admin action
      function sendTeamLeaderNotification(teamLeaderId) {
        if (teamLeaderId && teamLeaderId !== adminId) {
          const tlNotificationTitle = action === 'approve'
            ? 'File Approved by Admin'
            : 'File Rejected by Admin';
          const tlNotificationMessage = action === 'approve'
            ? `Admin ${adminUsername} has approved file "${file.original_name}" submitted by ${file.username}`
            : `Admin ${adminUsername} has rejected file "${file.original_name}" submitted by ${file.username}. ${comments ? 'Reason: ' + comments : ''}`;

          createNotification(
            teamLeaderId,
            fileId,
            notificationType,
            tlNotificationTitle,
            tlNotificationMessage,
            adminId,
            adminUsername,
            adminRole
          ).catch(err => {
            console.error('Failed to create team leader notification:', err);
          });
          console.log(`📧 Created admin ${action} notification for team leader ID: ${teamLeaderId}`);
        }
      }

      let teamLeaderId = file.team_leader_id;

      // If team_leader_id is not set, try to get it from assignment submissions or team
      if (!teamLeaderId) {
        // Check if file is from an assignment submission
        db.get(
          `SELECT a.team_leader_id FROM assignment_submissions asub
           JOIN assignments a ON asub.assignment_id = a.id
           WHERE asub.file_id = ? LIMIT 1`,
          [fileId],
          (err, assignmentSubmission) => {
            if (!err && assignmentSubmission && assignmentSubmission.team_leader_id) {
              teamLeaderId = assignmentSubmission.team_leader_id;
              sendTeamLeaderNotification(teamLeaderId);
            } else {
              // Get team leader from user's team
              db.get(
                'SELECT id FROM users WHERE team = ? AND role = ? LIMIT 1',
                [file.user_team, 'TEAM_LEADER'],
                (err, teamLeader) => {
                  if (!err && teamLeader) {
                    teamLeaderId = teamLeader.id;
                  }
                  sendTeamLeaderNotification(teamLeaderId);
                }
              );
            }
          }
        );
      } else {
        sendTeamLeaderNotification(teamLeaderId);
      }

      console.log(`✅ File ${action}d by admin: ${file.filename}${action === 'approve' ? ' - Published to Public Network' : ''}`);
      res.json({
        success: true,
        message: `File ${action}d successfully${action === 'approve' ? ' and published to Public Network' : ''}`,
        file: {
          ...file,
          status: newStatus,
          current_stage: newStage,
          admin_reviewed_at: now,
          admin_comments: comments,
          ...(action === 'approve' && { public_network_url: publicNetworkUrl, final_approved_at: now })
        }
      });
    });
  });
});

// Get single file details
router.get('/:fileId', (req, res) => {
  const { fileId } = req.params;

  db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
    if (err) {
      console.error('❌ Error getting file:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch file'
      });
    }
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    res.json({
      success: true,
      file
    });
  });
});

// Get file comments
router.get('/:fileId/comments', (req, res) => {
  const { fileId } = req.params;
  db.all(
    'SELECT * FROM file_comments WHERE file_id = ? ORDER BY created_at DESC',
    [fileId],
    (err, comments) => {
      if (err) {
        console.error('❌ Error getting file comments:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch comments'
        });
      }
      res.json({
        success: true,
        comments
      });
    }
  );
});

// Add comment to file
router.post('/:fileId/comments', (req, res) => {
  const { fileId } = req.params;
  const { comment, userId, username, userRole } = req.body;
  if (!comment || !comment.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Comment cannot be empty'
    });
  }

  // Get file info to send notification to owner
  db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
    if (err || !file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    db.run(
      'INSERT INTO file_comments (file_id, user_id, username, user_role, comment) VALUES (?, ?, ?, ?, ?)',
      [fileId, userId, username, userRole, comment.trim()],
      function (err) {
        if (err) {
          console.error('❌ Error adding comment:', err);
          return res.status(500).json({
            success: false,
            message: 'Failed to add comment'
          });
        }

        // Create notification for the file owner (if comment is not by the owner)
        if (userId !== file.user_id) {
          const notificationTitle = 'New Comment on Your File';
          const notificationMessage = `${username} commented on your file "${file.original_name}": ${comment.trim().substring(0, 100)}${comment.trim().length > 100 ? '...' : ''}`;

          createNotification(
            file.user_id,
            fileId,
            'comment',
            notificationTitle,
            notificationMessage,
            userId,
            username,
            userRole
          ).catch(err => {
            console.error('Failed to create notification for comment:', err);
          });
        }

        res.json({
          success: true,
          message: 'Comment added successfully',
          comment: {
            id: this.lastID,
            file_id: fileId,
            user_id: userId,
            username: username,
            user_role: userRole,
            comment: comment.trim(),
            created_at: new Date()
          }
        });
      }
    );
  });
});

// Get file status history
router.get('/:fileId/history', (req, res) => {
  const { fileId } = req.params;
  db.all(
    'SELECT * FROM file_status_history WHERE file_id = ? ORDER BY created_at DESC',
    [fileId],
    (err, history) => {
      if (err) {
        console.error('❌ Error getting file history:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch file history'
        });
      }
      res.json({
        success: true,
        history
      });
    }
  );
});

// Delete file (Admin only)
router.delete('/:fileId', async (req, res) => {
  const { fileId } = req.params;
  const { adminId, adminUsername, adminRole, team } = req.body;
  console.log(`🗑️ Deleting file ${fileId} by admin ${adminUsername}`);

  try {
    // Get file info first
    const file = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });

    if (!file) {
      // Not in files table — check assignment_attachments (old TL-attached files)
      const attachment = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM assignment_attachments WHERE id = ?', [fileId], (err, row) => {
          if (err) reject(err); else resolve(row);
        });
      });

      if (!attachment) {
        return res.status(404).json({ success: false, message: 'File not found' });
      }

      // Delete physical file for attachment
      let attPath = attachment.public_network_url && !attachment.public_network_url.startsWith('http')
        ? attachment.public_network_url
        : null;
      if (!attPath) {
        const fp = attachment.file_path || '';
        if (fp.startsWith('\\\\') || /^[A-Za-z]:[\\//]/.test(fp)) {
          attPath = fp;
        } else if (fp.startsWith('/uploads/')) {
          attPath = path.join(uploadsDir, fp.substring(9));
        } else if (fp) {
          attPath = path.join(uploadsDir, fp);
        }
      }
      if (attPath) await safeDeleteFile(attPath).catch(() => {});

      // Delete DB record
      await new Promise((resolve) => {
        db.run('DELETE FROM assignment_attachments WHERE id = ?', [fileId], () => resolve());
      });

      logActivity(db, adminId, adminUsername, adminRole, team,
        `Attachment deleted: ${attachment.original_name} (Admin Action)`);

      console.log(`✅ Attachment deleted: ${attachment.original_name}`);
      return res.json({ success: true, message: 'File deleted successfully.' });
    }

    // IMPORTANT: Clear assignment submissions that reference this file
    // This allows users to resubmit the task
    try {
      // Step 1: Find which assignment+user rows are linked to this file
      const submissions = await new Promise((resolve, reject) => {
        db.all(
          'SELECT assignment_id, user_id FROM assignment_submissions WHERE file_id = ?',
          [fileId],
          (err, rows) => { if (err) reject(err); else resolve(rows || []); }
        );
      });

      // Step 2: Reset assignment_members status so the user can resubmit
      for (const sub of submissions) {
        await new Promise((resolve) => {
          db.run(
            'UPDATE assignment_members SET status = ?, submitted_at = NULL WHERE assignment_id = ? AND user_id = ?',
            ['pending', sub.assignment_id, sub.user_id],
            (err) => {
              if (err) console.warn('⚠️ Could not reset assignment_members status:', err.message);
              resolve();
            }
          );
        });
      }

      // Step 3: Delete the submission record(s) that pointed to this file
      const deletedCount = await new Promise((resolve, reject) => {
        db.run(
          'DELETE FROM assignment_submissions WHERE file_id = ?',
          [fileId],
          function (err) { if (err) reject(err); else resolve(this.changes); }
        );
      });

      if (deletedCount > 0) {
        console.log(`✅ Cleared ${deletedCount} assignment submission(s) for file ${fileId} — user can resubmit`);
      }
    } catch (clearError) {
      console.error('⚠️ CRITICAL: Failed to clear assignment submissions:', clearError.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to clear assignment references. File cannot be deleted.',
        error: clearError.message
      });
    }

    // Delete file from filesystem
    // IMPORTANT: Check public_network_url FIRST — approved files are moved to NAS and their
    // public_network_url holds the real NAS path (e.g. X:\user_approvals\JC087\file.pdf).
    // file_path still holds the old /uploads/ relative path and will NOT find the file on NAS.
    let filePath;

    if (file.public_network_url && !file.public_network_url.startsWith('http')) {
      // File was approved and moved to NAS — use the NAS path directly
      filePath = file.public_network_url;
      console.log(`📁 File is on NAS, using public_network_url: ${filePath}`);
    } else if (file.file_path) {
      // File is still in uploads staging area — resolve relative path
      if (file.file_path.startsWith('/uploads/')) {
        const relativePath = file.file_path.substring('/uploads/'.length);
        if (relativePath.includes('/')) {
          filePath = path.join(uploadsDir, relativePath);
        } else {
          filePath = path.join(uploadsDir, file.username, path.basename(file.file_path));
          try {
            await fs.access(filePath);
          } catch (e) {
            filePath = path.join(uploadsDir, path.basename(file.file_path));
          }
        }
      } else {
        filePath = await resolveFilePath(file.file_path, file.username);
      }
    } else {
      filePath = path.join(uploadsDir, path.basename(file.file_path || ''));
    }

    console.log(`🗑️ Attempting to delete file at: ${filePath}`);
    const deleteResult = await safeDeleteFile(filePath);

    if (!deleteResult.success && !deleteResult.notFound) {
      console.warn(`⚠️ Physical file deletion issue: ${deleteResult.message}`);
    }

    // Delete file record from database
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM files WHERE id = ?', [fileId], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    // Log activity
    logActivity(
      db,
      adminId,
      adminUsername,
      adminRole,
      team,
      `File deleted: ${file.filename} (Admin Action) - Assignment submissions cleared`
    );

    console.log(`✅ File deleted: ${file.filename}`);
    res.json({
      success: true,
      message: 'File deleted successfully. Assignment submissions have been cleared and can be resubmitted.'
    });
  } catch (error) {
    console.error('❌ Error deleting file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: error.message
    });
  }
});

// Helper: convert stored file_path to a filesystem path the server can unlink
async function resolveFilePath(storedPath, username = null) {
  if (!storedPath) {
    return null;
  }

  // If UNC path (\\server\share...) or absolute Windows (C:\...) or POSIX absolute (/..), return as-is
  if (/^\\\\/.test(storedPath) || path.isAbsolute(storedPath)) {
    return storedPath;
  }

  // Handle paths stored as relative URLs with /uploads/ prefix
  if (storedPath.startsWith('/uploads/')) {
    const relativePath = storedPath.substring('/uploads/'.length);

    // Check if this is a username path format like 'username/filename.ext'
    if (relativePath.includes('/')) {
      // This is likely a username/filename path
      return path.join(uploadsDir, relativePath);
    }
    // If username is provided, check if the file exists in that user's directory
    else if (username) {
      // Try the username directory first
      const userPath = path.join(uploadsDir, username, path.basename(storedPath));
      try {
        await fs.access(userPath);
        return userPath;
      } catch (e) {
        // File not found in user directory
      }
    }

    // Default to direct file in uploads dir
    return path.join(uploadsDir, relativePath);
  }

  // For paths without /uploads/ prefix, try various locations
  // First check if it exists directly in uploads folder
  const directPath = path.join(uploadsDir, path.basename(storedPath));

  // If username is provided, also check in user's folder
  if (username) {
    const userPath = path.join(uploadsDir, username, path.basename(storedPath));
    try {
      await fs.access(userPath);
      return userPath;
    } catch (e) {
      // File not found in user directory
    }
  }

  // Final fallback - direct join with uploads dir
  return directPath;
}

// POST /api/files/:id/delete-file
// Attempt to delete the physical file from disk/network.
// For approved files that have been moved, delete from the public_network_url location
// For pending/rejected files, delete from uploads
// Body optionally contains admin info for audit (adminId, adminUsername, ...)
router.post('/:id/delete-file', async (req, res) => {
  const id = req.params.id;
  try {
    // Use callback-based db.get to match existing pattern
    db.get('SELECT * FROM files WHERE id = ?', [id], async (err, file) => {
      if (err || !file) {
        return res.status(404).json({ success: false, message: 'File record not found' });
      }

      let resolved;

      // Check if file has been moved to projects (approved files)
      if (file.public_network_url) {
        resolved = file.public_network_url;
        console.log(`🗑️ File has been moved to projects, deleting from: ${resolved}`);
      }
      // For non-approved files or old records, try to resolve from uploads
      else {
        const storedPath = file.file_path || file.storage_path || file.filepath || file.path;

        // Try to properly resolve the file path using stored information
        if (storedPath) {
          if (storedPath.startsWith('/uploads/')) {
            // Handle paths stored as relative URLs with /uploads/ prefix
            const relativePath = storedPath.substring('/uploads/'.length);

            if (relativePath.includes('/')) {
              // Already has subdirectory - use as is
              resolved = path.join(uploadsDir, relativePath);
            } else {
              // Try to find in user's directory
              const userPath = path.join(uploadsDir, file.username, path.basename(storedPath));

              // Check if file exists in user folder
              try {
                await fs.access(userPath);
                resolved = userPath;
              } catch (e) {
                // Not found in user directory, fallback to direct location
                resolved = path.join(uploadsDir, path.basename(storedPath));
              }
            }
          } else {
            // Direct path or already absolute
            resolved = await resolveFilePath(storedPath, file.username);
          }
        }
      }

      if (!resolved) {
        return res.status(400).json({ success: false, message: 'No file path available to delete' });
      }

      console.log(`🗑️ Attempting to delete physical file: ${resolved}`);

      const deleteResult = await safeDeleteFile(resolved);

      if (deleteResult.success) {
        if (deleteResult.notFound) {
          console.log(`ℹ️ Physical file not found (already removed): ${resolved}`);
          return res.json({ success: true, message: 'Physical file not found (already removed)' });
        }

        console.log(`✅ Physical file deleted successfully: ${resolved}`);
        return res.json({ success: true, message: 'Physical file deleted' });
      } else {
        console.error('❌ Error deleting physical file:', resolved, deleteResult.error);
        return res.status(500).json({
          success: false,
          message: 'Failed to delete physical file',
          detail: deleteResult.message
        });
      }
    });
  } catch (err) {
    console.error('❌ delete-file error:', err);
    return res.status(500).json({ success: false, message: 'Server error', detail: err.message });
  }
});

// REMOVED: Duplicate DELETE /:id route — handled by DELETE /:fileId above (full audit trail).
// REMOVED: Duplicate admin-review comment that referenced a removed route.


// HIGH PRIORITY FEATURE: Bulk Actions - Approve/Reject multiple files
router.post('/bulk-action', (req, res) => {
  const { fileIds, action, comments, reviewerId, reviewerUsername, reviewerRole, team } = req.body;

  if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'File IDs array is required'
    });
  }

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid action. Must be approve or reject'
    });
  }

  console.log(`📋 Bulk ${action} for ${fileIds.length} files by ${reviewerUsername}`);
  console.log(`🔍 DEBUG bulk-action: reviewerRole='${reviewerRole}', reviewerId=${reviewerId}, fileIds=${JSON.stringify(fileIds)}`);

  const now = new Date();
  const nowSql = now.toISOString().slice(0, 19).replace('T', ' ');
  const results = { success: [], failed: [] };
  let processed = 0;

  fileIds.forEach(fileId => {
    db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
      if (err || !file) {
        results.failed.push({ fileId, reason: 'File not found' });
        processed++;
        checkComplete();
        return;
      }

      const normalizedRole = (reviewerRole || '').toLowerCase().replace(/[^a-z]/g, '_');
      const isTeamLeader = normalizedRole === 'team_leader';
      const isAdmin = normalizedRole === 'admin';
      const correctStage = (isTeamLeader && file.current_stage === 'pending_team_leader') ||
        (isAdmin && file.current_stage === 'pending_admin');

      console.log(`🔍 DEBUG file ${fileId}: normalizedRole='${normalizedRole}', isTeamLeader=${isTeamLeader}, file.current_stage='${file.current_stage}', correctStage=${correctStage}`);

      if (!correctStage) {
        results.failed.push({ fileId, reason: `Incorrect review stage: role=${normalizedRole}, stage=${file.current_stage}`, fileName: file.original_name });
        processed++;
        checkComplete();
        return;
      }

      let newStatus, newStage;
      if (isTeamLeader) {
        newStatus = action === 'approve' ? 'team_leader_approved' : 'rejected_by_team_leader';
        newStage = action === 'approve' ? 'pending_admin' : 'rejected_by_team_leader';
      } else {
        newStatus = action === 'approve' ? 'final_approved' : 'rejected_by_admin';
        newStage = action === 'approve' ? 'published_to_public' : 'rejected_by_admin';
      }

      const updateSql = isTeamLeader ?
        `UPDATE files SET status = ?, current_stage = ?, team_leader_id = ?, team_leader_username = ?, 
         team_leader_reviewed_at = ?, team_leader_comments = ?${action === 'reject' ? ', rejection_reason = ?, rejected_by = ?, rejected_at = ?' : ''} 
         WHERE id = ?` :
        `UPDATE files SET status = ?, current_stage = ?, admin_id = ?, admin_username = ?, 
         admin_reviewed_at = ?, admin_comments = ?${action === 'approve' ? ', public_network_url = ?, final_approved_at = ?' : ''}${action === 'reject' ? ', rejection_reason = ?, rejected_by = ?, rejected_at = ?' : ''} 
         WHERE id = ?`;

      const publicNetworkUrl = (isAdmin && action === 'approve') ? `https://public-network.example.com/files/${file.filename}` : null;

      const updateParams = isTeamLeader ?
        (action === 'reject' ?
          [newStatus, newStage, reviewerId, reviewerUsername, nowSql, comments, comments, reviewerUsername, nowSql, fileId] :
          [newStatus, newStage, reviewerId, reviewerUsername, nowSql, comments, fileId]) :
        (action === 'approve' ?
          [newStatus, newStage, reviewerId, reviewerUsername, nowSql, comments, publicNetworkUrl, nowSql, fileId] :
          action === 'reject' ?
            [newStatus, newStage, reviewerId, reviewerUsername, nowSql, comments, comments, reviewerUsername, nowSql, fileId] :
            [newStatus, newStage, reviewerId, reviewerUsername, nowSql, comments, fileId]);

      db.run(updateSql, updateParams, function (err) {
        if (err) {
          console.error(`❌ Error updating file ${fileId}:`, err);
          results.failed.push({ fileId, reason: err.message, fileName: file.original_name });
          processed++;
          checkComplete();
          return;
        }

        // Add comment
        if (comments) {
          db.run(
            'INSERT INTO file_comments (file_id, user_id, username, user_role, comment, comment_type) VALUES (?, ?, ?, ?, ?, ?)',
            [fileId, reviewerId, reviewerUsername, reviewerRole, comments, action],
            () => { }
          );
        }

        // Log status change
        logFileStatusChange(
          db, fileId, file.status, newStatus, file.current_stage, newStage,
          reviewerId, reviewerUsername, reviewerRole, `Bulk ${action}: ${comments || 'No comments'}`
        );

        results.success.push({ fileId, fileName: file.original_name, newStatus, newStage });
        processed++;
        checkComplete();
      });
    });
  });

  function checkComplete() {
    if (processed === fileIds.length) {
      // Log activity
      logActivity(
        db, reviewerId, reviewerUsername, reviewerRole, team,
        `Bulk ${action}: ${results.success.length} files ${action}d, ${results.failed.length} failed`
      );

      console.log(`✅ Bulk action complete: ${results.success.length} succeeded, ${results.failed.length} failed`);
      res.json({
        success: true,
        message: `Bulk action completed: ${results.success.length} files ${action}d, ${results.failed.length} failed`,
        results
      });
    }
  }
});

// HIGH PRIORITY FEATURE: Advanced Filtering & Sorting
router.post('/team-leader/:team/filter', (req, res) => {
  const { team } = req.params;
  const { filters, sort, page = 1, limit = 50 } = req.body;
  const offset = (page - 1) * limit;

  console.log(`🔍 Filtering files for team ${team}:`, filters);

  const whereClauses = ['user_team = ?', 'current_stage = ?'];
  const params = [team, 'pending_team_leader'];

  // Build WHERE clauses based on filters
  if (filters) {
    if (filters.fileType && filters.fileType.length > 0) {
      const placeholders = filters.fileType.map(() => '?').join(',');
      whereClauses.push(`file_type IN (${placeholders})`);
      params.push(...filters.fileType);
    }

    if (filters.submittedBy && filters.submittedBy.length > 0) {
      const placeholders = filters.submittedBy.map(() => '?').join(',');
      whereClauses.push(`user_id IN (${placeholders})`);
      params.push(...filters.submittedBy);
    }

    if (filters.dateFrom) {
      whereClauses.push('uploaded_at >= ?');
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      whereClauses.push('uploaded_at <= ?');
      params.push(filters.dateTo);
    }

    if (filters.priority) {
      whereClauses.push('priority = ?');
      params.push(filters.priority);
    }

    if (filters.hasDeadline) {
      whereClauses.push('due_date IS NOT NULL');
    }

    if (filters.isOverdue) {
      whereClauses.push('due_date < ?');
      params.push(new Date().toISOString());
    }
  }

  // Build ORDER BY clause
  let orderBy = 'uploaded_at DESC';
  if (sort) {
    const sortField = sort.field || 'uploaded_at';
    const sortDir = sort.direction || 'DESC';
    const allowedFields = ['uploaded_at', 'original_name', 'file_size', 'priority', 'due_date'];
    if (allowedFields.includes(sortField)) {
      orderBy = `${sortField} ${sortDir}`;
    }
  }

  const whereClause = whereClauses.join(' AND ');
  const countSql = `SELECT COUNT(*) as total FROM files WHERE ${whereClause}`;
  const dataSql = `SELECT f.*, fc.comment as latest_comment FROM files f 
                   LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (SELECT MAX(id) FROM file_comments WHERE file_id = f.id) 
                   WHERE ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;

  db.get(countSql, params, (err, countResult) => {
    if (err) {
      console.error('❌ Error counting filtered files:', err);
      return res.status(500).json({ success: false, message: 'Failed to filter files' });
    }

    db.all(dataSql, [...params, limit, offset], (err, files) => {
      if (err) {
        console.error('❌ Error getting filtered files:', err);
        return res.status(500).json({ success: false, message: 'Failed to filter files' });
      }

      console.log(`✅ Retrieved ${files.length} filtered files`);
      res.json({
        success: true,
        files,
        pagination: {
          page,
          limit,
          total: countResult.total,
          pages: Math.ceil(countResult.total / limit)
        }
      });
    });
  });
});

// HIGH PRIORITY FEATURE: Set file priority and due date
router.patch('/:fileId/priority', (req, res) => {
  const { fileId } = req.params;
  const { priority, dueDate, reviewerId, reviewerUsername } = req.body;

  console.log(`🎯 Setting priority for file ${fileId}: ${priority}, due: ${dueDate}`);

  const updates = [];
  const params = [];

  if (priority !== undefined) {
    updates.push('priority = ?');
    params.push(priority);
  }

  if (dueDate !== undefined) {
    updates.push('due_date = ?');
    params.push(dueDate);
  }

  if (updates.length === 0) {
    return res.status(400).json({ success: false, message: 'No updates provided' });
  }

  params.push(fileId);
  const sql = `UPDATE files SET ${updates.join(', ')} WHERE id = ?`;

  db.run(sql, params, function (err) {
    if (err) {
      console.error('❌ Error updating file priority:', err);
      return res.status(500).json({ success: false, message: 'Failed to update priority' });
    }

    // Log activity
    const changes = [];
    if (priority !== undefined) {
      changes.push(`priority: ${priority}`);
    }
    if (dueDate !== undefined) {
      changes.push(`due date: ${dueDate}`);
    }

    db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
      if (file) {
        logActivity(
          db, reviewerId, reviewerUsername, 'team_leader', file.user_team,
          `Updated file ${file.original_name} - ${changes.join(', ')}`
        );
      }
    });

    console.log('✅ File priority updated');
    res.json({ success: true, message: 'Priority updated successfully' });
  });
});

// HIGH PRIORITY FEATURE: Get notification/alert data
router.get('/notifications/:team', (req, res) => {
  const { team } = req.params;
  console.log(`🔔 Getting notifications for team ${team}`);

  const now = new Date().toISOString();

  db.all(
    `SELECT id, original_name, uploaded_at, priority, due_date, username 
     FROM files 
     WHERE user_team = ? AND current_stage = 'pending_team_leader' 
     ORDER BY 
       CASE 
         WHEN due_date IS NOT NULL AND due_date < ? THEN 1
         WHEN priority = 'urgent' THEN 2
         WHEN priority = 'high' THEN 3
         ELSE 4
       END,
       uploaded_at ASC 
     LIMIT 10`,
    [team, now],
    (err, files) => {
      if (err) {
        console.error('❌ Error getting notifications:', err);
        return res.status(500).json({ success: false, message: 'Failed to get notifications' });
      }

      const notifications = files.map(file => {
        const isOverdue = file.due_date && new Date(file.due_date) < new Date();
        const isUrgent = file.priority === 'urgent' || file.priority === 'high';

        return {
          id: file.id,
          fileName: file.original_name,
          submitter: file.username,
          uploadedAt: file.uploaded_at,
          priority: file.priority || 'normal',
          dueDate: file.due_date,
          isOverdue,
          isUrgent,
          type: isOverdue ? 'overdue' : isUrgent ? 'urgent' : 'pending',
          message: isOverdue ?
            `Overdue: ${file.original_name} was due ${new Date(file.due_date).toLocaleDateString()}` :
            isUrgent ?
              `${file.priority.toUpperCase()}: ${file.original_name} needs review` :
              `New file: ${file.original_name} awaiting review`
        };
      });

      console.log(`✅ Retrieved ${notifications.length} notifications`);
      res.json({
        success: true,
        notifications,
        counts: {
          overdue: notifications.filter(n => n.isOverdue).length,
          urgent: notifications.filter(n => n.isUrgent && !n.isOverdue).length,
          pending: notifications.filter(n => !n.isOverdue && !n.isUrgent).length
        }
      });
    }
  );
});

// Get files by status for a team (for analytics modal)
router.get('/team/:team/status/:status', (req, res) => {
  const { team, status } = req.params;
  console.log(`📊 Getting ${status} files for team ${team}`);

  let whereClause = 'user_team = ?';
  const params = [team];

  // Map status to database values
  if (status === 'approved') {
    whereClause += ' AND (status = ? OR status = ?)';
    params.push('team_leader_approved', 'final_approved');
  } else if (status === 'pending') {
    whereClause += ' AND (current_stage = ? OR current_stage = ?)';
    params.push('pending_team_leader', 'pending_admin');
  } else if (status === 'rejected') {
    whereClause += ' AND (status = ? OR status = ?)';
    params.push('rejected_by_team_leader', 'rejected_by_admin');
  } else {
    return res.status(400).json({
      success: false,
      message: 'Invalid status. Must be approved, pending, or rejected'
    });
  }

  db.all(
    `SELECT f.*, fc.comment as latest_comment
     FROM files f
     LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (
       SELECT MAX(id) FROM file_comments WHERE file_id = f.id
     )
     WHERE ${whereClause}
     ORDER BY f.uploaded_at DESC`,
    params,
    (err, files) => {
      if (err) {
        console.error(`❌ Error getting ${status} files:`, err);
        return res.status(500).json({
          success: false,
          message: `Failed to fetch ${status} files`
        });
      }
      console.log(`✅ Retrieved ${files.length} ${status} files for team ${team}`);
      res.json({
        success: true,
        files
      });
    }
  );
});

// Open file with system's default application
router.post('/open-file', async (req, res) => {
  const { filePath } = req.body;
  console.log(`📂 Opening file with default application: ${filePath}`);

  try {
    // Resolve the file path
    let resolvedPath = filePath;

    // If it's a relative path starting with /uploads/, resolve it
    if (filePath.startsWith('/uploads/')) {
      const relativePath = filePath.substring(9);
      resolvedPath = path.join(uploadsDir, relativePath);
    }

    // Normalize path for Windows
    resolvedPath = path.normalize(resolvedPath);

    // Check if file exists
    try {
      await fs.access(resolvedPath);
    } catch (error) {
      console.error('❌ File not found:', resolvedPath);
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Sanitize path to prevent shell injection — reject any path containing shell metacharacters
    if (/[&;`|<>$!\r\n]/.test(resolvedPath)) {
      return res.status(400).json({ success: false, message: 'Invalid file path' });
    }

    // Platform-specific command to open file with default application
    let command;
    const escapedPath = resolvedPath.replace(/"/g, '\\"');
    if (process.platform === 'win32') {
      command = `start "" "${escapedPath}"`;
    } else if (process.platform === 'darwin') {
      command = `open "${escapedPath}"`;
    } else {
      command = `xdg-open "${escapedPath}"`;
    }

    exec(command, (error) => {
      if (error) {
        console.error('❌ Error opening file:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to open file',
          error: error.message
        });
      }
      console.log('✅ File opened successfully with default application');
      res.json({ success: true, message: 'File opened successfully' });
    });
  } catch (error) {
    console.error('❌ Error processing file open request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to open file',
      error: error.message
    });
  }
});

// Delete TL attachment folder (removes from assignment_attachments table + physical files)
router.post('/folder/delete-attachments', async (req, res) => {
  const { folderName, fileIds, adminId, adminUsername, adminRole, team } = req.body
  console.log(`🗑️ Deleting attachment folder "${folderName}" (${fileIds?.length || 0} files) by ${adminUsername}`)

  try {
    // Delete physical files and DB records
    for (const fileId of (fileIds || [])) {
      const attachment = await new Promise(resolve =>
        db.get('SELECT * FROM assignment_attachments WHERE id = ?', [fileId], (err, row) => resolve(row || null))
      )
      if (attachment?.file_path) {
        let srcPath
        if (path.isAbsolute(attachment.file_path) || attachment.file_path.startsWith('\\\\')) {
          srcPath = attachment.file_path
        } else if (attachment.file_path.startsWith('/uploads/')) {
          srcPath = path.join(uploadsDir, attachment.file_path.substring(9))
        } else {
          srcPath = path.join(uploadsDir, attachment.file_path)
        }
        await safeDeleteFile(srcPath).catch(() => {})
      }
      await new Promise(resolve =>
        db.run('DELETE FROM assignment_attachments WHERE id = ?', [fileId], () => resolve())
      )
    }

    logActivity(db, adminId, adminUsername, adminRole, team,
      `Attachment folder deleted: ${folderName} (${fileIds?.length || 0} files)`)

    res.json({ success: true, message: `Folder "${folderName}" deleted successfully` })
  } catch (error) {
    console.error('❌ Error deleting attachment folder:', error)
    res.status(500).json({ success: false, message: 'Failed to delete attachment folder', error: error.message })
  }
})

// Delete folder (deletes all files and the folder directory)
router.post('/folder/delete', async (req, res) => {
  const { folderName, username, fileIds, userId, userRole, team } = req.body;
  console.log(`🗑️ Deleting folder "${folderName}" by ${username}`);

  try {
    // Step 1: Fetch all file records from DB so we know the REAL physical paths
    // (files may have been moved to NAS after approval — file_path/public_network_url reflects that)
    const deletedPaths = new Set();

    // Collect directories to delete BEFORE removing DB records
    const dirsToDelete = new Set();
    // Always include the uploads staging path
    dirsToDelete.add(path.join(uploadsDir, username, folderName));

    if (fileIds && fileIds.length > 0) {
      const placeholders = fileIds.map(() => '?').join(',');

      // Step 1a: Fetch all records FIRST so we have paths before deleting from DB
      const fileRecords = await new Promise((resolve, reject) => {
        db.all(
          `SELECT id, file_path, public_network_url, filename, original_name FROM files WHERE id IN (${placeholders})`,
          fileIds,
          (err, rows) => { if (err) reject(err); else resolve(rows || []); }
        );
      });

      // Step 1b: Collect physical paths and NAS parent directories before any deletion
      for (const file of fileRecords) {
        const physicalPath = file.public_network_url && !file.public_network_url.startsWith('http')
          ? file.public_network_url
          : await resolveFilePath(file.file_path, username);

        if (physicalPath && !deletedPaths.has(physicalPath)) {
          deletedPaths.add(physicalPath);
          // Collect parent directory so we can delete the folder itself later
          dirsToDelete.add(path.dirname(physicalPath));
        }
      }

      // Step 1c: Delete each physical file
      for (const physicalPath of deletedPaths) {
        const result = await safeDeleteFile(physicalPath);
        if (result.success) {
          console.log(`✅ Deleted physical file: ${physicalPath}`);
        } else if (!result.notFound) {
          console.warn(`⚠️ Could not delete: ${physicalPath} — ${result.message}`);
        }
      }

      // Step 1d: Delete DB records AFTER collecting all paths
      for (const file of fileRecords) {
        await new Promise((resolve) => {
          db.run('DELETE FROM files WHERE id = ?', [file.id], () => resolve());
        });
      }

      // Clean up assignment_submissions
      await new Promise((resolve) => {
        db.run(`DELETE FROM assignment_submissions WHERE file_id IN (${placeholders})`, fileIds, () => resolve());
      });
    }

    // Step 2: Delete all collected folder directories (NAS + uploads staging)
    // Also add a direct path using folderName in case fileRecords was empty (files already deleted from DB)
    dirsToDelete.add(path.join(uploadsDir, username, folderName));
    for (const dirPath of dirsToDelete) {
      try {
        const exists = await fs.access(dirPath).then(() => true).catch(() => false);
        if (exists) {
          await fs.rm(dirPath, { recursive: true, force: true });
          console.log(`✅ Deleted folder directory: ${dirPath}`);
        } else {
          console.log(`ℹ️ Folder directory not found (already gone): ${dirPath}`);
        }
      } catch (dirErr) {
        console.warn(`⚠️ Could not delete directory ${dirPath}: ${dirErr.message}`);
      }
    }

    // Log activity
    logActivity(
      db,
      userId,
      username,
      userRole,
      team,
      `Folder deleted: ${folderName} (${fileIds?.length || 0} files)`
    );

    res.json({
      success: true,
      message: `Folder "${folderName}" and all its files have been deleted successfully.`
    });
  } catch (error) {
    console.error('❌ Error deleting folder:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete folder',
      error: error.message
    });
  }
});

// Download a file by ID — same path resolution as /stream but forces browser download
router.get('/:fileId/download', async (req, res) => {
  const { fileId } = req.params;
  if (!/^\d+$/.test(fileId)) return res.status(400).send('Invalid file ID');

  try {
    const lookupFile = await new Promise((resolve) =>
      db.get('SELECT file_path, original_name, public_network_url FROM files WHERE id = ?',
        [fileId], (err, row) => resolve(row || null))
    );

    let filePath, originalName;

    if (lookupFile) {
      originalName = lookupFile.original_name;
      if (lookupFile.public_network_url && !lookupFile.public_network_url.startsWith('http')) {
        filePath = lookupFile.public_network_url;
      } else if (lookupFile.file_path && (lookupFile.file_path.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(lookupFile.file_path))) {
        filePath = lookupFile.file_path;
      } else if (lookupFile.file_path && lookupFile.file_path.startsWith('/uploads/')) {
        filePath = path.join(uploadsDir, lookupFile.file_path.replace(/^\/uploads\//, ''));
      } else if (lookupFile.file_path) {
        filePath = path.join(uploadsDir, lookupFile.file_path);
      }
    } else {
      const att = await new Promise((resolve) =>
        db.get('SELECT file_path, original_name, public_network_url FROM assignment_attachments WHERE id = ?',
          [fileId], (err, row) => resolve(row || null))
      );
      if (!att) return res.status(404).send('File not found');
      originalName = att.original_name;
      if (att.public_network_url && !att.public_network_url.startsWith('http')) {
        filePath = att.public_network_url;
      } else if (att.file_path && (att.file_path.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(att.file_path))) {
        filePath = att.file_path;
      } else if (att.file_path && att.file_path.startsWith('/uploads/')) {
        filePath = path.join(uploadsDir, att.file_path.replace(/^\/uploads\//, ''));
      } else if (att.file_path) {
        filePath = path.join(uploadsDir, att.file_path);
      }
    }

    if (!filePath) return res.status(404).send('File path not resolved');

    const fsSync = require('fs');
    if (!fsSync.existsSync(filePath)) {
      try { fsSync.statSync(filePath); } catch (e) {
        return res.status(404).send('File not found on storage: ' + e.message);
      }
    }

    // Determine the correct MIME type so Windows knows the file type on save
    const ext = path.extname(originalName || path.basename(filePath)).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.zip': 'application/zip',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
    };
    const contentMime = mimeTypes[ext] || 'application/octet-stream';

    // Always ensure the filename has its extension
    const finalName = originalName || path.basename(filePath);
    const safeFilename = encodeURIComponent(finalName);
    res.setHeader('Content-Disposition', `attachment; filename="${finalName}"; filename*=UTF-8''${safeFilename}`);
    res.setHeader('Content-Type', contentMime);
    res.setHeader('Cache-Control', 'no-cache');

    console.log(`⬇️ Downloading file to client: ${filePath}`);
    const stream = fsSync.createReadStream(filePath);
    stream.on('error', (err) => {
      console.error('❌ Download stream error:', err);
      if (!res.headersSent) res.status(500).send('Error reading file');
    });
    stream.pipe(res);
  } catch (error) {
    console.error('❌ Error downloading file:', error);
    if (!res.headersSent) res.status(500).send('Server error');
  }
});

// Zip and download a whole folder by fileIds
router.get('/folder/zip', async (req, res) => {
  const { fileIds: fileIdsStr, folderName } = req.query;
  if (!fileIdsStr || !folderName) return res.status(400).send('Missing fileIds or folderName');

  const fileIds = fileIdsStr.split(',').map(id => parseInt(id.trim())).filter(Boolean);
  if (!fileIds.length) return res.status(400).send('No valid file IDs');

  const os = require('os');
  const fsSync = require('fs');
  const tmpDir = path.join(os.tmpdir(), `kmti-folder-${Date.now()}`);
  const zipPath = path.join(os.tmpdir(), `${folderName}-${Date.now()}.zip`);

  try {
    fsSync.mkdirSync(tmpDir, { recursive: true });

    // Resolve physical path for each file and copy to temp dir
    for (const fileId of fileIds) {
      const record = await new Promise((resolve) =>
        db.get('SELECT file_path, original_name, public_network_url, relative_path FROM files WHERE id = ?',
          [fileId], (err, row) => resolve(row || null))
      );
      if (!record) continue;

      let srcPath;
      if (record.public_network_url && !record.public_network_url.startsWith('http')) {
        srcPath = record.public_network_url;
      } else if (record.file_path && (record.file_path.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(record.file_path))) {
        srcPath = record.file_path;
      } else if (record.file_path && record.file_path.startsWith('/uploads/')) {
        srcPath = path.join(uploadsDir, record.file_path.replace(/^\/uploads\//, ''));
      } else if (record.file_path) {
        srcPath = path.join(uploadsDir, record.file_path);
      }
      if (!srcPath || !fsSync.existsSync(srcPath)) continue;

      // Preserve relative path structure inside zip
      let relPath = record.relative_path
        ? record.relative_path.replace(/\\/g, '/').split('/').slice(1).join('/')
        : record.original_name;
      if (!relPath) relPath = record.original_name;

      const destFile = path.join(tmpDir, relPath);
      fsSync.mkdirSync(path.dirname(destFile), { recursive: true });
      fsSync.copyFileSync(srcPath, destFile);
    }

    // Zip using PowerShell Compress-Archive (Windows)
    await new Promise((resolve, reject) => {
      const cmd = `powershell -NoProfile -Command "Compress-Archive -Path '${tmpDir}\\*' -DestinationPath '${zipPath}' -Force"`;
      exec(cmd, (err) => {
        if (err) reject(err); else resolve();
      });
    });

    if (!fsSync.existsSync(zipPath)) return res.status(500).send('Failed to create zip');

    const stat = fsSync.statSync(zipPath);
    const safeZipName = encodeURIComponent(`${folderName}.zip`);
    res.setHeader('Content-Disposition', `attachment; filename="${folderName}.zip"; filename*=UTF-8''${safeZipName}`);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'no-cache');

    console.log(`📦 Streaming folder zip: ${zipPath}`);
    const zipStream = fsSync.createReadStream(zipPath);
    zipStream.on('close', () => {
      // Cleanup temp files after streaming
      try { fsSync.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
      try { fsSync.unlinkSync(zipPath); } catch (_) {}
    });
    zipStream.on('error', (err) => {
      console.error('❌ Zip stream error:', err);
      if (!res.headersSent) res.status(500).send('Error streaming zip');
    });
    zipStream.pipe(res);
  } catch (error) {
    console.error('❌ Error creating folder zip:', error);
    try { require('fs').rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    try { require('fs').unlinkSync(zipPath); } catch (_) {}
    if (!res.headersSent) res.status(500).send('Failed to zip folder: ' + error.message);
  }
});

// Force-download a file by ID — identical path resolution to /stream but sends Content-Disposition: attachment
router.get('/:fileId/download', async (req, res) => {
  const { fileId } = req.params;
  if (!/^\d+$/.test(fileId)) return res.status(400).send('Invalid file ID');

  try {
    const lookupFile = await new Promise((resolve) =>
      db.get('SELECT file_path, original_name, public_network_url, status FROM files WHERE id = ?',
        [fileId], (err, row) => resolve(row || null))
    );

    let filePath, originalName;

    if (lookupFile) {
      originalName = lookupFile.original_name;
      if (lookupFile.public_network_url && !lookupFile.public_network_url.startsWith('http')) {
        filePath = lookupFile.public_network_url;
      } else if (lookupFile.file_path && (lookupFile.file_path.startsWith('\\\\') || /^[A-Za-z]:[\\\\]/.test(lookupFile.file_path))) {
        filePath = lookupFile.file_path;
      } else if (lookupFile.file_path && lookupFile.file_path.startsWith('/uploads/')) {
        filePath = path.join(uploadsDir, lookupFile.file_path.replace(/^\/uploads\//, ''));
      } else if (lookupFile.file_path) {
        filePath = path.join(uploadsDir, lookupFile.file_path);
      }
    } else {
      const att = await new Promise((resolve) =>
        db.get('SELECT file_path, original_name, public_network_url FROM assignment_attachments WHERE id = ?',
          [fileId], (err, row) => resolve(row || null))
      );
      if (!att) return res.status(404).send('File not found');
      originalName = att.original_name;
      if (att.public_network_url && !att.public_network_url.startsWith('http')) {
        filePath = att.public_network_url;
      } else if (att.file_path && (att.file_path.startsWith('\\\\') || /^[A-Za-z]:[\\\\]/.test(att.file_path))) {
        filePath = att.file_path;
      } else if (att.file_path && att.file_path.startsWith('/uploads/')) {
        filePath = path.join(uploadsDir, att.file_path.replace(/^\/uploads\//, ''));
      } else if (att.file_path) {
        filePath = path.join(uploadsDir, att.file_path);
      }
    }

    if (!filePath) return res.status(404).send('File path not resolved');

    const fsSync = require('fs');
    if (!fsSync.existsSync(filePath)) {
      try {
        fsSync.statSync(filePath);
      } catch (e) {
        return res.status(404).send('File not found on storage: ' + e.message);
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml',
      '.webp': 'image/webp', '.txt': 'text/plain', '.html': 'text/html',
      '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.zip': 'application/zip', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';
    const stat = fsSync.statSync(filePath);
    const safeFileName = (originalName || path.basename(filePath)).replace(/["\\]/g, '_');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`);
    res.setHeader('Cache-Control', 'no-cache');

    console.log(`⬇️ Force-downloading file: ${filePath}`);
    const stream = fsSync.createReadStream(filePath);
    stream.on('error', (err) => {
      console.error('❌ Download stream error:', err);
      if (!res.headersSent) res.status(500).send('Error reading file');
    });
    stream.pipe(res);
  } catch (error) {
    console.error('❌ Error in download route:', error);
    if (!res.headersSent) res.status(500).send('Server error');
  }
});

// Stream a file by ID — reads from NAS/local path and serves inline to the browser
// This allows any client to open files even if they don't have direct NAS access
router.get('/:fileId/stream', async (req, res) => {
  const { fileId } = req.params;
  if (!/^\d+$/.test(fileId)) return res.status(400).send('Invalid file ID');

  try {
    // Resolve the physical path using the same logic as /:id/path
    const lookupFile = await new Promise((resolve) =>
      db.get('SELECT file_path, original_name, public_network_url, status FROM files WHERE id = ?',
        [fileId], (err, row) => resolve(row || null))
    );

    let filePath, originalName;

    if (lookupFile) {
      originalName = lookupFile.original_name;
      if (lookupFile.public_network_url && !lookupFile.public_network_url.startsWith('http')) {
        filePath = lookupFile.public_network_url;
      } else if (lookupFile.file_path && (lookupFile.file_path.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(lookupFile.file_path))) {
        filePath = lookupFile.file_path;
      } else if (lookupFile.file_path && lookupFile.file_path.startsWith('/uploads/')) {
        filePath = path.join(uploadsDir, lookupFile.file_path.replace(/^\/uploads\//, ''));
      } else if (lookupFile.file_path) {
        filePath = path.join(uploadsDir, lookupFile.file_path);
      }
    } else {
      // Check assignment_attachments
      const att = await new Promise((resolve) =>
        db.get('SELECT file_path, original_name, public_network_url FROM assignment_attachments WHERE id = ?',
          [fileId], (err, row) => resolve(row || null))
      );
      if (!att) return res.status(404).send('File not found');
      originalName = att.original_name;
      if (att.public_network_url && !att.public_network_url.startsWith('http')) {
        filePath = att.public_network_url;
      } else if (att.file_path && (att.file_path.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(att.file_path))) {
        filePath = att.file_path;
      } else if (att.file_path && att.file_path.startsWith('/uploads/')) {
        filePath = path.join(uploadsDir, att.file_path.replace(/^\/uploads\//, ''));
      } else if (att.file_path) {
        filePath = path.join(uploadsDir, att.file_path);
      }
    }

    if (!filePath) return res.status(404).send('File path not resolved');

    // Use fs.promises to read from UNC/NAS paths (works where static serve cannot)
    const fsSync = require('fs');
    if (!fsSync.existsSync(filePath)) {
      // For UNC paths existsSync can lie — try reading anyway
      try {
        const stat = fsSync.statSync(filePath);
        if (!stat) return res.status(404).send('File not found on storage');
      } catch (e) {
        return res.status(404).send('File not found on storage: ' + e.message);
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml',
      '.webp': 'image/webp', '.txt': 'text/plain', '.html': 'text/html',
      '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.zip': 'application/zip', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';
    const stat = fsSync.statSync(filePath);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(originalName || path.basename(filePath))}"`); 
    res.setHeader('Cache-Control', 'no-cache');

    console.log(`📡 Streaming file to client: ${filePath}`);
    const stream = fsSync.createReadStream(filePath);
    stream.on('error', (err) => {
      console.error('❌ Stream error:', err);
      if (!res.headersSent) res.status(500).send('Error reading file');
    });
    stream.pipe(res);
  } catch (error) {
    console.error('❌ Error streaming file:', error);
    if (!res.headersSent) res.status(500).send('Server error');
  }
});

// Get file details by ID (for opening files) - CATCH-ALL, MUST BE LAST
// Also checks assignment_attachments so TL-attached files can be opened by users
router.get('/:fileId', (req, res) => {
  const { fileId } = req.params;

  // Skip if not a numeric ID (avoid catching other routes)
  if (!/^\d+$/.test(fileId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file ID'
    });
  }

  console.log(`📝 Getting file details for ID: ${fileId}`);

  // First check the files table
  db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
    if (err) {
      console.error('❌ Error getting file:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to get file details'
      });
    }

    if (file) {
      console.log('✅ File found in files table:', file.original_name);
      return res.json({ success: true, file });
    }

    // Not in files table — check assignment_attachments (TL-attached files)
    console.log(`📎 File ${fileId} not in files table, checking assignment_attachments...`);
    db.get(
      `SELECT id, file_path, original_name, filename, file_size, file_type,
              uploaded_by_username AS username, created_at AS uploaded_at,
              'team_leader_approved' AS status
       FROM assignment_attachments WHERE id = ?`,
      [fileId],
      (err2, attachment) => {
        if (err2) {
          console.error('❌ Error checking assignment_attachments:', err2);
          return res.status(500).json({ success: false, message: 'Failed to get file details' });
        }

        if (!attachment) {
          console.log('❌ File not found in either table:', fileId);
          return res.status(404).json({ success: false, message: 'File not found' });
        }

        console.log('✅ File found in assignment_attachments:', attachment.original_name);
        return res.json({ success: true, file: attachment });
      }
    );
  });
});

module.exports = router;