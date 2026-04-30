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
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <circle cx="8" cy="15" r="4"/>
            <path d="M10.85 12.15L19 4"/>
            <path d="M18 5l2 2"/>
            <path d="M15 8l2 2"/>
          </svg>
        )
      case 'password_reset_complete':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <circle cx="12" cy="12" r="9"/>
            <path d="M7 12l3.5 3.5 6.5-7"/>
          </svg>
        )
      case 'comment':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )
      case 'assignment':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="9" y1="13" x2="15" y2="13"/>
            <line x1="9" y1="17" x2="15" y2="17"/>
          </svg>
        )
      case 'approval':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <circle cx="12" cy="12" r="9"/>
            <path d="M7 12l3.5 3.5 6.5-7"/>
          </svg>
        )
      case 'rejection':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <circle cx="12" cy="12" r="9"/>
            <line x1="8" y1="8" x2="16" y2="16"/>
            <line x1="16" y1="8" x2="8" y2="16"/>
          </svg>
        )
      case 'final_approval':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22,4 12,14.01 9,11.01"/>
          </svg>
        )
      case 'final_rejection':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <circle cx="12" cy="12" r="9"/>
            <line x1="8" y1="8" x2="16" y2="16"/>
            <line x1="16" y1="8" x2="8" y2="16"/>
          </svg>
        )
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        )
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
              <span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="12" height="12" style={{marginRight: '4px', verticalAlign: 'middle'}}>
                  <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z"/>
                </svg>
                {notification.action_by_username}
              </span>
              {notification.assignment_title && (
                <span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" style={{marginRight: '4px', verticalAlign: 'middle'}}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                  </svg>
                  {notification.assignment_title}
                </span>
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
