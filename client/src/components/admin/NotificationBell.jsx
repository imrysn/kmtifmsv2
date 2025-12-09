import { useState, useEffect } from 'react';
import './NotificationBell.css';
import { useTaskbarFlash } from '../../utils/useTaskbarFlash';

const NotificationBell = ({ userId, onNotificationClick }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [pulse, setPulse] = useState(false);

  // Enable taskbar flashing for new notifications
  useTaskbarFlash(unreadCount, {
    enabled: true,
    pageTitle: 'KMTI FMS - Admin Dashboard'
  });

  useEffect(() => {
    fetchUnreadCount();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/notifications/user/${userId}/unread-count`);
      const data = await response.json();
      
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
      className={`notification-bell ${pulse ? 'pulse' : ''}`}
      onClick={onNotificationClick}
      title="Notifications"
    >
      <span className="bell-icon">🔔</span>
      {unreadCount > 0 && (
        <span className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
      )}
    </button>
  );
};

export default NotificationBell;
