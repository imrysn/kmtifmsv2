import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { apiFetch, API_BASE_URL } from '@/config/api';
import useStore from '@/store/useStore';
import './Notifications.css';
import FileIcon from '../shared/FileIcon';
import { useTaskbarFlash } from '../../utils/useTaskbarFlash';
import { parseNotification } from '../shared/SmartNavigation';
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="13" height="13" style={{marginRight: '4px', verticalAlign: 'middle', flexShrink: 0}}>
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
            </svg>
            {notification.action_by_username} ({notification.action_by_role})
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

const Notifications = ({ user, onNavigate, onRead }) => {
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

  // Keep latest notifications in a ref so SSE/poll closures never see stale state
  const notificationsRef = useRef([]);
  useEffect(() => { notificationsRef.current = notifications; }, [notifications]);

  // ── Core fetch — useCallback so it's stable and safe in effect deps ──────
  const fetchNotifications = useCallback(async (pageNum, isInitial = false, isSilentRefresh = false) => {
    try {
      if (isInitial && !isSilentRefresh) setLoading(true);
      else if (!isSilentRefresh) setLoadingMore(true);

      const data = await apiFetch(`/api/notifications/user/${user.id}?page=${pageNum}&limit=${limit}`);

      if (data.success) {
        const incoming = data.notifications || [];

        if (isSilentRefresh) {
          // Read from ref to avoid stale closure
          const existingIds = new Set(notificationsRef.current.map(n => n.id));
          const brandNew = incoming.filter(n => !existingIds.has(n.id));
          if (brandNew.length > 0) setNotifications(prev => [...brandNew, ...prev]);
        } else if (isInitial) {
          setNotifications(incoming);
          setPage(1);
        } else {
          setNotifications(prev => [...prev, ...incoming]);
          setPage(pageNum);
        }

        setUnreadCount(data.unreadCount || 0);
        if ((data.unreadCount || 0) === 0) onRead?.();
        setTotalCount(data.totalCount || 0);
        setHasMore(data.hasMore || false);
      } else {
        if (!isSilentRefresh) setError('Failed to fetch notifications');
      }
    } catch (err) {
      console.error('Error fetching admin notifications:', err);
      if (!isSilentRefresh) setError('Failed to fetch notifications');
    } finally {
      if (isInitial && !isSilentRefresh) setLoading(false);
      else if (!isSilentRefresh) setLoadingMore(false);
    }
  }, [user.id, onRead]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Initial load + 30s fallback poll ─────────────────────────────────────
  useEffect(() => {
    fetchNotifications(1, true);
    const interval = setInterval(() => fetchNotifications(1, true, true), 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // ── SSE — instant push the moment a notification is created ──────────────
  useEffect(() => {
    let es;
    let reconnectTimer;

    const connect = () => {
      const { token } = useStore.getState();
      const url = `${API_BASE_URL}/api/notifications/user/${user.id}/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      es = new EventSource(url);

      es.onmessage = (event) => {
        if (event.data === 'ping') fetchNotifications(1, true, true);
      };

      es.onerror = () => {
        es.close();
        reconnectTimer = setTimeout(connect, 5000);
      };
    };

    connect();
    return () => {
      if (es) es.close();
      clearTimeout(reconnectTimer);
    };
  }, [user.id, fetchNotifications]);

  // ── Infinite scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || loadingMore || !hasMore) return;

    const options = { root: null, rootMargin: '100px', threshold: 0.1 };
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        fetchNotifications(page + 1, false);
      }
    }, options);

    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => { if (observerRef.current) observerRef.current.disconnect(); };
  }, [loading, loadingMore, hasMore, page, fetchNotifications]);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      const data = await apiFetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT'
      });
      if (data.success) {
        setNotifications(prev => prev.map(n =>
          n.id === notificationId ? { ...n, is_read: true } : n
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/notifications/user/${user.id}/read-all`, {
        method: 'PUT'
      });
      if (data.success) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
        onRead?.();
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [user.id, onRead]);

  const deleteNotification = useCallback(async (notificationId) => {
    try {
      const data = await apiFetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE'
      });
      if (data.success) {
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
  }, [notifications]);

  const handleDeleteAll = useCallback(async () => {
    setIsDeleting(true);
    try {
      const data = await apiFetch(`/api/notifications/user/${user.id}/delete-all`, {
        method: 'DELETE'
      });
      if (data.success) {
        setNotifications([]);
        setUnreadCount(0);
        setTotalCount(0);
        setHasMore(false);
        setShowDeleteAllModal(false);
        onRead?.();
      }
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      setError('Failed to delete all notifications');
    } finally {
      setIsDeleting(false);
    }
  }, [user.id, onRead]);

  const handleNotificationClick = useCallback((notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    const { targetTab, context } = parseNotification(notification, 'admin');

    if (targetTab && onNavigate) {
      onNavigate(targetTab, context);
    } else {
      console.warn('Unable to navigate - no target tab determined for type:', notification.type);
    }
  }, [markAsRead, onNavigate]);

  // Notification icon component using FileIcon
  const NotificationIcon = useCallback(({ type }) => (
    <FileIcon
      fileType={type}
      size="medium"
      altText={`${type} notification icon`}
      className="notification-type-icon"
    />
  ), []);

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
    <div className="notifications-page">
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
          <div className="no-notifications-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="56" height="56">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
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

          {hasMore && !loadingMore && (
            <div ref={loadMoreRef} className="load-more-trigger" />
          )}

          {!hasMore && notifications.length >= limit && (
            <div className="end-of-list">
              <p>You've reached the end of your notifications</p>
            </div>
          )}
        </>
      )}

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
