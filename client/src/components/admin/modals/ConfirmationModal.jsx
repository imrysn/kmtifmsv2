import React from 'react'
import './ConfirmationModal.css'

/**
 * Reusable Confirmation Modal Component
 * 
 * @param {boolean} isOpen - Controls modal visibility
 * @param {function} onClose - Handler for closing the modal
 * @param {function} onConfirm - Handler for confirming the action
 * @param {string} title - Modal title
 * @param {string} message - Main message/question
 * @param {string} description - Additional description (optional)
 * @param {string} confirmText - Text for confirm button (default: "Confirm")
 * @param {string} cancelText - Text for cancel button (default: "Cancel")
 * @param {string} variant - Visual variant: 'danger', 'warning', 'info' (default: 'danger')
 * @param {boolean} isLoading - Shows loading state on confirm button
 */
const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
  children
}) => {
  if (!isOpen) return null

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleConfirm = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onConfirm()
  }

  const handleCancel = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onClose()
  }

  const getVariantIcon = () => {
    switch (variant) {
      case 'danger':
        return '⚠️'
      case 'warning':
        return '⚠️'
      case 'info':
        return 'ℹ️'
      default:
        return '⚠️'
    }
  }

  const getConfirmButtonClass = () => {
    switch (variant) {
      case 'danger':
        return 'btn-danger'
      case 'warning':
        return 'btn-warning'
      case 'info':
        return 'btn-primary'
      default:
        return 'btn-danger'
    }
  }

  return (
    <div 
      className="modal-overlay" 
      onClick={handleOverlayClick}
    >
      <div 
        className={`modal confirmation-modal ${variant}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button 
            onClick={handleCancel} 
            className="modal-close"
            disabled={isLoading}
          >
            ×
          </button>
        </div>
        
        <div className="modal-body">
          <div className="confirmation-content">
            <div className="confirmation-icon">
              {getVariantIcon()}
            </div>
            <div className="confirmation-text">
              <h4>{message}</h4>
              {description && (
                <p className="confirmation-description">{description}</p>
              )}
              {children}
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <div className="modal-actions">
            <button 
              type="button" 
              onClick={handleCancel} 
              className="btn btn-secondary"
              disabled={isLoading}
            >
              {cancelText}
            </button>
            <button 
              type="button" 
              onClick={handleConfirm}
              className={`btn ${getConfirmButtonClass()}`}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfirmationModal
