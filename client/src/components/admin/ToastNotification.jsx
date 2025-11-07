import { useEffect, useState } from 'react';
import './ToastNotification.css';

const ToastNotification = ({ notifications, onClose, onNavigate }) => {
  const [visible, setVisible] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());

  useEffect(() => {
    // Filter out dismissed notifications and only show unread ones
    const newNotifications = notifications
      .filter(n => !n.is_read && !dismissed.has(n.id))
      .slice(0, 3); // Show max 3 at a time

    setVisible(newNotifications);

    // Auto-dismiss after 8 seconds
    if (newNotifications.length > 0) {
      const timers = newNotifications.map(notification => 
        setTimeout(() => {
          handleDismiss(notification.id);
        }, 8000)
      );

      return () => timers.forEach(timer => clearTimeout(timer));
    }
  }, [notifications, dismissed]);

  const handleDismiss = (notificationId) => {
    setDismissed(prev => new Set([...prev, notificationId]));
    setVisible(prev => prev.filter(n => n.id !== notificationId));
  };

  const handleClick = (notification) => {
    if (onNavigate) {
      if (notification.assignment_id) {
        onNavigate('tasks', notification.assignment_id);
      } else if (notification.file_id) {
        if (notification.type === 'approval' || notification.type === 'rejection') {
          onNavigate('file-approval', notification.file_id);
        } else {
          onNavigate('file-management', notification.file_id);
        }
      }
    }
    handleDismiss(notification.id);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'comment':
        return '💬';
      case 'assignment':
        return '📋';
      case 'approval':
        return '✅';
      case 'rejection':
        return '❌';
      case 'final_approval':
        return '🎉';
      case 'final_rejection':
        return '🚫';
      default:
        return '🔔';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'comment':
        return 'blue';
      case 'assignment':
        return 'purple';
      case 'approval':
      case 'final_approval':
        return 'green';
      case 'rejection':
      case 'final_rejection':
        return 'red';
      default:
        return 'gray';
    }
  };

  if (visible.length === 0) return null;

  return (
    <div className="toast-container">
      {visible.map((notification, index) => (
        <div
          key={notification.id}
          className={`toast-notification toast-${getNotificationColor(notification.type)}`}
          style={{ animationDelay: `${index * 100}ms` }}
          onClick={() => handleClick(notification)}
        >
          <div className="toast-icon">
            {getNotificationIcon(notification.type)}
          </div>
          
          <div className="toast-content">
            <div className="toast-title">{notification.title}</div>
            <div className="toast-message">{notification.message}</div>
            <div className="toast-meta">
              <span>👤 {notification.action_by_username}</span>
              {notification.assignment_title && (
                <span>📋 {notification.assignment_title}</span>
              )}
            </div>
          </div>

          <button
            className="toast-close"
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss(notification.id);
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastNotification;
