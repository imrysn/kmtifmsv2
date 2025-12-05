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
    const iconStyle = {
      width: '48px',
      height: '48px',
      minWidth: '48px',
      minHeight: '48px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '12px',
      flexShrink: 0
    };

    switch (type) {
      case 'comment':
        return (
          <div style={{ ...iconStyle, background: '#EFF6FF' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3B82F6" width="24" height="24">
              <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
            </svg>
          </div>
        );
      case 'assignment':
        return (
          <div style={{ ...iconStyle, background: '#F3E8FF' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#9333EA" width="24" height="24">
              <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
            </svg>
          </div>
        );
      case 'approval':
      case 'final_approval':
        return (
          <div style={{ ...iconStyle, background: '#D1FAE5' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#10B981" width="24" height="24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
            </svg>
          </div>
        );
      case 'rejection':
      case 'final_rejection':
        return (
          <div style={{ ...iconStyle, background: '#FEE2E2' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#EF4444" width="24" height="24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </div>
        );
      default:
        return (
          <div style={{ ...iconStyle, background: '#FEF3C7' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F59E0B" width="24" height="24">
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
            </svg>
          </div>
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
