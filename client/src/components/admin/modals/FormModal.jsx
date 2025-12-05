import React from 'react'
import './FormModal.css'

/**
 * Reusable Form Modal Component
 * 
 * @param {boolean} isOpen - Controls modal visibility
 * @param {function} onClose - Handler for closing the modal
 * @param {function} onSubmit - Handler for form submission
 * @param {string} title - Modal title
 * @param {string} submitText - Text for submit button (default: "Submit")
 * @param {string} cancelText - Text for cancel button (default: "Cancel")
 * @param {boolean} isLoading - Shows loading state on submit button
 * @param {string} size - Modal size: 'small', 'medium', 'large' (default: 'medium')
 * @param {ReactNode} children - Form content
 */
const FormModal = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  submitText = 'Submit',
  cancelText = 'Cancel',
  isLoading = false,
  size = 'medium',
  children
}) => {
  if (!isOpen) return null

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose()
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (onSubmit) {
      onSubmit(e)
    }
  }

  const getSizeClass = () => {
    switch (size) {
      case 'small':
        return 'modal-small'
      case 'large':
        return 'modal-large'
      default:
        return 'modal-medium'
    }
  }

  return (
    <div 
      className="modal-overlay" 
      onClick={handleOverlayClick}
    >
      <div 
        className={`modal form-modal ${getSizeClass()}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button 
            onClick={onClose} 
            className="modal-close"
            type="button"
            disabled={isLoading}
          >
            ×
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {children}
          </div>
          
          <div className="modal-footer">
            <button 
              type="button" 
              onClick={onClose} 
              className="btn btn-secondary"
              disabled={isLoading}
            >
              {cancelText}
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : submitText}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default FormModal
