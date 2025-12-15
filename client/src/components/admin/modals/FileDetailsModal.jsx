import React from 'react'
import './FileDetailsModal.css'
import { getDisplayFileType } from '../../../utils/fileTypeUtils'

const FileDetailsModal = ({
  isOpen,
  onClose,
  file,
  onApprove,
  onReject,
  onOpenFile,
  isLoading,
  isOpeningFile,
  formatFileSize,
  mapFileStatus,
  getStatusDisplayName
}) => {
  if (!isOpen || !file) return null

  const formattedSize = formatFileSize(file.file_size)
  const formattedDate = new Date(file.uploaded_at).toLocaleString()

  return (
    <div className="file-details-modal-component">
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal file-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>File Details</h3>
          <button onClick={onClose} className="modal-close">×</button>
        </div>
        <div className="modal-body">
          {/* File Details Section */}
          <div className="file-details-section">
            <h4 className="section-title">File Details</h4>
            <div className="file-details-grid">
              <div className="detail-item">
                <span className="detail-label">FILE NAME:</span>
                <span className="detail-value">{file.original_name}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">FILE TYPE:</span>
                <span className="detail-value">{getDisplayFileType(file.file_type, file.original_name)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">FILE SIZE:</span>
                <span className="detail-value">{formattedSize}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">SUBMITTED BY:</span>
                <span className="detail-value">{file.username}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">TEAM:</span>
                <span className="detail-value team-badge-inline">
                  {file.user_team}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">UPLOAD DATE:</span>
                <span className="detail-value">{formattedDate}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">STATUS:</span>
                <span className={`detail-value status-badge status-${mapFileStatus(file.status)}`}>
                  {getStatusDisplayName(file.status)}
                </span>
              </div>
            </div>
          </div>

          {/* Actions Section */}
          <div className="actions-section">
            <div className="action-buttons-large">
              <button
                type="button"
                onClick={onApprove}
                className="btn btn-success-large"
                disabled={isLoading || file.status === 'final_approved' || file.status === 'rejected_by_team_leader' || file.status === 'rejected_by_admin'}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M16.875 5L7.5 14.375L3.125 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Approve
              </button>
              <button
                type="button"
                onClick={onReject}
                className="btn btn-danger-large"
                disabled={isLoading || file.status === 'final_approved' || file.status === 'rejected_by_team_leader' || file.status === 'rejected_by_admin'}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Reject
              </button>
              <button
                onClick={onOpenFile}
                className="btn btn-secondary-large"
                disabled={isLoading || isOpeningFile}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 10.8333V15.8333C15 16.2754 14.8244 16.6993 14.5118 17.0118C14.1993 17.3244 13.7754 17.5 13.3333 17.5H4.16667C3.72464 17.5 3.30072 17.3244 2.98816 17.0118C2.67559 16.6993 2.5 16.2754 2.5 15.8333V6.66667C2.5 6.22464 2.67559 5.80072 2.98816 5.48816C3.30072 5.17559 3.72464 5 4.16667 5H9.16667M12.5 2.5H17.5M17.5 2.5V7.5M17.5 2.5L8.33333 11.6667" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {isOpeningFile ? 'Opening...' : 'Open'}
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

export default FileDetailsModal
