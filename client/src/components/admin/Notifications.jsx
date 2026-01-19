import { useState, useEffect, useRef, useCallback, memo } from 'react';
import './Notifications.css';
import FileIcon from '../shared/FileIcon';
import { useTaskbarFlash } from '../../utils/useTaskbarFlash';
import { ConfirmationModal } from './modals';
import { useAuth, useNetwork } from '../../contexts';
import { withErrorBoundary } from '../common';

// Memoized notification item to prevent unnecessary re-renders
const NotificationItem = memo(({ notification, onNotificationClick, onDeleteNotification, NotificationIcon, formatTimeAgo }) => {
  return (
    <div
      className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
      onClick={() => onNotificationClick(notification)}
    >
      <div className="notification-icon">
        <NotificationIcon type={notification.type} />
      </div>
      
      <div className="notification-content">
        <div className="notification-title">
          {notification.title}
        </div>
        <div className="notification-message">{notification.message}</div>
        
        <div className="notification-meta">
          <span className="notification-author">
            👤 {notification.action_by_username} ({notification.action_by_role})
          </span>
          {notification.assignment_title && (
            <span className="notification-assignment">
              Assignment: {notification.assignment_title}
            </span>
          )}
          {notification.file_name && (
            <span className="notification-file">
              {notification.file_name}
            </span>
          )}
          {notification.assignment_due_date && (
            <span className="notification-due-date">
              Due: {new Date(notification.assignment_due_date).toLocaleDateString()}
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
          onDeleteNotification(notification.id);
        }}
      >
        ✕
      </button>
    </div>
  );
});

NotificationItem.displayName = 'NotificationItem';

