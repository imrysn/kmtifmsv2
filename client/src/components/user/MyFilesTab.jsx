import './css/MyFilesTab.css';
import { useState, useRef, useEffect } from 'react';
import SingleSelectTags from './SingleSelectTags';
import ConfirmationModal from '../admin/modals/ConfirmationModal';
import SuccessModal from './SuccessModal';
import FileIcon from '../admin/FileIcon';

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
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [successModal, setSuccessModal] = useState({ isOpen: false, title: '', message: '', type: 'success' });
  const fileInputRef = useRef(null);
  const menuRefs = useRef({});

  // Close menu when clicking outside or scrolling
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Check if click is outside all menu buttons and dropdowns
      const clickedInsideAnyMenu = Object.values(menuRefs.current).some(
        ref => ref && ref.contains(e.target)
      );
      
      if (!clickedInsideAnyMenu) {
        setOpenMenuId(null);
      }
    };
    
    const handleScroll = () => {
      setOpenMenuId(null);
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleFileUpload = async (e, replaceExisting = false) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    if (!uploadedFile) {
      setSuccessModal({
        isOpen: true,
        title: 'No File Selected',
        message: 'Please select a file to upload',
        type: 'warning'
      });
      return;
    }

    setIsUploading(true);

    try {
      // Only check for duplicates if not explicitly replacing
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
        setSuccessModal({
          isOpen: true,
          title: 'Success!',
          message: `File ${action} successfully! It has been submitted for team leader review.`,
          type: 'success'
        });
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
      } else {
        if (data.isDuplicate) {
          setDuplicateFileInfo({
            newFile: uploadedFile,
            existingFile: data.existingFile
          });
          setShowDuplicateModal(true);
        } else {
          setSuccessModal({
            isOpen: true,
            title: 'Upload Failed',
            message: data.message || 'Failed to upload file',
            type: 'error'
          });
        }
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setSuccessModal({
        isOpen: true,
        title: 'Upload Error',
        message: 'Failed to upload file. Please try again.',
        type: 'error'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleReplaceFile = async () => {
    // Call handleFileUpload with replaceExisting flag set to true
    await handleFileUpload(null, true);
  };
  
  const handleKeepBoth = () => {
    setShowDuplicateModal(false);
    setDuplicateFileInfo(null);
    setSuccessModal({
      isOpen: true,
      title: 'Rename Required',
      message: 'Please rename your file and try uploading again.',
      type: 'info'
    });
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

  const openFile = async (file) => {
    try {

      // Check if running in Electron
      if (window.electron && window.electron.openFileInApp) {
        // In Electron - open file directly from network location
        // Convert URL path to actual file system path
        // Format: /uploads/username/filename -> actual network path
        
        // Get the actual file path from server
        const response = await fetch(`http://localhost:3001/api/files/${file.id}/path`);
        const data = await response.json();
        
        if (data.success && data.filePath) {
          // Open file with system default application
          const result = await window.electron.openFileInApp(data.filePath);
          
          if (!result.success) {
            setSuccessModal({
              isOpen: true,
              title: 'Error',
              message: result.error || 'Failed to open file with system application',
              type: 'error'
            });
          }
        } else {
          throw new Error('Could not get file path');
        }
      } else {
        // In browser - just open in new tab
        const fileUrl = `http://localhost:3001${file.file_path}`;
        window.open(fileUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('Error opening file:', error);
      setSuccessModal({
        isOpen: true,
        title: 'Error',
        message: 'Failed to open file. Please try again.',
        type: 'error'
      });
    }
  };

  const openDeleteModal = (file) => {
    setFileToDelete(file);
    setShowDeleteModal(true);
  };

  const deleteFile = async () => {
    if (!fileToDelete) return;

    try {
      const response = await fetch(`http://localhost:3001/api/files/${fileToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          username: user.username,
          userRole: 'USER',
          team: user.team
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Remove file from local state
        fetchUserFiles();
        setSuccessModal({
          isOpen: true,
          title: 'File Deleted',
          message: 'File deleted successfully',
          type: 'error'
        });
        setShowDeleteModal(false);
        setFileToDelete(null);
      } else {
        setSuccessModal({
          isOpen: true,
          title: 'Delete Failed',
          message: data.message || 'Failed to delete file',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      setSuccessModal({
        isOpen: true,
        title: 'Delete Error',
        message: 'Failed to delete file. Please try again.',
        type: 'error'
      });
    }
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
      
      if (data.success && data.comments) {
        // Map comments to include action based on comment_type
        const mappedComments = data.comments.map(comment => {
          let action = null;
          if (comment.comment_type === 'approval') {
            action = 'approve';
          } else if (comment.comment_type === 'rejection') {
            action = 'reject';
          }
          
          return {
            ...comment,
            action: action,
            comments: comment.comment, // Map 'comment' field to 'comments' for consistency
            reviewer_username: comment.username,
            reviewer_role: comment.user_role
          };
        });
        setFileComments(mappedComments);
        console.log('Comments loaded:', mappedComments.length, mappedComments);
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
    f.status === 'final_approved' || f.status === 'uploaded' || f.status === 'team_leader_approved' || f.status === 'rejected_by_team_leader' || f.status === 'rejected_by_admin'
  );

  const pendingFiles = submittedFiles.filter(f => f.status === 'uploaded' || f.status === 'team_leader_approved');
  const approvedFiles = submittedFiles.filter(f => f.status === 'final_approved');
  const rejectedFiles = submittedFiles.filter(f => f.status === 'rejected_by_team_leader' || f.status === 'rejected_by_admin');

  return (
    <div className="user-my-files-component my-files-wrapper">
      {/* Header - LEFT TOP */}
      <div className="my-files-header-top">
        <div className="header-left">
          <h1>My Files</h1>
          <p className="header-subtitle">{submittedFiles.length} files • {formatFileSize(submittedFiles.reduce((total, file) => total + file.file_size, 0))} total</p>
        </div>
        <button 
          className="upload-btn-new"
          onClick={(e) => {
            e.preventDefault();
            setShowUploadModal(true);
          }}
          type="button"
        >
          ↑ Upload Files
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
          
          <div className="stat-box rejected-box">
            <div className="stat-icon rejected-icon">×</div>
            <div className="stat-text">
              <div className="stat-number">{rejectedFiles.length}</div>
              <div className="stat-name">Rejected</div>
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
                <div key={file.id} className="file-row-new" onClick={() => openFileDetails(file)}>
                  <div className="col-filename">
                    <FileIcon 
                      fileType={file.original_name.split('.').pop().toLowerCase()} 
                      isFolder={false}
                      size="default"
                      altText={`${file.file_type} file`}
                      style={{
                        width: '44px',
                        height: '44px'
                      }}
                    />
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
                  <div className="col-actions" onClick={(e) => e.stopPropagation()}>
                    <div 
                      className="actions-menu-container" 
                      ref={el => menuRefs.current[file.id] = el}
                    >
                      <button 
                        className="menu-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (openMenuId === file.id) {
                            setOpenMenuId(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMenuPosition({
                              top: rect.bottom + 4,
                              left: rect.right - 120
                            });
                            setOpenMenuId(file.id);
                          }
                        }}
                        title="More options"
                      >
                        ⋮
                      </button>
                      {openMenuId === file.id && (
                        <div 
                          className="actions-dropdown"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'fixed',
                            top: `${menuPosition.top}px`,
                            left: `${menuPosition.left}px`
                          }}
                        >
                          <button
                            className="dropdown-item delete-item"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openDeleteModal(file);
                              setOpenMenuId(null);
                            }}
                          >
                            Delete
                          </button>
                          <button
                            className="dropdown-item open-item"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openFile(file);
                              setOpenMenuId(null);
                            }}
                          >
                            Open
                          </button>
                        </div>
                      )}
                    </div>
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
              <button 
                className="modal-close" 
                onClick={(e) => {
                  e.preventDefault();
                  closeUploadModal();
                }}
                type="button"
              >×</button>
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
                    <FileIcon 
                      fileType={uploadedFile.name.split('.').pop().toLowerCase()} 
                      isFolder={false}
                      size="default"
                      altText={`${uploadedFile.name} file`}
                      style={{
                        width: '36px',
                        height: '36px'
                      }}
                    />
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
                  onClick={(e) => {
                    e.preventDefault();
                    closeUploadModal();
                  }}
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

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setFileToDelete(null);
        }}
        onConfirm={deleteFile}
        title="Delete File"
        message="Are you sure you want to delete this file?"
        fileInfo={{
          name: fileToDelete?.original_name || '',
          size: fileToDelete?.file_size || 0
        }}
        warningText="This action cannot be undone. The file and all its associated data will be permanently removed."
        confirmText="Delete File"
        cancelText="Cancel"
        variant="danger"
      />

      {/* File Details Modal */}
      {showFileDetailsModal && selectedFile && (
        <div className="modal-overlay" onClick={() => setShowFileDetailsModal(false)}>
          <div className="modal modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>File Details</h3>
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  setShowFileDetailsModal(false);
                }} 
                className="modal-close"
                type="button"
              >×</button>
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
                {selectedFile.description && (
                  <div className="detail-row">
                    <span className="detail-key">Description:</span>
                    <span className="detail-val description-text">{selectedFile.description}</span>
                  </div>
                )}
                {selectedFile.tags && selectedFile.tags.length > 0 && (
                  <div className="detail-row">
                    <span className="detail-key">Tags:</span>
                    <span className="detail-val">
                      <div className="tags-container">
                        {(typeof selectedFile.tags === 'string' ? JSON.parse(selectedFile.tags) : selectedFile.tags).map((tag, idx) => (
                          <span key={idx} className="tag-badge">{tag}</span>
                        ))}
                      </div>
                    </span>
                  </div>
                )}
              </div>

              <div className="comments-section">
                <h4>Review Comments & History</h4>
                {loadingComments ? (
                  <div className="loading-comments">Loading comments...</div>
                ) : fileComments && fileComments.length > 0 ? (
                  <div className="comments-list">
                    {fileComments.map((comment, index) => (
                      <div key={comment.id || index} className="comment-item">
                        <div className="comment-header">
                          <span className="comment-author">{comment.reviewer_username || comment.username}</span>
                          <span className="comment-role">({comment.reviewer_role || comment.user_role || 'USER'})</span>
                          {comment.action && (
                            <span className={`comment-action ${comment.action.toLowerCase()}`}>
                              {comment.action.toUpperCase()}
                            </span>
                          )}
                          <span className="comment-date">{new Date(comment.created_at).toLocaleString()}</span>
                        </div>
                        {(comment.comments || comment.comment) && <div className="comment-text">{comment.comments || comment.comment}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-comments">No review comments yet. This file has not been reviewed by admin or team leader.</p>
                )}
              </div>
            </div>
            <div className="modal-footer">
            </div>
          </div>
        </div>
      )}

      {/* Duplicate File Modal */}
      {showDuplicateModal && duplicateFileInfo && (
        <div className="modal-overlay" onClick={() => setShowDuplicateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚠️ Duplicate File Detected</h3>
              <button 
                className="modal-close" 
                onClick={(e) => {
                  e.preventDefault();
                  setShowDuplicateModal(false);
                  setDuplicateFileInfo(null);
                }}
                type="button"
              >×</button>
            </div>
            
            <div className="modal-body">
              <p className="duplicate-warning">
                A file with this name already exists in your files.
              </p>
              
              <div className="file-comparison">
                <div className="file-info-box">
                  <h4>📁 Existing File</h4>
                  <p><strong>Name:</strong> {duplicateFileInfo.existingFile?.original_name}</p>
                  <p><strong>Size:</strong> {formatFileSize(duplicateFileInfo.existingFile?.file_size)}</p>
                  <p><strong>Uploaded:</strong> {new Date(duplicateFileInfo.existingFile?.uploaded_at).toLocaleString()}</p>
                  <p><strong>Status:</strong> {getStatusDisplayName(duplicateFileInfo.existingFile?.status)}</p>
                </div>
                
                <div className="file-info-box">
                  <h4>📄 New File</h4>
                  <p><strong>Name:</strong> {duplicateFileInfo.newFile?.name}</p>
                  <p><strong>Size:</strong> {formatFileSize(duplicateFileInfo.newFile?.size)}</p>
                </div>
              </div>
              
              <p className="duplicate-question">
                What would you like to do?
              </p>
            </div>
            
            <div className="modal-actions">
              <button
                type="button"
                onClick={handleKeepBoth}
                className="btn btn-secondary"
                disabled={isUploading}
              >
                Keep Both (Rename)
              </button>
              <button
                type="button"
                onClick={handleReplaceFile}
                className="btn btn-danger"
                disabled={isUploading}
              >
                {isUploading ? 'Replacing...' : 'Replace Existing'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Modal */}
      <SuccessModal
        isOpen={successModal.isOpen}
        onClose={() => setSuccessModal({ ...successModal, isOpen: false })}
        title={successModal.title}
        message={successModal.message}
        type={successModal.type}
      />
    </div>
  );
};

export default MyFilesTab;
