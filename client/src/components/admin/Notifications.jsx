import { useState, useEffect } from 'react';
import './Notifications.css';
import { getSidebarIcon } from './FileIcon';

const Notifications = ({ user, onNavigate }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user.id]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/notifications/user/${user.id}`);
      const data = await response.json();
      
      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      } else {
        setError('Failed to fetch notifications');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError('Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const response = await fetch(`http://localhost:3001/api/notifications/${notificationId}/read`, {
        method: 'PUT'
      });
      
      const data = await response.json();
      if (data.success) {
        fetchNotifications(); // Refresh notifications
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/notifications/user/${user.id}/read-all`, {
        method: 'PUT'
      });
      
      const data = await response.json();
      if (data.success) {
        fetchNotifications(); // Refresh notifications
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const response = await fetch(`http://localhost:3001/api/notifications/${notificationId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      if (data.success) {
        fetchNotifications(); // Refresh notifications
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const deleteAll = async () => {
    if (!window.confirm('Are you sure you want to delete all notifications?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/notifications/user/${user.id}/delete-all`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      if (data.success) {
        fetchNotifications(); // Refresh notifications
      }
    } catch (error) {
      console.error('Error deleting all notifications:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    // Mark as read
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.assignment_id) {
      // Navigate to tasks tab
      if (onNavigate) {
        onNavigate('tasks', notification.assignment_id);
      }
    } else if (notification.file_id) {
      // Navigate to file approval or file management
      if (notification.type === 'approval' || notification.type === 'rejection') {
        if (onNavigate) {
          onNavigate('file-approval', notification.file_id);
        }
      } else {
        if (onNavigate) {
          onNavigate('file-management', notification.file_id);
        }
      }
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'comment':
        return '💬';
      case 'assignment':
        return '📋';
      case 'approval':
        return '✅';
      case 'rejection':
        return '❌';
      case 'final_approval':
        return '🎉';
      case 'final_rejection':
        return '🚫';
      default:
        return '🔔';
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const created = new Date(timestamp);
    const diffInSeconds = Math.floor((now - created) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return created.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="notifications-page">
        <div className="notifications-header">
          <h2>Notifications</h2>
        </div>
        <div className="notifications-loading">Loading notifications...</div>
      </div>
    );
  }

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <div>
          <h2>Notifications</h2>
          <p className="notifications-subtitle">Stay updated with your file approvals and system messages</p>
        </div>
        <div className="notifications-actions">
          {unreadCount > 0 && (
            <button className="btn-mark-all-read" onClick={markAllAsRead}>
              ✓ Mark All as Read
            </button>
          )}
          {notifications.length > 0 && (
            <button className="btn-delete-all" onClick={deleteAll}>
              🗑️ Delete All
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {notifications.length === 0 ? (
        <div className="no-notifications">
          <div className="no-notifications-icon">🔔</div>
          <h3>No notifications</h3>
          <p>You're all caught up! Check back later for updates.</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="notification-icon">
                {getNotificationIcon(notification.type)}
              </div>
              
              <div className="notification-content">
                <div className="notification-title">
                  {notification.title}
                  {!notification.is_read && <span className="unread-badge">New</span>}
                </div>
                <div className="notification-message">{notification.message}</div>
                
                <div className="notification-meta">
                  <span className="notification-author">
                    👤 {notification.action_by_username} ({notification.action_by_role})
                  </span>
                  {notification.assignment_title && (
                    <span className="notification-assignment">
                      📋 Assignment: {notification.assignment_title}
                    </span>
                  )}
                  {notification.file_name && (
                    <span className="notification-file">
                      📄 {notification.file_name}
                    </span>
                  )}
                  {notification.assignment_due_date && (
                    <span className="notification-due-date">
                      📅 Due: {new Date(notification.assignment_due_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                
                <div className="notification-time">
                  {formatTimeAgo(notification.created_at)}
                </div>
              </div>

              <button
                className="notification-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNotification(notification.id);
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
