import { memo, useMemo, useCallback, useEffect } from 'react';
import './css/FileModal.css';

const formatDate = (dateString) => {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
           ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch { return null; }
};

const STATUS_CONFIG = {
  uploaded:                 { label: 'Pending Review',          bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: '⏳' },
  revision:                 { label: 'Checked – Need to Edit',  bg: '#fffbeb', color: '#92400e', border: '#fde68a', icon: '✎' },
  under_revision:           { label: 'Under Revision',          bg: '#fffbeb', color: '#92400e', border: '#fde68a', icon: '✎' },
  checked:                  { label: 'Checked',                 bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: '✓' },
  team_leader_approved:     { label: 'Pending Admin',           bg: '#fefce8', color: '#713f12', border: '#fde68a', icon: '⏳' },
  final_approved:           { label: 'Approved',                bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', icon: '✓' },
  rejected_by_team_leader:  { label: 'Rejected by Team Leader', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', icon: '✕' },
  rejected_by_admin:        { label: 'Rejected by Admin',       bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', icon: '✕' },
};

const getStatusConfig = (status) => {
  if (!status) return { label: 'Unknown', bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb', icon: '?' };
  return STATUS_CONFIG[status] || { label: status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb', icon: '•' };
};

const STAGE_LABELS = {
  pending_team_leader: 'Team Leader Review',
  pending_admin: 'Admin Review',
  team_leader_approved: 'Waiting for Admin',
  admin_approved: 'Finalized',
  published_to_public: 'Published',
  rejected_by_team_leader: 'Rejected by Team Leader',
  rejected_by_admin: 'Rejected by Admin',
};

// Parse "Wrong items: Scale, Standard Notes" from checker_note
const parseWrongItems = (note) => {
  if (!note) return [];
  const match = note.match(/Wrong items?:\s*(.+)/i);
  if (match) {
    return match[1].split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
};

const InfoRow = ({ label, value, mono = false }) => (
  value ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <span style={{ fontSize: '10px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
      <span style={{ fontSize: '13.5px', fontWeight: '500', color: '#1f2937', wordBreak: mono ? 'break-all' : 'normal', fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</span>
    </div>
  ) : null
);

const FileModal = memo(({
  showFileModal,
  setShowFileModal,
  selectedFile,
  formatFileSize,
  onOpenFile
}) => {
  const handleClose = useCallback(() => setShowFileModal(false), [setShowFileModal]);

  useEffect(() => {
    document.body.style.overflow = showFileModal ? 'hidden' : 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [showFileModal]);

  const tags = useMemo(() => {
    if (!selectedFile?.tags) return [];
    try {
      const p = typeof selectedFile.tags === 'string' ? JSON.parse(selectedFile.tags) : selectedFile.tags;
      return Array.isArray(p) ? p : [];
    } catch { return []; }
  }, [selectedFile?.tags]);

  if (!showFileModal || !selectedFile) return null;

  const st = getStatusConfig(selectedFile.status);
  const isRejected = selectedFile.status === 'rejected_by_team_leader' || selectedFile.status === 'rejected_by_admin';
  const isCheckerRevision = selectedFile.status === 'revision';
  const isChecked = selectedFile.status === 'checked';
  const wrongItems = parseWrongItems(selectedFile.checker_note);
  const stageLabel = STAGE_LABELS[selectedFile.current_stage] || (selectedFile.current_stage ? selectedFile.current_stage.replace(/_/g, ' ') : null);

  const filename = selectedFile.original_name || selectedFile.filename || selectedFile.fileName || 'Unknown';
  const ext = filename.includes('.') ? filename.split('.').pop().toUpperCase() : null;

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: '20px', backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '580px',
          maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
          padding: '20px 22px 18px',
          position: 'relative',
          flexShrink: 0,
        }}>
          {/* close */}
          <button onClick={handleClose} style={{
            position: 'absolute', top: '14px', right: '16px',
            background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
            width: '28px', height: '28px', cursor: 'pointer', color: '#fff',
            fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>

          {/* file type chip + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            {ext && (
              <div style={{
                background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '8px', padding: '4px 10px', fontSize: '11px',
                fontWeight: '700', color: '#fff', letterSpacing: '0.08em',
              }}>{ext}</div>
            )}
            <span style={{
              fontSize: '13px', color: 'rgba(255,255,255,0.85)', fontWeight: '500',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
            }}>{filename}</span>
          </div>

          {/* task name */}
          {selectedFile.assignment_title && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>Task</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>{selectedFile.assignment_title}</div>
            </div>
          )}

          {/* Status pill */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: st.bg, border: `1px solid ${st.border}`, borderRadius: '20px', padding: '5px 14px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: st.color }}>{st.icon} {st.label}</span>
            {stageLabel && (
              <span style={{ fontSize: '11px', color: st.color, opacity: 0.75, borderLeft: `1px solid ${st.border}`, paddingLeft: '8px', marginLeft: '2px' }}>{stageLabel}</span>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>

          {/* Checker revision alert */}
          {isCheckerRevision && (
            <div style={{
              background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px',
              padding: '14px 16px', marginBottom: '18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: wrongItems.length ? '10px' : 0 }}>
                <span style={{ fontSize: '16px' }}>✎</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#92400e' }}>Checked – Needs Editing</div>
                  {selectedFile.checked_by && (
                    <div style={{ fontSize: '12px', color: '#b45309', marginTop: '2px' }}>
                      Reviewed by <strong>{selectedFile.checked_by}</strong>
                    </div>
                  )}
                </div>
              </div>
              {wrongItems.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Wrong Items Found</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {wrongItems.map((item, i) => (
                      <span key={i} style={{
                        background: '#fef3c7', border: '1px solid #fcd34d',
                        borderRadius: '6px', padding: '3px 10px',
                        fontSize: '12px', fontWeight: '600', color: '#92400e',
                      }}>{item}</span>
                    ))}
                  </div>
                </div>
              )}
              {selectedFile.checker_note && !wrongItems.length && (
                <div style={{ fontSize: '12.5px', color: '#92400e', marginTop: '4px', fontStyle: 'italic' }}>{selectedFile.checker_note}</div>
              )}
            </div>
          )}

          {/* Checked OK banner */}
          {isChecked && selectedFile.checked_by && (
            <div style={{
              background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px',
              padding: '12px 16px', marginBottom: '18px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <span style={{ fontSize: '20px' }}>✓</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#1d4ed8' }}>Checked & Approved</div>
                <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '1px' }}>
                  Checked by <strong>{selectedFile.checked_by}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Rejection banner */}
          {isRejected && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px',
              padding: '14px 16px', marginBottom: '18px',
            }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#b91c1c', marginBottom: '4px' }}>
                ✕ {selectedFile.status === 'rejected_by_team_leader' ? 'Rejected by Team Leader' : 'Rejected by Admin'}
              </div>
              {(selectedFile.rejection_reason || selectedFile.team_leader_comments || selectedFile.admin_comments) && (
                <div style={{ fontSize: '12.5px', color: '#dc2626', fontStyle: 'italic' }}>
                  "{selectedFile.rejection_reason || selectedFile.team_leader_comments || selectedFile.admin_comments}"
                </div>
              )}
              {selectedFile.rejected_by && (
                <div style={{ fontSize: '11.5px', color: '#ef4444', marginTop: '4px' }}>
                  By: <strong>{selectedFile.rejected_by}</strong>
                  {selectedFile.rejected_at && <> · {formatDate(selectedFile.rejected_at)}</>}
                </div>
              )}
            </div>
          )}

          {/* File Info grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px',
            background: '#f9fafb', borderRadius: '12px', padding: '16px',
            marginBottom: '16px', border: '1px solid #f3f4f6',
          }}>
            <InfoRow label="Filename" value={filename} mono />
            <InfoRow label="File Type" value={selectedFile.file_type || selectedFile.fileType || 'Unknown'} />
            <InfoRow label="File Size" value={formatFileSize(selectedFile.file_size || selectedFile.fileSize || 0)} />
            <InfoRow label="Uploaded" value={formatDate(selectedFile.uploaded_at || selectedFile.submitted_at || selectedFile.createdAt)} />
            {selectedFile.username && <InfoRow label="Submitted By" value={selectedFile.username} />}
            {selectedFile.user_team && <InfoRow label="Team" value={selectedFile.user_team} />}
          </div>

          {/* Description */}
          {selectedFile.description && (
            <div style={{ marginBottom: '16px', background: '#f9fafb', borderRadius: '10px', padding: '12px 14px', border: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px' }}>Description</div>
              <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>{selectedFile.description}</div>
            </div>
          )}

          {/* Tags */}
          {(tags.length > 0 || selectedFile.tag) && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(tags.length > 0 ? tags : [selectedFile.tag]).filter(Boolean).map((tag, i) => (
                  <span key={i} style={{
                    background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe',
                    padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                  }}>🏷 {tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* TL Review section */}
          {(selectedFile.team_leader_reviewed_at || (selectedFile.team_leader_comments && !isRejected)) && (
            <div style={{
              background: selectedFile.status === 'rejected_by_team_leader' ? '#fef2f2' : '#fff9f2',
              border: `1px solid ${selectedFile.status === 'rejected_by_team_leader' ? '#fecaca' : '#fed7aa'}`,
              borderRadius: '10px', padding: '12px 14px', marginBottom: '12px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: selectedFile.status === 'rejected_by_team_leader' ? '#b91c1c' : '#c2410c', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
                Team Leader Review
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {selectedFile.team_leader_username && <div style={{ fontSize: '12.5px', color: '#374151' }}><span style={{ fontWeight: '600' }}>Reviewed by:</span> {selectedFile.team_leader_username}</div>}
                {selectedFile.team_leader_reviewed_at && <div style={{ fontSize: '12.5px', color: '#374151' }}><span style={{ fontWeight: '600' }}>Date:</span> {formatDate(selectedFile.team_leader_reviewed_at)}</div>}
                {selectedFile.team_leader_comments && <div style={{ fontSize: '12.5px', color: '#374151', marginTop: '4px', fontStyle: 'italic' }}>"{selectedFile.team_leader_comments}"</div>}
              </div>
            </div>
          )}

          {/* Admin Review section */}
          {(selectedFile.admin_reviewed_at || (selectedFile.admin_comments && !isRejected)) && (
            <div style={{
              background: selectedFile.status === 'rejected_by_admin' ? '#fef2f2' : '#f5f3ff',
              border: `1px solid ${selectedFile.status === 'rejected_by_admin' ? '#fecaca' : '#ddd6fe'}`,
              borderRadius: '10px', padding: '12px 14px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: selectedFile.status === 'rejected_by_admin' ? '#b91c1c' : '#5b21b6', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
                Admin Review
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {selectedFile.admin_username && <div style={{ fontSize: '12.5px', color: '#374151' }}><span style={{ fontWeight: '600' }}>Reviewed by:</span> {selectedFile.admin_username}</div>}
                {selectedFile.admin_reviewed_at && <div style={{ fontSize: '12.5px', color: '#374151' }}><span style={{ fontWeight: '600' }}>Date:</span> {formatDate(selectedFile.admin_reviewed_at)}</div>}
                {selectedFile.admin_comments && <div style={{ fontSize: '12.5px', color: '#374151', marginTop: '4px', fontStyle: 'italic' }}>"{selectedFile.admin_comments}"</div>}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '14px 22px', borderTop: '1px solid #f3f4f6',
          background: '#fafafa', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexShrink: 0,
        }}>
          <button onClick={handleClose} style={{
            padding: '9px 20px', borderRadius: '8px', border: '1px solid #d1d5db',
            background: '#fff', color: '#374151', fontSize: '14px', fontWeight: '500', cursor: 'pointer',
          }}>Close</button>

          {onOpenFile && (
            <button onClick={onOpenFile} style={{
              padding: '9px 20px', borderRadius: '8px', border: 'none',
              background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: '#fff',
              fontSize: '14px', fontWeight: '600', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '7px',
              boxShadow: '0 2px 8px rgba(79,70,229,0.3)',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
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
