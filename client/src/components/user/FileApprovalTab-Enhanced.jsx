import React, { useState } from 'react';
import './css/FileApprovalTab-Enhanced.css';

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
        <div className="approval-file-icon pdf-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          </svg>
        </div>
      );
    } else if (['doc', 'docx'].includes(extension)) {
      return (
        <div className="approval-file-icon docx-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          </svg>
        </div>
      );
    } else if (['xls', 'xlsx'].includes(extension)) {
      return (
        <div className="approval-file-icon xlsx-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          </svg>
        </div>
      );
    } else {
      return (
        <div className="approval-file-icon default-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          </svg>
        </div>
      );
    }
  };

  const getStatusInfo = (file) => {
    if (file.status === 'final_approved') {
      return {
        badge: (
          <span className="status-badge approved">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
            </svg>
            Approved
          </span>
        ),
        color: 'approved'
      };
    } else if (file.current_stage.includes('pending')) {
      return {
        badge: (
          <span className="status-badge pending">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M16.2,16.2L11,13V7H12.5V12.2L17,14.9L16.2,16.2Z"/>
            </svg>
            Under Review
          </span>
        ),
        color: 'pending'
      };
    } else {
      return {
        badge: (
          <span className="status-badge rejected">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
            </svg>
            Rejected
          </span>
        ),
        color: 'rejected'
      };
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

  // Parse tags from JSON string - show all tags
  const getTags = (file) => {
    if (!file.tags) return [];
    try {
      const tags = JSON.parse(file.tags);
      if (!Array.isArray(tags)) return [];
      return tags;
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

  const FileCard = ({ file, showWithdraw = false }) => {
    const statusInfo = getStatusInfo(file);
    const tags = getTags(file);
    
    return (
      <div className={`approval-file-card ${statusInfo.color}`}>
        <div className="file-card-main">
          <div className="file-icon-wrapper">
            {getFileIcon(file.original_name)}
          </div>
          
          <div className="file-info-section">
            <div className="file-header-row">
              <h3 className="file-name">{file.original_name}</h3>
              <div className="status-section-inline">
                {statusInfo.badge}
              </div>
            </div>
            
            <div className="file-metadata-row">
              <div className="file-details">
                <span className="file-size">{formatFileSize(file.file_size)}</span>
                <span className="file-date">{formatDate(file.uploaded_at)}</span>
              </div>
            </div>
            
            {/* Tags Display */}
            {tags.length > 0 && (
              <div className="file-metadata-row">
                <div className="tags-display">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="metadata-icon">
                    <path d="M5.5,7A1.5,1.5 0 0,1 4,5.5A1.5,1.5 0 0,1 5.5,4A1.5,1.5 0 0,1 7,5.5A1.5,1.5 0 0,1 5.5,7M21.41,11.58L12.41,2.58C12.05,2.22 11.55,2 11,2H4C2.89,2 2,2.89 2,4V11C2,11.55 2.22,12.05 2.59,12.41L11.58,21.41C11.95,21.77 12.45,22 13,22C13.55,22 14.05,21.77 14.41,21.41L21.41,14.41C21.77,14.05 22,13.55 22,13C22,12.45 21.77,11.95 21.41,11.58Z"/>
                  </svg>
                  <div className="tags-list-inline">
                    {tags.slice(0, 2).map((tag, index) => (
                      <span key={index} className="tag-badge-inline">{tag}</span>
                    ))}
                    {tags.length > 2 && (
                      <span className="tag-more-inline">+{tags.length - 2} more</span>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <div className="file-actions">
              <button 
                className="action-btn details-btn"
                onClick={() => openFileModal(file)}
                title="View details"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/>
                </svg>
                Details
              </button>
              
              {showWithdraw && (
                <button 
                  className="action-btn withdraw-btn"
                  onClick={() => handleWithdraw(file.id)}
                  title="Withdraw file"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                  </svg>
                  Withdraw
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="approvals-loading">
        <div className="loading-spinner"></div>
        <p>Loading your file approvals...</p>
      </div>
    );
  }

  return (
    <div className="file-approvals-section">
      {/* Header */}
      <div className="approvals-header">
        <div className="header-content">
          <div className="header-text">
            <h2>File Approvals</h2>
            <p>Track the status of all your submitted files through the approval workflow.</p>
          </div>
          <div className="header-stats">
            <div className="quick-stat">
              <span className="stat-number">{files.length}</span>
              <span className="stat-label">Total Submissions</span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Dropdown */}
      <div className="stats-dropdown-container">
        <div className="dropdown-wrapper">
          <label htmlFor="status-filter" className="dropdown-label">
            <svg viewBox="0 0 24 24" fill="currentColor" className="filter-icon">
              <path d="M14,12V19.88C14.04,20.18 13.94,20.5 13.71,20.71C13.32,21.1 12.69,21.1 12.3,20.71L10.29,18.7C10.06,18.47 9.96,18.16 10,17.87V12H9.97L4.21,4.62C3.87,4.19 3.95,3.56 4.38,3.22C4.57,3.08 4.78,3 5,3V3H19V3C19.22,3 19.43,3.08 19.62,3.22C20.05,3.56 20.13,4.19 19.79,4.62L14.03,12H14Z"/>
            </svg>
            Filter by Status
          </label>
          <select 
            id="status-filter"
            className="status-filter-dropdown"
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

      {/* File Lists */}
      <div className="approvals-content">
        {filteredFiles.length > 0 ? (
          <div className="files-list-vertical">
            {filteredFiles.map(file => (
              <FileCard 
                key={file.id} 
                file={file} 
                showWithdraw={file.current_stage.includes('pending')}
              />
            ))}
          </div>
        ) : (
          <div className="empty-filter-state">
            <div className="empty-illustration">
              <svg viewBox="0 0 200 160" fill="none">
                <circle cx="100" cy="80" r="60" stroke="#E5E7EB" strokeWidth="2" fill="#F9FAFB"/>
                <path d="M70 80l15 15 30-30" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="empty-content">
              <h3>No {statusFilter === 'all' ? '' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Files</h3>
              <p>No files found with the selected status filter.</p>
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {files.length === 0 && (
        <div className="empty-approvals">
          <div className="empty-illustration">
            <svg viewBox="0 0 200 160" fill="none">
              <circle cx="100" cy="80" r="60" stroke="#E5E7EB" strokeWidth="2" fill="#F9FAFB"/>
              <path d="M70 80l15 15 30-30" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="160" cy="40" r="12" stroke="#E5E7EB" strokeWidth="2" fill="#F9FAFB"/>
              <circle cx="40" cy="40" r="8" stroke="#E5E7EB" strokeWidth="2" fill="#F9FAFB"/>
              <circle cx="170" cy="120" r="10" stroke="#E5E7EB" strokeWidth="2" fill="#F9FAFB"/>
            </svg>
          </div>
          <div className="empty-content">
            <h3>No File Submissions Yet</h3>
            <p>Once you submit files for approval, you'll be able to track their status here.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileApprovalTab;
