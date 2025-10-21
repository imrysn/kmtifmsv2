import { useState } from 'react';
import './css/FileApprovalTab-Table.css';

const FileApprovalTabTable = ({ 
  user,
  files,
  isLoading,
  formatFileSize,
  onWithdrawFile
}) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showFileDetailsModal, setShowFileDetailsModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileComments, setFileComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);

  // Calculate statistics
  const pendingFiles = files.filter(f => f.status === 'uploaded' || f.status === 'team_leader_approved');
  const approvedFiles = files.filter(f => f.status === 'final_approved');
  const rejectedFiles = files.filter(f => f.status === 'rejected_by_team_leader' || f.status === 'rejected_by_admin');

  const getStatusDisplayName = (dbStatus) => {
    switch (dbStatus) {
      case 'uploaded':
        return 'PENDING TEAM LEADER';
      case 'team_leader_approved':
        return 'PENDING ADMIN';
      case 'final_approved':
        return 'FINAL APPROVED';
      case 'rejected_by_team_leader':
        return 'REJECTED BY TEAM LEADER';
      case 'rejected_by_admin':
        return 'REJECTED BY ADMIN';
      default:
        return dbStatus.toUpperCase();
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'uploaded':
      case 'team_leader_approved':
        return 'status-pending';
      case 'final_approved':
        return 'status-approved';
      case 'rejected_by_team_leader':
      case 'rejected_by_admin':
        return 'status-rejected';
      default:
        return 'status-default';
    }
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    return { date: dateStr, time: timeStr };
  };

  const openFile = (file) => {
    const fileUrl = `http://localhost:3001${file.file_path}`;
    window.open(fileUrl, '_blank');
  };

  const openFileDetails = async (file) => {
    setSelectedFile(file);
    setShowFileDetailsModal(true);
    setLoadingComments(true);
    
    // Fetch comments from the API
    try {
      console.log('Fetching comments for file:', file.id);
      const response = await fetch(`http://localhost:3001/api/files/${file.id}/comments`);
      const data = await response.json();
      console.log('Comments response:', data);
      
      if (data.success) {
        setFileComments(data.comments || []);
        console.log('Comments loaded:', data.comments?.length || 0);
      } else {
        console.error('Failed to fetch comments:', data.message);
        setFileComments([]);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      setFileComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const openDeleteModal = (file) => {
    setFileToDelete(file);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!fileToDelete) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`http://localhost:3001/api/files/${fileToDelete.id}/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          reason: 'Deleted by user'
        })
      });

      const data = await response.json();
      if (data.success) {
        onWithdrawFile(fileToDelete.id);
        setShowDeleteModal(false);
        setFileToDelete(null);
      } else {
        alert('Failed to delete file: ' + data.message);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="user-file-approval-table-component file-approvals-table-section">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your file approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-file-approval-table-component file-approvals-table-section">
      {/* Header */}
      <div className="files-header">
        <div className="header-left">
          <h2>File Approvals</h2>
          <p>{files.length} files • {formatFileSize(files.reduce((total, file) => total + file.file_size, 0))} total</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="approval-stats-grid">
        <div className="stat-card pending">
          <div className="status-icon pending-icon">⏱</div>
          <div className="status-info">
            <div className="status-number">{pendingFiles.length}</div>
            <div className="status-label">Pending</div>
          </div>
        </div>
        
        <div className="stat-card approved">
          <div className="status-icon approved-icon">✓</div>
          <div className="status-info">
            <div className="status-number">{approvedFiles.length}</div>
            <div className="status-label">Approved</div>
          </div>
        </div>
        
        <div className="stat-card rejected">
          <div className="status-icon rejected-icon">✗</div>
          <div className="status-info">
            <div className="status-number">{rejectedFiles.length}</div>
            <div className="status-label">Rejected</div>
          </div>
        </div>
      </div>

      {/* Files Table */}
      <div className="table-container">
        {files.length > 0 ? (
          <>
            <table className="files-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Submitted By</th>
                  <th>Date & Time</th>
                  <th>Team</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => {
                  const { date, time } = formatDateTime(file.uploaded_at);
                  return (
                    <tr 
                      key={file.id} 
                      className="file-row" 
                      onClick={() => openFileDetails(file)}
                      title="Click to view details and comments"
                    >
                      <td>
                        <div className="file-cell">
                          <div className="file-icon">
                            {file.file_type.substring(0, 3).toUpperCase()}
                          </div>
                          <div className="file-info">
                            <div className="file-name">{file.original_name}</div>
                            <div className="file-size">{formatFileSize(file.file_size)}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="user-cell">
                          <div className="user-avatar">
                            {file.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="user-name">{file.username}</span>
                        </div>
                      </td>
                      <td>
                        <div className="datetime-cell">
                          <div className="date">{date}</div>
                          <div className="time">{time}</div>
                        </div>
                      </td>
                      <td>
                        <span className="team-badge">{file.user_team}</span>
                      </td>
                      <td>
                        <span className={`status-badge ${getStatusClass(file.status)}`}>
                          {getStatusDisplayName(file.status)}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="action-btn delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteModal(file);
                          }}
                        >
                          DELETE
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="table-footer">
              <p>Showing 1 to {files.length} of {files.length} files</p>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No File Submissions</h3>
            <p>You haven't submitted any files for approval yet.</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && fileToDelete && (
        <div className="modal-overlay" onClick={() => !isDeleting && setShowDeleteModal(false)}>
          <div className="modal delete-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete File</h3>
              <button onClick={() => !isDeleting && setShowDeleteModal(false)} className="modal-close" disabled={isDeleting}>×</button>
            </div>
            <div className="modal-body">
              <div className="delete-warning">
                <div className="warning-icon">⚠️</div>
                <div className="warning-content">
                  <h4>Are you sure you want to delete this file?</h4>
                  <p className="file-info">
                    <strong>{fileToDelete.original_name}</strong>
                    <br />
                    <span className="file-size-info">{formatFileSize(fileToDelete.file_size)}</span>
                  </p>
                  <p className="warning-text">
                    This action cannot be undone. The file and all its associated data will be permanently removed.
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <div className="delete-actions">
                <button 
                  type="button" 
                  onClick={() => setShowDeleteModal(false)} 
                  className="btn btn-secondary"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleDelete}
                  className="btn btn-danger" 
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete File'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Details Modal */}
      {showFileDetailsModal && selectedFile && (
        <div className="modal-overlay" onClick={() => setShowFileDetailsModal(false)}>
          <div className="modal file-details-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>File Details</h3>
              <button onClick={() => setShowFileDetailsModal(false)} className="modal-close">×</button>
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
                <div className="file-detail-row">
                  <span className="detail-label">Team:</span>
                  <span className="detail-value team-badge">{selectedFile.user_team}</span>
                </div>
                <div className="file-detail-row">
                  <span className="detail-label">Current Status:</span>
                  <span className={`detail-value status-badge ${getStatusClass(selectedFile.status)}`}>
                    {getStatusDisplayName(selectedFile.status)}
                  </span>
                </div>
                {selectedFile.description && (
                  <div className="file-detail-row">
                    <span className="detail-label">Description:</span>
                    <span className="detail-value description-text">{selectedFile.description}</span>
                  </div>
                )}
              </div>
              
              {/* Review Details from Files Table */}
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
              
              {/* Comments Section from file_comments table */}
              <div className="comments-section">
                <h4>Review Comments</h4>
                {loadingComments ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                    <div className="spinner" style={{ margin: '0 auto' }}></div>
                    <p>Loading comments...</p>
                  </div>
                ) : fileComments && fileComments.length > 0 ? (
                  <div className="comments-list">
                    {fileComments.map((comment, index) => (
                      <div key={comment.id || index} className="comment-item">
                        <div className="comment-header">
                          <span className="comment-author">{comment.username}</span>
                          <span className="comment-role">({comment.user_role})</span>
                          <span className="comment-date">
                            {new Date(comment.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="comment-text">{comment.comment}</div>
                        {comment.comment_type && (
                          <div className="comment-type-badge">{comment.comment_type}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-comments" style={{ fontStyle: 'italic', color: '#9ca3af', textAlign: 'center', padding: '20px' }}>
                    No comments yet.
                  </p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                onClick={() => setShowFileDetailsModal(false)} 
                className="btn btn-secondary"
              >
                Close
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setShowFileDetailsModal(false);
                  openFile(selectedFile);
                }}
                className="btn btn-primary"
              >
                Open File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileApprovalTabTable;
