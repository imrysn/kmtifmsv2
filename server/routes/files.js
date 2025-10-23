const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { db } = require('../config/database');
const { upload, uploadsDir, moveToUserFolder } = require('../config/middleware');
const { logActivity, logFileStatusChange } = require('../utils/logger');
const { getFileTypeDescription } = require('../utils/fileHelpers');
const { safeDeleteFile } = require('../utils/fileUtils');
const { createNotification } = require('./notifications');

const router = express.Router();

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
    const { description, userId, username, userTeam, replaceExisting } = req.body;
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Get the original filename and ensure proper UTF-8 encoding
    let originalFilename = req.file.originalname;
    
    // Fix common UTF-8 encoding issues (garbled Japanese/Chinese characters)
    try {
      // Check if the filename contains typical garbled UTF-8 patterns
      if (/[Ã¢â¬â¢Ã¤Â¸â‚¬Ã¦â€"‡Ã¨Â±Â¡]/.test(originalFilename)) {
        // The filename was decoded as latin1/binary instead of utf8
        // Re-encode as binary bytes, then decode as utf8
        const buffer = Buffer.from(originalFilename, 'binary');
        originalFilename = buffer.toString('utf8');
        console.log('📝 Fixed UTF-8 encoding for filename:', originalFilename);
      }
    } catch (e) {
      console.warn('⚠️ Could not decode filename, using original:', originalFilename);
    }
    
    console.log(`📁 File upload by ${username} from ${userTeam} team:`, originalFilename);
    
    // Move file from temp location to user folder
    try {
      const finalPath = moveToUserFolder(req.file.path, username, originalFilename);
      req.file.path = finalPath;
      req.file.filename = originalFilename; // Use decoded original filename
      req.file.originalname = originalFilename; // Update originalname with decoded version
      console.log(`✅ File organized successfully to: ${finalPath}`);
    } catch (moveError) {
      console.error('❌ Error organizing file details:', {
        error: moveError.message,
        tempPath: req.file.path,
        username: username,
        originalFilename: originalFilename,
        stack: moveError.stack
      });
      // Safely delete the temp file if it exists
      await safeDeleteFile(req.file.path);
      return res.status(500).json({
        success: false,
        message: 'Failed to organize uploaded file: ' + moveError.message,
        debug: moveError.message
      });
    }

    // Check for duplicate file if replaceExisting is not explicitly set
    if (replaceExisting !== 'true') {
      db.get('SELECT * FROM files WHERE original_name = ? AND user_id = ?', [req.file.originalname, userId], async (err, existingFile) => {
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
      // Replace existing file - first find and remove the old one
      db.get('SELECT * FROM files WHERE original_name = ? AND user_id = ?', [req.file.originalname, userId], async (err, existingFile) => {
        if (existingFile) {
          // Delete old physical file
          const oldRelativePath = existingFile.file_path.startsWith('/uploads/') ? existingFile.file_path.substring(8) : existingFile.file_path;
          const oldFilePath = path.join(uploadsDir, oldRelativePath);
          await safeDeleteFile(oldFilePath);
          
          // Delete old database record
          db.run('DELETE FROM files WHERE id = ?', [existingFile.id], (deleteErr) => {
            if (deleteErr) {
              console.error('❌ Error deleting old file record:', deleteErr);
            } else {
              console.log('✅ Old file record deleted');
              logActivity(db, userId, username, 'USER', userTeam, `File replaced: ${req.file.originalname}`);
            }
          });
        }

        // Insert new file record
        insertFileRecord();
      });
    }

    function insertFileRecord() {
      // Get the relative path from the uploadsDir
      const relativePath = path.relative(uploadsDir, req.file.path).replace(/\\/g, '/');
      
      // Insert file record into database
      db.run(`INSERT INTO files (
        filename, original_name, file_path, file_size, file_type, mime_type, description,
        user_id, username, user_team, status, current_stage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.file.filename,
        req.file.originalname,
        `/uploads/${relativePath}`,
        req.file.size,
        getFileTypeDescription(req.file.mimetype),
        req.file.mimetype,
        description || '',
        userId,
        username,
        userTeam,
        'uploaded',
        'pending_team_leader'
      ], async function(err) {
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
        const action = replaceExisting === 'true' ? 'replaced' : 'uploaded';
        logActivity(db, userId, username, 'USER', userTeam, `File ${action}: ${req.file.originalname}`);

        // Log status history
        logFileStatusChange(
          db,
          fileId,
          null,
          'uploaded',
          null,
          'pending_team_leader',
          userId,
          username,
          'USER',
          `File ${action} by user`
        );

        console.log(`✅ File ${action} successfully with ID: ${fileId}`);
        res.json({
          success: true,
          message: `File ${action} successfully`,
          file: {
            id: fileId,
            filename: req.file.filename,
            original_name: req.file.originalname,
            file_size: req.file.size,
            file_type: getFileTypeDescription(req.file.mimetype),
            description: description || '',
            status: 'uploaded',
            current_stage: 'pending_team_leader',
            uploaded_at: new Date()
          },
          replaced: replaceExisting === 'true'
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
  const limit = parseInt(req.query.limit) || 50;
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

// Get all files (Admin only - for comprehensive view) with pagination
router.get('/all', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  console.log(`📁 Getting all files (admin view) - Page ${page}, Limit ${limit}`);

  // Get total count
  db.get('SELECT COUNT(*) as total FROM files', [], (err, countResult) => {
    if (err) {
      console.error('❌ Error getting all file count:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch all files'
      });
    }

    db.all(
      `SELECT f.*, fc.comment as latest_comment
       FROM files f
       LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (
         SELECT MAX(id) FROM file_comments WHERE file_id = f.id
       )
       ORDER BY f.uploaded_at DESC LIMIT ? OFFSET ?`,
      [limit, offset],
      (err, files) => {
        if (err) {
          console.error('❌ Error getting all files:', err);
          return res.status(500).json({
            success: false,
            message: 'Failed to fetch all files'
          });
        }
        console.log(`✅ Retrieved ${files.length} files (all files view)`);
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
    if (err || !file) {
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
  const nowSql = now.toISOString().slice(0,19).replace('T', ' ');
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

    console.log('DEBUG: Executing SQL (team-leader):', tlSql.replace(/\s+/g,' '));
    console.log('DEBUG: Params (team-leader):', tlParams);

    db.run(tlSql, tlParams, function(err) {
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
  const { destinationPath, adminId, adminUsername, adminRole, team } = req.body;
  console.log(`📦 Moving file ${fileId} to destination: ${destinationPath}`);

  try {
    // Get file info
    const file = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Get source file path
    const relativePath = file.file_path.startsWith('/uploads/') ? file.file_path.substring(8) : file.file_path;
    const sourcePath = path.join(uploadsDir, relativePath);
    
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
    const fullDestinationPath = destinationPath;
    
    console.log('📂 Destination path:', fullDestinationPath);

    // Ensure destination directory exists
    await fs.mkdir(fullDestinationPath, { recursive: true });
    
    // Construct destination file path with original name
    const destinationFilePath = path.join(fullDestinationPath, file.original_name);
    
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

    // Update database with new path
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE files SET public_network_url = ?, projects_path = ? WHERE id = ?',
        [destinationFilePath, fullDestinationPath, fileId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Log activity
    logActivity(
      db,
      adminId,
      adminUsername,
      adminRole,
      team,
      `File moved to projects: ${file.original_name} -> ${fullDestinationPath}`
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
router.post('/:fileId/admin-review', (req, res) => {
  const { fileId } = req.params;
  const { action, comments, adminId, adminUsername, adminRole, team } = req.body;
  console.log(`📋 Admin ${action} for file ${fileId} by ${adminUsername}`);

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid action. Must be approve or reject'
    });
  }

  // Get current file status
  db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
    if (err || !file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    // Allow approval from any stage (pending_admin, pending_team_leader, etc.)
    // This fixes the issue where Team Leader approved files can't be approved by Admin
    console.log(`Current stage: ${file.current_stage}, Status: ${file.status}`);

  // Use MySQL-friendly DATETIME format
  const now = new Date();
  const nowSql = now.toISOString().slice(0,19).replace('T', ' ');
    let newStatus, newStage, publicNetworkUrl = null;
    if (action === 'approve') {
      newStatus = 'final_approved';
      newStage = 'published_to_public';
      // Simulate public network URL
      publicNetworkUrl = `https://public-network.example.com/files/${file.filename}`;
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
      admin_comments = ?${action === 'approve' ? ', public_network_url = ?, final_approved_at = ?' : ''}${action === 'reject' ? ', rejection_reason = ?, rejected_by = ?, rejected_at = ?' : ''}
    WHERE id = ?`;

    const adminParams = action === 'approve' ? [
      newStatus, newStage, adminId, adminUsername, nowSql, comments,
      publicNetworkUrl, nowSql, fileId
    ] : action === 'reject' ? [
      newStatus, newStage, adminId, adminUsername, nowSql, comments,
      comments, adminUsername, nowSql, fileId
    ] : [
      newStatus, newStage, adminId, adminUsername, nowSql, comments, fileId
    ];

    console.log('DEBUG: Executing SQL (admin):', adminSql.replace(/\s+/g,' '));
    console.log('DEBUG: Params (admin):', adminParams);

    db.run(adminSql, adminParams, function(err) {
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

// Get file system path for Electron to open with default app
router.get('/:fileId/path', (req, res) => {
  const { fileId } = req.params;
  
  db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
    if (err || !file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Convert URL path to actual file system path
    let filePath;
    if (file.file_path.startsWith('/uploads/')) {
      const relativePath = file.file_path.substring('/uploads/'.length);
      filePath = path.join(uploadsDir, relativePath);
    } else {
      filePath = path.join(uploadsDir, path.basename(file.file_path));
    }
    
    // Normalize path for Windows
    filePath = path.normalize(filePath);
    
    console.log(`📂 Resolved file path for ID ${fileId}: ${filePath}`);
    
    res.json({
      success: true,
      filePath: filePath
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
      function(err) {
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
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Delete file from filesystem
    // First, properly resolve the file path using stored information
    let filePath;
    
    if (file.file_path) {
      // For paths stored in database, we need to handle user subdirectories
      if (file.file_path.startsWith('/uploads/')) {
        // Check if the path already includes the username directory
        const relativePath = file.file_path.substring('/uploads/'.length);
        
        if (relativePath.includes('/')) {
          // Already has subdirectory - use as is
          filePath = path.join(uploadsDir, relativePath);
        } else {
          // Try to find in user's directory
          filePath = path.join(uploadsDir, file.username, path.basename(file.file_path));
          
          // If not found in user directory, fallback to direct location
          try {
            await fs.access(filePath);
          } catch (e) {
            filePath = path.join(uploadsDir, path.basename(file.file_path));
          }
        }
      } else {
        // Direct path or already absolute
        filePath = await resolveFilePath(file.file_path, file.username);
      }
    } else {
      // Fallback to basic resolution
      filePath = path.join(uploadsDir, path.basename(file.file_path || ''));
    }
    
    console.log(`🗑️ Attempting to delete file at: ${filePath}`);
    const deleteResult = await safeDeleteFile(filePath);
    
    if (!deleteResult.success && !deleteResult.notFound) {
      console.warn(`⚠️ Physical file deletion issue: ${deleteResult.message}`);
    }

    // Delete file record from database
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM files WHERE id = ?', [fileId], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });

    // Log activity
    logActivity(
      db,
      adminId,
      adminUsername,
      adminRole,
      team,
      `File deleted: ${file.filename} (Admin Action)`
    );
    
    console.log(`✅ File deleted: ${file.filename}`);
    res.json({
      success: true,
      message: 'File deleted successfully'
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
  if (!storedPath) return null;

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
// Body optionally contains admin info for audit (adminId, adminUsername, ...)
router.post('/:id/delete-file', async (req, res) => {
  const id = req.params.id;
  try {
    // Use callback-based db.get to match existing pattern
    db.get('SELECT * FROM files WHERE id = ?', [id], async (err, file) => {
      if (err || !file) {
        return res.status(404).json({ success: false, message: 'File record not found' });
      }

      const storedPath = file.file_path || file.storage_path || file.filepath || file.path;
      let resolved;
      
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

// DELETE /api/files/:id
// Delete DB record. Expect admin audit info in body optionally.
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await db.query('DELETE FROM files WHERE id = ?', [id]);
    // mysql2 returns affectedRows in result. If using query that returns array, handle gracefully.
    // For compatibility, check result.affectedRows or affectedRows in returned object.
    const affected = (result && result.affectedRows) || (Array.isArray(result) && result[0] && result[0].affectedRows) || null;
    // best-effort: consider success if no error thrown
    return res.json({ success: true, message: 'File record deleted' });
  } catch (err) {
    console.error('Error deleting DB record:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete file record', detail: err.message });
  }
});

// POST /api/files/:id/admin-review
// Body: { action: 'approve'|'reject', comments, adminId, adminUsername, adminRole, team }
// This will mark the file status and insert a comment/history row if table exists.
router.post('/:id/admin-review', async (req, res) => {
  const id = req.params.id;
  const { action, comments, adminId, adminUsername, adminRole, team } = req.body || {};

  if (!action) {
    return res.status(400).json({ success: false, message: 'Action required (approve|reject)' });
  }

  // map action to DB status
  let newStatus = null;
  if (action === 'approve') newStatus = 'final_approved';
  else if (action === 'reject') newStatus = 'rejected_by_admin';
  else {
    return res.status(400).json({ success: false, message: 'Unknown action' });
  }

  try {
    // Use transaction to update status + optional insert comment/history
    await db.transaction(async (conn) => {
      // Update files table status and reviewed fields if present
      const updateSql = `
        UPDATE files
        SET status = ?, reviewed_by = ?, reviewed_role = ?, reviewed_at = NOW()
        WHERE id = ?
      `;
      await conn.execute(updateSql, [newStatus, adminUsername || null, adminRole || null, id]);

      // If a comments/history table exists, attempt to insert a record.
      // Try common table names: file_comments, comments, file_history
      if (comments && comments.trim()) {
        // Try insert into file_comments if exists
        try {
          await conn.execute(
            `INSERT INTO file_comments (file_id, comments, reviewer_id, reviewer_username, reviewer_role, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
            [id, comments, adminId || null, adminUsername || null, adminRole || null]
          );
        } catch (e) {
          // If file_comments doesn't exist, try generic comments table, otherwise ignore
          try {
            await conn.execute(
              `INSERT INTO comments (file_id, comment_text, user_id, username, role, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
              [id, comments, adminId || null, adminUsername || null, adminRole || null]
            );
          } catch (e2) {
            // Not fatal: log and continue
            console.warn('Could not insert comment into file_comments/comments table:', e.message || e2.message);
          }
        }
      }
    });

    return res.json({ success: true, message: `File ${action}d successfully` });
  } catch (err) {
    console.error('admin-review error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update file review status', detail: err.message });
  }
});

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
  
  const now = new Date();
  const nowSql = now.toISOString().slice(0,19).replace('T', ' ');
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
      
      const isTeamLeader = reviewerRole === 'team_leader';
      const isAdmin = reviewerRole === 'admin';
      const correctStage = (isTeamLeader && file.current_stage === 'pending_team_leader') || 
                          (isAdmin && file.current_stage === 'pending_admin');
      
      if (!correctStage) {
        results.failed.push({ fileId, reason: 'Incorrect review stage', fileName: file.original_name });
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
      
      db.run(updateSql, updateParams, function(err) {
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
            () => {}
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
  
  let whereClauses = ['user_team = ?', 'current_stage = ?'];
  let params = [team, 'pending_team_leader'];
  
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
  
  db.run(sql, params, function(err) {
    if (err) {
      console.error('❌ Error updating file priority:', err);
      return res.status(500).json({ success: false, message: 'Failed to update priority' });
    }
    
    // Log activity
    const changes = [];
    if (priority !== undefined) changes.push(`priority: ${priority}`);
    if (dueDate !== undefined) changes.push(`due date: ${dueDate}`);
    
    db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
      if (file) {
        logActivity(
          db, reviewerId, reviewerUsername, 'team_leader', file.user_team,
          `Updated file ${file.original_name} - ${changes.join(', ')}`
        );
      }
    });
    
    console.log(`✅ File priority updated`);
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

module.exports = router;
