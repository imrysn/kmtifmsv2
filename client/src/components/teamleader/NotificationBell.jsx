import { useState, useEffect } from 'react';
import { apiFetch } from '@/config/api';
import './css/NotificationBell.css';
import { useTaskbarFlash } from '../../utils/useTaskbarFlash';

const NotificationBell = ({ userId, onNotificationClick }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [pulse, setPulse] = useState(false);

  // Enable taskbar flashing for new notifications
  useTaskbarFlash(unreadCount);

  useEffect(() => {
    fetchUnreadCount();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  const fetchUnreadCount = async () => {
    try {
      const data = await apiFetch(`/api/notifications/user/${userId}/unread-count`);

      if (data.success) {
        const newCount = data.count || 0;
        if (newCount > unreadCount) {
          setPulse(true);
          setTimeout(() => setPulse(false), 1000);
        }
        setUnreadCount(newCount);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  return (
    <button
      className={`tl-notification-bell ${pulse ? 'pulse' : ''}`}
      onClick={onNotificationClick}
      title="Notifications"
    >
      <span className="tl-bell-icon">🔔</span>
      {unreadCount > 0 && (
        <span className="tl-unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
      )}
    </button>
  );
};

export default NotificationBell;
