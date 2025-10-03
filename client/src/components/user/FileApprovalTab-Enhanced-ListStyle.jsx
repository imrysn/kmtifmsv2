import React, { useState } from 'react';
import './css/FileApprovalTab-Enhanced-ListStyle.css';

const FileApprovalTab = ({ 
  user,
  files,
  isLoading,
  formatFileSize,
  openFileModal,
  onWithdrawFile
}) => {
  
  // State for status filter
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Calculate statistics
  const pendingFiles = files.filter(f => f.current_stage.includes('pending'));
  const approvedFiles = files.filter(f => f.status === 'final_approved');
  const rejectedFiles = files.filter(f => f.status.includes('rejected'));

  const handleWithdraw = async (fileId) => {
    if (window.confirm('Are you sure you want to withdraw this file? This action cannot be undone.')) {
      try {
        const response = await fetch(`http://localhost:3001/api/files/${fileId}/withdraw`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            reason: 'Withdrawn by user'
          })
        });

        const data = await response.json();
        if (data.success) {
          onWithdrawFile(fileId);
        } else {
          alert('Failed to withdraw file: ' + data.message);
        }
      } catch (error) {
        console.error('Error withdrawing file:', error);
        alert('Failed to withdraw file. Please try again.');
      }
    }
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
      month: 'short',
      day: 'numeric'
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
      return <span className="status-badge approved">Approved</span>;
    } else if (file.current_stage.includes('pending')) {
      return <span className="status-badge pending">Under Review</span>;
    } else {
      return <span className="status-badge rejected">Rejected</span>;
    }
  };

  // Filter files based on selected status
  const getFilteredFiles = () => {
    switch (statusFilter) {
      case 'pending':
        return pendingFiles;
      case 'approved':
        return approvedFiles;
      case 'rejected':
        return rejectedFiles;
      case 'all':
      default:
        return files;
    }
  };

  const filteredFiles = getFilteredFiles();

  if (isLoading) {
    return (
      <div className="approvals-section">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your file approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="approvals-section">
      {/* Header */}
      <div className="approvals-header">
        <div className="header-left">
          <h2>File Approvals</h2>
          <p>{files.length} submissions • Track the status of your submitted files</p>
        </div>
        <div className="header-stats">
          <div className="stat-item">
            <span className="stat-number pending-color">{pendingFiles.length}</span>
            <span className="stat-label">Pending</span>
          </div>
          <div className="stat-item">
            <span className="stat-number approved-color">{approvedFiles.length}</span>
            <span className="stat-label">Approved</span>
          </div>
          <div className="stat-item">
            <span className="stat-number rejected-color">{rejectedFiles.length}</span>
            <span className="stat-label">Rejected</span>
          </div>
        </div>
      </div>

      {/* Filter Dropdown */}
      <div className="approvals-controls">
        <div className="filter-wrapper">
          <svg viewBox="0 0 24 24" fill="currentColor" className="filter-icon">
            <path d="M14,12V19.88C14.04,20.18 13.94,20.5 13.71,20.71C13.32,21.1 12.69,21.1 12.3,20.71L10.29,18.7C10.06,18.47 9.96,18.16 10,17.87V12H9.97L4.21,4.62C3.87,4.19 3.95,3.56 4.38,3.22C4.57,3.08 4.78,3 5,3V3H19V3C19.22,3 19.43,3.08 19.62,3.22C20.05,3.56 20.13,4.19 19.79,4.62L14.03,12H14Z"/>
          </svg>
          <label htmlFor="status-filter">Filter by Status</label>
          <select 
            id="status-filter"
            className="status-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Submissions ({files.length})</option>
            <option value="pending">Pending ({pendingFiles.length})</option>
            <option value="approved">Approved ({approvedFiles.length})</option>
            <option value="rejected">Rejected ({rejectedFiles.length})</option>
          </select>
        </div>
      </div>

      {/* Files List Container */}
      <div className="approvals-container-list">
        {filteredFiles.length > 0 ? (
          <>
            {/* Pending Files Section */}
            {filteredFiles.some(f => f.current_stage.includes('pending')) && (
              <div className="approvals-group">
                <div className="group-header">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="group-icon pending">
                    <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M16.2,16.2L11,13V7H12.5V12.2L17,14.9L16.2,16.2Z"/>
                  </svg>
                  <span className="group-title">Pending Review</span>
                  <span className="group-count">({filteredFiles.filter(f => f.current_stage.includes('pending')).length})</span>
                </div>
                <div className="files-list">
                  {filteredFiles
                    .filter(f => f.current_stage.includes('pending'))
                    .map((file) => {
                      const tags = getTags(file);
                      return (
                        <div key={file.id} className="file-item" onClick={() => openFileModal(file)}>
                          <div className="file-icon-wrapper">
                            {getFileIcon(file.original_name)}
                          </div>
                          <div className="file-info">
                            <h3 className="file-name">{file.original_name}</h3>
                            <div className="file-metadata">
                              <p className="file-size">{formatFileSize(file.file_size)}</p>
                              <p className="file-date">{formatDate(file.uploaded_at)}</p>
                              {tags.length > 0 && (
                                <>
                                  {tags.slice(0, 2).map((tag, index) => (
                                    <span key={index} className="file-tag-badge">{tag}</span>
                                  ))}
                                  {tags.length > 2 && (
                                    <span className="tag-more">+{tags.length - 2} more</span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          <div className="file-status-wrapper">
                            {getStatusDisplay(file)}
                          </div>
                          <div className="file-actions">
                            <button 
                              className="action-btn details"
                              onClick={(e) => {
                                e.stopPropagation();
                                openFileModal(file);
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/>
                              </svg>
                              Details
                            </button>
                            <button 
                              className="action-btn withdraw"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleWithdraw(file.id);
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                              </svg>
                              Withdraw
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Approved Files Section */}
            {filteredFiles.some(f => f.status === 'final_approved') && (
              <div className="approvals-group">
                <div className="group-header">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="group-icon approved">
                    <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
                  </svg>
                  <span className="group-title">Approved</span>
                  <span className="group-count">({filteredFiles.filter(f => f.status === 'final_approved').length})</span>
                </div>
                <div className="files-list">
                  {filteredFiles
                    .filter(f => f.status === 'final_approved')
                    .map((file) => {
                      const tags = getTags(file);
                      return (
                        <div key={file.id} className="file-item-compact" onClick={() => openFileModal(file)}>
                          <div className="file-icon-wrapper">
                            {getFileIcon(file.original_name)}
                          </div>
                          <div className="file-info-compact">
                            <h3 className="file-name">{file.original_name}</h3>
                            <div className="file-metadata">
                              <p className="file-size">{formatFileSize(file.file_size)}</p>
                              <p className="file-date">{formatDate(file.uploaded_at)}</p>
                            </div>
                            {tags.length > 0 && (
                              <div className="file-tags-row">
                                <svg viewBox="0 0 24 24" fill="currentColor" className="tag-icon">
                                  <path d="M5.5,7A1.5,1.5 0 0,1 4,5.5A1.5,1.5 0 0,1 5.5,4A1.5,1.5 0 0,1 7,5.5A1.5,1.5 0 0,1 5.5,7M21.41,11.58L12.41,2.58C12.05,2.22 11.55,2 11,2H4C2.89,2 2,2.89 2,4V11C2,11.55 2.22,12.05 2.59,12.41L11.58,21.41C11.95,21.77 12.45,22 13,22C13.55,22 14.05,21.77 14.41,21.41L21.41,14.41C21.77,14.05 22,13.55 22,13C22,12.45 21.77,11.95 21.41,11.58Z"/>
                                </svg>
                                {tags.slice(0, 2).map((tag, index) => (
                                  <span key={index} className="file-tag-badge-inline">{tag}</span>
                                ))}
                                {tags.length > 2 && (
                                  <span className="tag-more-inline">+{tags.length - 2} more</span>
                                )}
                              </div>
                            )}
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

            {/* Rejected Files Section */}
            {filteredFiles.some(f => f.status.includes('rejected')) && (
              <div className="approvals-group">
                <div className="group-header">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="group-icon rejected">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                  </svg>
                  <span className="group-title">Rejected</span>
                  <span className="group-count">({filteredFiles.filter(f => f.status.includes('rejected')).length})</span>
                </div>
                <div className="files-list">
                  {filteredFiles
                    .filter(f => f.status.includes('rejected'))
                    .map((file) => {
                      const tags = getTags(file);
                      return (
                        <div key={file.id} className="file-item-compact" onClick={() => openFileModal(file)}>
                          <div className="file-icon-wrapper">
                            {getFileIcon(file.original_name)}
                          </div>
                          <div className="file-info-compact">
                            <h3 className="file-name">{file.original_name}</h3>
                            <div className="file-metadata">
                              <p className="file-size">{formatFileSize(file.file_size)}</p>
                              <p className="file-date">{formatDate(file.uploaded_at)}</p>
                            </div>
                            {tags.length > 0 && (
                              <div className="file-tags-row">
                                <svg viewBox="0 0 24 24" fill="currentColor" className="tag-icon">
                                  <path d="M5.5,7A1.5,1.5 0 0,1 4,5.5A1.5,1.5 0 0,1 5.5,4A1.5,1.5 0 0,1 7,5.5A1.5,1.5 0 0,1 5.5,7M21.41,11.58L12.41,2.58C12.05,2.22 11.55,2 11,2H4C2.89,2 2,2.89 2,4V11C2,11.55 2.22,12.05 2.59,12.41L11.58,21.41C11.95,21.77 12.45,22 13,22C13.55,22 14.05,21.77 14.41,21.41L21.41,14.41C21.77,14.05 22,13.55 22,13C22,12.45 21.77,11.95 21.41,11.58Z"/>
                                </svg>
                                {tags.slice(0, 2).map((tag, index) => (
                                  <span key={index} className="file-tag-badge-inline">{tag}</span>
                                ))}
                                {tags.length > 2 && (
                                  <span className="tag-more-inline">+{tags.length - 2} more</span>
                                )}
                              </div>
                            )}
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
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-content">
              <h3>No {statusFilter === 'all' ? '' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Files</h3>
              <p>
                {files.length === 0 
                  ? "You haven't submitted any files for approval yet." 
                  : "No files match the selected filter."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Empty State for No Files */}
      {files.length === 0 && (
        <div className="approvals-container-list">
          <div className="empty-state">
            <div className="empty-illustration">
              <svg viewBox="0 0 200 160" fill="none">
                <circle cx="100" cy="80" r="60" stroke="#E5E7EB" strokeWidth="2" fill="#F9FAFB"/>
                <path d="M70 80l15 15 30-30" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="empty-content">
              <h3>No File Submissions Yet</h3>
              <p>Once you submit files for approval, you'll be able to track their status here.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileApprovalTab;
