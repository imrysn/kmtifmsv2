import { useEffect, useMemo, memo, useCallback } from 'react';
import './css/FileModal.css';

// MySQL datetimes have no timezone suffix — treat them as local time
const parseLocalDate = (str) => {
  if (!str) return null;
  // Already a Date object
  if (str instanceof Date) return str;
  // If it has a Z or +offset it's already UTC-aware — parse normally
  if (/[Zz]|[+-]\d{2}:?\d{2}$/.test(str)) return new Date(str);
  // MySQL format "YYYY-MM-DD HH:MM:SS" — replace space with T so it parses as local
  return new Date(str.replace(' ', 'T'));
};

const formatDate = (str) => {
  const d = parseLocalDate(str);
  if (!d || isNaN(d)) return '';
  return d.toLocaleString();
};

const getStatusBadgeClass = (status) => {
  if (!status) return 'status-uploaded';
  if (status === 'final_approved' || status === 'team_leader_approved') return 'status-approved';
  if (status.includes('rejected')) return 'status-rejected';
  return 'status-uploaded';
};

const getStatusText = (status) => {
  const map = {
    uploaded: 'Uploaded',
    team_leader_approved: 'Team Leader Approved',
    final_approved: 'Final Approved',
    rejected_by_team_leader: 'Rejected by Team Leader',
    rejected_by_admin: 'Rejected by Admin',
  };
  return map[status] || (status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ') : 'Unknown');
};

const getCurrentStageText = (currentStage) => {
  const map = {
    pending_team_leader: 'Pending Team Leader Review',
    pending_admin: 'Pending Admin Review',
    published_to_public: 'Published to Public Network',
    rejected_by_team_leader: 'Rejected by Team Leader',
    rejected_by_admin: 'Rejected by Admin',
  };
  return map[currentStage] || (currentStage ? currentStage.charAt(0).toUpperCase() + currentStage.slice(1).replace(/_/g, ' ') : 'Unknown');
};

const FileModal = memo(({ showFileModal, setShowFileModal, selectedFile, fileComments, formatFileSize }) => {
  const handleClose = useCallback(() => setShowFileModal(false), [setShowFileModal]);

  useEffect(() => {
    if (showFileModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [showFileModal]);

  const tags = useMemo(() => {
    if (!selectedFile?.tags) return [];
    try {
      const parsed = JSON.parse(selectedFile.tags);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [selectedFile?.tags]);

  const formattedCategory = useMemo(() => {
    const cat = selectedFile?.category;
    if (!cat) return '';
    const words = cat.replace(/([A-Z])/g, ' $1').trim().split(/\s+/).filter(Boolean);
    if (words.length <= 1) return cat;
    return `${words[0]} : ${words.slice(1).join(' ')}`;
  }, [selectedFile?.category]);

  if (!showFileModal || !selectedFile) return null;

  return (
    <div
      className="user-file-modal-component modal-overlay"
      onClick={handleClose}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, margin: 0, padding: 0 }}
    >
      <div
        className="modal file-modal"
        onClick={e => e.stopPropagation()}
        style={{ margin: '0 auto', maxWidth: '650px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div className="modal-header">
          <h3>File Details</h3>
          <button onClick={handleClose} className="modal-close">×</button>
        </div>
        <div className="modal-body">
          <div className="file-details-section">
            {selectedFile.assignment_title && (
              <div className="file-detail-row" style={{ borderBottom: '2px solid #4f46e5', marginBottom: '12px', paddingBottom: '12px' }}>
                <span className="detail-label">Task:</span>
                <span className="detail-value" style={{ color: '#000000', fontWeight: '700' }}>{selectedFile.assignment_title}</span>
              </div>
            )}
            <div className="file-detail-row">
              <span className="detail-label">Filename:</span>
              <span className="detail-value">{selectedFile.original_name}</span>
            </div>
            <div className="file-detail-row">
              <span className="detail-label">File Type:</span>
              <span className="detail-value">{selectedFile.file_type}</span>
            </div>
            <div className="file-detail-row">
              <span className="detail-label">File Size:</span>
              <span className="detail-value">{formatFileSize(selectedFile.file_size)}</span>
            </div>
            <div className="file-detail-row">
              <span className="detail-label">Uploaded:</span>
              <span className="detail-value">{formatDate(selectedFile.uploaded_at)}</span>
            </div>
            {selectedFile.description && (
              <div className="file-detail-row">
                <span className="detail-label">Description:</span>
                <span className="detail-value description-text">{selectedFile.description}</span>
              </div>
            )}
            {selectedFile.category && (
              <div className="file-detail-row">
                <span className="detail-label">Category:</span>
                <span className="detail-value"><span className="category-badge">{formattedCategory}</span></span>
              </div>
            )}
            {tags.length > 0 && (
              <div className="file-detail-row">
                <span className="detail-label">Tags:</span>
                <div className="detail-value">
                  <div className="tags-display">
                    {tags.map((tag, i) => <span key={i} className="tag-badge">{tag}</span>)}
                  </div>
                </div>
              </div>
            )}
            <div className="file-detail-row">
              <span className="detail-label">Current Status:</span>
              <div className="status-container">
                <span className={`status-badge ${getStatusBadgeClass(selectedFile.status)}`}>
                  {getStatusText(selectedFile.status)}
                </span>
                <div className="stage-text">{getCurrentStageText(selectedFile.current_stage)}</div>
              </div>
            </div>
            {selectedFile.team_leader_reviewed_at && (
              <div className="review-section">
                <h4>Team Leader Review</h4>
                <div className="review-info">
                  <div className="review-detail"><span className="review-label">Reviewed by:</span><span className="review-value">{selectedFile.team_leader_username}</span></div>
                  <div className="review-detail"><span className="review-label">Review Date:</span><span className="review-value">{formatDate(selectedFile.team_leader_reviewed_at)}</span></div>
                  {selectedFile.team_leader_comments && (
                    <div className="review-detail"><span className="review-label">Comments:</span><span className="review-value">{selectedFile.team_leader_comments}</span></div>
                  )}
                </div>
              </div>
            )}
            {selectedFile.admin_reviewed_at && (
              <div className="review-section">
                <h4>Admin Review</h4>
                <div className="review-info">
                  <div className="review-detail"><span className="review-label">Reviewed by:</span><span className="review-value">{selectedFile.admin_username}</span></div>
                  <div className="review-detail"><span className="review-label">Review Date:</span><span className="review-value">{formatDate(selectedFile.admin_reviewed_at)}</span></div>
                  {selectedFile.admin_comments && (
                    <div className="review-detail"><span className="review-label">Comments:</span><span className="review-value">{selectedFile.admin_comments}</span></div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
});

FileModal.displayName = 'FileModal';
export default FileModal;
