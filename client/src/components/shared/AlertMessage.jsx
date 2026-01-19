import React, { useEffect } from 'react'
import './AlertMessage.css'

/**
 * Reusable Alert Message Component
 * 
 * @param {string} type - Alert type: 'success', 'error', 'warning', 'info'
 * @param {string} message - Alert message to display
 * @param {function} onClose - Handler for closing the alert
 * @param {number} autoCloseDelay - Auto-close delay in ms (default: 3000, 0 to disable)
 */
const AlertMessage = ({
  type = 'info',
  message,
  onClose,
  autoCloseDelay = 3000
}) => {
  useEffect(() => {
    if (autoCloseDelay > 0 && onClose) {
      const timer = setTimeout(() => {
        onClose()
      }, autoCloseDelay)
      
      return () => clearTimeout(timer)
    }
  }, [autoCloseDelay, onClose])

  if (!message) return null

  const getAlertClass = () => {
    switch (type) {
      case 'success':
        return 'alert-success'
      case 'error':
        return 'alert-error'
      case 'warning':
        return 'alert-warning'
      case 'info':
        return 'alert-info'
      default:
        return 'alert-info'
    }
  }

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M16.875 5L7.5 14.375L3.125 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )
      case 'error':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )
      case 'warning':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 6V11M10 14H10.01M19 10C19 14.9706 14.9706 19 10 19C5.02944 19 1 14.9706 1 10C1 5.02944 5.02944 1 10 1C14.9706 1 19 5.02944 19 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )
      case 'info':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 9V14M10 6H10.01M19 10C19 14.9706 14.9706 19 10 19C5.02944 19 1 14.9706 1 10C1 5.02944 5.02944 1 10 1C14.9706 1 19 5.02944 19 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <div className="alert-message-component">
      <div className={`alert ${getAlertClass()} message-fade`}>
      <div className="alert-content">
        <span className="alert-icon">
          {getIcon()}
        </span>
        <span className="alert-message">{message}</span>
      </div>
      {onClose && (
        <button onClick={onClose} className="alert-close">
          ×
        </button>
      )}
      </div>
    </div>
  )
}

export default AlertMessage
