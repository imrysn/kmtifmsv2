const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { db } = require('../config/database');
const { upload, uploadsDir, moveToUserFolder } = require('../config/middleware');
const { logActivity, logFileStatusChange } = require('../utils/logger');
const { getFileTypeDescription } = require('../utils/fileHelpers');
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
      console.log(`✅ File organized successfully`);
    } catch (moveError) {
      console.error('❌ Error organizing file:', moveError);
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(500).json({
        success: false,
        message: 'Failed to organize uploaded file'
      });
    }

    // Check for duplicate file if replaceExisting is not explicitly set
    if (replaceExisting !== 'true') {
      db.get('SELECT * FROM files WHERE original_name = ? AND user_id = ?', [req.file.originalname, userId], (err, existingFile) => {
        if (err) {
          console.error('❌ Error checking for duplicate:', err);
          fs.unlink(req.file.path, () => {});
          return res.status(500).json({
            success: false,
            message: 'Failed to check for duplicate files'
          });
        }
        if (existingFile) {
          // Delete the newly uploaded file since we found a duplicate
          fs.unlink(req.file.path, (unlinkErr) => {
             if (unlinkErr) console.error('Error deleting duplicate upload:', unlinkErr);
          });
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
      db.get('SELECT * FROM files WHERE original_name = ? AND user_id = ?', [req.file.originalname, userId], (err, existingFile) => {
        if (existingFile) {
          // Delete old physical file
          const oldFilePath = path.join(uploadsDir, path.basename(existingFile.file_path));
          fs.unlink(oldFilePath, (unlinkErr) => {
            if (unlinkErr) {
              console.error('❌ Error deleting old file:', unlinkErr);
            } else {
              console.log('✅ Old file deleted:', oldFilePath);
            }
          });

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
      ], function(err) {
        if (err) {
          console.error('❌ Error saving file to database:', err);
          // Delete the uploaded file if database save fails
          fs.unlink(req.file.path, (unlinkErr) => {
             if (unlinkErr) console.error('Error deleting failed upload:', unlinkErr);
          });
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
    if (file.current_stage !== 'pending_admin') {
      return res.status(400).json({
        success: false,
        message: 'File is not in pending admin review stage'
      });
    }

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
router.delete('/:fileId', (req, res) => {
  const { fileId } = req.params;
  const { adminId, adminUsername, adminRole, team } = req.body;
  console.log(`🗑️ Deleting file ${fileId} by admin ${adminUsername}`);

  // Get file info first
  db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
    if (err || !file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Delete file from filesystem
    const filePath = path.join(uploadsDir, path.basename(file.file_path));
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) {
        console.error('❌ Error deleting physical file:', unlinkErr);
      } else {
        console.log('✅ Physical file deleted:', filePath);
      }
    });

    // Delete file record from database
    db.run('DELETE FROM files WHERE id = ?', [fileId], function(err) {
      if (err) {
        console.error('❌ Error deleting file from database:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to delete file'
        });
      }

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
    });
  });
});

module.exports = router;
