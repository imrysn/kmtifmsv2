import { useState, useEffect } from 'react';
import './css/NotificationTab.css';

const NotificationTab = ({ user, onOpenFile }) => {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
    
    // Poll for new notifications every 10 seconds
    const interval = setInterval(() => {
      fetchNotifications();
    }, 10000);

    return () => clearInterval(interval);
  }, [user.id]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/notifications/user/${user.id}`);
      const data = await response.json();
      
      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.is_read) {
      try {
        await fetch(`http://localhost:3001/api/notifications/${notification.id}/read`, {
          method: 'PUT'
        });
        
        // Update local state
        setNotifications(prevNotifications =>
          prevNotifications.map(n =>
            n.id === notification.id ? { ...n, is_read: 1 } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    // Open the file details if onOpenFile callback is provided
    if (onOpenFile && notification.file_id) {
      onOpenFile(notification.file_id);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/notifications/user/${user.id}/read-all`, {
        method: 'PUT'
      });
      
      const data = await response.json();
      if (data.success) {
        // Update all notifications to read
        setNotifications(prevNotifications =>
          prevNotifications.map(n => ({ ...n, is_read: 1 }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'approval':
        return '✅';
      case 'rejection':
        return '❌';
      case 'final_approval':
        return '🎉';
      case 'final_rejection':
        return '⛔';
      case 'comment':
        return '💬';
      default:
        return '📄';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'approval':
      case 'final_approval':
        return 'notification-success';
      case 'rejection':
      case 'final_rejection':
        return 'notification-error';
      case 'comment':
        return 'notification-info';
      default:
        return 'notification-default';
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="notification-section">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="notification-section">
      <div className="page-header">
        <div>
          <h2>Notifications</h2>
          <p>Stay updated with your file approvals and system messages</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllAsRead} className="mark-all-read-btn">
            Mark all as read ({unreadCount})
          </button>
        )}
      </div>

      <div className="notifications-container">
        {notifications.length > 0 ? (
          <div className="notifications-list">
            {notifications.map((notification) => (
              <div 
                key={notification.id} 
                className={`notification-card ${getNotificationColor(notification.type)} ${!notification.is_read ? 'unread' : ''}`}
                onClick={() => handleNotificationClick(notification)}
                style={{ cursor: 'pointer' }}
              >
                <div className="notification-icon">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="notification-content">
                  <div className="notification-header">
                    <h4 className="notification-title">{notification.title}</h4>
                    <span className="notification-time">{formatTimeAgo(notification.created_at)}</span>
                  </div>
                  <p className="notification-message">{notification.message}</p>
                  <div className="notification-footer">
                    <span className="notification-action-by">
                      By {notification.action_by_username}
                    </span>
                    {notification.file_name && (
                      <span className="notification-file">
                        📄 {notification.file_name}
                      </span>
                    )}
                  </div>
                  {!notification.is_read && (
                    <div className="unread-indicator"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-notifications">
            <div className="empty-icon">🔔</div>
            <h3>No notifications yet</h3>
            <p>We'll notify you when there are updates on your files or important system messages.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationTab;
