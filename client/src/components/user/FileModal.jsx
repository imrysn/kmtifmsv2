import { memo, useMemo, useCallback, useEffect } from 'react';
import './css/FileModal.css';

// Local helper to format dates reliably
const formatDate = (dateString) => {
  if (!dateString) return 'Unknown';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + 
           ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Unknown';
  }
};

const getStatusText = (status) => {
  const map = {
    'pending': 'Pending',
    'approved': 'Approved',
    'rejected': 'Rejected',
    'pending_team_leader': 'Pending TL',
    'approved_by_team_leader': 'TL Approved',
    'rejected_by_team_leader': 'Rejected by TL',
    'pending_admin': 'Pending Admin',
    'team_leader_approved': 'TL Approved',
    'team_leader_rejected': 'Rejected by TL',
    'admin_approved': 'Admin Approved',
    'admin_rejected': 'Admin Rejected',
    'rejected_by_admin': 'Rejected by Admin',
    'revision': 'Revision'
  };
  return map[status] || (status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ') : 'Unknown');
};

const getStatusBadgeClass = (status) => {
  if (!status) return 'status-uploaded';
  const s = status.toLowerCase();
  if (s.includes('approved')) return 'status-approved';
  if (s.includes('rejected')) return 'status-rejected';
  if (s.includes('pending')) return 'status-pending';
  if (s === 'revision') return 'status-revision';
  return 'status-uploaded';
};

const getCurrentStageText = (currentStage) => {
  const map = {
    'pending_team_leader': 'Team Leader Review',
    'pending_admin': 'Admin Review',
    'team_leader_approved': 'Waiting for Admin',
    'admin_approved': 'Finalized',
    'rejected_by_team_leader': 'Rejected by Team Leader',
    'rejected_by_admin': 'Rejected by Admin'
  };
  return map[currentStage] || (currentStage ? currentStage.charAt(0).toUpperCase() + currentStage.slice(1).replace(/_/g, ' ') : 'Unknown');
};

const FileModal = memo(({ 
  showFileModal, 
  setShowFileModal, 
  selectedFile, 
  formatFileSize,
  onOpenFile
}) => {
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
      const parsed = typeof selectedFile.tags === 'string' ? JSON.parse(selectedFile.tags) : selectedFile.tags;
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

  const isRejectedByTL = selectedFile.status === 'rejected_by_team_leader';
  const isRejectedByAdmin = selectedFile.status === 'rejected_by_admin';

  return (
    <div
      className="user-file-modal-component modal-overlay"
      onClick={handleClose}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, margin: 0, padding: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="modal file-modal"
        onClick={e => e.stopPropagation()}
        style={{ 
          margin: '0 auto', 
          maxWidth: '650px', 
          width: '90%', 
          maxHeight: '85vh', 
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden',
          borderRadius: '16px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
          background: '#fff'
        }}
      >
        <div className="modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>File Details</h3>
          <button onClick={handleClose} className="modal-close" style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#9ca3af' }}>×</button>
        </div>
        
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          <div className="file-details-section">
            {selectedFile.assignment_title && (
              <div className="file-detail-row" style={{ borderBottom: '2px solid #4f46e5', marginBottom: '16px', paddingBottom: '12px' }}>
                <span className="detail-label" style={{ fontSize: '12px', fontWeight: '700', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TASK:</span>
                <span className="detail-value" style={{ color: '#111827', fontWeight: '700', fontSize: '16px' }}>{selectedFile.assignment_title}</span>
              </div>
            )}
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div className="file-detail-item">
                <span className="detail-label" style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Filename</span>
                <span className="detail-value" style={{ fontWeight: '500', color: '#374151', wordBreak: 'break-all' }}>{selectedFile.original_name || selectedFile.filename || selectedFile.fileName || 'Unknown'}</span>
              </div>
              <div className="file-detail-item">
                <span className="detail-label" style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>File Type</span>
                <span className="detail-value" style={{ fontWeight: '500', color: '#374151' }}>{selectedFile.file_type || selectedFile.fileType || selectedFile.extension || 'Unknown'}</span>
              </div>
              <div className="file-detail-item">
                <span className="detail-label" style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>File Size</span>
                <span className="detail-value" style={{ fontWeight: '500', color: '#374151' }}>{formatFileSize(selectedFile.file_size || selectedFile.fileSize || selectedFile.size || 0)}</span>
              </div>
              <div className="file-detail-item">
                <span className="detail-label" style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Uploaded</span>
                <span className="detail-value" style={{ fontWeight: '500', color: '#374151' }}>{formatDate(selectedFile.uploaded_at || selectedFile.submitted_at || selectedFile.createdAt) || 'Unknown'}</span>
              </div>
            </div>

            {selectedFile.description && (
              <div className="file-detail-row" style={{ marginBottom: '16px' }}>
                <span className="detail-label" style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Description</span>
                <span className="detail-value description-text" style={{ color: '#4b5563', lineHeight: '1.5' }}>{selectedFile.description}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '24px', marginBottom: '20px' }}>
              {selectedFile.category && (
                <div className="file-detail-item">
                  <span className="detail-label" style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '6px' }}>Category</span>
                  <span className="category-badge" style={{ background: '#f3f4f6', color: '#374151', padding: '4px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: '500' }}>{formattedCategory}</span>
                </div>
              )}
              {tags.length > 0 && (
                <div className="file-detail-item">
                  <span className="detail-label" style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '6px' }}>Tags</span>
                  <div className="tags-display" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {tags.map((tag, i) => <span key={i} className="tag-badge" style={{ background: '#eff6ff', color: '#1e40af', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>{tag}</span>)}
                  </div>
                </div>
              )}
            </div>

            <div className="file-detail-row" style={{ background: '#f9fafb', padding: '16px', borderRadius: '12px', border: '1px solid #f3f4f6' }}>
              <span className="detail-label" style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '8px' }}>Current Status</span>
              <div className="status-container" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className={`status-badge ${getStatusBadgeClass(selectedFile.status)}`} style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                  {getStatusText(selectedFile.status)}
                </span>
                <div className="stage-text" style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>{getCurrentStageText(selectedFile.current_stage)}</div>
              </div>
            </div>

            {(selectedFile.team_leader_reviewed_at || selectedFile.team_leader_comments || (isRejectedByTL && (selectedFile.rejected_at || selectedFile.rejection_reason))) && (
              <div className="review-section" style={{ marginTop: '24px', padding: '16px', borderRadius: '12px', background: isRejectedByTL ? '#fef2f2' : '#fff9f2', border: `1px solid ${isRejectedByTL ? '#fecaca' : '#ffedd5'}` }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '700', color: isRejectedByTL ? '#991b1b' : '#9a3412' }}>Team Leader Review</h4>
                <div className="review-info" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="review-detail" style={{ fontSize: '13px' }}><span className="review-label" style={{ color: isRejectedByTL ? '#b91c1c' : '#c2410c', fontWeight: '600', marginRight: '8px' }}>Reviewed by:</span><span className="review-value" style={{ color: '#431407' }}>{selectedFile.team_leader_username || (isRejectedByTL ? selectedFile.rejected_by : null)}</span></div>
                  <div className="review-detail" style={{ fontSize: '13px' }}><span className="review-label" style={{ color: isRejectedByTL ? '#b91c1c' : '#c2410c', fontWeight: '600', marginRight: '8px' }}>Review Date:</span><span className="review-value" style={{ color: '#431407' }}>{formatDate(selectedFile.team_leader_reviewed_at || (isRejectedByTL ? selectedFile.rejected_at : null))}</span></div>
                  {(selectedFile.team_leader_comments || (isRejectedByTL && selectedFile.rejection_reason)) && (
                    <div className="review-detail" style={{ fontSize: '13px', marginTop: '4px' }}>
                      <span className="review-label" style={{ color: isRejectedByTL ? '#b91c1c' : '#c2410c', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Comments / Reason:</span>
                      <span className="review-value" style={{ color: '#431407', background: 'rgba(255,255,255,0.5)', padding: '8px', borderRadius: '6px', display: 'block' }}>
                        {selectedFile.team_leader_comments || (isRejectedByTL ? selectedFile.rejection_reason : null)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(selectedFile.admin_reviewed_at || selectedFile.admin_comments || (isRejectedByAdmin && (selectedFile.rejected_at || selectedFile.rejection_reason))) && (
              <div className="review-section" style={{ marginTop: '24px', padding: '16px', borderRadius: '12px', background: isRejectedByAdmin ? '#fef2f2' : '#f5f3ff', border: `1px solid ${isRejectedByAdmin ? '#fecaca' : '#ddd6fe'}` }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '700', color: isRejectedByAdmin ? '#991b1b' : '#5b21b6' }}>Admin Review</h4>
                <div className="review-info" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="review-detail" style={{ fontSize: '13px' }}><span className="review-label" style={{ color: isRejectedByAdmin ? '#b91c1c' : '#7c3aed', fontWeight: '600', marginRight: '8px' }}>Reviewed by:</span><span className="review-value" style={{ color: '#1e1b4b' }}>{selectedFile.admin_username || (isRejectedByAdmin ? selectedFile.rejected_by : null)}</span></div>
                  <div className="review-detail" style={{ fontSize: '13px' }}><span className="review-label" style={{ color: isRejectedByAdmin ? '#b91c1c' : '#7c3aed', fontWeight: '600', marginRight: '8px' }}>Review Date:</span><span className="review-value" style={{ color: '#1e1b4b' }}>{formatDate(selectedFile.admin_reviewed_at || (isRejectedByAdmin ? selectedFile.rejected_at : null))}</span></div>
                  {(selectedFile.admin_comments || (isRejectedByAdmin && selectedFile.rejection_reason)) && (
                    <div className="review-detail" style={{ fontSize: '13px', marginTop: '4px' }}>
                      <span className="review-label" style={{ color: isRejectedByAdmin ? '#b91c1c' : '#7c3aed', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Comments / Reason:</span>
                      <span className="review-value" style={{ color: '#1e1b4b', background: 'rgba(255,255,255,0.5)', padding: '8px', borderRadius: '6px', display: 'block' }}>
                        {selectedFile.admin_comments || (isRejectedByAdmin ? selectedFile.rejection_reason : null)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #f3f4f6', background: '#f9fafb', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={handleClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>Close</button>
          
          {onOpenFile && (
            <button 
              onClick={onOpenFile} 
              style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#4f46e5', color: '#fff', fontSize: '14px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Open File
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

FileModal.displayName = 'FileModal';
export default FileModal;
