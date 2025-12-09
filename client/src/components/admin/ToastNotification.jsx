import { useEffect, useState } from 'react';
import './ToastNotification.css';
import { useManualTaskbarFlash } from '../../utils/useTaskbarFlash';

const ToastNotification = ({ notifications, onClose, onNavigate }) => {
  const [visible, setVisible] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());
  
  // Manual taskbar flash trigger
  const flashTaskbar = useManualTaskbarFlash({ duration: 8000 });

  useEffect(() => {
    // Filter out dismissed notifications and only show unread ones
    const newNotifications = notifications
      .filter(n => !n.is_read && !dismissed.has(n.id))
      .slice(0, 3); // Show max 3 at a time

    setVisible(newNotifications);

    // Flash taskbar when new toast notifications appear
    if (newNotifications.length > 0) {
      const message = newNotifications.length === 1 
        ? newNotifications[0].title 
        : `${newNotifications.length} New Notifications`;
      flashTaskbar(message);
    }

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
    console.log('👉 Admin Toast clicked:', notification);
    
    if (onNavigate) {
      // Handle password reset request notifications
      if (notification.type === 'password_reset_request' && notification.file_id) {
        console.log('🔑 Password reset request - Navigating to User Management');
        // Note: file_id is being reused to store the requesting user's ID
        onNavigate('users', {
          userId: notification.file_id,  // file_id contains the requesting user's ID
          action: 'reset-password',
          username: notification.action_by_username
        });
      }
      // Handle task/assignment notifications
      else if (notification.assignment_id) {
        console.log('📋 Navigating to tasks:', notification.assignment_id);
        onNavigate('tasks', notification.assignment_id);
      } 
      // Handle file-related notifications
      else if (notification.file_id) {
        // Approval/rejection notifications go to file-approval tab
        if (notification.type === 'approval' || 
            notification.type === 'rejection' ||
            notification.type === 'final_approval' ||
            notification.type === 'final_rejection') {
          console.log('✅ Navigating to file-approval:', notification.file_id);
          onNavigate('file-approval', notification.file_id);
        } 
        // Other file notifications go to file-management
        else {
          console.log('📁 Navigating to file-management:', notification.file_id);
          onNavigate('file-management', notification.file_id);
        }
      }
      else {
        console.log('⚠️ No specific target for notification');
      }
    }
    handleDismiss(notification.id);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'password_reset_request':
        return '🔑';
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
      case 'password_reset_request':
        return 'gray';
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
    <div className="toast-container cursor-pointer">
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
