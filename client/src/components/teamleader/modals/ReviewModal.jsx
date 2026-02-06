import { useState } from 'react'
import { API_BASE_URL } from '@/config/api'
import './css/AssignmentDetailsModal.css'
import { getDisplayFileType } from '../../../utils/fileTypeUtils'
import { ConfirmationModal, FileOpenModal } from '../../shared'

const ReviewModal = ({
  showReviewModal,
  setShowReviewModal,
  selectedFile,
  reviewAction,
  setReviewAction,
  fileComments,
  reviewComments,
  setReviewComments,
  isProcessing,
  handleReviewSubmit,
  formatFileSize,
  user
}) => {
  if (!showReviewModal || !selectedFile) return null

  const [isOpeningFile, setIsOpeningFile] = useState(false)
  const [showRejectConfirmation, setShowRejectConfirmation] = useState(false)

  const [showOpenConfirmation, setShowOpenConfirmation] = useState(false)

  const handleOpenFileClick = () => {
    setShowOpenConfirmation(true)
  }

  const executeOpenFile = async () => {
    setIsOpeningFile(true)
    setShowOpenConfirmation(false)
    try {
      console.log('Opening file:', {
        id: selectedFile.id,
        name: selectedFile.original_name,
        current_status: selectedFile.status
      })

      // Check if running in Electron and has capability to open files locally
      if (window.electron && window.electron.openFileInApp) {
        // Get the absolute file path from server
        const response = await fetch(`${API_BASE_URL}/api/files/${selectedFile.id}/path`);
        const data = await response.json();

        if (data.success && data.filePath) {
          const result = await window.electron.openFileInApp(data.filePath);

          if (!result.success) {
            alert('Failed to open file locally: ' + (result.error || 'Unknown error'));
          }
        } else {
          alert('Could not retrieve file path');
        }
      } else {
        // Web fallback: Open file in new tab/download
        let fileUrl = selectedFile.file_path

        // Handle approved files with public URLs
        if (selectedFile.status === 'final_approved' && selectedFile.public_network_url) {
          if (selectedFile.public_network_url.startsWith('http')) {
            fileUrl = selectedFile.public_network_url
          } else {
            // Fallback for relative paths in public_network_url or inconsistencies
            fileUrl = `${API_BASE_URL}${selectedFile.file_path}`
          }
        } else {
          // Standard files served via API/static
          fileUrl = `${API_BASE_URL}${selectedFile.file_path}`
        }

        window.open(fileUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (error) {
      console.error('Error opening file:', error)
      alert('Failed to open file. Please try again.')
    } finally {
      setIsOpeningFile(false)
    }
  }

  const handleClose = () => {
    setShowReviewModal(false)
    setReviewAction(null)
  }

  const handleRejectClick = (e) => {
    e.preventDefault()
    // If there's no comment, show confirmation modal
    if (!reviewComments.trim()) {
      setShowRejectConfirmation(true)
    } else {
      // If there's a comment, proceed directly
      handleReviewSubmit({ preventDefault: () => { } }, 'reject')
    }
  }

  const handleConfirmReject = () => {
    setShowRejectConfirmation(false)
    handleReviewSubmit({ preventDefault: () => { } }, 'reject')
  }

  const getStatusDisplayName = (status) => {
    switch (status) {
      case 'uploaded':
      case 'submitted':
        return 'Pending Team Leader'
      case 'team_leader_approved':
        return 'Pending Admin'
      case 'final_approved':
        return 'Approved'
      case 'rejected_by_team_leader':
        return 'Rejected by Team Leader'
      case 'rejected_by_admin':
        return 'Rejected by Admin'
      default:
        return 'Pending Review'
    }
  }

  const mapFileStatus = (status) => {
    switch (status) {
      case 'uploaded':
      case 'submitted':
      case 'team_leader_approved':
        return 'pending'
      case 'final_approved':
        return 'approved'
      case 'rejected_by_team_leader':
      case 'rejected_by_admin':
        return 'rejected'
      default:
        return 'pending'
    }
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="file-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>File Details</h3>
          <button onClick={handleClose} className="modal-close">×</button>
        </div>

        <div className="modal-body">
          {/* File Details Section */}
          <div className="file-details-section">
            <h4 className="section-title">File Details</h4>
            <div className="file-details-grid">
              <div className="detail-item">
                <span className="detail-label">FILE NAME:</span>
                <span className="detail-value">{selectedFile.original_name}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">FILE TYPE:</span>
                <span className="detail-value">{getDisplayFileType(selectedFile.file_type, selectedFile.original_name)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">FILE SIZE:</span>
                <span className="detail-value">{formatFileSize(selectedFile.file_size)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">SUBMITTED BY:</span>
                <span className="detail-value">{selectedFile.fullName || selectedFile.username}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">TEAM:</span>
                <span className="detail-value team-badge-inline">
                  {selectedFile.user_team || selectedFile.team || user.team}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">UPLOAD DATE:</span>
                <span className="detail-value">
                  {new Date(selectedFile.submitted_at || selectedFile.created_at || selectedFile.upload_date).toLocaleString()}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">STATUS:</span>
                <span className={`detail-value status-badge status-${mapFileStatus(selectedFile.status || selectedFile.current_stage)}`}>
                  {getStatusDisplayName(selectedFile.status || selectedFile.current_stage)}
                </span>
              </div>
            </div>
          </div>

          {/* Description Section */}
          {selectedFile.description && (
            <div className="description-section">
              <h4 className="section-title">Description</h4>
              <div className="description-box">
                <p className="description-text">{selectedFile.description}</p>
              </div>
            </div>
          )}



          {/* Comments Section */}
          {selectedFile.status !== 'team_leader_approved' &&
            selectedFile.status !== 'final_approved' &&
            selectedFile.status !== 'rejected_by_team_leader' &&
            selectedFile.status !== 'rejected_by_admin' && (
              <div className="comments-section" style={{ marginBottom: '20px', backgroundColor: 'white' }}>
                <h4 className="section-title">Comments (Optional)</h4>
                <textarea
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  placeholder="Add optional comments or rejection reason..."
                  rows="3"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #E5E7EB',
                    color: '#000',
                    background: '#fff',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    minHeight: '80px'
                  }}
                />
              </div>
            )}

          {/* Already Reviewed Notice */}
          {(selectedFile.status === 'team_leader_approved' || selectedFile.status === 'final_approved' ||
            selectedFile.status === 'rejected_by_team_leader' || selectedFile.status === 'rejected_by_admin') && (
              <div className="review-notice" style={{
                padding: '12px 16px',
                background: selectedFile.status === 'team_leader_approved' ? '#FEF3C7' :
                  selectedFile.status === 'final_approved' ? '#D1FAE5' : '#FEE2E2',
                border: '1px solid ' + (selectedFile.status === 'team_leader_approved' ? '#FCD34D' :
                  selectedFile.status === 'final_approved' ? '#34D399' : '#FCA5A5'),
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{
                    color: selectedFile.status === 'team_leader_approved' ? '#92400E' :
                      selectedFile.status === 'final_approved' ? '#065F46' : '#991B1B'
                  }}>
                    <path d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z" stroke="currentColor" strokeWidth="2" />
                    <path d="M10 6V10M10 14H10.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span style={{
                    fontWeight: '500',
                    color: selectedFile.status === 'team_leader_approved' ? '#92400E' :
                      selectedFile.status === 'final_approved' ? '#065F46' : '#991B1B'
                  }}>
                    {selectedFile.status === 'team_leader_approved' ? 'This file has been approved by you and is now pending admin review.' :
                      selectedFile.status === 'final_approved' ? 'This file has been fully approved and published.' :
                        'This file has been rejected and cannot be re-reviewed.'}
                  </span>
                </div>
              </div>
            )}

          {/* Actions Section */}
          <div className="actions-section">
            <div className="action-buttons-large">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  // Pass the action directly to handleReviewSubmit
                  handleReviewSubmit({ preventDefault: () => { } }, 'approve')
                }}
                className="btn btn-success-large"
                disabled={isProcessing || selectedFile.status === 'team_leader_approved' || selectedFile.status === 'final_approved' || selectedFile.status === 'rejected_by_team_leader' || selectedFile.status === 'rejected_by_admin'}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M16.875 5L7.5 14.375L3.125 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Approve
              </button>
              <button
                type="button"
                onClick={handleRejectClick}
                className="btn btn-danger-large"
                disabled={isProcessing || selectedFile.status === 'team_leader_approved' || selectedFile.status === 'final_approved' || selectedFile.status === 'rejected_by_team_leader' || selectedFile.status === 'rejected_by_admin'}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Reject
              </button>
              <button
                type="button"
                onClick={handleOpenFileClick}
                className="btn btn-secondary-large"
                disabled={isProcessing || isOpeningFile}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2.5V10M10 10V17.5M10 10H17.5M10 10H2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {isOpeningFile ? 'Opening...' : 'Open File'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reject without reason confirmation modal */}
      <ConfirmationModal
        isOpen={showRejectConfirmation}
        onClose={() => setShowRejectConfirmation(false)}
        onConfirm={handleConfirmReject}
        title="Reject Without Reason?"
        message="You are about to reject this file without providing a reason."
        confirmText="Reject Anyway"
        cancelText="Cancel"
        variant="warning"
        isLoading={isProcessing}
      >
        <p className="warning-text" style={{ marginTop: '12px', fontSize: '14px', color: '#6B7280' }}>
          Consider adding a comment to help the submitter understand why the file was rejected.
        </p>
      </ConfirmationModal>

      {/* File Open Modal */}
      <FileOpenModal
        isOpen={showOpenConfirmation}
        onClose={() => setShowOpenConfirmation(false)}
        onConfirm={executeOpenFile}
        file={selectedFile}
        isLoading={isOpeningFile}
      />
    </div>
  )
}

export default ReviewModal