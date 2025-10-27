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

  return (
    <div className="tl-modal-overlay" onClick={handleClose}>
      <div className="tl-modal-large" onClick={e => e.stopPropagation()}>
        <div className="tl-modal-header">
          <h3>File Review</h3>
          <button onClick={handleClose}>×</button>
        </div>
        
        <div className="tl-modal-body-large">
          {/* File Details Section */}
          <div className="tl-modal-section">
            <h4 className="tl-section-title">File Details</h4>
            <div className="tl-file-details-grid">
              <div className="tl-detail-item">
                <span className="tl-detail-label">File Name:</span>
                <span className="tl-detail-value">{selectedFile.original_name}</span>
              </div>
              <div className="tl-detail-item">
                <span className="tl-detail-label">File Type:</span>
                <span className="tl-detail-value">{selectedFile.file_type}</span>
              </div>
              <div className="tl-detail-item">
                <span className="tl-detail-label">File Size:</span>
                <span className="tl-detail-value">{formatFileSize(selectedFile.file_size)}</span>
              </div>
              <div className="tl-detail-item">
                <span className="tl-detail-label">Submitted By:</span>
                <span className="tl-detail-value">{selectedFile.username}</span>
              </div>
              <div className="tl-detail-item">
                <span className="tl-detail-label">Team:</span>
                <span className="tl-detail-value">{selectedFile.team || user.team}</span>
              </div>
              <div className="tl-detail-item">
                <span className="tl-detail-label">Upload Date:</span>
                <span className="tl-detail-value">
                  {new Date(selectedFile.created_at || selectedFile.upload_date).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              <div className="tl-detail-item">
                <span className="tl-detail-label">Status:</span>
                <span className={`tl-status-badge ${selectedFile.current_stage?.includes('pending_team_leader') ? 'pending-tl' : 'pending-admin'}`}>
                  {selectedFile.current_stage?.includes('pending_team_leader') ? 'PENDING TEAM LEADER' : 'PENDING ADMIN'}
                </span>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="tl-modal-section">
            <h4 className="tl-section-title">Description</h4>
            <p className="tl-description-text">{selectedFile.description || 'No description provided'}</p>
          </div>

          {/* Comments/History Section */}
          <div className="tl-modal-section">
            <h4 className="tl-section-title">Comments & History</h4>
            {fileComments && fileComments.length > 0 ? (
              <div className="tl-comments-list">
                {fileComments.map((comment, index) => (
                  <div key={index} className="tl-comment-item">
                    <div className="tl-comment-header">
                      <span className="tl-comment-author">{comment.reviewer_username || comment.username}</span>
                      <span className="tl-comment-role">{comment.reviewer_role || comment.role}</span>
                      <span className="tl-comment-date">
                        {new Date(comment.reviewed_at || comment.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="tl-comment-body">
                      <span className={`tl-comment-action ${comment.action}`}>{comment.action?.toUpperCase()}</span>
                      {comment.comments && <p>{comment.comments}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="tl-no-comments">No comments yet</div>
            )}
          </div>

          {/* Review Action Section */}
          {!reviewAction ? (
            <div className="tl-modal-section">
              <h4 className="tl-section-title">Actions</h4>
              <div className="tl-action-buttons-large">
                <button className="tl-btn success" onClick={() => setReviewAction('approve')}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M16.875 5L7.5 14.375L3.125 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Approve File
                </button>
                <button className="tl-btn danger" onClick={() => setReviewAction('reject')}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Reject File
                </button>
                <a href={`http://localhost:3001${selectedFile.file_path}`} target="_blank" rel="noopener noreferrer" className="tl-btn secondary">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M15 10.8333V15.8333C15 16.2754 14.8244 16.6993 14.5118 17.0118C14.1993 17.3244 13.7754 17.5 13.3333 17.5H4.16667C3.72464 17.5 3.30072 17.3244 2.98816 17.0118C2.67559 16.6993 2.5 16.2754 2.5 15.8333V6.66667C2.5 6.22464 2.67559 5.80072 2.98816 5.48816C3.30072 5.17559 3.72464 5 4.16667 5H9.16667M12.5 2.5H17.5M17.5 2.5V7.5M17.5 2.5L8.33333 11.6667" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Open File
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleReviewSubmit}>
              <div className="tl-modal-section">
                <h4 className="tl-section-title">{reviewAction === 'approve' ? 'Approve File' : 'Reject File'}</h4>
                <div className="tl-form-group">
                  <label>{reviewAction === 'approve' ? 'Comments (Optional)' : 'Rejection Reason (Required)'}</label>
                  <textarea
                    value={reviewComments}
                    onChange={(e) => setReviewComments(e.target.value)}
                    placeholder={reviewAction === 'approve' ? "Add your comments..." : "Please provide a reason for rejection..."}
                    rows="4"
                    required={reviewAction === 'reject'}
                  />
                </div>
                <div className="tl-modal-actions">
                  <button type="button" className="tl-btn secondary" onClick={() => setReviewAction(null)} disabled={isProcessing}>Cancel</button>
                  <button type="submit" className={`tl-btn ${reviewAction === 'approve' ? 'success' : 'danger'}`} disabled={isProcessing || (reviewAction === 'reject' && !reviewComments.trim())}>
                    {isProcessing ? 'Processing...' : (reviewAction === 'approve' ? 'Confirm Approval' : 'Confirm Rejection')}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReviewModal
