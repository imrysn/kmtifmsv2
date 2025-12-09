import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import './css/NotificationTab.css';
import { LoadingCards } from '../common/InlineSkeletonLoader';
import FileIcon from '../admin/FileIcon';

// Memoized notification card component to prevent unnecessary re-renders
const NotificationCard = memo(({ notification, onNotificationClick, onDelete, getNotificationIcon, getNotificationColor, formatTimeAgo }) => {
  return (
    <div 
      className={`notification-card ${getNotificationColor(notification.type)} ${!notification.is_read ? 'unread' : ''}`}
      onClick={() => onNotificationClick(notification)}
    >
      <div className="notification-icon">
        {getNotificationIcon(notification.type)}
      </div>
      <div className="notification-content">
        <div className="notification-header">
          <h4 className="notification-title">{notification.title}</h4>
          <button
            className="delete-notification-btn"
            onClick={(e) => onDelete(notification.id, e)}
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
  );
});

NotificationCard.displayName = 'NotificationCard';

const NotificationTab = ({ user, onNavigateToTask }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const containerRef = useRef(null);
  const ITEM_HEIGHT = 120; // Approximate height of each notification card
  const BUFFER_SIZE = 5; // Extra items to render above/below viewport

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(
        `http://localhost:3001/api/notifications/user/${user.id}`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      } else {
        console.warn('Failed to fetch notifications:', data.message);
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Notification fetch timeout');
      } else {
        console.error('Error fetching notifications:', error);
      }
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user?.id]);

  // Virtual scrolling handler for Electron performance
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const scrollTop = containerRef.current.scrollTop;
    const viewportHeight = containerRef.current.clientHeight;
    
    const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
    const endIndex = Math.min(
      notifications.length,
      Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + BUFFER_SIZE
    );
    
    setVisibleRange({ start: startIndex, end: endIndex });
  }, [notifications.length, ITEM_HEIGHT, BUFFER_SIZE]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    // Throttle scroll events for better performance
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };
    
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [handleScroll]);

  // Calculate visible notifications
  const visibleNotifications = useMemo(() => {
    return notifications.slice(visibleRange.start, visibleRange.end);
  }, [notifications, visibleRange]);

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
    }
  }, [fetchNotifications, user?.id]);

  const markAsRead = useCallback(async (notificationId) => {
    // Optimistic update - update UI immediately
    const notificationToUpdate = notifications.find(n => n.id === notificationId);
    if (notificationToUpdate?.is_read) return; // Already read
    
    setNotifications(prevNotifications =>
      prevNotifications.map(n =>
        n.id === notificationId ? { ...n, is_read: true } : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    // Then update server in background
    try {
      const response = await fetch(`http://localhost:3001/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        // Revert on error
        setNotifications(prevNotifications =>
          prevNotifications.map(n =>
            n.id === notificationId ? { ...n, is_read: false } : n
          )
        );
        setUnreadCount(prev => prev + 1);
        throw new Error('Failed to mark as read');
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [notifications]);

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;
    
    // Optimistic update
    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;
    
    setNotifications(prevNotifications =>
      prevNotifications.map(n => ({ ...n, is_read: true }))
    );
    setUnreadCount(0);
    
    // Update server in background
    try {
      const response = await fetch(`http://localhost:3001/api/notifications/user/${user.id}/read-all`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        // Revert on error
        setNotifications(previousNotifications);
        setUnreadCount(previousUnreadCount);
        throw new Error('Failed to mark all as read');
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [user?.id, notifications, unreadCount]);

  const deleteNotification = useCallback(async (notificationId, e) => {
    e.stopPropagation();
    
    // Optimistic update
    const deletedNotif = notifications.find(n => n.id === notificationId);
    const previousNotifications = notifications;
    
    setNotifications(prevNotifications => 
      prevNotifications.filter(n => n.id !== notificationId)
    );
    
    if (deletedNotif && !deletedNotif.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    
    // Delete from server in background
    try {
      const response = await fetch(`http://localhost:3001/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        // Revert on error
        setNotifications(previousNotifications);
        if (deletedNotif && !deletedNotif.is_read) {
          setUnreadCount(prev => prev + 1);
        }
        throw new Error('Failed to delete notification');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [notifications]);

  const handleNotificationClick = useCallback(async (notification) => {
    // Mark as read (non-blocking)
    if (!notification.is_read) {
      markAsRead(notification.id); // Don't await - let it run in background
    }

    // Handle navigation based on notification type
    if (notification.type === 'comment' && notification.assignment_id) {
      // Store the username of who commented/replied for highlighting
      if (notification.action_by_username) {
        sessionStorage.setItem('highlightCommentBy', notification.action_by_username);
      }
      
      // Navigate to tasks tab and scroll to comments section
      if (onNavigateToTask) {
        onNavigateToTask(notification.assignment_id);
      }
    } else if (notification.type === 'assignment' && notification.assignment_id) {
      // Navigate to tasks tab
      if (onNavigateToTask) {
        onNavigateToTask(notification.assignment_id);
      }
    }
  }, [markAsRead, onNavigateToTask]);

  const getNotificationIcon = useCallback((type) => {
    return (
      <FileIcon
        fileType={type}
        size="medium"
        altText={`${type} notification icon`}
        className="notification-type-icon"
      />
    );
  }, []);

  const getNotificationColor = useMemo(() => {
    return (type) => {
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
  }, []);

  const formatTimeAgo = useMemo(() => {
    return (dateString) => {
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
  }, []);

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

      <div className="notifications-container" ref={containerRef}>
        {notifications.length > 0 ? (
          <div className="notifications-list">
            {/* Spacer for items before visible range */}
            <div style={{ height: `${visibleRange.start * ITEM_HEIGHT}px` }} />
            
            {visibleNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onNotificationClick={handleNotificationClick}
                onDelete={deleteNotification}
                getNotificationIcon={getNotificationIcon}
                getNotificationColor={getNotificationColor}
                formatTimeAgo={formatTimeAgo}
              />
            ))}
            
            {/* Spacer for items after visible range */}
            <div style={{ height: `${(notifications.length - visibleRange.end) * ITEM_HEIGHT}px` }} />
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
