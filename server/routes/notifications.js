const express = require('express');
const { query, queryOne } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { upload, uploadsDir } = require('../config/middleware');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Apply authentication to all routes in this router
router.use(authenticateToken);


// ── SSE broadcaster ──────────────────────────────────────────────────────────
// Map<userId, Set<res>> — one user may have multiple open tabs
const sseClients = new Map();

const addClient = (userId, res) => {
  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId).add(res);
};

const removeClient = (userId, res) => {
  const set = sseClients.get(userId);
  if (set) {
    set.delete(res); if (set.size === 0) {
      sseClients.delete(userId);
    }
  }
};

// Push a ping to a specific user so the client refetches immediately
const pushToUser = (userId, customPayload = null) => {
  const set = sseClients.get(String(userId));
  if (!set || set.size === 0) {
    return;
  }
  const payload = customPayload ? `data: ${JSON.stringify(customPayload)}\n\n` : 'data: ping\n\n';
  for (const res of set) {
    try {
      res.write(payload);
    } catch {
      removeClient(String(userId), res);
    }
  }
};

// SSE endpoint — client connects once and stays open
router.get('/user/:userId/stream', (req, res) => {
  const { userId } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if proxied
  res.flushHeaders();

  // Send a heartbeat every 25s to keep the connection alive through proxies
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  addClient(userId, res);
  console.log(`📡 SSE client connected: user ${userId} (total: ${sseClients.get(userId)?.size})`);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(userId, res);
    console.log(`📡 SSE client disconnected: user ${userId}`);
  });
});

// Helper function to create a notification (supports both file and assignment notifications)
const createNotification = async (userId, fileId, type, title, message, actionById, actionByUsername, actionByRole, assignmentId = null) => {
  try {
    console.log('🔔 Creating notification:', { userId, fileId, assignmentId, type, title });

    const result = await query(
      `INSERT INTO notifications (
        user_id, file_id, type, title, message, assignment_id,
        action_by_id, action_by_username, action_by_role, panel_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'user')`,
      [
        userId ?? null,
        fileId ?? null,
        type ?? null,
        title ?? null,
        message ?? null,
        assignmentId ?? null,
        actionById ?? null,
        actionByUsername ?? 'System',
        actionByRole ?? 'ADMIN'
      ]
    );

    console.log(`✅ Notification created for user ${userId}: ${title}`);
    // Push real-time ping so the client badge updates instantly
    pushToUser(userId);
    return result.insertId;
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    console.error('Details:', { userId, fileId, assignmentId, type, title, message });
    throw error;
  }
};

