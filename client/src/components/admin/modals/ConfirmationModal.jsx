import React from 'react'
import './ConfirmationModal.css'

/**
 * Reusable Confirmation Modal Component - Styled to match FileApproval design
 * 
 * @param {boolean} isOpen - Controls modal visibility
 * @param {function} onClose - Handler for closing the modal
 * @param {function} onConfirm - Handler for confirming the action
 * @param {string} title - Modal title
 * @param {string} message - Main message/question
 * @param {string} confirmText - Text for confirm button (default: "Confirm")
 * @param {string} cancelText - Text for cancel button (default: "Cancel")
 * @param {string} variant - Visual variant: 'danger', 'warning', 'info' (default: 'danger')
 * @param {boolean} isLoading - Shows loading state on confirm button
 * @param {object} itemInfo - Optional item info object (for file, user, etc.)
 * @param {ReactNode} children - Custom content to display in the modal body
 */
const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
  itemInfo,
  children
}) => {
  if (!isOpen) return null

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose()
    }
  }

  const handleConfirm = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isLoading) {
      onConfirm()
    }
  }

  const handleCancel = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isLoading) {
      onClose()
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
            type="button"
          >
            ×
          </button>
        </div>
        
        <div className="modal-body">
          <div className="delete-warning">
            <span className="warning-icon">⚠️</span>
            <div className="warning-content">
              <h4>{message}</h4>
              
              {/* Item info section (can be file, user, task, etc.) */}
              {itemInfo && (
                <div className="item-info">
                  {itemInfo.name && <div className="item-name">{itemInfo.name}</div>}
                  {itemInfo.details && <div className="item-details">{itemInfo.details}</div>}
                </div>
              )}
              
              {/* Custom children content */}
              {children}
              
              {/* Default warning text */}
              {!children && (
                <p className="warning-text">
                  This action cannot be undone. The file and all its associated data will be permanently removed.
                </p>
              )}
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <div className="delete-actions">
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
              {isLoading ? 'Deleting...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfirmationModal
