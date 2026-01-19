import { useState, useEffect, useRef, useCallback, memo } from 'react';
import './css/NotificationTab.css';
import FileIcon from '../shared/FileIcon';
import { useTaskbarFlash } from '../../utils/useTaskbarFlash';

// Memoized notification item to prevent unnecessary re-renders
const NotificationItem = memo(({ notification, onNotificationClick, onDeleteNotification, NotificationIcon, formatTimeAgo }) => {
  return (
    <div
      className={`tl-notification-item ${!notification.is_read ? 'unread' : ''}`}
      onClick={() => onNotificationClick(notification)}
    >
      <div className="tl-notification-icon">
        <NotificationIcon type={notification.type} />
      </div>
      
      <div className="tl-notification-content">
        <div className="tl-notification-title">
          {notification.title}
          {!notification.is_read && <span className="tl-unread-badge">New</span>}
        </div>
        <div className="tl-notification-message">{notification.message}</div>
        
        <div className="tl-notification-meta">
          <span className="tl-notification-author">
            👤 {notification.action_by_username} ({notification.action_by_role})
          </span>
          {notification.assignment_title && (
            <span className="tl-notification-assignment">
              Assignment: {notification.assignment_title}
            </span>
          )}
          {notification.file_name && (
            <span className="tl-notification-file">
              {notification.file_name}
            </span>
          )}
          {notification.assignment_due_date && (
            <span className="tl-notification-due-date">
              Due: {new Date(notification.assignment_due_date).toLocaleDateString()}
            </span>
          )}
        </div>
        
        <div className="tl-notification-time">
          {formatTimeAgo(notification.created_at)}
        </div>
      </div>

      <button
        className="tl-notification-delete"
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

const NotificationTab = ({ user, onNavigate }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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

  const handleDeleteAll = () => {
    setShowDeleteModal(true);
  };

  const confirmDeleteAll = async () => {
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
        setShowDeleteModal(false);
      }
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      setError('Failed to delete all notifications');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleNotificationClick = (notification) => {
    console.log('🔔 Notification clicked:', notification);
    console.log('   Type:', notification.type);
    console.log('   Title:', notification.title);
    console.log('   Assignment ID:', notification.assignment_id);
    
    // Mark as read
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    // Detect if this is a reply notification by title
    const isReplyNotification = notification.title === 'New Reply on Assignment';
    console.log('   Is Reply Notification:', isReplyNotification);

    // Navigate based on notification type
    if (notification.type === 'comment' || isReplyNotification) {
      // For comment/reply notifications, navigate to assignments with comment context
      console.log('   → Navigating to assignments with comment context');
      if (notification.assignment_id) {
        const navigationData = {
          assignmentId: notification.assignment_id,
          shouldOpenComments: true,
          expandAllReplies: isReplyNotification  // Auto-expand replies for reply notifications
        };
        console.log('   📤 Sending navigation data:', navigationData);
        
        if (onNavigate) {
          onNavigate('assignments', navigationData);
        } else {
          console.error('   ❌ onNavigate function not provided!');
        }
      } else {
        console.error('   ❌ No assignment_id found in notification!');
      }
    } else if (notification.type === 'submission' || notification.type === 'file_uploaded' || notification.type === 'assignment') {
      // For submitted file notifications - use "Go to Task" behavior
      console.log('   → Navigating to assignments (Go to Task behavior)');
      if (notification.assignment_id) {
        if (onNavigate) {
          onNavigate('assignments', {
            assignmentId: notification.assignment_id,
            fileId: notification.file_id || null,  // Pass file_id if available
            shouldOpenComments: false,
            fromFileSubmission: true
          });
        } else {
          console.error('   ❌ onNavigate function not provided!');
        }
      } else {
        console.error('   ❌ No assignment_id found in notification!');
      }
    } else if (notification.type === 'approval' || notification.type === 'rejection' || notification.type === 'final_approval' || notification.type === 'final_rejection') {
      // For file approval/rejection notifications, navigate to file collection
      console.log('   → Navigating to file collection');
      if (notification.file_id) {
        if (onNavigate) {
          onNavigate('file-collection', {
            fileId: notification.file_id
          });
        }
      } else {
        console.error('   ❌ No file_id found in notification!');
      }
    } else if (!notification.type || notification.type === '') {
      // Handle case where type is empty or missing
      // If we have both file_id and assignment_id, it's likely a file submission
      console.log('   ⚠️ Empty notification type, checking IDs...');
      if (notification.file_id && notification.assignment_id) {
        console.log('   → Has both file_id and assignment_id, treating as file submission');
        console.log('   → Navigating to assignments (Go to Task behavior)');
        if (onNavigate) {
          onNavigate('assignments', {
            assignmentId: notification.assignment_id,
            fileId: notification.file_id,  // Pass file_id to highlight specific file
            shouldOpenComments: false,
            fromFileSubmission: true
          });
        }
      } else if (notification.assignment_id) {
        // Just assignment_id, navigate to assignment
        console.log('   → Has assignment_id only, navigating to assignments');
        if (onNavigate) {
          onNavigate('assignments', {
            assignmentId: notification.assignment_id,
            shouldOpenComments: false
          });
        }
      } else if (notification.file_id) {
        // Just file_id, navigate to file collection
        console.log('   → Has file_id only, navigating to file collection');
        if (onNavigate) {
          onNavigate('file-collection', {
            fileId: notification.file_id
          });
        }
      } else {
        console.error('   ❌ Empty type and no valid IDs found!');
      }
    } else {
      console.warn('   ⚠️ Unknown notification type:', notification.type);
    }
  };

  // Notification icon component using FileIcon
  const NotificationIcon = ({ type }) => {
    return (
      <FileIcon
        fileType={type}
        size="medium"
        altText={`${type} notification icon`}
        className="tl-notification-type-icon"
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
    <div className="tl-notification-skeleton">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="tl-notification-skeleton-item">
          <div className="tl-skeleton-icon"></div>
          <div className="tl-skeleton-content">
            <div className="tl-skeleton-line tl-skeleton-line-title"></div>
            <div className="tl-skeleton-line tl-skeleton-line-message"></div>
            <div className="tl-skeleton-line tl-skeleton-line-meta"></div>
          </div>
        </div>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="tl-notifications-page">
        <div className="tl-notifications-header">
          <div>
            <h2>Notifications</h2>
            <p className="tl-notifications-subtitle">Stay updated with your file approvals and system messages</p>
          </div>
        </div>
        <NotificationSkeleton />
      </div>
    );
  }

  return (
    <div className={`tl-notifications-page ${loading ? 'loading-cursor' : ''}`}>
      <div className="tl-notifications-header">
        <div>
          <h2>Notifications</h2>
          <p className="tl-notifications-subtitle">Stay updated with your file approvals and system messages</p>
        </div>
        <div className="tl-notifications-actions">
          {unreadCount > 0 && (
            <button className="tl-btn-mark-all-read" onClick={markAllAsRead}>
              Mark All as Read
            </button>
          )}
          {notifications.length > 0 && (
            <button className="tl-btn-delete-all" onClick={handleDeleteAll}>
              Delete All
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="tl-error-message">{error}</div>
      )}

      <div className="tl-notifications-stats">
        {totalCount} total • {unreadCount} unread
      </div>

      {notifications.length === 0 ? (
        <div className="tl-no-notifications">
          <div className="tl-no-notifications-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </div>
          <h3>No notifications</h3>
          <p>You're all caught up! Check back later for updates.</p>
        </div>
      ) : (
        <>
          <div className="tl-notifications-list">
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
            <div className="tl-notifications-loading-more">
              <div className="tl-notification-skeleton-item">
                <div className="tl-skeleton-icon"></div>
                <div className="tl-skeleton-content">
                  <div className="tl-skeleton-line tl-skeleton-line-title"></div>
                  <div className="tl-skeleton-line tl-skeleton-line-message"></div>
                </div>
              </div>
              <div className="tl-notification-skeleton-item">
                <div className="tl-skeleton-icon"></div>
                <div className="tl-skeleton-content">
                  <div className="tl-skeleton-line tl-skeleton-line-title"></div>
                  <div className="tl-skeleton-line tl-skeleton-line-message"></div>
                </div>
              </div>
            </div>
          )}

          {/* Infinite Scroll Trigger */}
          {hasMore && !loadingMore && (
            <div ref={loadMoreRef} className="tl-load-more-trigger" />
          )}

          {/* End of List Message */}
          {!hasMore && notifications.length >= limit && (
            <div className="tl-end-of-list">
              <p>You've reached the end of your notifications</p>
            </div>
          )}
        </>
      )}

      {/* Delete All Confirmation Modal */}
      {showDeleteModal && (
        <div className="custom-modal-overlay" onClick={() => !isDeleting && setShowDeleteModal(false)}>
          <div className="custom-modal" onClick={(e) => e.stopPropagation()}>
            <div className="custom-modal-header">
              <h3>Delete All Notifications?</h3>
              <button 
                onClick={() => setShowDeleteModal(false)} 
                className="custom-modal-close"
                disabled={isDeleting}
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
                    <div className="item-name">{totalCount} notification{totalCount !== 1 ? 's' : ''}</div>
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
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={confirmDeleteAll}
                  className="modal-confirm-btn"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete All'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationTab;
