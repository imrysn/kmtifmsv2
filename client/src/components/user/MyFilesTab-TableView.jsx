import './css/MyFilesTab-TableView.css';
import { useState, useRef } from 'react';

const MyFilesTabTableView = ({ 
  filteredFiles,
  isLoading,
  filterStatus,
  setFilterStatus,
  searchQuery,
  setSearchQuery,
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
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null);
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

  const handleFileUpload = async (e) => {
    e.preventDefault();
    
    if (!uploadedFile) {
      alert('Please select a file to upload');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('description', description);
      formData.append('userId', user.id);
      formData.append('username', user.username);
      formData.append('userTeam', user.team);

      const response = await fetch('http://localhost:3001/api/files/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        alert('File uploaded successfully! It has been submitted for team leader review.');
        setUploadedFile(null);
        setDescription('');
        setShowUploadModal(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Refresh file list
        fetchUserFiles();
        if (onUploadSuccess) {
          onUploadSuccess('File uploaded successfully! It has been submitted for team leader review.');
        }
      } else {
        alert(data.message || 'Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const clearUploadForm = () => {
    setUploadedFile(null);
    setDescription('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const closeUploadModal = () => {
    setShowUploadModal(false);
    clearUploadForm();
  };

  // Handle file open
  const handleOpenFile = async (file, e) => {
    e.stopPropagation();
    try {
      // Construct the file URL
      const fileUrl = `http://localhost:3001${file.file_path}`;
      
      // Open file in new tab
      window.open(fileUrl, '_blank');
      
      console.log('✅ File opened:', file.original_name);
    } catch (error) {
      console.error('❌ Error opening file:', error);
      alert('Failed to open file. Please try again.');
    }
  };

  // Handle file delete
  const handleDeleteFile = async (file, e) => {
    e.stopPropagation();
    
    // Confirm deletion
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${file.original_name}"?\n\nThis action cannot be undone and will remove the file from both the database and the file system.`
    );
    
    if (!confirmDelete) return;

    setIsDeleting(file.id);
    
    try {
      // First, delete the physical file from the server
      const deleteFileResponse = await fetch(`http://localhost:3001/api/files/${file.id}/delete-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          adminId: user.id,
          adminUsername: user.username,
          adminRole: user.role,
          team: user.team
        })
      });

      const deleteFileData = await deleteFileResponse.json();

      if (!deleteFileData.success) {
        throw new Error(deleteFileData.message || 'Failed to delete physical file');
      }

      console.log('✅ Physical file deleted:', deleteFileData.message);

      // Then, delete the database record
      const deleteRecordResponse = await fetch(`http://localhost:3001/api/files/${file.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          adminId: user.id,
          adminUsername: user.username,
          adminRole: user.role,
          team: user.team
        })
      });

      const deleteRecordData = await deleteRecordResponse.json();

      if (deleteRecordData.success) {
        alert(`File "${file.original_name}" deleted successfully!`);
        
        // Refresh the file list
        fetchUserFiles();
        
        console.log('✅ File record deleted from database');
      } else {
        throw new Error(deleteRecordData.message || 'Failed to delete file record');
      }
    } catch (error) {
      console.error('❌ Error deleting file:', error);
      alert(`Failed to delete file: ${error.message}`);
    } finally {
      setIsDeleting(null);
    }
  };

  // Helper functions
  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    
    if (['pdf'].includes(extension)) {
      return (
        <div className="file-icon-table pdf-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          </svg>
          <span className="file-type-label">PDF</span>
        </div>
      );
    } else if (['doc', 'docx'].includes(extension)) {
      return (
        <div className="file-icon-table docx-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          </svg>
          <span className="file-type-label">DOC</span>
        </div>
      );
    } else if (['xls', 'xlsx'].includes(extension)) {
      return (
        <div className="file-icon-table xlsx-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          </svg>
          <span className="file-type-label">XLS</span>
        </div>
      );
    } else if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
      return (
        <div className="file-icon-table image-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z" />
          </svg>
          <span className="file-type-label">IMG</span>
        </div>
      );
    } else {
      return (
        <div className="file-icon-table default-icon">
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
    });
  };

  const getStatusBadge = (file) => {
    if (file.status === 'final_approved') {
      return <span className="status-badge approved">Approved</span>;
    } else if (file.current_stage.includes('pending')) {
      return <span className="status-badge pending">Pending</span>;
    } else {
      return <span className="status-badge draft">Draft</span>;
    }
  };

  return (
    <div className="my-files-table-section">
      {/* Header */}
      <div className="files-header">
        <div className="header-left">
          <h2>My Files</h2>
          <p>{filteredFiles.length} files • {formatFileSize(filteredFiles.reduce((total, file) => total + file.file_size, 0))} total</p>
        </div>
      </div>

      {/* Controls Row - Search and Upload aligned */}
      <div className="files-controls-row">
        <div className="search-wrapper">
          <svg className="search-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/>
          </svg>
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
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

      {/* Files Table */}
      <div className="files-table-container">
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading your files...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-content">
              <h3>No files found</h3>
              <p>
                {files.length === 0 
                  ? "Ready to upload your first file? Click the Upload Files button to get started." 
                  : "No files match your current search criteria."}
              </p>
            </div>
          </div>
        ) : (
          <table className="files-table">
            <thead>
              <tr>
                <th className="col-file">File</th>
                <th className="col-size">Size</th>
                <th className="col-uploaded">Uploaded</th>
                <th className="col-status">Status</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file) => (
                <tr 
                  key={file.id} 
                  className="file-row"
                  onClick={() => openFileModal(file)}
                >
                  <td className="col-file">
                    <div className="file-info">
                      <div className="file-icon-wrapper">
                        {getFileIcon(file.original_name)}
                      </div>
                      <div className="file-details">
                        <div className="file-name">{file.original_name}</div>
                        <div className="file-type">
                          {file.original_name.split('.').pop().toLowerCase()}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="col-size">
                    <span className="file-size">{formatFileSize(file.file_size)}</span>
                  </td>
                  <td className="col-uploaded">
                    <span className="upload-date">{formatDate(file.uploaded_at)}</span>
                  </td>
                  <td className="col-status">
                    {getStatusBadge(file)}
                  </td>
                  <td className="col-actions">
                    <div className="action-buttons">
                      <button 
                        className="action-btn open"
                        onClick={(e) => handleOpenFile(file, e)}
                        title="Open file"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
                        </svg>
                      </button>
                      <button 
                        className="action-btn view"
                        onClick={(e) => {
                          e.stopPropagation();
                          openFileModal(file);
                        }}
                        title="View details"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/>
                        </svg>
                      </button>
                      {(!file.status || (file.status !== 'final_approved' && !file.current_stage.includes('pending'))) && (
                        <button 
                          className="action-btn delete"
                          onClick={(e) => handleDeleteFile(file, e)}
                          disabled={isDeleting === file.id}
                          title="Delete file"
                        >
                          {isDeleting === file.id ? (
                            <svg viewBox="0 0 24 24" fill="currentColor" className="spinning">
                              <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

              <div className="submission-details">
                <div className="detail-item">
                  <span>Team:</span> <strong>{user?.team}</strong>
                </div>
                <div className="detail-item">
                  <span>Submitted by:</span> <strong>{user?.fullName}</strong>
                </div>
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
    </div>
  );
};

export default MyFilesTabTableView;