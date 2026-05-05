import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '@/config/api';
import './Notifications.css';
import { useTaskbarFlash } from '../../utils/useTaskbarFlash';
import { parseNotification } from '../shared/SmartNavigation';
import { withErrorBoundary } from '../common';

// Sub-components
import NotificationHeader from './subcomponents/NotificationHeader';
import NotificationList from './subcomponents/NotificationList';
import NotificationModals from './subcomponents/NotificationModals';

const Notifications = ({ user, onNavigate, onRead }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Ref for infinite scroll
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);

  // Enable taskbar flashing for new notifications
  useTaskbarFlash(unreadCount);

  const fetchNotifications = useCallback(async (pageNum, isInitial = false, isSilentRefresh = false) => {
    try {
      if (isInitial && !isSilentRefresh) {
        setLoading(true);
      } else if (!isSilentRefresh) {
        setLoadingMore(true);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/notifications/user/${user.id}?page=${pageNum}&limit=${limit}`
      );
      const data = await response.json();

      if (data.success) {
        const newNotifications = data.notifications || [];

        if (isInitial) {
          setNotifications(newNotifications);
          setPage(1);
        } else if (isSilentRefresh) {
          const existingIds = new Set(notifications.map(n => n.id));
          const truelyNew = newNotifications.filter(n => !existingIds.has(n.id));
          if (truelyNew.length > 0) {
            setNotifications(prev => [...truelyNew, ...prev]);
          }
        } else {
          setNotifications(prev => [...prev, ...newNotifications]);
          setPage(pageNum);
        }

        setUnreadCount(data.unreadCount || 0);
        if ((data.unreadCount || 0) === 0) onRead?.();
        setTotalCount(data.totalCount || 0);
        setHasMore(data.hasMore || false);
      } else {
        setError('Failed to fetch notifications');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      if (!isSilentRefresh) setError('Failed to fetch notifications');
    } finally {
      if (isInitial && !isSilentRefresh) setLoading(false);
      else if (!isSilentRefresh) setLoadingMore(false);
    }
  }, [user.id, notifications, limit, onRead]);

  useEffect(() => {
    fetchNotifications(1, true);
    const interval = setInterval(() => {
      fetchNotifications(1, true, true);
    }, 30000);
    return () => clearInterval(interval);
  }, [user.id, fetchNotifications]);

  useEffect(() => {
    if (loading || loadingMore || !hasMore) return;

    const options = { root: null, rootMargin: '100px', threshold: 0.1 };
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        fetchNotifications(page + 1, false);
      }
    }, options);

    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [loading, loadingMore, hasMore, page, fetchNotifications]);

  const markAsRead = async (notificationId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
        method: 'PUT'
      });
      const data = await response.json();
      if (data.success) {
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
      const response = await fetch(`${API_BASE_URL}/api/notifications/user/${user.id}/read-all`, {
        method: 'PUT'
      });
      const data = await response.json();
      if (data.success) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
        onRead?.();
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
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
  };

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/user/${user.id}/delete-all`, {
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

  const handleNotificationClick = useCallback((notification) => {
    if (!notification.is_read) markAsRead(notification.id);
    const { targetTab, context } = parseNotification(notification, 'admin');
    if (targetTab && onNavigate) onNavigate(targetTab, context);
  }, [onNavigate]);

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

  if (loading) {
    return (
      <div className="notifications-page">
        <NotificationHeader notificationsCount={0} unreadCount={0} />
        <div className="notification-skeleton">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="notification-skeleton-item">
              <div className="skeleton-icon"></div>
              <div className="skeleton-content">
                <div className="skeleton-line skeleton-line-title"></div>
                <div className="skeleton-line skeleton-line-message"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`notifications-page ${loading ? 'loading-cursor' : ''}`}>
      <NotificationHeader
        unreadCount={unreadCount}
        notificationsCount={notifications.length}
        markAllAsRead={markAllAsRead}
        setShowDeleteAllModal={setShowDeleteAllModal}
      />

      {error && <div className="error-message">{error}</div>}

      <div className="notifications-stats">
        {totalCount} total • {unreadCount} unread
      </div>

      <NotificationList
        notifications={notifications}
        handleNotificationClick={handleNotificationClick}
        deleteNotification={deleteNotification}
        formatTimeAgo={formatTimeAgo}
        loadingMore={loadingMore}
        hasMore={hasMore}
        loadMoreRef={loadMoreRef}
        limit={limit}
      />

      <NotificationModals
        showDeleteAllModal={showDeleteAllModal}
        setShowDeleteAllModal={setShowDeleteAllModal}
        handleDeleteAll={handleDeleteAll}
        isDeleting={isDeleting}
        totalCount={totalCount}
        unreadCount={unreadCount}
      />
    </div>
  );
};

export default withErrorBoundary(Notifications, {
  componentName: 'Notifications'
});
