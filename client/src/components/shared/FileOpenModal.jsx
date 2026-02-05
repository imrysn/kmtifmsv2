import React, { useEffect } from 'react'
import './FileOpenModal.css'

/**
 * File Open Confirmation Modal Component
 * Clean and minimal UI for confirming file opening
 * 
 * @param {boolean} isOpen - Controls modal visibility
 * @param {function} onClose - Handler for closing the modal
 * @param {function} onConfirm - Handler for confirming file open
 * @param {object} file - File object with original_name
 * @param {boolean} isLoading - Shows loading state
 */
const FileOpenModal = ({
    isOpen,
    onClose,
    onConfirm,
    file,
    isLoading = false
}) => {
    // Disable body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('modal-open')
            document.body.style.overflow = 'hidden'
        } else {
            document.body.classList.remove('modal-open')
            document.body.style.overflow = ''
        }

        // Cleanup on unmount
        return () => {
            document.body.classList.remove('modal-open')
            document.body.style.overflow = ''
        }
    }, [isOpen])

    if (!isOpen || !file) return null

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

    return (
        <div className="file-open-overlay" onClick={handleOverlayClick}>
            <div className="file-open-modal-new" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="file-open-header">
                    <div className="file-open-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M9 12H15M9 16H15M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H12.5858C12.851 3 13.1054 3.10536 13.2929 3.29289L18.7071 8.70711C18.8946 8.89464 19 9.149 19 9.41421V19C19 20.1046 18.1046 21 17 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <h3 className="file-open-title">Open File</h3>
                    <button
                        onClick={handleCancel}
                        className="file-open-close"
                        disabled={isLoading}
                        type="button"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="file-open-body">
                    <p className="file-open-question">Do you want to open this file?</p>
                    <div className="file-open-name-box">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M6 2H14L18 6V16C18 17.1046 17.1046 18 16 18H4C2.89543 18 2 17.1046 2 16V4C2 2.89543 2.89543 2 4 2H6Z" fill="currentColor" fillOpacity="0.1" />
                            <path d="M6 2H14L18 6V16C18 17.1046 17.1046 18 16 18H4C2.89543 18 2 17.1046 2 16V4C2 2.89543 2.89543 2 4 2H6Z" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                        <span className="file-open-filename">{file.original_name}</span>
                    </div>
                    <p className="file-open-hint">The file will open in your default application.</p>
                </div>

                {/* Footer */}
                <div className="file-open-footer">
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="file-open-btn file-open-btn-cancel"
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="file-open-btn file-open-btn-confirm"
                        disabled={isLoading}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M14 8.66667V14C14 14.5523 13.5523 15 13 15H3C2.44772 15 2 14.5523 2 14V4C2 3.44772 2.44772 3 3 3H8.33333M11 2H15M15 2V6M15 2L7 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {isLoading ? 'Opening...' : 'Open File'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default FileOpenModal
