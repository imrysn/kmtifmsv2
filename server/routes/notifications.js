const express = require('express');
const { db } = require('../config/database');

const router = express.Router();

// Helper function to create a notification
const createNotification = (userId, fileId, type, title, message, actionById, actionByUsername, actionByRole) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO notifications (user_id, file_id, type, title, message, action_by_id, action_by_username, action_by_role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, fileId, type, title, message, actionById, actionByUsername, actionByRole],
      function(err) {
        if (err) {
          console.error('❌ Error creating notification:', err);
          reject(err);
        } else {
          console.log(`✅ Notification created for user ${userId}: ${title}`);
          resolve(this.lastID);
        }
      }
    );
  });
};

// Get all notifications for a user
router.get('/user/:userId', (req, res) => {
  const { userId } = req.params;
  const { unreadOnly } = req.query;

  let query = `
    SELECT n.*, f.original_name as file_name, f.status as file_status
    FROM notifications n
    LEFT JOIN files f ON n.file_id = f.id
    WHERE n.user_id = ?
  `;

  if (unreadOnly === 'true') {
    query += ' AND n.is_read = 0';
  }

  query += ' ORDER BY n.created_at DESC LIMIT 100';

  db.all(query, [userId], (err, notifications) => {
    if (err) {
      console.error('❌ Error fetching notifications:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch notifications'
      });
    }

    res.json({
      success: true,
      notifications: notifications || [],
      unreadCount: notifications.filter(n => !n.is_read).length
    });
  });
});

// Get unread notification count
router.get('/user/:userId/unread-count', (req, res) => {
  const { userId } = req.params;

  db.get(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
    [userId],
    (err, result) => {
      if (err) {
        console.error('❌ Error getting unread count:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to get unread count'
        });
      }

      res.json({
        success: true,
        count: result.count || 0
      });
    }
  );
});

// Mark notification as read
router.put('/:notificationId/read', (req, res) => {
  const { notificationId } = req.params;
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  db.run(
    'UPDATE notifications SET is_read = 1, read_at = ? WHERE id = ?',
    [now, notificationId],
    function(err) {
      if (err) {
        console.error('❌ Error marking notification as read:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to mark notification as read'
        });
      }

      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    }
  );
});

// Mark all notifications as read for a user
router.put('/user/:userId/read-all', (req, res) => {
  const { userId } = req.params;
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  db.run(
    'UPDATE notifications SET is_read = 1, read_at = ? WHERE user_id = ? AND is_read = 0',
    [now, userId],
    function(err) {
      if (err) {
        console.error('❌ Error marking all notifications as read:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to mark all notifications as read'
        });
      }

      res.json({
        success: true,
        message: 'All notifications marked as read',
        count: this.changes
      });
    }
  );
});

// Delete a notification
router.delete('/:notificationId', (req, res) => {
  const { notificationId } = req.params;

  db.run(
    'DELETE FROM notifications WHERE id = ?',
    [notificationId],
    function(err) {
      if (err) {
        console.error('❌ Error deleting notification:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to delete notification'
        });
      }

      res.json({
        success: true,
        message: 'Notification deleted'
      });
    }
  );
});

// Delete all notifications for a user
router.delete('/user/:userId/delete-all', (req, res) => {
  const { userId } = req.params;

  db.run(
    'DELETE FROM notifications WHERE user_id = ?',
    [userId],
    function(err) {
      if (err) {
        console.error('❌ Error deleting all notifications:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to delete all notifications'
        });
      }

      res.json({
        success: true,
        message: 'All notifications deleted',
        count: this.changes
      });
    }
  );
});

// Export both the router and the helper function
module.exports = {
  router,
  createNotification
};
