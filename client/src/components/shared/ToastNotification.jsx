import { useEffect, useState, useCallback } from 'react'
import './ToastNotification.css'
import { useManualTaskbarFlash } from '../../utils/useTaskbarFlash'

/**
 * Unified Toast Notification Component
 * Merged from admin and user versions with best features from both
 * 
 * @param {Array} notifications - Array of notification objects
 * @param {function} onClose - Close handler
 * @param {function} onNavigate - Navigation handler (role, data)
 * @param {number} duration - Auto-dismiss duration in ms (default: 5000)
 * @param {string} role - User role ('admin', 'user', 'teamleader')
 */
const ToastNotification = ({
  notifications,
  onClose,
  onNavigate,
  duration = 5000,
  role = 'user'
}) => {
  const [visible, setVisible] = useState([])
  const [dismissed, setDismissed] = useState(new Set())

  // Manual taskbar flash trigger
  const flashTaskbar = useManualTaskbarFlash({ duration })

  useEffect(() => {
    // Filter out dismissed notifications and only show unread ones
    const newNotifications = notifications
      .filter(n => !n.is_read && !dismissed.has(n.id))
      .slice(0, 3) // Show max 3 at a time

    setVisible(newNotifications)

    // Flash taskbar when new toast notifications appear
    if (newNotifications.length > 0) {
      const message = newNotifications.length === 1
        ? newNotifications[0].title
        : `${newNotifications.length} New Notifications`
      flashTaskbar(message)
    }

    // Auto-dismiss after duration
    if (newNotifications.length > 0) {
      const timers = newNotifications.map(notification =>
        setTimeout(() => {
          handleDismiss(notification.id)
        }, duration)
      )

      return () => timers.forEach(timer => clearTimeout(timer))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications, dismissed, duration])

  const handleDismiss = useCallback((notificationId) => {
    setDismissed(prev => new Set([...prev, notificationId]))
    setVisible(prev => prev.filter(n => n.id !== notificationId))
  }, [])

  const handleClick = useCallback((notification) => {
    console.log(`👉 ${role} Toast clicked:`, notification)

    if (onNavigate) {
      // Admin-specific navigation
      if (role === 'admin') {
        // Handle password reset request notifications
        if (notification.type === 'password_reset_request') {
          console.log('🔑 Password reset request - Navigating to User Management')
          onNavigate('users', {
            userId: notification.action_by_id,  // Use action_by_id (requesting user's ID)
            action: 'reset-password',
            username: notification.action_by_username
          })
        }
        // Handle task/assignment notifications
        else if (notification.assignment_id) {
          console.log('📋 Navigating to tasks:', notification.assignment_id)
          onNavigate('tasks', notification.assignment_id)
        }
        // Handle file-related notifications
        else if (notification.file_id) {
          if (notification.type === 'approval' ||
            notification.type === 'rejection' ||
            notification.type === 'final_approval' ||
            notification.type === 'final_rejection') {
            console.log('✅ Navigating to file-approval:', notification.file_id)
            onNavigate('file-approval', notification.file_id)
          } else {
            console.log('📁 Navigating to file-management:', notification.file_id)
            onNavigate('file-management', notification.file_id)
          }
        }
      }

      // User-specific navigation
      else if (role === 'user') {
        if (notification.type === 'comment' && notification.assignment_id) {
          // For comment notifications, navigate to tasks and highlight the comment
          if (notification.action_by_username) {
            sessionStorage.setItem('highlightCommentBy', notification.action_by_username)
          }
          onNavigate('tasks', notification.assignment_id)
        }
        else if (notification.type === 'assignment' && notification.assignment_id) {
          onNavigate('tasks', notification.assignment_id)
        }
        else if (
          (notification.type === 'approval' ||
            notification.type === 'rejection' ||
            notification.type === 'final_approval' ||
            notification.type === 'final_rejection') &&
          notification.file_id
        ) {
          onNavigate('my-files', notification.file_id)
        }
        else if (notification.file_id) {
          onNavigate('my-files', notification.file_id)
        }
      }

      // Team Leader-specific navigation
      else if (role === 'teamleader') {
        if (notification.assignment_id) {
          onNavigate('assignments', notification.assignment_id)
        } else if (notification.file_id) {
          onNavigate('file-collection', notification.file_id)
        }
      }
    }

    handleDismiss(notification.id)
  }, [onNavigate, handleDismiss, role])

  const getNotificationIcon = useCallback((type) => {
    switch (type) {
      case 'password_reset_request':
        return '🔑'
      case 'password_reset_complete':
        return '✅'
      case 'comment':
        return '💬'
      case 'assignment':
        return '📋'
      case 'approval':
        return '✅'
      case 'rejection':
        return '❌'
      case 'final_approval':
        return '🎉'
      case 'final_rejection':
        return '🚫'
      default:
        return '🔔'
    }
  }, [])

  const getNotificationColor = useCallback((type) => {
    switch (type) {
      case 'password_reset_request':
        return 'gray'
      case 'password_reset_complete':
        return 'green'
      case 'comment':
        return 'blue'
      case 'assignment':
        return 'purple'
      case 'approval':
      case 'final_approval':
        return 'green'
      case 'rejection':
      case 'final_rejection':
        return 'red'
      default:
        return 'gray'
    }
  }, [])

  if (visible.length === 0) return null

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
              e.stopPropagation()
              handleDismiss(notification.id)
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

export default ToastNotification
