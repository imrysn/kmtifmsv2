const express = require('express');
const { db } = require('../config/database');
const { query, queryOne } = require('../../database/config');

const router = express.Router();

// Helper function to create a notification (supports both file and assignment notifications)
const createNotification = async (userId, fileId, type, title, message, actionById, actionByUsername, actionByRole, assignmentId = null) => {
  try {
    console.log('🔔 Creating notification:', { userId, fileId, assignmentId, type, title });
    
    const result = await query(
      `INSERT INTO notifications (
        user_id, file_id, assignment_id, type, title, message, 
        action_by_id, action_by_username, action_by_role
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, fileId, assignmentId, type, title, message, actionById, actionByUsername, actionByRole]
    );
    
    console.log(`✅ Notification created for user ${userId}: ${title}`);
    return result.insertId;
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    console.error('Details:', { userId, fileId, assignmentId, type, title, message });
    throw error;
  }
};

// Get all notifications for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { unreadOnly } = req.query;

    console.log(`📬 Fetching notifications for user ${userId}, unreadOnly: ${unreadOnly}`);

    let queryStr = `
      SELECT 
        n.*, 
        f.original_name as file_name, 
        f.status as file_status,
        a.title as assignment_title,
        a.due_date as assignment_due_date
      FROM notifications n
      LEFT JOIN files f ON n.file_id = f.id
      LEFT JOIN assignments a ON n.assignment_id = a.id
      WHERE n.user_id = ?
    `;

    if (unreadOnly === 'true') {
      queryStr += ' AND n.is_read = 0';
    }

    queryStr += ' ORDER BY n.created_at DESC LIMIT 100';

    const notifications = await query(queryStr, [userId]);
    
    console.log(`✅ Found ${notifications.length} notifications for user ${userId}`);
    
    // Count unread notifications
    const unreadCount = notifications.filter(n => n.is_read === 0 || n.is_read === false).length;

    res.json({
      success: true,
      notifications: notifications || [],
      unreadCount: unreadCount
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

// Get unread notification count
router.get('/user/:userId/unread-count', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await queryOne(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );

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

    const result = await query(
      'UPDATE notifications SET is_read = 1, read_at = ? WHERE user_id = ? AND is_read = 0',
      [now, userId]
    );

    console.log(`✅ Marked all notifications as read for user ${userId}`);

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

    console.log(`🗑️ Deleting all notifications for user ${userId}`);

    const result = await query(
      'DELETE FROM notifications WHERE user_id = ?',
      [userId]
    );

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

// Export both the router and the helper function
module.exports = {
  router,
  createNotification
};
