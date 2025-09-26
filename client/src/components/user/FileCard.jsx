import './css/FileCard.css';

const FileCard = ({ file, formatFileSize, onFileClick }) => {
  const getStatusBadgeClass = (status, currentStage) => {
    if (status === 'final_approved') return 'status-approved';
    if (status.includes('rejected')) return 'status-rejected';
    if (currentStage.includes('pending')) return 'status-pending';
    return 'status-uploaded';
  };

  const getStatusText = (status, currentStage) => {
    switch (status) {
      case 'uploaded':
        return 'Uploaded';
      case 'team_leader_approved':
        return 'Team Leader Approved';
      case 'final_approved':
        return 'Final Approved';
      case 'rejected_by_team_leader':
        return 'Rejected by Team Leader';
      case 'rejected_by_admin':
        return 'Rejected by Admin';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
    }
  };

  const getCurrentStageText = (currentStage) => {
    switch (currentStage) {
      case 'pending_team_leader':
        return 'Pending Team Leader Review';
      case 'pending_admin':
        return 'Pending Admin Review';
      case 'published_to_public':
        return 'Published to Public Network';
      case 'rejected_by_team_leader':
        return 'Rejected by Team Leader';
      case 'rejected_by_admin':
        return 'Rejected by Admin';
      default:
        return currentStage.charAt(0).toUpperCase() + currentStage.slice(1).replace('_', ' ');
    }
  };

  return (
    <div 
      className="file-card"
      onClick={() => onFileClick(file)}
    >
      <div className="file-header">
        <div className="file-icon-large">
          {file.file_type.split(' ')[0].slice(0, 3).toUpperCase()}
        </div>
        <div className="file-basic-info">
          <h3 className="file-name">{file.original_name}</h3>
          <p className="file-size">{formatFileSize(file.file_size)}</p>
        </div>
      </div>
      
      <div className="file-content">
        <div className="file-description">
          {file.description || 'No description provided'}
        </div>
        
        <div className="file-meta">
          <div className="meta-item">
            <span className="meta-label">Type:</span>
            <span className="meta-value">{file.file_type}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Uploaded:</span>
            <span className="meta-value">{new Date(file.uploaded_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
      
      <div className="file-footer">
        <div className="file-status-info">
          <div className={`status-badge ${getStatusBadgeClass(file.status, file.current_stage)}`}>
            {getStatusText(file.status, file.current_stage)}
          </div>
          <div className="current-stage">
            {getCurrentStageText(file.current_stage)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileCard;