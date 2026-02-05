import { useState, useEffect, useMemo, useCallback } from 'react';
import { API_BASE_URL } from '@/config/api';
import { useTaskbarFlash } from '../../utils/useTaskbarFlash';
import './css/NotificationTab.css';
import { parseNotification } from '../shared/SmartNavigation';

const NotificationTab = ({ user, onOpenFile, onNavigateToTasks, onNavigate, onUpdateUnreadCount }) => {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [displayCount, setDisplayCount] = useState(10);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // Enable taskbar flashing for new notifications
  useTaskbarFlash(unreadCount);

  useEffect(() => {
    let isMounted = true;

    const loadNotifications = async () => {
      if (isMounted) {
        await fetchNotifications();
      }
    };

    loadNotifications();

    // Poll for new notifications every 5 seconds for real-time updates
    const pollInterval = setInterval(() => {
      if (isMounted) {
        fetchNotifications();
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [user.id]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/user/${user.id}`);
      const data = await response.json();

      if (data.success) {
        setNotifications(data.notifications || []);
        const newUnreadCount = data.unreadCount || 0;
        setUnreadCount(newUnreadCount);
        // Update parent component's unread count
        if (onUpdateUnreadCount) {
          onUpdateUnreadCount(newUnreadCount);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching notifications:', error);
    } finally {
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    }
  };

  const handleNotificationClick = useCallback(async (notification) => {
    // Mark as read
    if (!notification.is_read) {
      try {
        await fetch(`${API_BASE_URL}/api/notifications/${notification.id}/read`, {
          method: 'PUT'
        });

        // Update local state
        setNotifications(prevNotifications =>
          prevNotifications.map(n =>
            n.id === notification.id ? { ...n, is_read: 1 } : n
          )
        );
        const newUnreadCount = Math.max(0, unreadCount - 1);
        setUnreadCount(newUnreadCount);
        if (onUpdateUnreadCount) {
          onUpdateUnreadCount(newUnreadCount);
        }
      } catch (error) {
        console.error('❌ Error marking notification as read:', error);
      }
    }

    // Use shared notification parser
    const { targetTab, context } = parseNotification(notification, 'user');

    console.log('🧭 Parsed User Notification:', { targetTab, context });

    if (targetTab) {
      if (onNavigate) {
        // Use new unified handler
        onNavigate(targetTab, context);
      } else {
        // Fallback for legacy props if onNavigate is missing
        if (targetTab === 'tasks' && onNavigateToTasks) {
          onNavigateToTasks(context?.assignmentId);
        } else if ((targetTab === 'files' || targetTab === 'my-files') && onOpenFile) {
          onOpenFile(context?.fileId);
        }
      }
    }
  }, [onNavigate, onNavigateToTasks, onOpenFile, unreadCount, onUpdateUnreadCount]);

  const handleDeleteNotification = useCallback(async (e, notificationId) => {
    e.stopPropagation();
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}`, {
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
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/user/${user.id}/read-all`, {
        method: 'PUT'
      });

      const data = await response.json();
      if (data.success) {
        // Update all notifications to read
        setNotifications(prevNotifications =>
          prevNotifications.map(n => ({ ...n, is_read: 1 }))
        );
        setUnreadCount(0);
        // Update parent component's unread count
        if (onUpdateUnreadCount) {
          onUpdateUnreadCount(0);
        }
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [user.id, onUpdateUnreadCount]);

  const handleDeleteAll = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  const confirmDeleteAll = useCallback(async () => {
    try {
      console.log('Deleting all notifications for user:', user.id);
      const response = await fetch(`${API_BASE_URL}/api/notifications/user/${user.id}/delete-all`, {
        method: 'DELETE'
      });

      const data = await response.json();
      console.log('Delete response:', data);

      if (data.success) {
        setNotifications([]);
        setUnreadCount(0);
        setShowDeleteModal(false);
        // Update parent component's unread count
        if (onUpdateUnreadCount) {
          onUpdateUnreadCount(0);
        }
        console.log('✅ All notifications deleted successfully');
      } else {
        console.error('❌ Delete failed:', data.message);
        alert('Failed to delete notifications. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error deleting all notifications:', error);
      alert('An error occurred while deleting notifications.');
    }
  }, [user.id, onUpdateUnreadCount]);

  const getNotificationIcon = useCallback((type) => {
    console.log('🔄 UPDATED VERSION - Using specific user dashboard icons');
    switch (type) {
      case 'approval':
      case 'final_approval':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="file-icon-svg">
            <circle cx="10" cy="10" r="8.5" />
            <path d="M6 10l2.5 2.5 5.5-5.5" />
          </svg>
        );
      case 'rejection':
      case 'final_rejection':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="file-icon-svg">
            <circle cx="10" cy="10" r="8.5" />
            <line x1="4" y1="4" x2="16" y2="16" />
          </svg>
        );
      case 'comment':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="file-icon-svg">
            <path d="M3 3h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6l-3 3V4a1 1 0 0 1 1-1z" />
          </svg>
        );
      case 'assignment':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="file-icon-svg">
            <path d="M12 2H4a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 4 18h10a1.5 1.5 0 0 0 1.5-1.5V6l-3.5-4z" />
            <path d="M12 2v4h3.5" />
            <path d="M6 10h6M6 13h6" />
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="file-icon-svg">
            <path d="M12 2H4a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 4 18h10a1.5 1.5 0 0 0 1.5-1.5V6l-3.5-4z" />
            <path d="M12 2v4h3.5" />
          </svg>
        );
    }
  }, []);

  const getStatusDisplayName = useCallback((dbStatus) => {
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
  }, []);

  const getNotificationColor = useCallback((type) => {
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
  }, []);

  const formatTimeAgo = useCallback((dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  }, []);

  const formatRole = useCallback((role) => {
    if (!role) return '';
    // Convert "TEAM LEADER" to "TEAM LEADER", "ADMIN" to "ADMIN", "USER" to "USER"
    return role.toUpperCase();
  }, []);

  // Memoize computed values
  const displayedNotifications = useMemo(
    () => notifications.slice(0, displayCount),
    [notifications, displayCount]
  );

  const remainingCount = useMemo(
    () => notifications.length - displayCount,
    [notifications.length, displayCount]
  );

  const handleSeeMore = useCallback(() => {
    if (showAll) {
      setDisplayCount(10);
      setShowAll(false);
    } else {
      setDisplayCount(prev => prev + 10);
      if (displayCount + 10 >= notifications.length) {
        setShowAll(true);
      }
    }
  }, [showAll, displayCount, notifications.length]);

  // Show minimal skeleton only on very first load
  if (isInitialLoad && notifications.length === 0) {
    return (
      <div className="user-notification-component notification-section">
        <div className="page-header">
          <div className="page-header-content">
            <div className="page-header-left">
              <h2>Notifications</h2>
              <p>Click on any notification to view details</p>
            </div>
          </div>
        </div>

        <div className="notifications-container">
          <div className="notifications-list">
            {[1, 2, 3].map((item) => (
              <div key={item} className="notification-card skeleton-card">
                <div className="skeleton-icon"></div>
                <div className="skeleton-content">
                  <div className="skeleton-title"></div>
                  <div className="skeleton-message"></div>
                  <div className="skeleton-footer">
                    <div className="skeleton-footer-item"></div>
                    <div className="skeleton-footer-item"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="user-notification-component notification-section">
        <div className="page-header">
          <div className="page-header-content">
            <div className="page-header-left">
              <h2>Notifications</h2>
              <p>Stay updated with your file approvals and system messages</p>
              <div className="notification-stats">
                {notifications.length} total • {unreadCount} unread
              </div>
            </div>
            <div className="notification-actions">
              {unreadCount > 0 && (
                <button
                  className="mark-all-read-btn"
                  onClick={handleMarkAllAsRead}
                  title="Mark all as read"
                >
                  Mark All as Read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  className="delete-all-btn"
                  onClick={handleDeleteAll}
                  title="Delete all notifications"
                >
                  Delete All
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="notifications-container">
          {notifications.length > 0 ? (
            <div className="notifications-list">
              {displayedNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-card clickable ${getNotificationColor(notification.type)} ${!notification.is_read ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <div className="notification-title-row">
                      <h4 className="notification-title">{notification.title}</h4>
                      <svg className="arrow-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="notification-message">{notification.message}</p>
                    <div className="notification-footer">
                      <span className="notification-action-by">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 1 .41-1.108A9.965 9.965 0 0 1 10 11c2.456 0 4.71.886 6.425 2.385.276.24.456.6.41 1.108a9.98 9.98 0 0 1-13.37 0Z" />
                        </svg>
                        {notification.action_by_username} ({formatRole(notification.action_by_role)})
                      </span>
                      <span className="notification-time">{formatTimeAgo(notification.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {notifications.length > 10 && (
                <div className="see-more-container">
                  <button
                    className="see-more-btn"
                    onClick={handleSeeMore}
                  >
                    {showAll ? 'See less' : `See more (${remainingCount} more notifications)`}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-notifications">
              <div className="empty-icon">○</div>
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
            <div className="custom-modal-header">
              <h3>Delete All Notifications?</h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="custom-modal-close"
                type="button"
              >
                ×
              </button>
            </div>

            <div className="custom-modal-body">
              <div className="delete-warning">
                <span className="warning-icon">⚠️</span>
                <div className="warning-content">
                  <h4>Are you sure you want to delete all notifications?</h4>

                  <div className="item-info">
                    <div className="item-name">{notifications.length} notification{notifications.length !== 1 ? 's' : ''}</div>
                    <div className="item-details">Including {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</div>
                  </div>

                  <p className="warning-text">
                    This action cannot be undone. All notifications will be permanently removed from your account.
                  </p>
                </div>
              </div>
            </div>

            <div className="custom-modal-footer">
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="modal-cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteAll}
                  className="modal-confirm-btn"
                >
                  Delete All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationTab;
