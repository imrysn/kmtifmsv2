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
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (100MB limit)
      if (file.size > 100 * 1024 * 1024) {
        alert('File size must be less than 100MB');
        return;
      }
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
      // If not explicitly replacing, check for duplicates first
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
      
      // Proceed with upload
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
        
        // Refresh file list
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

  // Helper function to open file
  const openFile = (file, e) => {
    e.stopPropagation();
    const fileUrl = `http://localhost:3001${file.file_path}`;
    window.open(fileUrl, '_blank');
  };
  
  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    
    if (['pdf'].includes(extension)) {
      return (
        <div className="file-icon-list pdf-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          </svg>
          <span className="file-type-label">PDF</span>
        </div>
      );
    } else if (['doc', 'docx'].includes(extension)) {
      return (
        <div className="file-icon-list docx-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          </svg>
          <span className="file-type-label">DOC</span>
        </div>
      );
    } else if (['xls', 'xlsx'].includes(extension)) {
      return (
        <div className="file-icon-list xlsx-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          </svg>
          <span className="file-type-label">XLS</span>
        </div>
      );
    } else if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
      return (
        <div className="file-icon-list image-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z" />
          </svg>
          <span className="file-type-label">IMG</span>
        </div>
      );
    } else {
      return (
        <div className="file-icon-list default-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          </svg>
          <span className="file-type-label">FILE</span>
        </div>
      );
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit'
    }) + ' ' + date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getTags = (file) => {
    if (!file.tags) return [];
    try {
      const tags = JSON.parse(file.tags);
      return Array.isArray(tags) ? tags : [];
    } catch (e) {
      return [];
    }
  };

  const getStatusDisplay = (file) => {
    if (file.status === 'final_approved') {
      return <span className="status-badge approved">Final Approved</span>;
    } else if (file.status === 'uploaded') {
      return <span className="status-badge pending">Pending Team Leader Review</span>;
    } else if (file.status === 'team_leader_approved') {
      return <span className="status-badge pending">Pending Admin Review</span>;
    }
    return null;
  };

  const getSubmissionStatus = (file) => {
    if (file.status === 'final_approved' || file.current_stage.includes('pending')) {
      return <span className="submission-status">✓ Submitted</span>;
    }
    return null;
  };

  // Only show submitted files
  const submittedFiles = filteredFiles.filter(f => 
    f.status === 'final_approved' || f.status === 'uploaded' || f.status === 'team_leader_approved'
  );

  return (
    <div className="my-files-section">
      {/* Header */}
      <div className="files-header">
        <div className="header-left">
          <h2>My Files</h2>
          <p>{filteredFiles.length} files • {formatFileSize(filteredFiles.reduce((total, file) => total + file.file_size, 0))} total</p>
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

      {/* Files List */}
      <div className="files-container-list">
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading your files...</p>
          </div>
        ) : (
          <>
            {/* Submitted Section */}
            {submittedFiles.length > 0 && (
              <div className="files-section">
                <div className="section-header">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="section-icon submitted">
                    <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
                  </svg>
                  <span className="section-title">Submitted for Approval</span>
                  <span className="section-count">({submittedFiles.length})</span>
                </div>
                <div className="files-list">
                  {submittedFiles.map((file) => {
                    const tags = getTags(file);
                    return (
                      <div 
                        key={file.id} 
                        className="file-item-compact" 
                        onClick={() => openFileModal(file)}
                        onDoubleClick={(e) => openFile(file, e)}
                        title="Click to view details and comments, double-click to open file"
                      >
                        <div className="file-icon-wrapper">
                          {getFileIcon(file.original_name)}
                        </div>
                        <div className="file-info-compact">
                          <h3 className="file-name">{file.original_name}</h3>
                        </div>
                        <div className="file-status-compact">
                          {getStatusDisplay(file)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredFiles.length === 0 && (
              <div className="empty-state">
                <div className="empty-content">
                  <h3>No files found</h3>
                  <p>
                    {files.length === 0 
                      ? "Ready to upload your first file? Click the button above to get started." 
                      : "No files match your current search criteria."}
                  </p>
                </div>
              </div>
            )}
          </>
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
                  <p>Maximum size: 100MB</p>
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
    </div>
  );
};

export default MyFilesTab;
