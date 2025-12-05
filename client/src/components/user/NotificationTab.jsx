import { useState, useEffect } from 'react';
import './css/NotificationTab.css';
import { LoadingCards } from '../common/InlineSkeletonLoader';

const NotificationTab = ({ user, onNavigateToTask }) => {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    setIsLoading(true);
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

  const markAsRead = async (notificationId) => {
    try {
      await fetch(`http://localhost:3001/api/notifications/${notificationId}/read`, {
        method: 'PUT'
      });
      
      // Update local state
      setNotifications(prevNotifications =>
        prevNotifications.map(n =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch(`http://localhost:3001/api/notifications/user/${user.id}/read-all`, {
        method: 'PUT'
      });
      
      // Update local state
      setNotifications(prevNotifications =>
        prevNotifications.map(n => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId, e) => {
    e.stopPropagation();
    try {
      await fetch(`http://localhost:3001/api/notifications/${notificationId}`, {
        method: 'DELETE'
      });
      
      // Update local state
      setNotifications(prevNotifications =>
        prevNotifications.filter(n => n.id !== notificationId)
      );
      
      // Update unread count if the deleted notification was unread
      const deletedNotif = notifications.find(n => n.id === notificationId);
      if (deletedNotif && !deletedNotif.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    console.log('🔔 Notification clicked:', notification);
    
    // Mark as read
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Handle navigation based on notification type
    if (notification.type === 'comment' && notification.assignment_id) {
      console.log('💬 Comment notification - assignment_id:', notification.assignment_id);
      console.log('👤 action_by_username:', notification.action_by_username);
      
      // Store the username of who commented/replied for highlighting
      if (notification.action_by_username) {
        sessionStorage.setItem('highlightCommentBy', notification.action_by_username);
        console.log('✅ Stored highlightCommentBy:', notification.action_by_username);
      }
      
      // Navigate to tasks tab and scroll to comments section
      if (onNavigateToTask) {
        console.log('➡️ Calling onNavigateToTask...');
        onNavigateToTask(notification.assignment_id);
      } else {
        console.log('❌ onNavigateToTask is not defined!');
      }
    } else if (notification.type === 'assignment' && notification.assignment_id) {
      // Navigate to tasks tab
      if (onNavigateToTask) {
        onNavigateToTask(notification.assignment_id);
      }
    }
    // For file notifications, you can add navigation to files tab if needed
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'comment':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        );
      case 'assignment':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        );
      case 'approval':
      case 'final_approval':
      case 'rejection':
      case 'final_rejection':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
            <polyline points="13 2 13 9 20 9"></polyline>
          </svg>
        );
      default:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        );
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'comment':
        return 'notification-comment';
      case 'assignment':
        return 'notification-assignment';
      case 'approval':
      case 'final_approval':
        return 'notification-success';
      case 'rejection':
      case 'final_rejection':
        return 'notification-error';
      default:
        return 'notification-default';
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMins > 0) {
      return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  return (
    <div className="user-notification-component notification-section">
      <div className="page-header">
        <div className="page-header-title">
          <span className="bell-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </span>
          <h2>Notifications</h2>
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount}</span>
          )}
        </div>
        <p>Stay updated with your assignments and file approvals</p>
      </div>

      {unreadCount > 0 && (
        <div className="notification-actions">
          <button onClick={markAllAsRead} className="mark-all-read-btn">
            Mark All as Read
          </button>
        </div>
      )}

      <div className="notifications-container">
        {isLoading ? (
          <div>
            <LoadingCards count={6} />
          </div>
        ) : notifications.length > 0 ? (
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
                    <button
                      className="delete-notification-btn"
                      onClick={(e) => deleteNotification(notification.id, e)}
                      title="Delete notification"
                    >
                      ×
                    </button>
                  </div>
                  <p className="notification-message">{notification.message}</p>
                  <div className="notification-footer">
                    <span className="notification-time">{formatTimeAgo(notification.created_at)}</span>
                    {notification.action_by_username && (
                      <span className="notification-author">
                        by {notification.action_by_username}
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
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            </div>
            <h3>No notifications yet</h3>
            <p>We'll notify you when there are updates on your assignments or important messages.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationTab;
