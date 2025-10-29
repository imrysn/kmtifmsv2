import FileIcon from '../admin/FileIcon';
import './css/FileCard.css';

const FileCard = ({ file, formatFileSize, onFileClick }) => {
  // Parse tags from JSON string and filter for Parts tags without parentheses
  const getTags = () => {
    if (!file.tags) return [];
    try {
      const tags = JSON.parse(file.tags);
      if (!Array.isArray(tags)) return [];
      
      // Filter: only tags containing 'Parts' (case insensitive) and without parentheses
      return tags.filter(tag => {
        const tagStr = String(tag);
        const hasParts = tagStr.toLowerCase().includes('parts');
        const hasParentheses = tagStr.includes('(') || tagStr.includes(')');
        return hasParts && !hasParentheses;
      });
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

  // Get file extension from filename or file type
  const getFileExtension = () => {
    if (file.original_name) {
      const ext = file.original_name.split('.').pop().toLowerCase();
      return ext;
    }
    return file.file_type.toLowerCase();
  };

  const tags = getTags();

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
      className="user-file-card-component file-card"
      onClick={() => onFileClick(file)}
    >
      <div className="file-card-horizontal">
        {/* Left: File Icon */}
        <div className="file-icon-large">
          <FileIcon 
            fileType={getFileExtension()} 
            isFolder={false}
            size="large"
            altText={`${file.file_type} file`}
          />
        </div>
        
        {/* Center: All File Details */}
        <div className="file-details-section">
          <div className="file-main-info">
            <h3 className="file-name">{file.original_name}</h3>
            <p className="file-size">{formatFileSize(file.file_size)}</p>
          </div>
          
          {/* Category Display */}
          {file.category && (
            <div className="file-category">
              <span className="category-text">{formatCategory(file.category)}</span>
            </div>
          )}
          
          {/* Tags Display */}
          {tags.length > 0 && (
            <div className="file-tags-inline">
              <span className="tags-label">Tags:</span>
              <div className="tags-dropdown-inline">
                <button className="tags-dropdown-button">
                  <span>Parts Tags ({tags.length})</span>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="dropdown-icon">
                    <path d="M7,10L12,15L17,10H7Z"/>
                  </svg>
                </button>
                <div className="tags-dropdown-content">
                  {tags.map((tag, index) => (
                    <div key={index} className="tag-item">{tag}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Additional Metadata */}
          <div className="file-metadata-row">
            <span className="metadata-item">
              <span className="metadata-label">Type:</span>
              <span className="metadata-value">{file.file_type}</span>
            </span>
            <span className="metadata-divider">•</span>
            <span className="metadata-item">
              <span className="metadata-label">Uploaded:</span>
              <span className="metadata-value">{new Date(file.uploaded_at).toLocaleDateString()}</span>
            </span>
          </div>
        </div>
        
        {/* Right: Status Info */}
        <div className="file-status-section">
          <div className={`status-badge ${getStatusBadgeClass(file.status, file.current_stage)}`}>
            {getStatusText(file.status, file.current_stage)}
          </div>
          <div className="status-stage">
            ✓ {getCurrentStageText(file.current_stage)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileCard;
