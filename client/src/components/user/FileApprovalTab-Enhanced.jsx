import React from 'react';
import './css/FileApprovalTab-Enhanced.css';

const FileApprovalTab = ({ 
  user,
  files,
  isLoading,
  formatFileSize,
  openFileModal,
  onWithdrawFile
}) => {
  
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

  const FileCard = ({ file, showWithdraw = false }) => {
    const statusInfo = getStatusInfo(file);
    
    return (
      <div className={`approval-file-card ${statusInfo.color}`}>
        <div className="file-card-header">
          <div className="file-icon-wrapper">
            {getFileIcon(file.original_name)}
          </div>
          <div className="file-meta">
            <h3 className="file-name">{file.original_name}</h3>
            <div className="file-details">
              <span className="file-size">{formatFileSize(file.file_size)}</span>
              <span className="file-date">{formatDate(file.uploaded_at)}</span>
            </div>
          </div>
        </div>
        
        <div className="file-card-body">
          <div className="status-section">
            {statusInfo.badge}
          </div>
          
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

      {/* Statistics Cards */}
      <div className="stats-overview">
        <div className="stat-card pending-stat">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M16.2,16.2L11,13V7H12.5V12.2L17,14.9L16.2,16.2Z"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-number">{pendingFiles.length}</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>
        
        <div className="stat-card approved-stat">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-number">{approvedFiles.length}</div>
            <div className="stat-label">Approved</div>
          </div>
        </div>
        
        <div className="stat-card rejected-stat">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-number">{rejectedFiles.length}</div>
            <div className="stat-label">Rejected</div>
          </div>
        </div>
      </div>

      {/* File Lists */}
      <div className="approvals-content">
        {/* Pending Files */}
        {pendingFiles.length > 0 && (
          <div className="approval-section pending-section">
            <div className="section-header">
              <div className="section-icon pending">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M16.2,16.2L11,13V7H12.5V12.2L17,14.9L16.2,16.2Z"/>
                </svg>
              </div>
              <div className="section-title">
                <h3>Pending Review</h3>
                <span className="section-count">({pendingFiles.length})</span>
              </div>
            </div>
            <div className="files-grid">
              {pendingFiles.map(file => (
                <FileCard 
                  key={file.id} 
                  file={file} 
                  showWithdraw={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* Approved Files */}
        {approvedFiles.length > 0 && (
          <div className="approval-section approved-section">
            <div className="section-header">
              <div className="section-icon approved">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                </svg>
              </div>
              <div className="section-title">
                <h3>Approved</h3>
                <span className="section-count">({approvedFiles.length})</span>
              </div>
            </div>
            <div className="files-grid">
              {approvedFiles.map(file => (
                <FileCard 
                  key={file.id} 
                  file={file} 
                  showWithdraw={false}
                />
              ))}
            </div>
          </div>
        )}

        {/* Rejected Files */}
        {rejectedFiles.length > 0 && (
          <div className="approval-section rejected-section">
            <div className="section-header">
              <div className="section-icon rejected">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
              </div>
              <div className="section-title">
                <h3>Rejected</h3>
                <span className="section-count">({rejectedFiles.length})</span>
              </div>
            </div>
            <div className="files-grid">
              {rejectedFiles.map(file => (
                <FileCard 
                  key={file.id} 
                  file={file} 
                  showWithdraw={false}
                />
              ))}
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