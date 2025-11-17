import './css/AssignmentDetailsModal.css'

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

  const handleClose = () => {
    setShowReviewModal(false)
    setReviewAction(null)
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
                <span className="detail-value">{selectedFile.file_type}</span>
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
                  {selectedFile.team || user.team}
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
                  <path d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z" stroke="currentColor" strokeWidth="2"/>
                  <path d="M10 6V10M10 14H10.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
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
                  setReviewAction('approve')
                  // Create a synthetic event for handleReviewSubmit
                  handleReviewSubmit({ preventDefault: () => {} })
                }}
                className="btn btn-success-large"
                disabled={isProcessing || selectedFile.status === 'team_leader_approved' || selectedFile.status === 'final_approved' || selectedFile.status === 'rejected_by_team_leader' || selectedFile.status === 'rejected_by_admin'}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M16.875 5L7.5 14.375L3.125 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Approve
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  if (!reviewComments.trim()) {
                    alert('Please add a rejection reason in the comment box above')
                    return
                  }
                  setReviewAction('reject')
                  // Create a synthetic event for handleReviewSubmit
                  handleReviewSubmit({ preventDefault: () => {} })
                }}
                className="btn btn-danger-large"
                disabled={isProcessing || selectedFile.status === 'team_leader_approved' || selectedFile.status === 'final_approved' || selectedFile.status === 'rejected_by_team_leader' || selectedFile.status === 'rejected_by_admin'}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Reject
              </button>
              <button
                type="button"
                onClick={() => window.open(`http://localhost:3001${selectedFile.file_path}`, '_blank')}
                className="btn btn-secondary-large"
                disabled={isProcessing}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 10.8333V15.8333C15 16.2754 14.8244 16.6993 14.5118 17.0118C14.1993 17.3244 13.7754 17.5 13.3333 17.5H4.16667C3.72464 17.5 3.30072 17.3244 2.98816 17.0118C2.67559 16.6993 2.5 16.2754 2.5 15.8333V6.66667C2.5 6.22464 2.67559 5.80072 2.98816 5.48816C3.30072 5.17559 3.72464 5 4.16667 5H9.16667M12.5 2.5H17.5M17.5 2.5V7.5M17.5 2.5L8.33333 11.6667" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Open
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReviewModal
