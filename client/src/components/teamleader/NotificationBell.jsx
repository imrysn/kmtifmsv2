import { useState, useEffect, useRef } from 'react';
import { apiFetch, API_BASE_URL } from '@/config/api';
import './css/NotificationBell.css';
import { useTaskbarFlash } from '../../utils/useTaskbarFlash';

const NotificationBell = ({ userId, onNotificationClick }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [pulse, setPulse] = useState(false);
  const unreadCountRef = useRef(0);

  // Enable taskbar flashing for new notifications
  useTaskbarFlash(unreadCount);

  const fetchUnreadCount = async () => {
    try {
      const data = await apiFetch(`/api/notifications/user/${userId}/unread-count`);

      if (data.success) {
        const newCount = data.count || 0;
        if (newCount > unreadCountRef.current) {
          setPulse(true);
          setTimeout(() => setPulse(false), 1000);
        }
        unreadCountRef.current = newCount;
        setUnreadCount(newCount);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  useEffect(() => {
    if (!userId) return;

    fetchUnreadCount();

    // ── SSE: get instant ping when a notification is pushed ──────────────
    const token = (() => {
      try {
        // Zustand store keeps the token; read it from localStorage as fallback
        const raw = localStorage.getItem('kmti-auth') || localStorage.getItem('auth-storage');
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed?.state?.token || parsed?.token || null;
        }
      } catch (_) {}
      return null;
    })();

    let es;
    let retryTimeout;
    let retries = 0;

    const connectSSE = () => {
      const url = `${API_BASE_URL}/api/notifications/user/${userId}/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      es = new EventSource(url);

      es.onmessage = (e) => {
        if (e.data === 'ping') {
          // A new notification was pushed — refetch immediately
          fetchUnreadCount();
        }
      };

      es.onerror = () => {
        es.close();
        // Reconnect with exponential back-off (max 30s)
        const delay = Math.min(1000 * Math.pow(2, retries++), 30000);
        retryTimeout = setTimeout(connectSSE, delay);
      };

      es.onopen = () => { retries = 0; };
    };

    connectSSE();

    // ── Fallback polling every 30s (covers SSE gaps) ─────────────────────
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(retryTimeout);
      if (es) es.close();
    };
  }, [userId]);

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
