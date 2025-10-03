import './css/FileModal.css';

const FileModal = ({ 
  showFileModal,
  setShowFileModal,
  selectedFile,
  fileComments,
  formatFileSize 
}) => {
  if (!showFileModal || !selectedFile) return null;

  const getStatusBadgeClass = (status, currentStage) => {
    if (status === 'final_approved') return 'status-approved';
    if (status.includes('rejected')) return 'status-rejected';
    if (currentStage.includes('pending')) return 'status-pending';
    return 'status-uploaded';
  };

  const getStatusText = (status, currentStage) => {
    switch (status) {
      case 'uploaded':
        return 'Uploaded';
      case 'team_leader_approved':
        return 'Team Leader Approved';
      case 'final_approved':
        return 'Final Approved';
      case 'rejected_by_team_leader':
        return 'Rejected by Team Leader';
      case 'rejected_by_admin':
        return 'Rejected by Admin';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
    }
  };

  const getCurrentStageText = (currentStage) => {
    switch (currentStage) {
      case 'pending_team_leader':
        return 'Pending Team Leader Review';
      case 'pending_admin':
        return 'Pending Admin Review';
      case 'published_to_public':
        return 'Published to Public Network';
      case 'rejected_by_team_leader':
        return 'Rejected by Team Leader';
      case 'rejected_by_admin':
        return 'Rejected by Admin';
      default:
        return currentStage.charAt(0).toUpperCase() + currentStage.slice(1).replace('_', ' ');
    }
  };

  // Parse tags from JSON string - show ALL tags in modal
  const getTags = () => {
    if (!selectedFile.tags) return [];
    try {
      const tags = JSON.parse(selectedFile.tags);
      return Array.isArray(tags) ? tags : [];
    } catch (e) {
      return [];
    }
  };

  // Format category for display - "Projects : Arm Plate" format
  const formatCategory = (category) => {
    if (!category) return '';
    
    // Split on capital letters and spaces
    const words = category
      .replace(/([A-Z])/g, ' $1') // Add space before capitals
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0);
    
    if (words.length === 0) return category;
    if (words.length === 1) return words[0];
    
    // First word : rest of words
    const firstWord = words[0];
    const restWords = words.slice(1).join(' ');
    
    return `${firstWord} : ${restWords}`;
  };

  const tags = getTags();

  return (
    <div className="modal-overlay" onClick={() => setShowFileModal(false)}>
      <div className="modal file-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>File Details</h3>
          <button onClick={() => setShowFileModal(false)} className="modal-close">×</button>
        </div>
        <div className="modal-body">
          <div className="file-details-section">
            <div className="file-detail-row">
              <span className="detail-label">Filename:</span>
              <span className="detail-value">{selectedFile.original_name}</span>
            </div>
            <div className="file-detail-row">
              <span className="detail-label">File Type:</span>
              <span className="detail-value">{selectedFile.file_type}</span>
            </div>
            <div className="file-detail-row">
              <span className="detail-label">File Size:</span>
              <span className="detail-value">{formatFileSize(selectedFile.file_size)}</span>
            </div>
            <div className="file-detail-row">
              <span className="detail-label">Uploaded:</span>
              <span className="detail-value">{new Date(selectedFile.uploaded_at).toLocaleString()}</span>
            </div>
            
            {selectedFile.description && (
              <div className="file-detail-row">
                <span className="detail-label">Description:</span>
                <span className="detail-value description-text">{selectedFile.description}</span>
              </div>
            )}
            
            {selectedFile.category && (
              <div className="file-detail-row">
                <span className="detail-label">Category:</span>
                <span className="detail-value">
                  <span className="category-badge">{formatCategory(selectedFile.category)}</span>
                </span>
              </div>
            )}
            
            {tags.length > 0 && (
              <div className="file-detail-row">
                <span className="detail-label">Tags:</span>
                <div className="detail-value">
                  <div className="tags-display">
                    {tags.map((tag, index) => (
                      <span key={index} className="tag-badge">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            <div className="file-detail-row">
              <span className="detail-label">Current Status:</span>
              <div className="status-container">
                <span className={`status-badge ${getStatusBadgeClass(selectedFile.status, selectedFile.current_stage)}`}>
                  {getStatusText(selectedFile.status, selectedFile.current_stage)}
                </span>
                <div className="stage-text">{getCurrentStageText(selectedFile.current_stage)}</div>
              </div>
            </div>
            
            {/* Review Details */}
            {selectedFile.team_leader_reviewed_at && (
              <div className="review-section">
                <h4>Team Leader Review</h4>
                <div className="review-info">
                  <div className="review-detail">
                    <span className="review-label">Reviewed by:</span>
                    <span className="review-value">{selectedFile.team_leader_username}</span>
                  </div>
                  <div className="review-detail">
                    <span className="review-label">Review Date:</span>
                    <span className="review-value">{new Date(selectedFile.team_leader_reviewed_at).toLocaleString()}</span>
                  </div>
                  {selectedFile.team_leader_comments && (
                    <div className="review-detail">
                      <span className="review-label">Comments:</span>
                      <span className="review-value">{selectedFile.team_leader_comments}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {selectedFile.admin_reviewed_at && (
              <div className="review-section">
                <h4>Admin Review</h4>
                <div className="review-info">
                  <div className="review-detail">
                    <span className="review-label">Reviewed by:</span>
                    <span className="review-value">{selectedFile.admin_username}</span>
                  </div>
                  <div className="review-detail">
                    <span className="review-label">Review Date:</span>
                    <span className="review-value">{new Date(selectedFile.admin_reviewed_at).toLocaleString()}</span>
                  </div>
                  {selectedFile.admin_comments && (
                    <div className="review-detail">
                      <span className="review-label">Comments:</span>
                      <span className="review-value">{selectedFile.admin_comments}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {selectedFile.public_network_url && (
              <div className="public-network-section">
                <h4>Public Network</h4>
                <div className="public-info">
                  <div className="public-detail">
                    <span className="public-label">Published URL:</span>
                    <a 
                      href={selectedFile.public_network_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="public-link"
                    >
                      {selectedFile.public_network_url}
                    </a>
                  </div>
                  <div className="public-detail">
                    <span className="public-label">Published Date:</span>
                    <span className="public-value">{new Date(selectedFile.final_approved_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
            
            {selectedFile.rejection_reason && (
              <div className="rejection-section">
                <h4>Rejection Details</h4>
                <div className="rejection-info">
                  <div className="rejection-detail">
                    <span className="rejection-label">Rejected by:</span>
                    <span className="rejection-value">{selectedFile.rejected_by}</span>
                  </div>
                  <div className="rejection-detail">
                    <span className="rejection-label">Rejection Date:</span>
                    <span className="rejection-value">{new Date(selectedFile.rejected_at).toLocaleString()}</span>
                  </div>
                  <div className="rejection-detail">
                    <span className="rejection-label">Reason:</span>
                    <span className="rejection-value rejection-reason">{selectedFile.rejection_reason}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Comments Section */}
          {fileComments.length > 0 && (
            <div className="comments-section">
              <h4>Review Comments</h4>
              <div className="comments-list">
                {fileComments.map((comment, index) => (
                  <div key={index} className="comment-item">
                    <div className="comment-header">
                      <span className="comment-author">{comment.username}</span>
                      <span className="comment-role">({comment.user_role})</span>
                      <span className="comment-date">{new Date(comment.created_at).toLocaleString()}</span>
                    </div>
                    <div className="comment-text">{comment.comment}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button 
            onClick={() => setShowFileModal(false)} 
            className="btn btn-primary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileModal;