// Helper function to notify all admins
const createAdminNotification = async (fileId, type, title, message, actionById, actionByUsername, actionByRole, assignmentId = null) => {
  try {
    console.log('📢 Broadcasting admin notification:', { type, title });

    // 1. Get all admin users
    const admins = await query('SELECT id FROM users WHERE role = ?', ['ADMIN']);

    if (!admins || admins.length === 0) {
      console.log('⚠️ No admins found to notify');
      return 0;
    }

    console.log(`found ${admins.length} admins to notify`);

    // 2. Create notification for each admin
    let count = 0;
    for (const admin of admins) {
      // Don't notify the admin who performed the action (if applicable)
      if (actionById && admin.id === parseInt(actionById, 10)) {
        console.log(`ℹ️ Skipped notifying admin ${admin.id} (${admin.username || 'unknown'}) - they performed the action`);
        continue;
      }

      console.log(`🔔 Creating notification for admin ${admin.id} (${admin.username || 'unknown'})`);
      await query(
        `INSERT INTO notifications (
          user_id, file_id, type, title, message, assignment_id,
          action_by_id, action_by_username, action_by_role
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          admin.id,
          fileId ?? null,
          type ?? null,
          title ?? null,
          message ?? null,
          assignmentId ?? null,
          actionById ?? null,
          actionByUsername ?? 'System',
          actionByRole ?? 'ADMIN'
        ]
      );
      // Push real-time ping to the admin
      pushToUser(admin.id);
      count++;
    }

    console.log(`✅ Admin notifications created: ${count}`);
    return count;

  } catch (error) {
    console.error('❌ Error creating admin notifications:', error);
    // Don't throw, just log error so main flow doesn't break
    return 0;
  }
};

// Get all notifications for a user with pagination
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { unreadOnly, page = 1, limit = 20, panelType, type } = req.query;

    // Ownership check: users can only see their own notifications; ADMIN can see any
    // Use loose == comparison so string userId from URL matches integer req.user.id from JWT
    const isOwner = req.user.id === parseInt(userId, 10);
    const isAdmin = req.user.role === 'ADMIN';
    console.log(`📬 Notifications fetch: reqUser.id=${req.user.id}(${typeof req.user.id}) userId=${userId}(${typeof userId}) isOwner=${isOwner} role=${req.user.role}`);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied: You can only view your own notifications' });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    console.log(`📬 Fetching notifications for user ${userId}, page: ${pageNum}, limit: ${limitNum}`);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?';
    const countParams = [userId];
    if (unreadOnly === 'true') {
      countQuery += ' AND is_read = 0';
    }
    // Panel-type filtering: exclude notifications scoped to the *other* panel
    if (panelType === 'teamleader') {
      countQuery += " AND (panel_type IS NULL OR panel_type != 'user')";
    } else if (panelType === 'user') {
      countQuery += " AND (panel_type IS NULL OR panel_type != 'teamleader')";
    }
    
    // Type filtering for broadcast replies
    if (type) {
      if (type === 'broadcast_history') {
        countQuery += " AND type IN ('broadcast', 'broadcast_reply')";
      } else {
        countQuery += " AND type = ?";
        countParams.push(type);
      }
    } else {
      countQuery += " AND type NOT IN ('broadcast_reply', 'broadcast')";
    }
    const countResult = await queryOne(countQuery, countParams);
    const totalCount = countResult?.total || 0;

    // Get paginated notifications
    let queryStr = `
      SELECT 
        n.*, 
        f.original_name as file_name, 
        f.status as file_status,
        a.title as assignment_title,
        a.due_date as assignment_due_date,
        ac.id as comment_id,
        u.profile_picture as action_by_profile_picture
      FROM notifications n
      LEFT JOIN files f ON n.file_id = f.id
      LEFT JOIN assignments a ON n.assignment_id = a.id
      LEFT JOIN assignment_comments ac 
        ON n.assignment_id IS NOT NULL
        AND n.type IN ('comment', 'mention', 'reply')
        AND ac.assignment_id = n.assignment_id
        AND ac.created_at BETWEEN DATE_SUB(n.created_at, INTERVAL 1 SECOND)
                               AND DATE_ADD(n.created_at, INTERVAL 1 SECOND)
      LEFT JOIN users u ON n.action_by_id = u.id
      WHERE n.user_id = ?
    `;

    const queryParams = [userId];
    if (unreadOnly === 'true') {
      queryStr += ' AND n.is_read = 0';
    }
    // Panel-type filtering: exclude notifications scoped to the *other* panel
    if (panelType === 'teamleader') {
      queryStr += " AND (n.panel_type IS NULL OR n.panel_type != 'user')";
    } else if (panelType === 'user') {
      queryStr += " AND (n.panel_type IS NULL OR n.panel_type != 'teamleader')";
    }

    // Type filtering for broadcast replies
    if (type) {
      if (type === 'broadcast_history') {
        queryStr += " AND n.type IN ('broadcast', 'broadcast_reply')";
      } else {
        queryStr += " AND n.type = ?";
        queryParams.push(type);
      }
    } else {
      queryStr += " AND n.type NOT IN ('broadcast_reply', 'broadcast')";
    }

    queryStr += ` ORDER BY n.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

    const notifications = await query(queryStr, queryParams);

    console.log(`✅ Found ${notifications.length} notifications for user ${userId} (page ${pageNum})`);

    // Count unread notifications (total, not just in this page)
    let unreadCountQuery = 'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0';
    const unreadParams = [userId];
    if (panelType === 'teamleader') {
      unreadCountQuery += " AND (panel_type IS NULL OR panel_type != 'user')";
    } else if (panelType === 'user') {
      unreadCountQuery += " AND (panel_type IS NULL OR panel_type != 'teamleader')";
    }
    
    // Exclude broadcast replies from unread count
    if (type) {
      if (type === 'broadcast_history') {
        unreadCountQuery += " AND type IN ('broadcast', 'broadcast_reply')";
      } else {
        unreadCountQuery += " AND type = ?";
        unreadParams.push(type);
      }
    } else {
      unreadCountQuery += " AND type != 'broadcast_reply'";
    }
    const unreadCountResult = await queryOne(unreadCountQuery, unreadParams);
    const unreadCount = unreadCountResult?.count || 0;

    // Calculate if there are more pages
    const hasMore = offset + notifications.length < totalCount;

    res.json({
      success: true,
      notifications: notifications || [],
      unreadCount: unreadCount,
      totalCount: totalCount,
      page: pageNum,
      limit: limitNum,
      hasMore: hasMore
    });
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
});

// ── Fast broadcast-messages endpoint (no heavy JOINs) ──────────────────────
// Used exclusively by the BroadcastModal Messages/History tab.
// Skips the files/assignments/assignment_comments JOINs entirely since
// broadcast notifications never have file_id or assignment_id set.
router.get('/user/:userId/broadcasts', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, type } = req.query;

    if (req.user.id !== parseInt(userId, 10) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const params = [userId];

    // Two separate filters: one with the `n.` alias (for the JOIN query),
    // one plain (for the simple COUNT query with no alias)
    let typeFilterAliased = '';  // used in SELECT ... FROM notifications n
    let typeFilterPlain   = '';  // used in SELECT COUNT(*) FROM notifications

    if (type === 'broadcast_reply') {
      typeFilterAliased = "AND n.type = 'broadcast_reply'";
      typeFilterPlain   = "AND type = 'broadcast_reply'";
    } else {
      // covers 'broadcast_history' and any other value
      typeFilterAliased = "AND n.type IN ('broadcast', 'broadcast_reply')";
      typeFilterPlain   = "AND type IN ('broadcast', 'broadcast_reply')";
    }

    const rows = await query(
      `SELECT n.id, n.user_id, n.type, n.title, n.message, n.is_read, n.created_at,
              n.action_by_id, n.action_by_username, n.action_by_role,
              u.profile_picture as action_by_profile_picture
       FROM notifications n
       LEFT JOIN users u ON n.action_by_id = u.id
       WHERE n.user_id = ? ${typeFilterAliased}
       ORDER BY n.created_at DESC
       LIMIT ?`,
      [...params, limitNum]
    );

    const unreadResult = await query(
      `SELECT COUNT(*) as count FROM notifications
       WHERE user_id = ? AND is_read = 0 ${typeFilterPlain}`,
      params
    );

    // Strip any legacy inline base64 from old DB records before returning.
    // Old messages stored raw base64 (500KB-2MB each); replace with [Image]
    // placeholder so the API response stays small. New messages already use URL paths.
    const sanitized = (rows || []).map(row => ({
      ...row,
      message: row.message
        ? row.message.replace(/!\[.*?\]\(data:image\/[^)]+\)/g, '![Image](/api/placeholder-image)')
        : row.message
    }));

    console.log(`✅ Fast broadcast fetch: ${sanitized.length} messages for user ${userId}`);

    res.json({
      success: true,
      notifications: sanitized,
      unreadCount: unreadResult[0]?.count || 0
    });
  } catch (error) {
    console.error('❌ Error fetching broadcasts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch broadcasts' });
  }
});


router.get('/user/:userId/unread-count', async (req, res) => {
  try {
    const { userId } = req.params;

    // Ownership check (loose == to handle string/int mismatch between URL param and JWT)
    if (req.user.id !== parseInt(userId, 10) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { panelType } = req.query;

    let unreadQuery = "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0 AND type NOT IN ('broadcast_reply', 'broadcast')";
    const unreadParams = [userId];
    if (panelType === 'teamleader') {
      unreadQuery += " AND (panel_type IS NULL OR panel_type != 'user')";
    } else if (panelType === 'user') {
      unreadQuery += " AND (panel_type IS NULL OR panel_type != 'teamleader')";
    }
    const result = await queryOne(unreadQuery, unreadParams);

    res.json({
      success: true,
      count: result?.count || 0
    });
  } catch (error) {
    console.error('❌ Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count'
    });
  }
});

// Mark notification as read
router.put('/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await query(
      'UPDATE notifications SET is_read = 1, read_at = ? WHERE id = ?',
      [now, notificationId]
    );

    console.log(`✅ Notification ${notificationId} marked as read`);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
});

// Mark all notifications as read for a user
router.put('/user/:userId/read-all', async (req, res) => {
  try {
    const { userId } = req.params;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Ownership check (loose == to handle string/int mismatch between URL param and JWT)
    if (req.user.id !== parseInt(userId, 10) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { type } = req.query;

    let queryStr = 'UPDATE notifications SET is_read = 1, read_at = ? WHERE user_id = ? AND is_read = 0';
    const params = [now, userId];

    if (type) {
      if (type === 'broadcast_history') {
        queryStr += " AND type IN ('broadcast', 'broadcast_reply')";
      } else if (type === 'broadcast_announcements') {
        queryStr += " AND type = 'broadcast' AND title != 'Message from Admin'";
      } else if (type === 'broadcast_messages') {
        queryStr += " AND (type = 'broadcast_reply' OR (type = 'broadcast' AND title = 'Message from Admin'))";
      } else {
        queryStr += ' AND type = ?';
        params.push(type);
      }
    }

    const result = await query(queryStr, params);

    console.log(`✅ Marked all notifications as read for user ${userId}`);
    pushToUser(userId); // Trigger SSE ping to update frontend badge

    res.json({
      success: true,
      message: 'All notifications marked as read',
      count: result.affectedRows || 0
    });
  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
});

// Delete a notification
router.delete('/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;

    await query(
      'DELETE FROM notifications WHERE id = ?',
      [notificationId]
    );

    console.log(`✅ Notification ${notificationId} deleted`);

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('❌ Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
});

// Delete all notifications for a user
router.delete('/user/:userId/delete-all', async (req, res) => {
  try {
    const { userId } = req.params;
    const { type } = req.query;

    // Ownership check (loose == to handle string/int mismatch between URL param and JWT)
    if (req.user.id !== parseInt(userId, 10) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    console.log(`🗑️ Deleting all notifications for user ${userId}`);

    let queryStr = 'DELETE FROM notifications WHERE user_id = ?';
    const params = [userId];

    if (type) {
      if (type === 'broadcast_history') {
        queryStr += " AND type IN ('broadcast', 'broadcast_reply')";
      } else if (type === 'broadcast_announcements') {
        queryStr += " AND type = 'broadcast' AND title != 'Message from Admin'";
      } else if (type === 'broadcast_messages') {
        queryStr += " AND (type = 'broadcast_reply' OR (type = 'broadcast' AND title = 'Message from Admin'))";
      } else {
        queryStr += ' AND type = ?';
        params.push(type);
      }
    }

    const result = await query(queryStr, params);

    console.log(`✅ Deleted ${result.affectedRows || 0} notifications for user ${userId}`);

    res.json({
      success: true,
      message: 'All notifications deleted',
      count: result.affectedRows || 0
    });
  } catch (error) {
    console.error('❌ Error deleting all notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete all notifications'
    });
  }
});

// Get unread broadcasts for a user
router.get('/user/:userId/unread-broadcasts', async (req, res) => {
  try {
    const { userId } = req.params;

    // Ownership check (loose == to handle string/int mismatch between URL param and JWT)
    if (req.user.id !== parseInt(userId, 10) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const broadcasts = await query(
      `SELECT * FROM notifications 
       WHERE user_id = ? AND is_read = 0 AND type IN ('broadcast', 'broadcast_reply') 
       ORDER BY created_at ASC`,
      [userId]
    );

    res.json({
      success: true,
      broadcasts
    });
  } catch (error) {
    console.error('❌ Error getting unread broadcasts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread broadcasts'
    });
  }
});

// Broadcast a notification
router.post('/broadcast', upload.single('image'), async (req, res) => {
  try {
    let { title, message, targetUserIds, imageBase64 } = req.body;
    
    // targetUserIds might come as a JSON string when sent via FormData
    if (typeof targetUserIds === 'string') {
      try {
        targetUserIds = JSON.parse(targetUserIds);
      } catch (e) {
        targetUserIds = [];
      }
    }
    
    if (!title || (!message && !req.file && !imageBase64)) {
      return res.status(400).json({ success: false, message: 'Title and message or image are required' });
    }

    message = message || '';

    // Process image upload if present
    if (req.file) {
      const broadcastsDir = path.join(uploadsDir, 'broadcasts');
      try {
        // Ensure broadcasts directory exists
        await fs.mkdir(broadcastsDir, { recursive: true });
        
        // Use original extension
        const ext = path.extname(req.file.originalname) || '.png';
        const finalFilename = `broadcast_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
        const finalPath = path.join(broadcastsDir, finalFilename);
        
        // Move file from temp to final destination (copy then delete to avoid EXDEV cross-device errors)
        await fs.copyFile(req.file.path, finalPath);
        await fs.unlink(req.file.path);
        
        // Append image to message
        message += `\n\n![Image](/uploads/broadcasts/${finalFilename})`;
      } catch (err) {
        console.error('Failed to process broadcast image:', err);
        // Continue even if image fails, or you could return an error
      }
    } else if (imageBase64) {
      // Save base64 image to disk — storing raw base64 inline in DB causes
      // the broadcasts API to return megabytes per fetch, lagging the UI.
      try {
        const broadcastsDir = path.join(uploadsDir, 'broadcasts');
        await fs.mkdir(broadcastsDir, { recursive: true });
        const mimeMatch = imageBase64.match(/^data:image\/(\w+);base64,/);
        const ext = mimeMatch ? `.${mimeMatch[1].replace('jpeg', 'jpg')}` : '.png';
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const finalFilename = `broadcast_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
        const finalPath = path.join(uploadsDir, 'broadcasts', finalFilename);
        await fs.writeFile(finalPath, Buffer.from(base64Data, 'base64'));
        message += `\n\n![Image](/uploads/broadcasts/${finalFilename})`;
        console.log(`✅ Broadcast image saved: ${finalFilename}`);
      } catch (err) {
        console.error('⚠️ Failed to save broadcast image:', err.message);
        // Skip the image rather than storing huge base64 inline
      }
    }

    console.log(`📢 Sending broadcast announcement: ${title} from ${req.user.username}`);

    let users = [];
    if (req.user.role !== 'ADMIN') {
      // Non-admins can only send messages to admins
      users = await query("SELECT id FROM users WHERE role = 'ADMIN'");
    } else {
      // Admin: Get users based on targetUserIds or get all users
      if (targetUserIds && Array.isArray(targetUserIds) && targetUserIds.length > 0) {
        // Fetch only specific users
        const placeholders = targetUserIds.map(() => '?').join(',');
        users = await query(`SELECT id FROM users WHERE id IN (${placeholders})`, targetUserIds);
      } else {
        // Send to all users
        users = await query("SELECT id FROM users");
      }
    }

    let count = 0;
    const isNonAdmin = req.user.role !== 'ADMIN';
    const dbType = isNonAdmin ? 'broadcast_reply' : 'broadcast';

    // Strip base64 image data from SSE payload — sending megabytes via SSE
    // freezes every connected client's UI. The alert popup only needs the title.
    const sseMessage = message.replace(/!\[.*?\]\(data:image\/[^)]+\)/g, '[Image]');

    for (const user of users) {
      // Save to database so it persists and appears in Messages tab if needed
      const result = await query(
        'INSERT INTO notifications (user_id, type, title, message, action_by_id, action_by_username, action_by_role) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [user.id, dbType, title, message, req.user.id, req.user.username, req.user.role]
      );

      // Push SSE ping with broadcast payload (triggers the alert popup)
      // Use sseMessage — base64 stripped — to keep the SSE payload tiny
      pushToUser(user.id, { 
        id: result.insertId,
        type: 'broadcast', 
        title, 
        message: sseMessage,
        senderId: req.user.id,
        senderName: req.user.username
      });
      count++;
    }

    console.log(`✅ Broadcast sent to ${count} users`);

    res.json({
      success: true,
      message: 'Broadcast sent successfully',
      count
    });
  } catch (error) {
    console.error('❌ Error sending broadcast:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send broadcast'
    });
  }
});

