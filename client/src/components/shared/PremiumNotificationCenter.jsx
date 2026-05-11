import { useState, useEffect, useRef, useCallback, memo, useMemo, startTransition } from 'react';
import { apiFetch, API_BASE_URL } from '@/config/api';
import useStore from '@/store/useStore';
import {
  Bell,
  Trash2,
  CheckCheck,
  AlertCircle,
  MessageSquare,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  ArrowRight
} from 'lucide-react';
import { PremiumBadge, PremiumButton, MemberAvatar, PremiumModal, FileIcon } from '../shared';
import { parseNotification } from '../shared/SmartNavigation';
import { formatDate, formatTimeAgo, getInitials } from '../../utils/ui-helpers';
import './PremiumNotificationCenter.css';

const POLL_INTERVAL = 60000; // Reduced frequency — SSE handles real-time
const SSE_DEBOUNCE_MS = 5000; // Ignore rapid SSE pings within 5s
const FILE_DETAIL_TYPES = new Set(['approval', 'final_approval', 'rejection', 'final_rejection', 'comment']);

const NotificationItem = memo(({ notification, onClick, onDelete, formatTimeAgo, role }) => {
  const isUnread = !notification.is_read;

  const getIcon = () => {
    switch (notification.type) {
      case 'approval':
      case 'final_approval':
        return <CheckCircle2 className="notif-type-icon success" size={16} />;
      case 'rejection':
      case 'final_rejection':
        return <XCircle className="notif-type-icon danger" size={16} />;
      case 'comment':
      case 'mention':
        return <MessageSquare className="notif-type-icon info" size={16} />;
      case 'assignment':
        return <FileText className="notif-type-icon warning" size={16} />;
      default:
        return <Bell className="notif-type-icon secondary" size={16} />;
    }
  };

  return (
    <div
      className={`premium-notif-item ${isUnread ? 'unread' : ''}`}
      onClick={() => onClick(notification)}
    >
      <div className="notif-status-dot"></div>

      <div className="notif-icon-wrapper">
        <div className="notif-icon-bg">
          {getIcon()}
        </div>
      </div>

      <div className="notif-main-content">
        <div className="notif-header-row">
          <h4 className="notif-title">{notification.title}</h4>
          <span className="notif-time">{formatTimeAgo(notification.created_at)}</span>
        </div>

        <p className="notif-message">{notification.message}</p>

        <div className="notif-footer-meta">
          <div className="notif-author">
            <User size={12} />
            <span>{notification.action_by_username}</span>
          </div>

          {notification.assignment_title && (
            <div className="notif-context">
              <ArrowRight size={12} />
              <span title={notification.assignment_title}>{notification.assignment_title}</span>
            </div>
          )}
        </div>
      </div>

      <button
        className="notif-action-delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification.id, isUnread);
        }}
        title="Remove notification"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
});

NotificationItem.displayName = 'NotificationItem';

const PremiumNotificationCenter = ({ user, role, onNavigate, onUpdateUnreadCount }) => {
  // Optimized Selectors (prevents re-rendering when other store keys change)
  const notifications = useStore(state => state.serverNotifications);
  const setNotifications = useStore(state => state.setServerNotifications);
  const unreadCount = useStore(state => state.globalUnreadCount);
  const setUnreadCount = useStore(state => state.setGlobalUnreadCount);
  const page = useStore(state => state.notifPage);
  const hasMore = useStore(state => state.notifHasMore);
  const setNotifPagination = useStore(state => state.setNotifPagination);

  const [loading, setLoading] = useState(notifications.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const limit = 20;

  const onUpdateUnreadCountRef = useRef(onUpdateUnreadCount);
  useEffect(() => { onUpdateUnreadCountRef.current = onUpdateUnreadCount; }, [onUpdateUnreadCount]);

  const lastPingRef = useRef(0); // SSE debounce guard

  const fetchNotifications = useCallback(async (pageNum = 1, isSilent = false) => {
    try {
      const currentCacheSize = useStore.getState().serverNotifications.length;
      if (!isSilent && pageNum === 1 && currentCacheSize === 0) setLoading(true);
      if (!isSilent && pageNum > 1) setLoadingMore(true);

      const data = await apiFetch(`/api/notifications/user/${user.id}?page=${pageNum}&limit=${limit}`);

      if (data.success) {
        const newNotifs = data.notifications || [];

        if (pageNum === 1) {
          setNotifications(newNotifs);
          setNotifPagination(1, data.hasMore || false);
        } else {
          setNotifications(prev => {
            const existingIds = new Set(prev.map(n => n.id));
            const uniqueNew = newNotifs.filter(n => !existingIds.has(n.id));
            return [...prev, ...uniqueNew];
          });
          setNotifPagination(pageNum, data.hasMore || false);
        }

        const count = data.unreadCount || 0;
        setUnreadCount(count);
        if (onUpdateUnreadCountRef.current) onUpdateUnreadCountRef.current(count);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError('Could not sync notifications. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user.id, setNotifications, setUnreadCount, setNotifPagination]);

  // Initial Fetch & Polling
  useEffect(() => {
    fetchNotifications(1);
    const interval = setInterval(() => fetchNotifications(1, true), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // SSE for real-time updates
  useEffect(() => {
    let es;
    let reconnectTimer;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;
      const { token } = useStore.getState();
      es = new EventSource(`${API_BASE_URL}/api/notifications/user/${user.id}/stream${token ? `?token=${token}` : ''}`);

      es.onmessage = (event) => {
        if (event.data === 'ping') {
          const now = Date.now();
          if (now - lastPingRef.current < SSE_DEBOUNCE_MS) return;
          lastPingRef.current = now;
          fetchNotifications(1, true);
        }
      };

      es.onerror = () => {
        if (es) es.close();
        if (isMounted) {
          reconnectTimer = setTimeout(connect, 5000);
        }
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (es) es.close();
      clearTimeout(reconnectTimer);
    };
  }, [user.id, fetchNotifications]);

  const handleMarkAllRead = async () => {
    // Functional update prevents unnecessary capture of notifications array
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    if (onUpdateUnreadCountRef.current) onUpdateUnreadCountRef.current(0);

    try {
      const data = await apiFetch(`/api/notifications/user/${user.id}/read-all`, { method: 'PUT' });
      if (!data.success) throw new Error('Mark all read failed');
    } catch (err) {
      console.error('Error marking all as read:', err);
      // If fails, we re-fetch to sync with server instead of expensive manual rollbacks
      fetchNotifications(1, true);
    }
  };

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    setNotifications([]);
    setUnreadCount(0);
    setNotifPagination(1, false);
    setShowDeleteAllModal(false);
    if (onUpdateUnreadCountRef.current) onUpdateUnreadCountRef.current(0);

    try {
      const data = await apiFetch(`/api/notifications/user/${user.id}/delete-all`, { method: 'DELETE' });
      if (!data.success) throw new Error('Delete all failed');
    } catch (err) {
      console.error('Error deleting all notifications:', err);
      fetchNotifications(1, true);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleNotificationClick = useCallback(async (notification) => {
    const { targetTab, context } = parseNotification(notification, role || 'user');

    if (context) {
      if (context.assignmentId) sessionStorage.setItem('highlightAssignmentId', context.assignmentId.toString());
      if (context.fileId) sessionStorage.setItem('highlightFileId', context.fileId.toString());
      if (context.shouldOpenComments) sessionStorage.setItem('notificationContext', JSON.stringify(context));
    }

    if (targetTab && onNavigate) {
      onNavigate(targetTab, context);
    }

    if (!notification.is_read) {
      setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => {
        const next = Math.max(0, prev - 1);
        if (onUpdateUnreadCountRef.current) onUpdateUnreadCountRef.current(next);
        return next;
      });

      try {
        await apiFetch(`/api/notifications/${notification.id}/read`, { method: 'PUT' });
      } catch (err) {
        console.error('Error marking as read:', err);
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: false } : n));
        setUnreadCount(prev => {
          const next = prev + 1;
          if (onUpdateUnreadCountRef.current) onUpdateUnreadCountRef.current(next);
          return next;
        });
      }
    }
  }, [role, onNavigate, setNotifications, setUnreadCount]);

  const handleDeleteNotification = useCallback(async (id, wasUnread) => {
    // STABILIZED: Use functional update to remove dependency on 'notifications' array
    setNotifications(prev => prev.filter(n => n.id !== id));
    
    if (wasUnread) {
      setUnreadCount(prev => {
        const next = Math.max(0, prev - 1);
        if (onUpdateUnreadCountRef.current) onUpdateUnreadCountRef.current(next);
        return next;
      });
    }

    try {
      const data = await apiFetch(`/api/notifications/${id}`, { method: 'DELETE' });
      if (!data.success) throw new Error('Delete failed');
    } catch (err) {
      console.error('Error deleting notification:', err);
      // Sync back from server on error
      fetchNotifications(1, true);
    }
  }, [fetchNotifications, setNotifications, setUnreadCount]);

  // displayNotifs removed - using notifications directly is cleaner with memoized children

  return (
    <div className="premium-notif-center">
      <div className="notif-center-header">
        <div className="header-text">
          <h2>Notifications</h2>
          <p>Stay updated with your file approvals and messages</p>
        </div>

        <div className="header-actions">
          {unreadCount > 0 && (
            <PremiumButton
              variant="ghost"
              size="sm"
              icon={CheckCheck}
              onClick={handleMarkAllRead}
              className="action-btn"
            >
              Mark all read
            </PremiumButton>
          )}
          {notifications.length > 0 && (
            <PremiumButton
              variant="danger"
              size="md"
              icon={Trash2}
              onClick={() => setShowDeleteAllModal(true)}
            >
              Clear All
            </PremiumButton>
          )}
        </div>
      </div>

      <div className="notif-center-body">
        {loading && page === 1 ? (
          <div className="notif-skeleton-list">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="notif-skeleton-item">
                <div className="skeleton-circle"></div>
                <div className="skeleton-lines">
                  <div className="line long"></div>
                  <div className="line medium"></div>
                  <div className="line short"></div>
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="notif-empty-state">
            <div className="empty-icon-box">
              <Bell size={48} strokeWidth={1} />
            </div>
            <h3>All caught up!</h3>
            <p>You don't have any new notifications at the moment.</p>
          </div>
        ) : (
          <div className="notif-scroll-area">
            <div className="notif-list">
              {notifications.map(n => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onClick={handleNotificationClick}
                  onDelete={handleDeleteNotification}
                  formatTimeAgo={formatTimeAgo}
                  role={role}
                />
              ))}
            </div>

            {hasMore && (
              <div className="load-more-section">
                <PremiumButton
                  variant="outline"
                  size="sm"
                  loading={loadingMore}
                  onClick={() => fetchNotifications(page + 1)}
                >
                  Load older notifications
                </PremiumButton>
              </div>
            )}
          </div>
        )}
      </div>

      <PremiumModal
        isOpen={showDeleteAllModal}
        onClose={() => setShowDeleteAllModal(false)}
        title="Clear Notifications"
        variant="danger"
        footer={
          <>
            <PremiumButton variant="ghost" onClick={() => setShowDeleteAllModal(false)}>Cancel</PremiumButton>
            <PremiumButton variant="danger" onClick={handleDeleteAll} loading={isDeleting}>Clear All</PremiumButton>
          </>
        }
      >
        <div className="clear-all-warning">
          <AlertCircle size={32} />
          <p>This will permanently remove all <strong>{notifications.length}</strong> notifications from your history. This action cannot be undone.</p>
        </div>
      </PremiumModal>
    </div>
  );
};

export default PremiumNotificationCenter;
