import './css/MyFilesTab.css';
import { useState, useRef } from 'react';
import SingleSelectTags from './SingleSelectTags';

const MyFilesTab = ({ 
  filteredFiles,
  isLoading,
  filterStatus,
  setFilterStatus,
  setActiveTab,
  fetchUserFiles,
  formatFileSize,
  openFileModal,
  files,
  user,
  onUploadSuccess
}) => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [description, setDescription] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateFileInfo, setDuplicateFileInfo] = useState(null);
  const [showFileDetailsModal, setShowFileDetailsModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileComments, setFileComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleFileUpload = async (e, replaceExisting = false) => {
    e.preventDefault();
    
    if (!uploadedFile) {
      alert('Please select a file to upload');
      return;
    }

    setIsUploading(true);

    try {
      if (!replaceExisting) {
        const duplicateResponse = await fetch('http://localhost:3001/api/files/check-duplicate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            originalName: uploadedFile.name,
            userId: user.id
          })
        });
        
        const duplicateData = await duplicateResponse.json();
        
        if (duplicateData.success && duplicateData.isDuplicate) {
          setDuplicateFileInfo({
            newFile: uploadedFile,
            existingFile: duplicateData.existingFile
          });
          setShowDuplicateModal(true);
          setIsUploading(false);
          return;
        }
      }
      
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('description', description);
      formData.append('tags', selectedTag ? JSON.stringify([selectedTag]) : '[]');
      formData.append('userId', user.id);
      formData.append('username', user.username);
      formData.append('userTeam', user.team);
      if (replaceExisting) {
        formData.append('replaceExisting', 'true');
      }

      const response = await fetch('http://localhost:3001/api/files/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        const action = data.replaced ? 'replaced' : 'uploaded';
        alert(`File ${action} successfully! It has been submitted for team leader review.`);
        setUploadedFile(null);
        setDescription('');
        setSelectedTag('');
        setShowUploadModal(false);
        setShowDuplicateModal(false);
        setDuplicateFileInfo(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        fetchUserFiles();
        if (onUploadSuccess) {
          onUploadSuccess(`File ${action} successfully! It has been submitted for team leader review.`);
        }
      } else {
        if (data.isDuplicate) {
          setDuplicateFileInfo({
            newFile: uploadedFile,
            existingFile: data.existingFile
          });
          setShowDuplicateModal(true);
        } else {
          alert(data.message || 'Failed to upload file');
        }
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReplaceFile = async () => {
    await handleFileUpload({ preventDefault: () => {} }, true);
  };
  
  const handleKeepBoth = () => {
    setShowDuplicateModal(false);
    setDuplicateFileInfo(null);
    alert('Please rename your file and try uploading again.');
  };

  const clearUploadForm = () => {
    setUploadedFile(null);
    setDescription('');
    setSelectedTag('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const closeUploadModal = () => {
    setShowUploadModal(false);
    clearUploadForm();
  };

  const openFile = (file) => {
    const fileUrl = `http://localhost:3001${file.file_path}`;
    window.open(fileUrl, '_blank');
  };

  const openFileDetails = async (file) => {
    setSelectedFile(file);
    setShowFileDetailsModal(true);
    setLoadingComments(true);
    
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

  const submittedFiles = filteredFiles.filter(f => 
    f.status === 'final_approved' || f.status === 'uploaded' || f.status === 'team_leader_approved'
  );

  const pendingFiles = submittedFiles.filter(f => f.status === 'uploaded' || f.status === 'team_leader_approved');
  const approvedFiles = submittedFiles.filter(f => f.status === 'final_approved');

  return (
    <div className="my-files-section">
      {/* Header */}
      <div className="files-header">
        <div className="header-left">
          <h2>My Files</h2>
          <p>{submittedFiles.length} files • {formatFileSize(submittedFiles.reduce((total, file) => total + file.file_size, 0))} total</p>
        </div>
        <div className="header-right">
          <button 
            className="upload-btn"
            onClick={() => setShowUploadModal(true)}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z"/>
            </svg>
            Upload Files
          </button>
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
      </div>

      {/* Files Table */}
      <div className="table-container">
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading your files...</p>
          </div>
        ) : submittedFiles.length > 0 ? (
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
                {submittedFiles.map((file) => {
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
                          className="action-btn open-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            openFile(file);
                          }}
                        >
                          OPEN
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="table-footer">
              <p>Showing 1 to {submittedFiles.length} of {submittedFiles.length} files</p>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-content">
              <div className="empty-icon">📋</div>
              <h3>No files found</h3>
              <p>
                {files.length === 0 
                  ? "Ready to upload your first file? Click the button above to get started." 
                  : "No files match your current search criteria."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="upload-modal-overlay" onClick={closeUploadModal}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Upload File for Approval</h3>
              <button className="modal-close" onClick={closeUploadModal}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleFileUpload} className="upload-form">
              <div className="form-group">
                <label className="form-label">Select File</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="file-input"
                  disabled={isUploading}
                />
                <div className="file-input-info">
                  <p>All file types are supported</p>
                  <p>No file size limit</p>
                </div>
              </div>

              {uploadedFile && (
                <div className="selected-file-info">
                  <div className="file-preview">
                    <div className="file-icon-preview">
                      {uploadedFile.name.split('.').pop().toUpperCase()}
                    </div>
                    <div className="file-details">
                      <div className="file-name">{uploadedFile.name}</div>
                      <div className="file-size">{formatFileSize(uploadedFile.size)}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide a brief description of this file and its purpose..."
                  rows="3"
                  className="form-textarea"
                  disabled={isUploading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tag</label>
                <SingleSelectTags
                  selectedTag={selectedTag}
                  onChange={setSelectedTag}
                  disabled={isUploading}
                />
                {selectedTag && (
                  <div className="tags-info">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="info-icon">
                      <path d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
                    </svg>
                    <span>1 tag selected</span>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={closeUploadModal}
                  className="btn secondary"
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadedFile || isUploading}
                  className={`btn primary ${isUploading ? 'loading' : ''}`}
                >
                  {isUploading ? 'Uploading...' : 'Submit for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplicate File Modal */}
      {showDuplicateModal && duplicateFileInfo && (
        <div className="upload-modal-overlay" onClick={() => setShowDuplicateModal(false)}>
          <div className="duplicate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>File Already Exists</h3>
              <button className="modal-close" onClick={() => setShowDuplicateModal(false)}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
              </button>
            </div>
            
            <div className="duplicate-content">
              <div className="warning-section">
                <div className="warning-icon">⚠️</div>
                <p className="warning-text">
                  A file with this name already exists in your account. What would you like to do?
                </p>
              </div>
              
              <div className="file-comparison">
                <div className="file-info existing">
                  <div className="file-header">
                    <div className="file-icon existing-icon">
                      {duplicateFileInfo.existingFile.original_name.split('.').pop().toUpperCase()}
                    </div>
                    <div>
                      <h4>Existing File</h4>
                      <p className="file-name">{duplicateFileInfo.existingFile.original_name}</p>
                    </div>
                  </div>
                  <div className="file-details">
                    <p><strong>Uploaded:</strong> {new Date(duplicateFileInfo.existingFile.uploaded_at).toLocaleDateString()}</p>
                    <p><strong>Status:</strong> {duplicateFileInfo.existingFile.status}</p>
                  </div>
                </div>
                
                <div className="file-info new">
                  <div className="file-header">
                    <div className="file-icon new-icon">
                      {duplicateFileInfo.newFile.name.split('.').pop().toUpperCase()}
                    </div>
                    <div>
                      <h4>New File</h4>
                      <p className="file-name">{duplicateFileInfo.newFile.name}</p>
                    </div>
                  </div>
                  <div className="file-details">
                    <p><strong>Size:</strong> {formatFileSize(duplicateFileInfo.newFile.size)}</p>
                    <p><strong>Type:</strong> {duplicateFileInfo.newFile.type}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-actions duplicate-actions">
              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="btn secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleKeepBoth}
                className="btn secondary"
              >
                Keep Both (Rename)
              </button>
              <button
                type="button"
                onClick={handleReplaceFile}
                className="btn danger"
                disabled={isUploading}
              >
                {isUploading ? 'Replacing...' : 'Replace Existing File'}
              </button>
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

export default MyFilesTab;