const Notifications = ({ user, onNavigate }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Enable taskbar flashing for new notifications
  useTaskbarFlash(unreadCount);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Ref for infinite scroll
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);

  // Highlighted comment ref
  const [highlightedCommentId, setHighlightedCommentId] = useState(null);

  useEffect(() => {
    fetchNotifications(1, true);
    // Poll for new notifications every 30 seconds (only first page)
    const interval = setInterval(() => {
      fetchNotifications(1, true, true);
    }, 30000);
    return () => clearInterval(interval);
  }, [user.id]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (loading || loadingMore || !hasMore) return;

    const options = {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    };

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        fetchNotifications(page + 1, false);
      }
    }, options);

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loading, loadingMore, hasMore, page]);

  const fetchNotifications = async (pageNum, isInitial = false, isSilentRefresh = false) => {
    try {
      if (isInitial && !isSilentRefresh) {
        setLoading(true);
      } else if (!isSilentRefresh) {
        setLoadingMore(true);
      }

      const response = await fetch(
        `http://localhost:3001/api/notifications/user/${user.id}?page=${pageNum}&limit=${limit}`
      );
      const data = await response.json();
      
      if (data.success) {
        const newNotifications = data.notifications || [];
        
        if (isInitial) {
          setNotifications(newNotifications);
          setPage(1);
        } else if (isSilentRefresh) {
          // For silent refresh, only update if there are new notifications
          const existingIds = new Set(notifications.map(n => n.id));
          const truelyNew = newNotifications.filter(n => !existingIds.has(n.id));
          if (truelyNew.length > 0) {
            setNotifications([...truelyNew, ...notifications]);
          }
        } else {
          // For pagination
          setNotifications(prev => [...prev, ...newNotifications]);
          setPage(pageNum);
        }
        
        setUnreadCount(data.unreadCount || 0);
        setTotalCount(data.totalCount || 0);
        setHasMore(data.hasMore || false);
      } else {
        setError('Failed to fetch notifications');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      if (!isSilentRefresh) {
        setError('Failed to fetch notifications');
      }
    } finally {
      if (isInitial && !isSilentRefresh) {
        setLoading(false);
      } else if (!isSilentRefresh) {
        setLoadingMore(false);
      }
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const response = await fetch(`http://localhost:3001/api/notifications/${notificationId}/read`, {
        method: 'PUT'
      });
      
      const data = await response.json();
      if (data.success) {
        // Update local state instead of refetching
        setNotifications(prev => prev.map(n => 
          n.id === notificationId ? { ...n, is_read: true } : n
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));
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
        // Update local state
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
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
        // Update local state
        const deletedNotification = notifications.find(n => n.id === notificationId);
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        setTotalCount(prev => prev - 1);
        if (deletedNotification && !deletedNotification.is_read) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`http://localhost:3001/api/notifications/user/${user.id}/delete-all`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      if (data.success) {
        setNotifications([]);
        setUnreadCount(0);
        setTotalCount(0);
        setHasMore(false);
        setShowDeleteAllModal(false);
      }
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      setError('Failed to delete all notifications');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleNotificationClick = (notification) => {
    // Mark as read
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    console.log('📋 Notification clicked:', notification);

    // Handle password reset request notifications
    if (notification.type === 'password_reset_request') {
      if (onNavigate && notification.file_id) {
        console.log('🔑 Password reset request - Navigating to User Management');
        // Navigate to users tab with context to open password reset modal
        // Note: file_id is being reused to store the requesting user's ID
        onNavigate('users', {
          userId: notification.file_id,  // file_id contains the requesting user's ID
          action: 'reset-password',
          username: notification.action_by_username
        });
      }
      return;
    }

    // Navigate based on notification type
    if (notification.type === 'comment') {
      // For comments, open the task modal with the comment highlighted
      if (notification.assignment_id) {
        // Store the comment ID to highlight
        if (notification.comment_id) {
          setHighlightedCommentId(notification.comment_id);
        }
        
        // Navigate to tasks tab with assignment context
        if (onNavigate) {
          onNavigate('tasks', {
            assignmentId: notification.assignment_id,
            commentId: notification.comment_id,
            shouldOpenComments: true
          });
        }
      }
    } else if (notification.assignment_id) {
      // For other assignment-related notifications
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

  // Notification icon component using FileIcon
  const NotificationIcon = ({ type }) => {
    return (
      <FileIcon
        fileType={type}
        size="medium"
        altText={`${type} notification icon`}
        className="notification-type-icon"
      />
    );
  };

  const formatTimeAgo = useCallback((timestamp) => {
    const now = new Date();
    const created = new Date(timestamp);
    const diffInSeconds = Math.floor((now - created) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return created.toLocaleDateString();
  }, []);

  // Skeleton loader component
  const NotificationSkeleton = () => (
    <div className="notification-skeleton">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="notification-skeleton-item">
          <div className="skeleton-icon"></div>
          <div className="skeleton-content">
            <div className="skeleton-line skeleton-line-title"></div>
            <div className="skeleton-line skeleton-line-message"></div>
            <div className="skeleton-line skeleton-line-meta"></div>
          </div>
        </div>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="notifications-page">
        <div className="notifications-header">
          <div>
            <h2>Notifications</h2>
            <p className="notifications-subtitle">Stay updated with your file approvals and system messages</p>
          </div>
        </div>
        <NotificationSkeleton />
      </div>
    );
  }

  return (
    <div className={`notifications-page ${loading ? 'loading-cursor' : ''}`}>
      <div className="notifications-header">
        <div>
          <h2>Notifications</h2>
          <p className="notifications-subtitle">Stay updated with your file approvals and system messages</p>
        </div>
        <div className="notifications-actions">
          {unreadCount > 0 && (
            <button className="btn-mark-all-read" onClick={markAllAsRead}>
              Mark All as Read
            </button>
          )}
          {notifications.length > 0 && (
            <button className="btn-delete-all" onClick={() => setShowDeleteAllModal(true)}>
              Delete All
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="notifications-stats">
        {totalCount} total • {unreadCount} unread
      </div>

      {notifications.length === 0 ? (
        <div className="no-notifications">
          <div className="no-notifications-icon">🔔</div>
          <h3>No notifications</h3>
          <p>You're all caught up! Check back later for updates.</p>
        </div>
      ) : (
        <>
          <div className="notifications-list">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onNotificationClick={handleNotificationClick}
                onDeleteNotification={deleteNotification}
                NotificationIcon={NotificationIcon}
                formatTimeAgo={formatTimeAgo}
              />
            ))}
          </div>

          {/* Load More Skeleton */}
          {loadingMore && (
            <div className="notifications-loading-more">
              <div className="notification-skeleton-item">
                <div className="skeleton-icon"></div>
                <div className="skeleton-content">
                  <div className="skeleton-line skeleton-line-title"></div>
                  <div className="skeleton-line skeleton-line-message"></div>
                </div>
              </div>
              <div className="notification-skeleton-item">
                <div className="skeleton-icon"></div>
                <div className="skeleton-content">
                  <div className="skeleton-line skeleton-line-title"></div>
                  <div className="skeleton-line skeleton-line-message"></div>
                </div>
              </div>
            </div>
          )}

          {/* Infinite Scroll Trigger */}
          {hasMore && !loadingMore && (
            <div ref={loadMoreRef} className="load-more-trigger" />
          )}

          {/* End of List Message */}
          {!hasMore && notifications.length >= limit && (
            <div className="end-of-list">
              <p>You've reached the end of your notifications</p>
            </div>
          )}
        </>
      )}

      {/* Delete All Confirmation Modal */}
      {showDeleteAllModal && (
        <ConfirmationModal
          isOpen={showDeleteAllModal}
          onClose={() => setShowDeleteAllModal(false)}
          onConfirm={handleDeleteAll}
          title="Delete All Notifications"
          message="Are you sure you want to delete all notifications?"
          confirmText="Delete All"
          cancelText="Cancel"
          variant="danger"
          isLoading={isDeleting}
          itemInfo={{
            name: `${totalCount} notification${totalCount !== 1 ? 's' : ''}`,
            details: `Including ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
          }}
        >
          <p className="warning-text">
            This action cannot be undone. All notifications will be permanently removed from your account.
          </p>
        </ConfirmationModal>
      )}
    </div>
  );
};

export default withErrorBoundary(Notifications, {
  componentName: 'Notifications'
});