// Reply to a broadcast
router.post('/broadcast/reply', async (req, res) => {
  try {
    const { broadcastSenderId, originalMessage, replyMessage } = req.body;
    
    if (!broadcastSenderId || !replyMessage) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    console.log(`💬 User ${req.user.id} replying to broadcast from ${broadcastSenderId}`);

    // Create a notification for the broadcast sender (but it won't show in standard feed)
    // We do NOT call createNotification directly because it pushes a 'ping' that triggers a toast.
    // Instead we insert it silently so it's available for the "Replies" tab.
    const result = await query(
      `INSERT INTO notifications (user_id, file_id, type, title, message, action_by_id, action_by_username, action_by_role) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        broadcastSenderId,
        null,
        'broadcast_reply',
        'Broadcast Reply',
        `${req.user.username || 'A user'} replied to your broadcast:\n\n"${replyMessage}"`,
        req.user.id,
        req.user.username,
        req.user.role
      ]
    );

    // Also push a real-time popup to the sender so they see it instantly
    pushToUser(broadcastSenderId, {
      id: result.insertId,
      type: 'broadcast',
      title: `Reply from ${req.user.username || 'A user'}`,
      message: replyMessage,
      senderId: req.user.id,
      senderName: req.user.username
    });

    res.json({
      success: true,
      message: 'Reply sent successfully'
    });
  } catch (error) {
    console.error('❌ Error sending broadcast reply:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send reply'
    });
  }
});

// Export both the router and the helper functions
module.exports = {
  router,
  createNotification,
  createAdminNotification,
  pushToUser
};
