import React from 'react'
import './FileOpenModal.css'

/**
 * File Open Confirmation Modal Component
 * Consistent UI for confirming file opening across all roles
 * 
 * @param {boolean} isOpen - Controls modal visibility
 * @param {function} onClose - Handler for closing the modal
 * @param {function} onConfirm - Handler for confirming file open
 * @param {object} file - File object with original_name, file_type, etc.
 * @param {boolean} isLoading - Shows loading state
 */
const FileOpenModal = ({
    isOpen,
    onClose,
    onConfirm,
    file,
    isLoading = false
}) => {
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
        <div
            className="modal-overlay"
            onClick={handleOverlayClick}
        >
            <div
                className="modal file-open-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-header">
                    <div className="modal-header-content">
                        <svg className="file-icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M9 12H15M9 16H15M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H12.5858C12.851 3 13.1054 3.10536 13.2929 3.29289L18.7071 8.70711C18.8946 8.89464 19 9.149 19 9.41421V19C19 20.1046 18.1046 21 17 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <h3>Open File</h3>
                    </div>
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
                    <div className="file-open-content">
                        <p className="file-open-question">Do you want to open this file?</p>

                        <div className="file-info-box">
                            <svg className="file-doc-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <path d="M6 2H14L18 6V16C18 17.1046 17.1046 18 16 18H4C2.89543 18 2 17.1046 2 16V4C2 2.89543 2.89543 2 4 2H6Z" fill="#4F46E5" fillOpacity="0.1" />
                                <path d="M6 2H14L18 6V16C18 17.1046 17.1046 18 16 18H4C2.89543 18 2 17.1046 2 16V4C2 2.89543 2.89543 2 4 2H6Z" stroke="#4F46E5" strokeWidth="1.5" />
                            </svg>
                            <span className="file-name-display">{file.original_name}</span>
                        </div>

                        <p className="file-open-hint">The file will open in your default application.</p>
                    </div>
                </div>

                <div className="modal-footer">
                    <div className="file-open-actions">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="btn btn-cancel"
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="btn btn-open-file"
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
        </div>
    )
}

export default FileOpenModal
