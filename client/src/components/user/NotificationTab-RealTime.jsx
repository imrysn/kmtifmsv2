import { useState, useEffect } from 'react';
import './css/NotificationTab.css';

const NotificationTab = ({ user, onOpenFile, onNavigateToTasks }) => {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    fetchNotifications();
    
    // Poll for new notifications every 5 seconds
    const interval = setInterval(() => {
      fetchNotifications();
    }, 5000);

    return () => clearInterval(interval);
  }, [user.id]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/notifications/user/${user.id}`);
      const data = await response.json();
      
      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        console.log('📬 Notifications updated:', data.notifications?.length || 0);
      }
    } catch (error) {
      console.error('❌ Error fetching notifications:', error);
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
        console.error('❌ Error marking notification as read:', error);
      }
    }

    // Handle navigation based on notification type
    if (notification.type === 'comment' && notification.assignment_id) {
      // For comment notifications, navigate to tasks and store assignment ID + commenter name
      if (onNavigateToTasks) {
        // Store both assignment ID and the username who made the comment
        sessionStorage.setItem('scrollToAssignment', notification.assignment_id);
        sessionStorage.setItem('highlightCommentBy', notification.action_by_username);
        console.log('📍 Stored comment navigation:', {
          assignmentId: notification.assignment_id,
          highlightUser: notification.action_by_username
        });
        onNavigateToTasks(notification.assignment_id);
      }
    } else if (notification.type === 'assignment') {
      // Navigate to tasks tab for assignment notifications
      if (onNavigateToTasks) {
        onNavigateToTasks();
      }
    } else if (notification.file_id) {
      // Open the file details for file-related notifications
      if (onOpenFile) {
        onOpenFile(notification.file_id);
      }
    }
  };

  const handleDeleteNotification = async (e, notificationId) => {
    e.stopPropagation();
    try {
      const response = await fetch(`http://localhost:3001/api/notifications/${notificationId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      if (data.success) {
        setNotifications(prevNotifications =>
          prevNotifications.filter(n => n.id !== notificationId)
        );
      }
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
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

  const handleDeleteAll = () => {
    setShowDeleteModal(true);
  };

  const confirmDeleteAll = async () => {
    try {
      console.log('Deleting all notifications for user:', user.id);
      const response = await fetch(`http://localhost:3001/api/notifications/user/${user.id}/delete-all`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      console.log('Delete response:', data);
      
      if (data.success) {
        setNotifications([]);
        setUnreadCount(0);
        setShowDeleteModal(false);
        console.log('✅ All notifications deleted successfully');
      } else {
        console.error('❌ Delete failed:', data.message);
        alert('Failed to delete notifications. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error deleting all notifications:', error);
      alert('An error occurred while deleting notifications.');
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
      case 'assignment':
        return '📋';
      default:
        return '📄';
    }
  };

  const getStatusDisplayName = (dbStatus) => {
    switch (dbStatus) {
      case 'uploaded':
        return 'PENDING TEAM LEADER';
      case 'team_leader_approved':
        return 'PENDING ADMIN';
      case 'final_approved':
        return 'FINAL APPROVED';
      case 'rejected_by_team_leader':
        return 'REJECTED BY TEAM LEADER';
      case 'rejected_by_admin':
        return 'REJECTED BY ADMIN';
      default:
        return dbStatus ? dbStatus.replace(/_/g, ' ').toUpperCase() : 'UNKNOWN';
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
      case 'assignment':
        return 'notification-assignment';
      default:
        return 'notification-default';
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };



  if (isLoading) {
    return (
      <div className="user-notification-component notification-section">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="user-notification-component notification-section">
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <h2>Notifications</h2>
            <p>Stay updated with your file approvals and system messages</p>
          </div>
          {notifications.length > 0 && (
            <div className="notification-actions">
              <button 
                className="mark-all-read-btn"
                onClick={handleMarkAllAsRead}
                title="Mark all as read"
                disabled={unreadCount === 0}
                style={{
                  opacity: unreadCount === 0 ? 0.5 : 1,
                  cursor: unreadCount === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                ✓ Mark All as Read
              </button>
              <button 
                className="delete-all-btn"
                onClick={handleDeleteAll}
                title="Delete all notifications"
              >
                🗑️ Delete All
              </button>
            </div>
          )}
        </div>
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
                    <div className="notification-time-actions">
                      <span className="notification-time">{formatTimeAgo(notification.created_at)}</span>
                      <button 
                        className="delete-notification-btn"
                        onClick={(e) => handleDeleteNotification(e, notification.id)}
                        title="Delete notification"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <p className="notification-message">{notification.message}</p>
                  <div className="notification-footer">
                    <span className="notification-action-by">
                      👤 {notification.action_by_username} ({notification.action_by_role})
                    </span>
                    {notification.file_status && (
                      <span className="notification-status">
                        Status: {getStatusDisplayName(notification.file_status)}
                      </span>
                    )}
                    {notification.assignment_title && (
                      <span className="notification-assignment-title">
                        📋 Assignment: {notification.assignment_title}
                      </span>
                    )}
                    {notification.assignment_due_date && (
                      <span className="notification-due-date">
                        📅 Due: {new Date(notification.assignment_due_date).toLocaleDateString()}
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

    {/* Custom Delete Confirmation Modal */}
    {showDeleteModal && (
      <div className="custom-modal-overlay" onClick={() => setShowDeleteModal(false)}>
        <div className="custom-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-icon">
            <span className="warning-icon">⚠️</span>
          </div>
          <h3 className="modal-title">Delete All Notifications?</h3>
          <p className="modal-message">
            Are you sure you want to delete all notifications? This action cannot be undone.
          </p>
          <div className="modal-actions">
            <button 
              className="modal-cancel-btn"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </button>
            <button 
              className="modal-confirm-btn"
              onClick={confirmDeleteAll}
            >
              Delete All
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default NotificationTab;
