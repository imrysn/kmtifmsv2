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

  const getFileTypeClass = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    
    if (['pdf'].includes(ext)) return 'pdf-type';
    if (['doc', 'docx', 'txt'].includes(ext)) return 'doc-type';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'xls-type';
    if (['ppt', 'pptx'].includes(ext)) return 'ppt-type';
    if (['zip', 'rar', 'tar', '7z'].includes(ext)) return 'zip-type';
    if (['png', 'jpg', 'jpeg', 'gif', 'bmp'].includes(ext)) return 'img-type';
    
    return 'default-type';
  };

  const submittedFiles = filteredFiles.filter(f => 
    f.status === 'final_approved' || f.status === 'uploaded' || f.status === 'team_leader_approved'
  );

  const pendingFiles = submittedFiles.filter(f => f.status === 'uploaded' || f.status === 'team_leader_approved');
  const approvedFiles = submittedFiles.filter(f => f.status === 'final_approved');

  return (
    <div className="my-files-wrapper">
      {/* Header - LEFT TOP */}
      <div className="my-files-header-top">
        <div className="header-left">
          <h1>My Files</h1>
          <p className="header-subtitle">{submittedFiles.length} files • {formatFileSize(submittedFiles.reduce((total, file) => total + file.file_size, 0))} total</p>
        </div>
        <button 
          className="upload-btn-new"
          onClick={() => setShowUploadModal(true)}
        >
          ↓ Upload Files
        </button>
      </div>

      {/* Statistics Cards - BELOW */}
      <div className="stats-row">
          <div className="stat-box pending-box">
            <div className="stat-icon pending-icon">⏱</div>
            <div className="stat-text">
              <div className="stat-number">{pendingFiles.length}</div>
              <div className="stat-name">Pending</div>
            </div>
          </div>
          
          <div className="stat-box approved-box">
            <div className="stat-icon approved-icon">✓</div>
            <div className="stat-text">
              <div className="stat-number">{approvedFiles.length}</div>
              <div className="stat-name">Approved</div>
            </div>
          </div>
      </div>

      {/* Files Table */}
      <div className="files-table-wrapper">
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading your files...</p>
          </div>
        ) : submittedFiles.length > 0 ? (
          <div className="files-list">
            <div className="table-header">
              <div className="col-filename">FILENAME</div>
              <div className="col-datetime">DATE & TIME</div>
              <div className="col-team">TEAM</div>
              <div className="col-status">STATUS</div>
              <div className="col-actions">ACTIONS</div>
            </div>
            {submittedFiles.map((file) => {
              const { date, time } = formatDateTime(file.uploaded_at);
              return (
                <div key={file.id} className="file-row-new">
                  <div className="col-filename">
                    <div className={`file-icon-box ${getFileTypeClass(file.original_name)}`}>{file.file_type.substring(0, 3).toUpperCase()}</div>
                    <div className="file-text">
                      <div className="filename">{file.original_name}</div>
                      <div className="filesize">{formatFileSize(file.file_size)}</div>
                      <div className="datetime-mobile">
                        <div className="date-label">{date}</div>
                        <div className="time-label">{time}</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-datetime">
                    <div className="date-label">{date}</div>
                    <div className="time-label">{time}</div>
                  </div>
                  <div className="col-team">
                    <span className="team-text">{file.user_team}</span>
                  </div>
                  <div className="col-status">
                    <span className={`status-tag ${getStatusClass(file.status)}`}>
                      {getStatusDisplayName(file.status)}
                    </span>
                  </div>
                  <div className="col-actions">
                    <button 
                      className="open-file-btn"
                      onClick={() => openFile(file)}
                    >
                      OPEN
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No files found</h3>
            <p>
              {files.length === 0 
                ? "Ready to upload your first file? Click the button above to get started." 
                : "No files match your current search criteria."}
            </p>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={closeUploadModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Upload File for Approval</h3>
              <button className="modal-close" onClick={closeUploadModal}>×</button>
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
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={closeUploadModal}
                  className="btn btn-cancel"
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadedFile || isUploading}
                  className="btn btn-submit"
                >
                  {isUploading ? 'Uploading...' : 'Submit for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* File Details Modal */}
      {showFileDetailsModal && selectedFile && (
        <div className="modal-overlay" onClick={() => setShowFileDetailsModal(false)}>
          <div className="modal modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>File Details</h3>
              <button onClick={() => setShowFileDetailsModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="details-section">
                <div className="detail-row">
                  <span className="detail-key">Filename:</span>
                  <span className="detail-val">{selectedFile.original_name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-key">File Type:</span>
                  <span className="detail-val">{selectedFile.file_type}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-key">File Size:</span>
                  <span className="detail-val">{formatFileSize(selectedFile.file_size)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-key">Uploaded:</span>
                  <span className="detail-val">{new Date(selectedFile.uploaded_at).toLocaleString()}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-key">Team:</span>
                  <span className="detail-val">{selectedFile.user_team}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-key">Status:</span>
                  <span className={`detail-val status-tag ${getStatusClass(selectedFile.status)}`}>
                    {getStatusDisplayName(selectedFile.status)}
                  </span>
                </div>
              </div>

              <div className="comments-section">
                <h4>Review Comments</h4>
                {loadingComments ? (
                  <div className="loading-comments">Loading comments...</div>
                ) : fileComments && fileComments.length > 0 ? (
                  <div className="comments-list">
                    {fileComments.map((comment, index) => (
                      <div key={comment.id || index} className="comment-item">
                        <div className="comment-header">
                          <span className="comment-author">{comment.username}</span>
                          <span className="comment-role">({comment.user_role})</span>
                          <span className="comment-date">{new Date(comment.created_at).toLocaleString()}</span>
                        </div>
                        <div className="comment-text">{comment.comment}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-comments">No comments yet.</p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowFileDetailsModal(false)} className="btn btn-cancel">Close</button>
              <button onClick={() => { setShowFileDetailsModal(false); openFile(selectedFile); }} className="btn btn-submit">Open File</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyFilesTab;
