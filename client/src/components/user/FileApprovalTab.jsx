import './css/FileApprovalTab.css';

const FileApprovalTab = ({ 
  user,
  files,
  isLoading,
  formatFileSize,
  openFileModal,
  onWithdrawFile
}) => {
  
  // Helper function to open file (reverted to original)
  const openFile = (file) => {
    const fileUrl = `http://localhost:3001${file.file_path}`;
    window.open(fileUrl, '_blank');
  };
  
  // Calculate statistics
  const pendingFiles = files.filter(f => f.status === 'uploaded' || f.status === 'team_leader_approved');
  const approvedFiles = files.filter(f => f.status === 'final_approved');
  const rejectedFiles = files.filter(f => f.status === 'rejected_by_team_leader' || f.status === 'rejected_by_admin');

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

  const getFileIcon = (fileName, fileType) => {
    const extension = fileName.split('.').pop().toLowerCase();
    
    if (['pdf'].includes(extension)) {
      return '📄';
    } else if (['doc', 'docx'].includes(extension)) {
      return '📘';
    } else if (['xls', 'xlsx'].includes(extension)) {
      return '📊';
    } else if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
      return '🖼️';
    } else if (['zip', 'rar'].includes(extension)) {
      return '📦';
    } else {
      return '📄';
    }
  };

  const FileItem = ({ file, showWithdraw = false }) => (
    <div className="approval-file-item" onClick={() => openFile(file)}>
      <div className="file-icon-section">
        <div className={`file-type-icon ${file.file_type.includes('PDF') ? 'pdf' : 'doc'}`}>
          {getFileIcon(file.original_name, file.file_type)}
        </div>
      </div>
      
      <div className="file-info-section">
        <h4 className="file-title">{file.original_name}</h4>
        <p className="file-size">{formatFileSize(file.file_size)}</p>
      </div>

      <div className="file-status-section">
        {file.status === 'final_approved' ? (
          <span className="status-badge approved">
            <span className="status-icon">✓</span> Final Approved
          </span>
        ) : file.status === 'uploaded' ? (
          <span className="status-badge pending">
            <span className="status-icon">⏱</span> Pending Team Leader Review
          </span>
        ) : file.status === 'team_leader_approved' ? (
          <span className="status-badge pending">
            <span className="status-icon">⏱</span> Pending Admin Review
          </span>
        ) : file.status.includes('rejected') ? (
          <span className="status-badge rejected">
            <span className="status-icon">✗</span> Rejected
          </span>
        ) : null}
      </div>

      <div className="file-actions-section">
        {showWithdraw && (
          <button 
            className="action-btn withdraw"
            onClick={(e) => {
              e.stopPropagation();
              handleWithdraw(file.id);
            }}
          >
            Withdraw
          </button>
        )}
        <button 
          className="action-btn details"
          onClick={(e) => {
            e.stopPropagation();
            openFile(file);
          }}
        >
          <span className="action-icon">👁</span> Open
        </button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="user-file-approval-component file-approvals-section">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your file approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-file-approval-component file-approvals-section">
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
          <div className="stat-icon">⏱</div>
          <div className="stat-number">{pendingFiles.length}</div>
          <div className="stat-label">Pending</div>
        </div>
        
        <div className="stat-card approved">
          <div className="stat-icon">✓</div>
          <div className="stat-number">{approvedFiles.length}</div>
          <div className="stat-label">Approved</div>
        </div>
        
        <div className="stat-card rejected">
          <div className="stat-icon">✗</div>
          <div className="stat-number">{rejectedFiles.length}</div>
          <div className="stat-label">Rejected</div>
        </div>
      </div>



      {/* Pending Files Section */}
      {pendingFiles.length > 0 && (
        <div className="approval-section">
          <div className="section-header pending">
            <span className="section-icon">⏱</span>
            <h3>Pending Review ({pendingFiles.length})</h3>
          </div>
          <div className="files-list">
            {pendingFiles.map(file => (
              <FileItem 
                key={file.id} 
                file={file} 
                showWithdraw={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Approved Files Section */}
      {approvedFiles.length > 0 && (
        <div className="approval-section">
          <div className="section-header approved">
            <span className="section-icon">✓</span>
            <h3>Approved ({approvedFiles.length})</h3>
          </div>
          <div className="files-list">
            {approvedFiles.map(file => (
              <FileItem 
                key={file.id} 
                file={file} 
                showWithdraw={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* Rejected Files Section */}
      {rejectedFiles.length > 0 && (
        <div className="approval-section">
          <div className="section-header rejected">
            <span className="section-icon">✗</span>
            <h3>Rejected ({rejectedFiles.length})</h3>
          </div>
          <div className="files-list">
            {rejectedFiles.map(file => (
              <FileItem 
                key={file.id} 
                file={file} 
                showWithdraw={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {files.length === 0 && (
        <div className="empty-approvals">
          <div className="empty-icon">📋</div>
          <h3>No File Submissions</h3>
          <p>You haven't submitted any files for approval yet.</p>
          <button 
            className="btn btn-primary"
            onClick={() => window.location.href = '#my-files'}
          >
            Go to My Files
          </button>
        </div>
      )}
    </div>
  );
};

export default FileApprovalTab;
