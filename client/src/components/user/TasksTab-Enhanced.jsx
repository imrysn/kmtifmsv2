import { useRef, useCallback, useState, useEffect, startTransition, useMemo, memo } from 'react';
import { apiFetch, API_BASE_URL, uploadWithProgress, getAuthToken } from '@/config/api';
import anime from 'animejs';
import './css/TasksTab-Enhanced.css';
import './css/TasksTab-Comments.css';
import { FileIcon, FileOpenModal } from '../shared';
import FileModal from './FileModal';
import Avatar from '../shared/Avatar';
import CommentsModal from '../shared/CommentsModal';
import { recursiveGroupByPath } from '@utils/folderUtils';
import { formatBusinessDaysLeft, getBusinessDaysColor } from '@utils/otDatesUtils';
import SingleSelectTags from './SingleSelectTags';
import { LoadingCards } from '../common/InlineSkeletonLoader';
import SuccessModal from './SuccessModal';
import { useSmartNavigation } from '../shared/SmartNavigation';
import '../shared/SmartNavigation/SmartNavigation.css';

// ─── Constants ────────────────────────────────────────────────────────────────
const INITIAL_FILE_DISPLAY_LIMIT = 5;
const SORT_OPTIONS = [
  { value: 'all', label: 'All Tasks' },
  { value: 'completed', label: 'Completed' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'no_due_date', label: 'No Due Date' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (dateString) =>
  new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const formatDateTime = (dateString) => {
  const date = new Date(dateString);
  return (
    date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) +
    ' at ' +
    date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  );
};

const formatFileSize = (bytes) => {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const groupFilesByFolder = (files) => {
  const folders = {};
  const individualFiles = [];
  if (!files || !Array.isArray(files)) return { folders, individualFiles };

  const sortedFiles = [...files].sort((a, b) => {
    const nameA = (a.original_name || a.filename || '').toLowerCase();
    const nameB = (b.original_name || b.filename || '').toLowerCase();
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
  });

  for (const file of sortedFiles) {
    if (file.folder_name) {
      if (!folders[file.folder_name]) folders[file.folder_name] = [];
      folders[file.folder_name].push(file);
    } else {
      individualFiles.push(file);
    }
  }

  const sortedFolders = {};
  Object.keys(folders).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })).forEach(key => {
    sortedFolders[key] = folders[key];
  });

  return { folders: sortedFolders, individualFiles };
};

const getAssignmentStatus = (assignment) => {
  // Only truly completed when the team leader/admin explicitly marks it done
  if (assignment.status === 'completed') return 'completed';
  // Having submitted files means it's active (submitted), not completed yet
  if (!assignment.due_date) return 'no_due_date';
  const dueDate = new Date(assignment.due_date);
  const now = new Date();
  dueDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  if (dueDate < now) return 'overdue';
  return 'active';
};

// ─── Checklist categories & items (from the drawing review sheet) ────────────
const CHECKLIST_SECTIONS_2D = [
  {
    section: 'Drawing Views',
    items: ['Origin', 'Alignment of Views', 'Line Attributes', 'Dimensions', 'Hole Properties', 'Chamfer/Radius', 'Machining Symbol', 'Welding Symbol', 'Geometric/Fitting Tolerances', 'Additional Views', 'Text Attributes'],
  },
  {
    section: 'Notes',
    items: ['Standard Notes', 'Special Notes'],
  },
  {
    section: 'Bill of Materials',
    items: ['Material Type', 'Material Specification', 'Quantity', 'Material Weight', 'Remarks', 'Balloon', 'Numbering & Arrangement (Assy)'],
  },
  {
    section: 'Title Block',
    items: ['Machine name', 'Part Name', 'Scale', 'Designed', 'Drawn', 'Quantity', 'Job Number', 'Cross Reference Number', 'Previous Drawing Number', 'Revision Details (if necessary)'],
  },
  {
    section: 'Isometric View',
    items: ['Orientation', 'Scale', 'Location'],
  },
  {
    section: 'Others',
    items: ['Tree View Properties / Link', 'Excel (Additional Info)'],
  },
];

const CHECKLIST_SECTIONS_3D = [
  {
    section: 'Part Modeling',
    items: ['Fully Defined Sketches', 'Unused Sketches/Features', 'Fillets & Chamfers Location', 'Draft Angles', 'No Errors/Warnings in FeatureManager'],
  },
  {
    section: 'Assembly / Mates',
    items: ['No Interference', 'Proper Mates', 'Degrees of Freedom', 'Collision Detection', 'Sub-assemblies structured correctly'],
  },
  {
    section: 'Properties',
    items: ['Material Applied', 'Mass Properties Computed', 'Custom Properties Filled'],
  },
  {
    section: 'Others',
    items: ['Tree View Organization', 'Standard Planes Alignment', 'Layer(s)'],
  }
];

// ─── Checking Modal ───────────────────────────────────────────────────────────
const CheckingModal = memo(({ isOpen, onClose, file, assignment, onMarkForEditing, onDoneChecking, user }) => {
  const [checkedItems, setCheckedItems] = useState({});
  const [additionalComment, setAdditionalComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checklistType, setChecklistType] = useState('2D');
  const [showPenaltySelector, setShowPenaltySelector] = useState(false);
  const [selectedPenalty, setSelectedPenalty] = useState(5);
  const [customItems, setCustomItems] = useState([]);
  const [newItemInput, setNewItemInput] = useState('');

  useEffect(() => {
    if (isOpen) { 
      setCheckedItems({}); 
      setAdditionalComment(''); 
      setChecklistType('2D'); 
      setShowPenaltySelector(false); 
      setSelectedPenalty(5); 
      
      let savedCustom = [];
      try { 
        savedCustom = JSON.parse(localStorage.getItem('kmtifms_custom_checklist_items')) || []; 
      } catch(e) {}
      
      // Ensure it's an array and unique
      setCustomItems([...new Set(savedCustom)]); 
      setNewItemInput(''); 
    }
  }, [isOpen, file?.id]);

  if (!isOpen || !file) return null;

  const wrongItems = Object.entries(checkedItems)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const handleMarkForEditing = async () => {
    if (!showPenaltySelector) {
      setShowPenaltySelector(true);
      return;
    }
    setIsSubmitting(true);
    try {
      const penaltyToApply = selectedPenalty;
      await onMarkForEditing(file.id, wrongItems, additionalComment.trim(), penaltyToApply);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDoneChecking = async () => {
    setIsSubmitting(true);
    try {
      await onDoneChecking(file.id, additionalComment.trim());
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleItem = (item) =>
    setCheckedItems(prev => ({ ...prev, [item]: !prev[item] }));

  const addCustomItem = () => {
    const trimmed = newItemInput.trim();
    if (!trimmed) return;
    setCustomItems(prev => {
      const newItems = [...new Set([...prev, trimmed])];
      localStorage.setItem('kmtifms_custom_checklist_items', JSON.stringify(newItems));
      return newItems;
    });
    setCheckedItems(prev => ({ ...prev, [trimmed]: true }));
    setNewItemInput('');
  };

  const removeCustomItem = (item) => {
    setCustomItems(prev => {
      const newItems = prev.filter(i => i !== item);
      localStorage.setItem('kmtifms_custom_checklist_items', JSON.stringify(newItems));
      return newItems;
    });
    setCheckedItems(prev => { const n = { ...prev }; delete n[item]; return n; });
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    >
      <div
        style={{ background: 'var(--background-secondary)', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '560px', maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)' }}>Checking</h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '420px' }}>
              {file.original_name || file.filename}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
              Check items that are <span style={{ color: 'var(--status-rejected-text)', fontWeight: '600' }}>wrong</span> in this file
            </p>

            {/* 2D / 3D Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
              <div style={{ display: 'inline-flex', background: 'var(--background-secondary)', borderRadius: '8px', padding: '4px' }}>
                <button
                  type="button"
                  onClick={() => setChecklistType('2D')}
                  style={{ padding: '6px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer', background: checklistType === '2D' ? 'var(--background-primary)' : 'transparent', color: checklistType === '2D' ? 'var(--text-primary)' : 'var(--text-tertiary)', boxShadow: checklistType === '2D' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
                >
                  2D Checklist
                </button>
                <button
                  type="button"
                  onClick={() => setChecklistType('3D')}
                  style={{ padding: '6px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer', background: checklistType === '3D' ? 'var(--background-primary)' : 'transparent', color: checklistType === '3D' ? 'var(--text-primary)' : 'var(--text-tertiary)', boxShadow: checklistType === '3D' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
                >
                  3D Checklist
                </button>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-tertiary)', lineHeight: 1, padding: '0', flexShrink: 0 }}>×</button>
        </div>

        {!showPenaltySelector ? (
          <>
            {/* Wrong items summary */}
            {wrongItems.length > 0 && (
              <div style={{ margin: '0 24px 0', padding: '10px 14px', background: 'var(--status-rejected)', border: '1px solid var(--status-rejected-text)', borderRadius: '8px', marginTop: '14px' }}>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: 'var(--status-rejected-text)' }}>
                  ⚠ {wrongItems.length} item{wrongItems.length !== 1 ? 's' : ''} marked as wrong: {wrongItems.join(', ')}
                </p>
              </div>
            )}

            {/* Checklist */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px' }}>
              {(checklistType === '2D' ? CHECKLIST_SECTIONS_2D : CHECKLIST_SECTIONS_3D).map(({ section, items }) => (
                <div key={section} style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '6px 10px', background: 'var(--background-secondary)', borderRadius: '6px', marginBottom: '6px' }}>
                    {section}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {items.map(item => {
                      const isWrong = !!checkedItems[item];
                      return (
                        <label
                          key={item}
                          onClick={() => toggleItem(item)}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer', background: isWrong ? 'var(--status-rejected)' : 'transparent', border: isWrong ? '1px solid #fecaca' : '1px solid transparent', transition: 'all 0.12s', userSelect: 'none' }}
                        >
                          {/* Custom white checkbox */}
                          <div
                            style={{
                              width: '16px', height: '16px', borderRadius: '3px', flexShrink: 0, cursor: 'pointer',
                              border: isWrong ? '2px solid #dc2626' : '2px solid #d1d5db',
                              background: isWrong ? 'var(--status-rejected-text)' : 'var(--background-secondary)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.12s',
                            }}
                          >
                            {isWrong && (
                              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="var(--background-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <span style={{ fontSize: '13.5px', color: isWrong ? 'var(--status-rejected-text)' : 'var(--text-secondary)', fontWeight: isWrong ? '600' : '400' }}>
                            {item}
                          </span>
                          {isWrong && (
                            <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--status-rejected-text)', fontWeight: '600', background: 'var(--status-rejected)', padding: '1px 7px', borderRadius: '10px', flexShrink: 0 }}>Wrong</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Custom Items Section */}
              {customItems.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '6px 10px', background: 'var(--background-secondary)', borderRadius: '6px', marginBottom: '6px' }}>
                    Custom Items
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {customItems.map(item => {
                      const isWrong = !!checkedItems[item];
                      return (
                        <div
                          key={item}
                          onClick={() => toggleItem(item)}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer', background: isWrong ? 'var(--status-rejected)' : 'transparent', border: isWrong ? '1px solid #fecaca' : '1px solid transparent', transition: 'all 0.12s', userSelect: 'none' }}
                        >
                          <div
                            style={{
                              width: '16px', height: '16px', borderRadius: '3px', flexShrink: 0,
                              border: isWrong ? '2px solid #dc2626' : '2px solid #d1d5db',
                              background: isWrong ? 'var(--status-rejected-text)' : 'var(--background-secondary)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.12s',
                            }}
                          >
                            {isWrong && (
                              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="var(--background-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <span style={{ fontSize: '13.5px', color: isWrong ? 'var(--status-rejected-text)' : 'var(--text-secondary)', fontWeight: isWrong ? '600' : '400', flex: 1 }}>
                            {item}
                          </span>
                          {isWrong && (
                            <span style={{ fontSize: '11px', color: 'var(--status-rejected-text)', fontWeight: '600', background: 'var(--status-rejected)', padding: '1px 7px', borderRadius: '10px', flexShrink: 0 }}>Wrong</span>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); removeCustomItem(item); }}
                            title="Remove this item"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '18px', lineHeight: 1, padding: '0 4px', flexShrink: 0 }}
                          >×</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add New Item Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0 4px' }}>
                <input
                  type="text"
                  value={newItemInput}
                  onChange={e => setNewItemInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomItem(); } }}
                  placeholder="Add new checklist item..."
                  style={{
                    flex: 1, padding: '7px 12px', fontSize: '13px', border: '1px dashed var(--border-color)',
                    borderRadius: '7px', background: 'transparent', color: 'var(--text-secondary)',
                    fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.15s'
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--status-pending-text)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                />
                <button
                  onClick={addCustomItem}
                  disabled={!newItemInput.trim()}
                  title="Add item"
                  style={{
                    padding: '7px 16px', borderRadius: '7px', border: 'none', flexShrink: 0,
                    background: newItemInput.trim() ? 'var(--status-review-text)' : 'var(--border-color)',
                    color: '#fff', fontSize: '13px', fontWeight: '600', cursor: newItemInput.trim() ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s', whiteSpace: 'nowrap'
                  }}
                >Add</button>
              </div>
            </div>

            {/* Additional Comment */}
            <div style={{ padding: '0 24px 14px', borderTop: '1px solid var(--background-secondary)', paddingTop: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                Additional Comment <span style={{ color: 'var(--text-tertiary)', fontWeight: '400' }}>(optional)</span>
              </label>
              <textarea
                value={additionalComment}
                onChange={e => setAdditionalComment(e.target.value)}
                placeholder="Add any other remarks or notes for the user..."
                rows={2}
                disabled={isSubmitting}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', outline: 'none', color: 'var(--text-secondary)', background: 'var(--background-secondary)', transition: 'border-color 0.12s' }}
                onFocus={e => { e.target.style.borderColor = 'var(--status-pending-text)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; }}
              />
            </div>
          </>
        ) : (
          <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '18px', color: 'var(--text-primary)' }}>Select Completion Percentage</h4>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '400px', lineHeight: '1.5' }}>
              You are returning this file for editing with <b>{wrongItems.length} wrong items</b>.<br />
              This percentage represents how much will be deducted from the user's performance based on their files.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', justifyContent: 'center', width: '100%', maxWidth: '420px' }}>
              {Array.from({ length: 12 }, (_, i) => (i + 1) * 5).map(pct => (
                <button
                  key={pct}
                  onClick={() => setSelectedPenalty(pct)}
                  style={{
                    padding: '10px 0',
                    borderRadius: '8px',
                    border: selectedPenalty === pct ? '2px solid var(--status-rejected-text)' : '1px solid var(--border-color)',
                    background: selectedPenalty === pct ? 'var(--status-rejected)' : 'var(--background-secondary)',
                    color: selectedPenalty === pct ? 'var(--status-rejected-text)' : 'var(--text-primary)',
                    fontWeight: selectedPenalty === pct ? '700' : '500',
                    fontSize: '14px',
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'all 0.15s'
                  }}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '12px 24px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px', justifyContent: 'flex-end', background: 'var(--background-secondary)' }}>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--background-secondary)', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleMarkForEditing}
            disabled={isSubmitting}
            style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#f59e0b', color: '#ffffff', fontSize: '14px', fontWeight: '600', cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Mark this file as needing edits"
          >
            {showPenaltySelector ? (
               <>
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5l10 -10"/></svg>
                 Confirm
               </>
            ) : (
               <>
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                   <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                 </svg>
                 For Editing (Select Percentage)
               </>
            )}
          </button>
          {!showPenaltySelector && (
            <button
              onClick={handleDoneChecking}
              disabled={isSubmitting}
              style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: 'var(--status-review-text)', color: 'var(--background-secondary)', fontSize: '14px', fontWeight: '600', cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Done Checking
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
CheckingModal.displayName = 'CheckingModal';

// ─── Sub-components ───────────────────────────────────────────────────────────
// ─── Checklist View Modal (read-only wrong items viewer) ──────────────────────
export const ChecklistViewModal = memo(({ isOpen, onClose, file, currentUserRole }) => {
  const [resolvedNote, setResolvedNote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checklistType, setChecklistType] = useState('2D');

  const [fileScore, setFileScore] = useState(null);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [penaltyPercentage, setPenaltyPercentage] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [localPenalty, setLocalPenalty] = useState(file?.checker_penalty_percentage || null);

  useEffect(() => {
    if (!isOpen || !file) { setResolvedNote(null); setFileScore(null); setLoading(false); return; }
    
    setLocalPenalty(file.checker_penalty_percentage || null);

    if (file.penalty_percentage !== undefined) {
      setFileScore(100 - file.penalty_percentage);
    }

    // If checker_note is already on the file object, use it directly — no fetch needed
    if (file.checker_note !== undefined) {
      setResolvedNote(file.checker_note || '');
      setLoading(false);
      return;
    }
    // Otherwise fetch the full file details to get checker_note + penalty_percentage
    setLoading(true);
    apiFetch(`/api/files/${file.id}`)
      .then(data => {
        const fileData = data.file || data;
        setResolvedNote(fileData?.checker_note || '');
        if (fileData?.penalty_percentage !== undefined) {
          setFileScore(100 - fileData.penalty_percentage);
        }
      })
      .catch(() => setResolvedNote(''))
      .finally(() => setLoading(false));
  }, [isOpen, file]);

  useEffect(() => {
    const handlePenalty = (e) => {
      if (file && file.id === e.detail.fileId) {
        setLocalPenalty(e.detail.penaltyPercentage);
        if (file) file.checker_penalty_percentage = e.detail.penaltyPercentage;
      }
    };
    window.addEventListener('checkerPenaltyApplied', handlePenalty);
    return () => window.removeEventListener('checkerPenaltyApplied', handlePenalty);
  }, [file]);

  // Auto-detect the right checklist if any wrong items exist in 3D
  useEffect(() => {
    if (!isOpen || !file) return;

    // We need to re-parse the wrong items here to do the detection since we moved this above the return.
    const note = file.checker_note !== undefined ? (file.checker_note || '') : resolvedNote;
    if (!note) return;

    const noteBody = note.split('|')[0];
    const match = noteBody.match(/Wrong items?:\s*(.+)/i);
    let items = [];
    if (match) items = match[1].trim().split(',').map(s => s.trim()).filter(Boolean);

    if (items.length > 0) {
      const has3D = items.some(item => CHECKLIST_SECTIONS_3D.some(sec => sec.items.includes(item)));
      setChecklistType(has3D ? '3D' : '2D');
    }
  }, [isOpen, file, resolvedNote]);

  if (!isOpen || !file) return null;

  // Parse wrong items and additional comment from checker_note
  const wrongItems = (() => {
    if (!resolvedNote) return [];
    // Note format: "Wrong items: X, Y | Comment: Z"
    const noteBody = resolvedNote.split('|')[0];
    const match = noteBody.match(/Wrong items?:\s*(.+)/i);
    if (match) return match[1].trim().split(',').map(s => s.trim()).filter(Boolean);
    return [];
  })();

  const additionalComment = (() => {
    if (!resolvedNote) return '';
    // Handles both formats:
    //   "Wrong items: X, Y | Comment: Z"  (mark-for-editing with wrong items)
    //   "Comment: Z"                       (done-checking with note only)
    const pipeMatch = resolvedNote.match(/\|\s*Comment:\s*(.+)/i);
    if (pipeMatch) return pipeMatch[1].trim();
    const directMatch = resolvedNote.match(/^Comment:\s*(.+)/i);
    if (directMatch) return directMatch[1].trim();
    return '';
  })();

  const wrongSet = new Set(wrongItems);
  const filename = file.original_name || file.filename || 'Unknown';

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    >
      <div
        id="checklist-view-modal-content"
        style={{ background: 'var(--background-secondary)', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '560px', maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke='var(--status-pending-text)' strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Checklist Results</h3>
              {fileScore !== null && (
                <span style={{ 
                  background: fileScore === 100 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: fileScore === 100 ? '#22c55e' : '#ef4444',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '700',
                  marginLeft: '8px'
                }}>
                  {fileScore === 100 ? '100%' : `-${100 - fileScore}%`}
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px' }}>
              {filename}
            </p>

            {/* 2D / 3D Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
              <div style={{ display: 'inline-flex', background: 'var(--background-secondary)', borderRadius: '8px', padding: '4px' }}>
                <button
                  type="button"
                  onClick={() => setChecklistType('2D')}
                  style={{ padding: '6px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer', background: checklistType === '2D' ? 'var(--background-primary)' : 'transparent', color: checklistType === '2D' ? 'var(--text-primary)' : 'var(--text-tertiary)', boxShadow: checklistType === '2D' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
                >
                  2D Checklist
                </button>
                <button
                  type="button"
                  onClick={() => setChecklistType('3D')}
                  style={{ padding: '6px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer', background: checklistType === '3D' ? 'var(--background-primary)' : 'transparent', color: checklistType === '3D' ? 'var(--text-primary)' : 'var(--text-tertiary)', boxShadow: checklistType === '3D' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
                >
                  3D Checklist
                </button>
              </div>
            </div>

          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-tertiary)', lineHeight: 1, padding: '0', flexShrink: 0 }}>×</button>
        </div>

        {/* Wrong items summary banner */}
        {loading ? (
          <div style={{ margin: '14px 22px 0', padding: '10px 14px', background: 'var(--background-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-tertiary)' }}>Loading checklist...</p>
          </div>
        ) : wrongItems.length > 0 ? (
          <div style={{ margin: '14px 22px 0', padding: '10px 14px', background: 'var(--status-rejected)', border: '1px solid var(--status-rejected-text)', borderRadius: '8px' }}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--status-rejected-text)' }}>
              ⚠ {wrongItems.length} item{wrongItems.length !== 1 ? 's' : ''} marked as wrong: {wrongItems.join(', ')}
            </p>
          </div>
        ) : file?.status === 'revision' ? (
          <div style={{ margin: '14px 22px 0', padding: '10px 14px', background: 'var(--status-rejected)', border: '1px solid var(--status-rejected-text)', borderRadius: '8px' }}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--status-rejected-text)' }}>✎ Need to Edit{additionalComment ? ' — see note below' : ''}</p>
          </div>
        ) : additionalComment ? (
          <div style={{ margin: '14px 22px 0', padding: '10px 14px', background: 'var(--status-approved)', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--status-approved-text)' }}>✓ No wrong items — checker left a note below</p>
          </div>
        ) : (
          <div style={{ margin: '14px 22px 0', padding: '10px 14px', background: 'var(--status-approved)', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--status-approved-text)' }}>✓ No issues found — all items passed</p>
          </div>
        )}

        {/* Additional comment from checker */}
        {!loading && additionalComment && (
          <div style={{ margin: '10px 22px 0', padding: '10px 14px', background: 'var(--status-pending)', border: '1px solid #fde68a', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke='var(--status-pending-text)' strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <div>
              <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: 'var(--status-pending-text)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Checker Note</p>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--status-pending-text)' }}>{additionalComment}</p>
            </div>
          </div>
        )}

        {/* Checklist (read-only) */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '14px 22px 18px' }}>
          {(checklistType === '2D' ? CHECKLIST_SECTIONS_2D : CHECKLIST_SECTIONS_3D).map(({ section, items }) => (
            <div key={section} style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '5px 10px', background: 'var(--background-secondary)', borderRadius: '6px', marginBottom: '4px' }}>
                {section}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {items.map(item => {
                  const isWrong = wrongSet.has(item);
                  return (
                    <div
                      key={item}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '7px 10px', borderRadius: '6px',
                        background: isWrong ? 'var(--status-rejected)' : 'transparent',
                        border: isWrong ? '1px solid #fecaca' : '1px solid transparent',
                      }}
                    >
                      {/* Read-only indicator */}
                      <div style={{
                        width: '16px', height: '16px', borderRadius: '3px', flexShrink: 0,
                        border: isWrong ? '2px solid #dc2626' : '2px solid #d1d5db',
                        background: isWrong ? 'var(--status-rejected-text)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isWrong && (
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="var(--background-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span style={{ fontSize: '13.5px', color: isWrong ? 'var(--status-rejected-text)' : 'var(--text-secondary)', fontWeight: isWrong ? '600' : '400', flex: 1 }}>
                        {item}
                      </span>
                      {isWrong && (
                        <span style={{ fontSize: '11px', color: 'var(--status-rejected-text)', fontWeight: '600', background: 'var(--status-rejected)', padding: '2px 8px', borderRadius: '10px', flexShrink: 0 }}>Wrong</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border-color)', background: 'var(--background-secondary)', display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
          {successMessage && (
            <span style={{ color: '#10b981', fontSize: '14px', fontWeight: '600', marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              {successMessage}
            </span>
          )}
          {file?.checked_by && (
            <button
              onClick={() => {
                if (!localPenalty) {
                  setShowPenaltyModal(true);
                }
              }}
              disabled={!!localPenalty}
              style={{
                padding: '8px 20px',
                borderRadius: '10px',
                border: 'none',
                background: localPenalty ? 'var(--bg-tertiary, #e2e8f0)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: localPenalty ? 'var(--text-secondary, #64748b)' : 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: localPenalty ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: localPenalty ? 'none' : '0 4px 12px rgba(239, 68, 68, 0.25)',
                opacity: localPenalty ? 0.8 : 1
              }}
              onMouseEnter={(e) => { if (!localPenalty) { e.currentTarget.style.transform = 'translateY(-1.5px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.35)'; } }}
              onMouseLeave={(e) => { if (!localPenalty) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.25)'; } }}
              onMouseDown={(e) => { if (!localPenalty) { e.currentTarget.style.transform = 'translateY(1px)'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(239, 68, 68, 0.2)'; } }}
              onMouseUp={(e) => { if (!localPenalty) { e.currentTarget.style.transform = 'translateY(-1.5px)'; } }}
            >
              {localPenalty ? `Penalty Applied (${localPenalty}%)` : 'Wrong Checked'}
            </button>
          )}
          <button
            onClick={onClose}
            style={{ padding: '8px 20px', borderRadius: '10px', border: 'none', background: 'var(--bg-tertiary, #f1f5f9)', color: 'var(--text-secondary, #475569)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #e2e8f0)'; e.currentTarget.style.color = 'var(--text-primary, #1e293b)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary, #f1f5f9)'; e.currentTarget.style.color = 'var(--text-secondary, #475569)'; }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.97)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Checker Penalty Modal */}
      {showPenaltyModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--background-secondary)', borderRadius: '16px', padding: '24px', width: '480px', maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <h4 style={{ margin: '0 0 16px', fontSize: '18px', color: 'var(--text-primary)' }}>Select Checker Penalty</h4>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Select how much to deduct from the checker's performance for this file.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '24px' }}>
              {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map(pct => (
                <button
                  key={pct}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPenaltyPercentage(pct);
                  }}
                  style={{
                    padding: '10px 0',
                    borderRadius: '8px',
                    border: penaltyPercentage === pct ? '2px solid #f59e0b' : '1px solid var(--border-color)',
                    background: penaltyPercentage === pct ? 'rgba(245, 158, 11, 0.1)' : 'var(--background-secondary)',
                    color: penaltyPercentage === pct ? '#f59e0b' : 'var(--text-primary)',
                    fontWeight: penaltyPercentage === pct ? '700' : '500',
                    cursor: 'pointer'
                  }}
                >
                  {pct}%
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setShowPenaltyModal(false)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: '500' }}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setIsSubmitting(true);
                  try {
                    await apiFetch(`/api/files/${file.id}/checker-penalty`, {
                      method: 'POST',
                      body: JSON.stringify({ penalty_percentage: penaltyPercentage })
                    });
                    
                    // Show a massive success overlay before closing
                    setShowPenaltyModal(false);
                    setSuccessMessage(`Successfully applied ${penaltyPercentage}% penalty!`);
                    
                    // Add a quick animation effect to the modal
                    const modalEl = document.getElementById('checklist-view-modal-content');
                    if (modalEl) {
                      anime({
                        targets: modalEl,
                        scale: [1, 1.05, 1],
                        borderColor: ['#10b981', 'transparent'],
                        borderWidth: ['4px', '0px'],
                        duration: 600,
                        easing: 'easeOutElastic(1, .8)'
                      });
                    }
                    
                    setTimeout(() => {
                      setSuccessMessage(null);
                      if (onClose) onClose();
                    }, 2000);
                  } catch (e) {
                    console.error('Failed to set penalty', e);
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting}
                style={{ padding: '8px 24px', borderRadius: '8px', border: 'none', background: '#f59e0b', color: 'white', fontWeight: '600', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
              >
                {isSubmitting ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
ChecklistViewModal.displayName = 'ChecklistViewModal';

const FileMoreMenuInline = memo(({ onDelete, onViewDetails, onOpenPath, isFolder = false, onChecking, onChecklist, onMarkForEditing, onDoneChecking }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!onDelete && !onViewDetails && !onChecking && !onChecklist) return null;

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(prev => !prev); }}
        title="More options"
        style={{
          background: 'transparent', border: 'none', borderRadius: '6px',
          width: '30px', height: '30px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', color: 'var(--text-tertiary)',
          padding: 0, flexShrink: 0, transition: 'all 0.15s',
          fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px'
        }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--background-secondary)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
      >
        •••
      </button>
      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', right: 0, top: '34px', zIndex: 1000,
            backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)',
            borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            minWidth: '180px', overflow: 'hidden',
          }}
        >
          {onViewDetails && (
            <button
              onClick={() => { setOpen(false); onViewDetails(); }}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none',
                padding: '10px 14px', fontSize: '13px', color: 'var(--text-secondary)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--background-secondary)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              File Details
            </button>
          )}
          {onOpenPath && (
            <button
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(false); onOpenPath(); }}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none',
                padding: '10px 14px', fontSize: '13px', color: 'var(--text-secondary)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--background-secondary)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v12z" />
              </svg>
              {isFolder ? 'Open Folder Path' : 'Open File Path'}
            </button>
          )}
          {onChecking && (onViewDetails || onOpenPath) && (
            <div style={{ height: '1px', backgroundColor: 'var(--background-secondary)', margin: '2px 0' }} />
          )}
          {onChecklist && (
            <button
              onClick={() => { setOpen(false); onChecklist(); }}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none',
                padding: '10px 14px', fontSize: '13px', color: 'var(--status-pending-text)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--status-pending)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
              Checklist
            </button>
          )}
          {onChecking && (
            <button
              onClick={() => { setOpen(false); onChecking(); }}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none',
                padding: '10px 14px', fontSize: '13px', color: 'var(--status-review-text)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#ede9fe'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
              Checking
            </button>
          )}
          {onDelete && (onChecking || onChecklist) && (
            <div style={{ height: '1px', backgroundColor: 'var(--background-secondary)', margin: '2px 0' }} />
          )}
          {onDelete && (
            <button
              onClick={() => { setOpen(false); onDelete(); }}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none',
                padding: '10px 14px', fontSize: '13px', color: 'var(--status-rejected-text)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--status-rejected)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
              </svg>
              {isFolder ? 'Delete Folder' : 'Delete File'}
            </button>
          )}
        </div>
      )}
    </div>
  );
});
FileMoreMenuInline.displayName = 'FileMoreMenuInline';

// ── Read-only menu for Team Leader attachments (Open File Path + Download) ───
const AttachmentMoreMenu = memo(({ onDownload, onOpenPath, isFolder = false }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        style={{
          background: 'transparent', border: 'none', borderRadius: '6px',
          width: '28px', height: '28px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--background-secondary)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
        title="More options"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: '4px',
          background: 'var(--background-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 200,
          minWidth: '160px', padding: '4px',
        }}>
          {onOpenPath && (
            <button
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onOpenPath(); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                padding: '8px 12px', background: 'transparent', border: 'none',
                borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'left',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--background-secondary)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              {isFolder ? 'Open Folder Path' : 'Open File Path'}
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDownload(); setOpen(false); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
              padding: '8px 12px', background: 'transparent', border: 'none',
              borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'left',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--background-secondary)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {isFolder ? 'Download Folder' : 'Download'}
          </button>
        </div>
      )}
    </div>
  );
});
AttachmentMoreMenu.displayName = 'AttachmentMoreMenu';

const getFileStatusBadge = (file) => {
  const status = typeof file === 'string' ? file : file?.status || 'uploaded';
  
  let revisionLabel = '✎ CHECKED - NEED TO EDIT';
  if (status === 'revision' && typeof file === 'object' && file?.checked_by) {
    const firstName = file.checked_by.split(' ')[0];
    const formattedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    revisionLabel = `✎ Checked by: ${formattedFirstName} (Need to Edit)`;
  } else if (status === 'revision') {
    revisionLabel = '✎ Checked by: (Need to Edit)';
  }

  const badges = {
    new: { bg: 'var(--status-review-text)', color: 'var(--background-secondary)', label: 'New', radius: '20px' },
    uploaded: { bg: 'var(--status-review-text)', color: 'var(--background-secondary)', label: 'New', radius: '20px' },
    team_leader_approved: { bg: 'var(--status-pending)', color: 'var(--status-pending-text)', label: 'Pending Admin', radius: '20px' },
    final_approved: { bg: '#d1fae5', color: 'var(--status-approved-text)', label: '✓ APPROVED', radius: '4px', weight: '600' },
    rejected_by_team_leader: { bg: '#ffe4e6', color: 'var(--status-rejected-text)', label: 'Rejected', radius: '20px' },
    rejected_by_admin: { bg: '#ffe4e6', color: 'var(--status-rejected-text)', label: 'Rejected', radius: '20px' },
    under_revision: { bg: 'var(--status-pending)', color: 'var(--status-pending-text)', label: '✎ REVISED', radius: '4px', weight: '600' },
    revision: { bg: 'var(--status-pending)', color: 'var(--status-pending-text)', label: revisionLabel, radius: '4px', weight: '600' },
    checked: { bg: 'var(--status-review)', color: 'var(--status-review-text)', label: '✓ CHECKED', radius: '4px', weight: '600' },
  };
  const b = badges[status] || badges.uploaded;
  return (
    <span style={{ backgroundColor: b.bg, color: b.color, padding: '3px 10px', borderRadius: b.radius, fontSize: '11px', fontWeight: b.weight || '500', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      {b.label}
    </span>
  );
};

const getStatusBadge = (assignment, activeTab = 'my-tasks', user = null) => {
  if (assignment.status === 'completed') {
    return <span style={{ backgroundColor: 'var(--status-approved)', color: 'var(--status-approved-text)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>✓ COMPLETED</span>;
  }
  if (assignment.status === 'checked') {
    return <span style={{ backgroundColor: 'var(--status-review)', color: 'var(--status-review-text)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>✓ CHECKED</span>;
  }
  // In My Tasks: only count the current user's own submitted files for badge logic
  const mySubmittedFiles = activeTab === 'for-checking'
    ? assignment.submitted_files
    : (assignment.submitted_files || []).filter(f =>
      !f.submitter_name
      || (user?.id && String(f.user_id) === String(user.id))
      || (user?.username && f.submitter_username === user.username)
    );
  if (assignment.status === 'for_editing') {
    // For Checking tab: checker sees "FOR CHECKING"; My Tasks tab with submitted files: user sees "SUBMITTED"
    if (activeTab === 'for-checking') {
      return <span style={{ backgroundColor: 'transparent', color: 'var(--status-pending-text)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', border: '1px solid #FDBA74' }}>FOR CHECKING</span>;
    }
    if (mySubmittedFiles?.length > 0) {
      return <span style={{ backgroundColor: 'var(--status-approved)', color: 'var(--status-approved-text)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #86EFAC' }}>✓ SUBMITTED</span>;
    }
    return <span style={{ backgroundColor: 'var(--status-pending)', color: 'var(--status-pending-text)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #FCD34D' }}>✎ FOR EDITING</span>;
  }
  if (mySubmittedFiles?.length > 0) {
    if (activeTab === 'for-checking') {
      return <span style={{ backgroundColor: 'transparent', color: 'var(--status-pending-text)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', border: '1px solid #FDBA74' }}>FOR CHECKING</span>;
    }
    return <span style={{ backgroundColor: 'var(--status-approved)', color: 'var(--status-approved-text)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #86EFAC' }}>✓ SUBMITTED</span>;
  }
  if (!assignment.due_date) return null;
  const dueDate = new Date(assignment.due_date);
  const now = new Date();
  dueDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
  if (assignment.user_status === 'submitted' && !assignment.submitted_files?.length) {
    return <span style={{ backgroundColor: 'var(--status-pending)', color: 'var(--status-pending-text)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>⚠ MISSING</span>;
  }
  if (daysUntilDue < 0) {
    return <span style={{ backgroundColor: 'var(--status-rejected)', color: 'var(--status-rejected-text)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>⚠ OVERDUE</span>;
  }
  if (daysUntilDue <= 4) {
    return <span style={{ backgroundColor: 'var(--status-pending)', color: 'var(--status-pending-text)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>⏱ PENDING</span>;
  }
  return null;
};

// ─── Main Component ───────────────────────────────────────────────────────────
const TasksTab = memo(({
  user,
  highlightedAssignmentId,
  highlightedFileId,
  highlightedFileStatus,
  notificationCommentContext,
  onClearHighlight,
  onClearFileHighlight,
  onClearNotificationContext,
  initialTab,
  onClearInitialTab,
}) => {
  // Core data
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Tab toggle: 'my-tasks' | 'for-checking'
  const [activeTab, setActiveTab] = useState('my-tasks');

  // UI state
  const [sortFilter, setSortFilter] = useState('all');
  // Team filter toggle: 'all' | 'KUSAKABE' | 'IT Dept'
  const [teamFilter, setTeamFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const prevSearchQueryRef = useRef('');
  const [successModal, setSuccessModal] = useState({ isOpen: false, title: '', message: '', type: 'success' });
  const [downloadToast, setDownloadToast] = useState({ show: false, fileName: '' });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [showAllSubmittedFiles, setShowAllSubmittedFiles] = useState({});

  // Comments
  const [comments, setComments] = useState({});
  const [newComment, setNewComment] = useState({});
  const [isPostingComment, setIsPostingComment] = useState({});
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [currentCommentsAssignment, setCurrentCommentsAssignment] = useState(null);
  const [highlightCommentBy, setHighlightCommentBy] = useState(null);
  const [highlightTargetCommentId, setHighlightTargetCommentId] = useState(null);
  const [isPostingReply, setIsPostingReply] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [visibleReplies, setVisibleReplies] = useState({});

  // Submit modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fileDescription, setFileDescription] = useState('');
  const [fileTag, setFileTag] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState('files');
  const [targetFolder, setTargetFolder] = useState(null);
  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false);
  const [localCreatedFolders, setLocalCreatedFolders] = useState([]);
  const uploadAbortControllerRef = useRef(null); // ref to abort in-progress XHR upload

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);

  // File open modal
  const [showOpenFileModal, setShowOpenFileModal] = useState(false);
  const [fileToOpen, setFileToOpen] = useState(null);
  const [openModalType, setOpenModalType] = useState('file');

  // File Details modal
  const [showFileDetailsModal, setShowFileDetailsModal] = useState(false);
  const [fileDetailsTarget, setFileDetailsTarget] = useState(null);

  // Checking modal (per-file checklist)
  const [checkingModal, setCheckingModal] = useState({ isOpen: false, file: null, assignment: null });
  // Checklist view modal (read-only wrong items viewer)
  const [checklistViewModal, setChecklistViewModal] = useState({ isOpen: false, file: null });

  // Checker three-dot menu
  const [checkerMenuOpen, setCheckerMenuOpen] = useState(null); // assignmentId
  const checkerMenuRef = useRef(null);

  useEffect(() => {
    if (!checkerMenuOpen) return;
    const handler = (e) => {
      if (checkerMenuRef.current && !checkerMenuRef.current.contains(e.target)) setCheckerMenuOpen(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [checkerMenuOpen]);

  // Refs
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const currentAssignmentIdRef = useRef(null);
  const newCommentRef = useRef(newComment);
  newCommentRef.current = newComment;

  // Warm up the server's path cache when a folder is expanded
  const prefetchFolderFiles = useCallback((files, type = 'file') => {
    if (!files || files.length === 0) return

    // Use bulk prefetch to resolve all paths in one parallel request
    const fileIds = files.map(f => f.id).filter(Boolean);
    if (fileIds.length === 0) return;

    apiFetch('/api/files/bulk-path', {
      method: 'POST',
      body: JSON.stringify({ fileIds, type })
    }).catch(() => { }); // Ignore prefetch errors
  }, []);

  // ─── Fetch helpers ─────────────────────────────────────────────────────────
  const showError = useCallback((message) =>
    setSuccessModal({ isOpen: true, title: 'Error', message, type: 'error' }), []);

  const fetchComments = useCallback(async (assignmentId) => {
    setLoadingComments(true);
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments`);
      if (data.success) {
        setComments(prev => ({ ...prev, [assignmentId]: data.comments || [] }));
        setAssignments(prev => prev.map(a =>
          a.id === assignmentId ? { ...a, comment_count: (data.comments || []).length } : a
        ));
      }
    } catch { /* silent */ } finally {
      setLoadingComments(false);
    }
  }, []);

  const fetchAssignments = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch(`/api/assignments/user/${user.id}`);
      if (data.success) {
        setAssignments(data.assignments || []);
      } else {
        showError('Failed to fetch assignments');
      }
    } catch {
      showError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  }, [user.id, showError]);

  // ─── Checker actions (must be after fetchAssignments & showError) ────────────
  const handleMarkForEditing = useCallback(async (assignment, fileId = null, note = null, penaltyPercentage = null) => {
    setCheckerMenuOpen(null);
    try {
      const data = await apiFetch(`/api/assignments/${assignment.id}/mark-for-editing`, {
        method: 'PUT',
        body: JSON.stringify({ checkerId: user.id, checkerName: user.fullName || user.username, fileId, note, penaltyPercentage }),
      });
      if (data.success) {
        setSuccessModal({ isOpen: true, title: 'Status Updated', message: 'Marked as For Editing — user has been notified.', type: 'success' });
        fetchAssignments();
      } else { showError(data.message || 'Failed to update status'); }
    } catch { showError('Failed to update status'); }
  }, [user, fetchAssignments, showError]);

  const handleMarkChecked = useCallback(async (assignment) => {
    setCheckerMenuOpen(null);
    try {
      const data = await apiFetch(`/api/assignments/${assignment.id}/mark-checked`, {
        method: 'PUT',
        body: JSON.stringify({ checkerId: user.id, checkerName: user.fullName || user.username }),
      });
      if (data.success) {
        setSuccessModal({ isOpen: true, title: 'Review Complete', message: `Done Checked by: ${user.fullName || user.username}. Team Leader has been notified.`, type: 'success' });
        fetchAssignments();
      } else {
        showError(data.message || 'Failed to update status');
      }
    } catch (err) {
      showError(err?.message || 'Failed to update status');
    }
  }, [user, fetchAssignments, showError]);

  const handleMarkFileChecked = useCallback(async (assignment, fileId, checkerNote = '') => {
    setCheckerMenuOpen(null);
    if (!fileId) { showError('Cannot mark file: file ID is missing.'); return; }
    try {
      const data = await apiFetch(`/api/assignments/${assignment.id}/files/${fileId}/mark-file-checked`, {
        method: 'PUT',
        body: JSON.stringify({ checkerId: user.id, checkerName: user.fullName || user.username, checkerNote }),
      });
      if (data.success) {
        if (data.allChecked) {
          setSuccessModal({ isOpen: true, title: 'All Files Checked', message: `All files checked — Team Leader has been notified.`, type: 'success' });
        } else {
          setSuccessModal({ isOpen: true, title: 'File Checked', message: 'File marked as Checked.', type: 'success' });
        }
        await fetchAssignments();
      } else { showError(data.message || 'Failed to update file status'); }
    } catch (err) {
      showError(err?.message || 'Failed to update file status');
    }
  }, [user, fetchAssignments, showError]);

  // ─── Session storage scroll-to on mount ────────────────────────────────────
  const openCommentsModal = useCallback((assignment) => {
    setCurrentCommentsAssignment(assignment);
    setShowCommentsModal(true);
    startTransition(() => setComments(prev => ({ ...prev, [assignment.id]: [] })));
    setTimeout(() => fetchComments(assignment.id), 0);
  }, [fetchComments]);

  useEffect(() => {
    const assignmentId = sessionStorage.getItem('scrollToAssignment');
    const highlightUser = sessionStorage.getItem('highlightCommentBy');
    if (assignmentId && assignments.length > 0) {
      sessionStorage.removeItem('scrollToAssignment');
      sessionStorage.removeItem('highlightCommentBy');
      const assignment = assignments.find(a => a.id === parseInt(assignmentId));
      if (assignment) {
        if (highlightUser) setHighlightCommentBy(highlightUser);
        setTimeout(() => {
          openCommentsModal(assignment);
          setTimeout(() => {
            document.querySelector('.tasks-modal-body')?.scrollTo(0, 0);
            setTimeout(() => setHighlightCommentBy(null), 3000);
          }, 100);
        }, 500);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments.length]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  // Reset display state when search query changes so results refresh cleanly
  useEffect(() => {
    if (prevSearchQueryRef.current !== searchQuery) {
      prevSearchQueryRef.current = searchQuery;
      setShowAllSubmittedFiles({});
      setExpandedFolders({});
    }
  }, [searchQuery]);

  // Apply initialTab from notification click (e.g. 'for-checking')
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      if (onClearInitialTab) onClearInitialTab();
    }
  }, [initialTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep currentAssignmentIdRef in sync
  currentAssignmentIdRef.current = currentCommentsAssignment?.id;

  // ─── Smart Navigation ──────────────────────────────────────────────────────
  useSmartNavigation({
    role: 'user',
    items: assignments,
    highlightedItemId: highlightedAssignmentId,
    highlightedFileId,
    highlightedFileStatus,
    notificationContext: notificationCommentContext,
    onClearHighlight,
    onClearFileHighlight,
    onClearNotificationContext,
    openCommentsModal,
    setVisibleReplies,
    showCommentsModal,
    selectedItem: currentCommentsAssignment,
    comments: comments[currentCommentsAssignment?.id] || [],
    setHighlightUsername: setHighlightCommentBy,
    setHighlightCommentId: setHighlightTargetCommentId
  });

  // Auto-set team filter to ensure the highlighted assignment is visible
  useEffect(() => {
    if (highlightedAssignmentId && assignments.length > 0) {
      const assignment = assignments.find(a => a.id === parseInt(highlightedAssignmentId));
      if (assignment) {
        const assignmentTeam = assignment.team || user?.team || 'IT Dept';
        setTeamFilter(assignmentTeam);
      }
    }
  }, [highlightedAssignmentId, assignments, user?.team]);

  // Auto-expand the folder that contains highlightedFileId so the file is visible.
  // activeTab dependency ensures this runs after the tab has switched (For Checking vs My Tasks).
  useEffect(() => {
    if (!highlightedFileId || assignments.length === 0) return;
    const fid = parseInt(highlightedFileId);
    for (const assignment of assignments) {
      const allFiles = assignment.submitted_files || [];
      const targetFile = allFiles.find(f => f.id === fid);
      if (targetFile) {
        // Always expand "See more" so the file isn't hidden behind the limit
        setShowAllSubmittedFiles(prev => prev[assignment.id] ? prev : { ...prev, [assignment.id]: true });
        // If the file is inside a folder, expand that folder too
        if (targetFile.folder_name) {
          const key = `${assignment.id}-${targetFile.folder_name}`;
          setExpandedFolders(prev => prev[key] ? prev : { ...prev, [key]: true });
        }
        break;
      }
    }
  }, [highlightedFileId, assignments, activeTab]);

  // Scroll to and visually highlight the file card after expand/show-all state settles.
  // activeTab is a dependency so this re-runs after the tab switch renders the correct cards.
  // NOTE: onClearFileHighlight is NOT called here — useSmartNavigation.js EFFECT 4 handles
  // that cleanup via its own retry loop. Calling it here too would double-clear and cause
  // a second re-render. This effect only handles the visual scroll+pulse.
  useEffect(() => {
    if (!highlightedFileId || assignments.length === 0) return;
    const fid = parseInt(highlightedFileId);
    // 500ms gives time for: tab switch render + folder auto-expand render + show-all render
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-file-id="${fid}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Pulse highlight: indigo ring + light indigo background, fades after 2.5s
      el.style.transition = 'box-shadow 0.3s, background-color 0.3s';
      el.style.boxShadow = '0 0 0 3px #6366f1';
      el.style.backgroundColor = '#eef2ff';
      const cleanup = setTimeout(() => {
        el.style.boxShadow = '';
        el.style.backgroundColor = '';
      }, 2500);
      return () => clearTimeout(cleanup);
    }, 500); // 500ms — tab switch + folder expand + see-all settle
    return () => clearTimeout(timer);
  }, [highlightedFileId, assignments, activeTab]); // activeTab ensures re-run after tab switch

  // Auto-open ChecklistViewModal when navigating from a "Submission Needs Editing" notification
  useEffect(() => {
    if (!highlightedFileId || highlightedFileStatus !== 'revision' || assignments.length === 0) return;
    const fid = parseInt(highlightedFileId);
    for (const assignment of assignments) {
      const targetFile = (assignment.submitted_files || []).find(f => f.id === fid);
      if (targetFile) {
        // Small delay so the task card has time to scroll into view first
        const timer = setTimeout(() => {
          setChecklistViewModal({ isOpen: true, file: targetFile });
          if (onClearFileHighlight) onClearFileHighlight();
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  }, [highlightedFileId, highlightedFileStatus, assignments]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Comment actions ───────────────────────────────────────────────────────
  const postComment = useCallback(async (assignmentId, commentText) => {
    if (!commentText?.trim()) return;
    setIsPostingComment(prev => ({ ...prev, [assignmentId]: true }));
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, username: user.username || user.fullName, comment: commentText.trim() }),
      });
      if (data.success) {
        setNewComment(prev => ({ ...prev, [assignmentId]: '' }));
        fetchComments(assignmentId);
      } else {
        showError('Failed to post comment');
      }
    } catch {
      showError('Failed to post comment');
    } finally {
      setIsPostingComment(prev => ({ ...prev, [assignmentId]: false }));
    }
  }, [user.id, user.username, user.fullName, fetchComments, showError]);

  const postReply = useCallback(async (_e, commentId, replyTextValue, onSuccess) => {
    const assignmentId = currentAssignmentIdRef.current;
    if (!assignmentId || !commentId || !replyTextValue?.trim()) return;
    setIsPostingReply(true);
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments/${commentId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, username: user.username || user.fullName, reply: replyTextValue.trim() }),
      });
      if (data.success) { onSuccess?.(); fetchComments(assignmentId); }
      else showError(data.message || 'Failed to post reply');
    } catch { showError('Failed to post reply'); }
    finally { setIsPostingReply(false); }
  }, [user.id, user.username, user.fullName, fetchComments, showError]);

  const editComment = useCallback(async (assignmentId, commentId, newText) => {
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments/${commentId}`, {
        method: 'PUT',
        body: JSON.stringify({ userId: user.id, comment: newText }),
      });
      if (data.success) fetchComments(assignmentId);
      else showError(data.message || 'Failed to edit comment');
    } catch { showError('Failed to edit comment'); }
  }, [user.id, fetchComments, showError]);

  const deleteComment = useCallback(async (assignmentId, commentId) => {
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments/${commentId}`, {
        method: 'DELETE',
        body: JSON.stringify({ userId: user.id }),
      });
      if (data.success) fetchComments(assignmentId);
      else showError(data.message || 'Failed to delete comment');
    } catch { showError('Failed to delete comment'); }
  }, [user.id, fetchComments, showError]);

  const editReply = useCallback(async (assignmentId, commentId, replyId, newText) => {
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments/${commentId}/reply/${replyId}`, {
        method: 'PUT',
        body: JSON.stringify({ userId: user.id, reply: newText }),
      });
      if (data.success) fetchComments(assignmentId);
      else showError(data.message || 'Failed to edit reply');
    } catch { showError('Failed to edit reply'); }
  }, [user.id, fetchComments, showError]);

  const deleteReply = useCallback(async (assignmentId, commentId, replyId) => {
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments/${commentId}/reply/${replyId}`, {
        method: 'DELETE',
        body: JSON.stringify({ userId: user.id }),
      });
      if (data.success) fetchComments(assignmentId);
      else showError(data.message || 'Failed to delete reply');
    } catch { showError('Failed to delete reply'); }
  }, [user.id, fetchComments, showError]);

  const toggleRepliesVisibility = useCallback((commentId) =>
    setVisibleReplies(prev => ({ ...prev, [commentId]: !prev[commentId] })), []);

  // ─── File actions ──────────────────────────────────────────────────────────
  const handleDownloadFile = useCallback(async (file) => {
    const fileUrl = `${API_BASE_URL}/api/files/${file.id}/download`;
    const fileName = file.original_name || file.filename || 'file';
    if (window.electron?.downloadFile) {
      const result = await window.electron.downloadFile(fileUrl, fileName, getAuthToken());
      if (result?.success) {
        setDownloadToast({ show: true, fileName });
        setTimeout(() => setDownloadToast({ show: false, fileName: '' }), 3500);
      } else if (result && !result.success && !result.canceled) {
        showError(result.error || 'Download failed');
      }
    } else {
      const a = Object.assign(document.createElement('a'), { href: fileUrl, download: fileName });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setDownloadToast({ show: true, fileName });
      setTimeout(() => setDownloadToast({ show: false, fileName: '' }), 3500);
    }
  }, [showError]);

  const handleDownloadFolder = useCallback(async (folderFiles, folderName, isAttachment = false) => {
    if (!window.electron?.downloadFolder) {
      const fileIds = folderFiles.map(f => f.id).join(',');
      const typeParam = isAttachment ? '&type=attachment' : '&type=file';
      const a = Object.assign(document.createElement('a'), {
        href: `${API_BASE_URL}/api/files/folder/zip?fileIds=${fileIds}&folderName=${encodeURIComponent(folderName)}${typeParam}`,
        download: `${folderName}.zip`
      });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      return;
    }
    try {
      const fileIds = folderFiles.map(f => f.id).filter(Boolean);
      const data = await apiFetch('/api/files/bulk-path', {
        method: 'POST',
        body: JSON.stringify({ fileIds, type: isAttachment ? 'attachment' : 'file' })
      });
      const fileInfoList = (data.results || []).map((r, i) => {
        const file = folderFiles.find(f => f.id === r.id) || folderFiles[i] || {};
        return { srcPath: r.success ? r.path : null, name: file.original_name || r.originalName, relativePath: file.relative_path || null };
      });
      const result = await window.electron.downloadFolder(folderName, fileInfoList);
      if (result?.success) {
        setDownloadToast({ show: true, fileName: folderName });
        setTimeout(() => setDownloadToast({ show: false, fileName: '' }), 3500);
      } else if (result && !result.success) { showError(result.error || 'Folder download failed'); }
    } catch (err) { showError(err.message || 'Folder download failed'); }
  }, [showError]);

  const handleOpenFile = useCallback(async () => {
    if (!fileToOpen) return;

    // Close immediately for responsiveness
    const file = { ...fileToOpen };
    const type = openModalType;
    setShowOpenFileModal(false);
    setFileToOpen(null);

    setSuccessModal({ isOpen: true, title: 'Success', message: type === 'folder' ? 'Folder opened successfully!' : 'File opened successfully!', type: 'success' });

    try {
      if (type === 'folder' || type === 'filePath') {
        const pathType = file.isAttachment ? 'attachment' : 'file';
        const folderParam = file.folderName && file.folderName !== 'Folder Path' ? `&folderName=${encodeURIComponent(file.folderName)}` : '';
        const data = await apiFetch(`/api/files/${file.id}/path?type=${pathType}${folderParam}`);
        if (data.success && data.filePath && window.electron?.openFolderInExplorer) {
          await window.electron.openFolderInExplorer(data.filePath);
        }
        return;
      }

      const pathType = file.isAttachment ? 'attachment' : 'file';
      const pathData = await apiFetch(`/api/files/${file.id}/path?type=${pathType}`);
      if (!pathData.success || !pathData.filePath) throw new Error(pathData.message || 'Could not resolve file path');

      if (window.electron?.openFileInApp) {
        const result = await window.electron.openFileInApp(pathData.filePath);
        if (!result.success) {
          showError(result.error || 'Failed to open file');
        }
      } else {
        const ext = (pathData.filePath.split('.').pop() || '').toLowerCase();
        const browserViewable = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'txt', 'html', 'css', 'js', 'json', 'xml', 'mp4', 'mp3'];
        if (browserViewable.includes(ext)) {
          window.open(`${API_BASE_URL}/api/files/${file.id}/stream`, '_blank', 'noopener,noreferrer');
        } else {
          const a = Object.assign(document.createElement('a'), {
            href: `${API_BASE_URL}/api/files/${file.id}/stream`,
            download: file.original_name || 'file',
          });
          a.click();
        }
      }
    } catch { showError('Failed to open file. Please try again.'); }
  }, [fileToOpen, openModalType, showError]);

  const confirmDeleteFile = useCallback((assignmentId, fileId, fileName) => {
    setFileToDelete({ assignmentId, fileId, fileName });
    setShowDeleteModal(true);
  }, []);

  const confirmOpenFile = useCallback((file) => {
    setFileToOpen(file);
    setOpenModalType('file');
    setShowOpenFileModal(true);
  }, []);

  // ─── Submit modal helpers ─────────────────────────────────────────────────
  const resetSubmitModal = useCallback(() => {
    // Abort any in-flight XHR upload before clearing state
    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort();
      uploadAbortControllerRef.current = null;
    }
    setUploadedFiles([]);
    setFileDescription('');
    setFileTag('');
    setUploadMode('files');
    setTargetFolder(null);
    setUploadProgress(0);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  }, []);

  const handleRemoveSubmittedFile = useCallback(async (assignmentId, fileId) => {
    setShowDeleteModal(false);
    setFileToDelete(null);
    // Optimistic update
    setAssignments(prev => prev.map(a =>
      a.id === assignmentId
        ? { ...a, submitted_files: a.submitted_files.filter(f => f.id !== fileId) }
        : a
    ));
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/files/${fileId}`, {
        method: 'DELETE',
        body: JSON.stringify({ userId: user.id }),
      });
      if (data.success) {
        // Best-effort cleanup of actual file record
        apiFetch(`/api/files/${fileId}`, {
          method: 'DELETE',
          body: JSON.stringify({ adminId: user.id, adminUsername: user.username, adminRole: user.role, team: user.team }),
        }).catch(() => { });
        setSuccessModal({ isOpen: true, title: 'Removed', message: 'File removed successfully', type: 'error' });
        setTimeout(() => fetchAssignments(), 500);
      } else {
        fetchAssignments();
        showError(data.message || 'Failed to remove file');
      }
    } catch {
      fetchAssignments();
      showError('Failed to remove file. Please try again.');
    }
  }, [user.id, user.username, user.role, user.team, fetchAssignments, showError]);

  // resetSubmitModal defined above (near uploadProgress state)

  const handleSubmit = useCallback((assignment) => {
    setCurrentAssignment(assignment);
    resetSubmitModal();
    setShowSubmitModal(true);
  }, [resetSubmitModal]);

  const handleRemoveFile = useCallback((index) =>
    setUploadedFiles(prev => prev.filter((_, i) => i !== index)), []);

  const handleFileUpload = useCallback(async () => {
    if (!uploadedFiles.length || !currentAssignment) return;

    // Cancel any previous in-flight upload before starting a new one
    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    uploadAbortControllerRef.current = abortController;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const allPaths = uploadedFiles.map(f => {
        if (targetFolder) {
          // If the file came from a folder drag-drop it already has the correct full
          // relative path — keep it.
          // If it's a plain individual file (no folderName), do NOT prepend the
          // top-level folder name here.  Sending just the filename lets the server's
          // path-inheritance logic look up the original subfolder path from the DB
          // (e.g. "TESTING!/New folder/file.pdf") instead of landing flat at the
          // top level ("TESTING!/file.pdf").
          return f.folderName ? f.relativePath : f.file.name;
        }
        return f.relativePath;
      });

      const fd = new FormData();
      fd.append('userId', user.id);
      fd.append('username', user.username);
      fd.append('assignmentId', currentAssignment.id);
      fd.append('tag', fileTag || '');
      fd.append('description', fileDescription || '');
      fd.append('relativePaths', JSON.stringify(allPaths));
      if (targetFolder) fd.append('targetFolder', targetFolder);
      uploadedFiles.forEach(f => fd.append('files', f.file));

      const result = await uploadWithProgress(
        '/api/files/bulk-upload',
        fd,
        {
          onProgress: (p) => setUploadProgress(Math.min(p, 99)),
          signal: abortController.signal,  // ← wire AbortController so cancel kills the XHR
        }
      );

      // Guard: if the user cancelled while the last bytes were in-flight, bail out
      if (abortController.signal.aborted) return;

      setUploadProgress(100);

      if (result.success) {
        setSuccessModal({
          isOpen: true,
          title: 'Success',
          message: 'Files uploaded and submitted successfully!',
          type: 'success'
        });
        setShowSubmitModal(false);
        resetSubmitModal();
        fetchAssignments();
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (err) {
      // Silently ignore intentional cancellations
      if (err.name === 'AbortError') return;
      showError(err.message || 'Failed to upload files');
    } finally {
      uploadAbortControllerRef.current = null;
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [uploadedFiles, currentAssignment, user, fileTag, fileDescription, targetFolder, fetchAssignments, resetSubmitModal, showError]);

  // ─── Utility ───────────────────────────────────────────────────────────────
  const formatRelativeTime = useCallback((dateString) => {
    const diff = Math.floor((Date.now() - new Date(dateString)) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, []);

  const getInitials = useCallback((name) => {
    if (!name) return '?';
    if (name.includes('.')) {
      const [a, b] = name.split('.');
      if (b) return (a[0] + b[0]).toUpperCase();
    }
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  }, []);

  const handleCloseCommentsModal = useCallback(() => setShowCommentsModal(false), []);

  const handleSetNewComment = useCallback((val) =>
    setNewComment(prev => ({ ...prev, [currentAssignmentIdRef.current]: val })), []);

  const handlePostComment = useCallback(() => {
    const id = currentAssignmentIdRef.current;
    if (!id) return;
    const text = newCommentRef.current[id]?.trim();
    if (text) postComment(id, text);
  }, [postComment]);

  const openFileDetails = useCallback(async (file) => {
    try {
      const data = await apiFetch(`/api/files/${file.id}`);
      const fileData = data.file || file;
      if (file.assignment_title && !fileData.assignment_title) {
        fileData.assignment_title = file.assignment_title;
      }
      setFileDetailsTarget(fileData);
    } catch (err) {
      showError('Failed to load file details. Please try again.');
      setFileDetailsTarget(file);
    }
    setShowFileDetailsModal(true);
  }, []);

  useEffect(() => {
    const fileId = sessionStorage.getItem('openFileDetailsId');
    if (!fileId || assignments.length === 0) return;
    sessionStorage.removeItem('openFileDetailsId');

    const fid = parseInt(fileId);
    let assignmentTitle = null;
    for (const a of assignments) {
      if (a.submitted_files?.some(f => f.id === fid)) {
        assignmentTitle = a.title;
        break;
      }
    }

    openFileDetails({ id: fid, assignment_title: assignmentTitle });
  }, [assignments, openFileDetails]);

  const openFolderInExplorer = useCallback(async (fileId, isAttachment = true, folderName = 'Folder Path', isFolder = false) => {
    if (!window.electron?.openFolderInExplorer) return;
    setFileToOpen({ id: fileId, isAttachment, folderName });
    setOpenModalType(isFolder ? 'folder' : 'filePath');
    setShowOpenFileModal(true);
  }, []);

  // ─── Sorted + Filtered assignments ────────────────────────────────────────
  const myTaskAssignments = useMemo(() => {
    return assignments.filter(a => {
      const isAssigned = a.assigned_to === 'all' || (a.assigned_member_details || []).some(m => String(m.id) === String(user.id))
      return isAssigned && getAssignmentStatus(a) !== 'completed'
    })
  }, [assignments, user.id])

  const doneTaskAssignments = useMemo(() => {
    return assignments.filter(a => {
      const isAssigned = a.assigned_to === 'all' || (a.assigned_member_details || []).some(m => String(m.id) === String(user.id))
      return isAssigned && getAssignmentStatus(a) === 'completed'
    })
  }, [assignments, user.id])

  const forCheckingAssignments = useMemo(() => {
    return assignments.filter(a => {
      const checkerIds = (() => { try { return JSON.parse(a.checker_ids || '[]').map(String) } catch { return [] } })()
      return checkerIds.includes(String(user.id))
    })
  }, [assignments, user.id])

  const filteredAssignments = useMemo(() => {
    let base = myTaskAssignments;
    if (activeTab === 'for-checking') base = forCheckingAssignments;
    else if (activeTab === 'done-tasks') base = doneTaskAssignments;
    const sorted = [...base].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const bySort = sortFilter === 'all' ? sorted : sorted.filter(a => getAssignmentStatus(a) === sortFilter);
    const byTeam = teamFilter === 'all' ? bySort : bySort.filter(a => (a.team || 'IT Dept') === teamFilter);
    if (!searchQuery.trim()) return byTeam;

    const q = searchQuery.toLowerCase();

    // Normalization helper to handle accents like ñ and common typos like Micheal/Michael
    const matchesQuery = (text) => {
      if (!text) return false;
      const normText = String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const normQuery = q.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      if (normText.includes(normQuery)) return true;

      // Michael/Micheal typo tolerance
      const altQuery = normQuery.replace(/micheal/g, 'michael').replace(/michael/g, 'micheal');
      if (normText.includes(altQuery)) return true;

      const altText = normText.replace(/micheal/g, 'michael').replace(/michael/g, 'micheal');
      if (altText.includes(normQuery) || altText.includes(altQuery)) return true;

      return false;
    };

    return byTeam.filter(a =>
      matchesQuery(a.title) ||
      matchesQuery(a.description) ||
      matchesQuery(a.team_leader_username) ||
      matchesQuery(a.team_leader_fullname) ||
      matchesQuery(a.assigned_user_fullname) ||
      matchesQuery(a.assigned_to) ||
      (a.assigned_member_details || []).some(m =>
        matchesQuery(m.fullName) ||
        matchesQuery(m.username)
      ) ||
      (a.attachments || []).some(f =>
        matchesQuery(f.original_name) ||
        matchesQuery(f.file_name) ||
        matchesQuery(f.folder_name)
      ) ||
      (a.submitted_files || a.recent_submissions || []).some(f =>
        matchesQuery(f.original_name) ||
        matchesQuery(f.file_name) ||
        matchesQuery(f.folder_name)
      )
    );
  }, [myTaskAssignments, forCheckingAssignments, doneTaskAssignments, activeTab, sortFilter, teamFilter, searchQuery]);

  const filterCounts = useMemo(() => {
    const counts = { all: assignments.length, completed: 0, overdue: 0, no_due_date: 0 };
    for (const a of assignments) {
      const s = getAssignmentStatus(a);
      if (s === 'completed') counts.completed++;
      else if (s === 'overdue') counts.overdue++;
      else if (s === 'no_due_date') counts.no_due_date++;
    }
    return counts;
  }, [assignments]);

  const readAllFilesFromEntry = (entry, basePath = '') => new Promise((resolve) => {
    if (entry.isFile) {
      entry.file(file => resolve([{ file, relativePath: basePath + file.name, folderName: basePath ? basePath.split('/')[0] : null }]), () => resolve([]));
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const allEntries = [];
      const readBatch = () => {
        reader.readEntries(async (batch) => {
          if (!batch.length) {
            const results = await Promise.all(allEntries.map(e => readAllFilesFromEntry(e, `${basePath}${entry.name}/`)));
            resolve(results.flat());
          } else { allEntries.push(...batch); readBatch(); }
        }, () => resolve([]));
      };
      readBatch();
    } else resolve([]);
  });

  // ─── Render helpers ────────────────────────────────────────────────────────
  const renderFolderStatusBadges = (folderFiles) => {
    const total = folderFiles.length;
    const approved = folderFiles.filter(f => f.status === 'final_approved').length;
    const tlApproved = folderFiles.filter(f => f.status === 'team_leader_approved').length;
    const rejected = folderFiles.filter(f => ['rejected_by_team_leader', 'rejected_by_admin'].includes(f.status)).length;
    const revision = folderFiles.filter(f => f.status === 'revision').length;
    const checked = folderFiles.filter(f => f.status === 'checked').length;
    const pending = folderFiles.filter(f => !f.status || f.status === 'uploaded').length;

    if (approved === total) return <span style={{ background: 'var(--status-approved)', color: 'var(--status-approved-text)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>✓ All Approved</span>;
    if (checked === total) return <span style={{ background: 'var(--status-review)', color: 'var(--status-review-text)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>✓ All Checked</span>;
    if (rejected === total) return <span style={{ background: 'var(--status-rejected)', color: 'var(--status-rejected-text)', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>All Rejected</span>;

    return (
      <>
        {revision > 0 && <span style={{ background: 'var(--status-pending)', color: 'var(--status-pending-text)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', border: '1px solid #fef08a', marginRight: '4px' }}>Checked - Need to Edit ({revision})</span>}
        {checked > 0 && checked < total && <span style={{ background: 'var(--status-review)', color: 'var(--status-review-text)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', marginRight: '4px' }}>Checked ({checked})</span>}
        {(tlApproved > 0 || (approved > 0 && !pending && !rejected)) && <span style={{ background: 'var(--status-pending)', color: 'var(--status-pending-text)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '500', marginRight: '4px' }}>Pending Admin</span>}
        {pending > 0 && revision === 0 && <span style={{ background: 'var(--status-review)', color: 'var(--status-review-text)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', marginRight: '4px' }}>Pending Review</span>}
        {rejected > 0 && <span style={{ background: 'var(--status-rejected)', color: 'var(--status-rejected-text)', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500', marginRight: '4px' }}>{rejected} Rejected</span>}
        {approved > 0 && approved < total && <span style={{ background: 'var(--status-approved)', color: 'var(--status-approved-text)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>{approved} Approved</span>}
      </>
    );
  };

  const renderFileCard = (file, assignmentId, indented = false, assignmentTitle = null, isAttachment = false, checkerActions = null) => {
    const canDelete = file.status !== 'final_approved';
    const fileWithTitle = assignmentTitle ? { ...file, assignment_title: assignmentTitle } : file;
    return (
      <div
        key={file.id}
        data-file-id={file.id}
        className="submitted-file-card"
        onClick={() => confirmOpenFile({ ...file, isAttachment })}
        style={{ cursor: 'pointer', backgroundColor: 'var(--background-secondary)', marginBottom: indented ? '4px' : undefined }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ flexShrink: 0 }}>
            <FileIcon fileType={(file.original_name || file.filename || 'file').split('.').pop().toLowerCase()} isFolder={false} size={indented ? 'small' : 'default'} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: '500', fontSize: indented ? '14px' : '15px', color: 'var(--text-primary)', marginBottom: indented ? '2px' : '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file.original_name || file.filename}
            </div>
            <div style={{ fontSize: indented ? '12px' : '13px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: indented ? '6px' : '8px', flexWrap: 'wrap' }}>
              <span>by <span style={{ fontWeight: '500', color: 'var(--status-review-text)' }}>{file.submitter_name || user.fullName || user.username}</span></span>
              <span style={{ color: 'var(--text-tertiary)' }}>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                {formatDateTime(file.submitted_at || file.uploaded_at)}
              </span>
              {file.tag && (
                <span style={{ backgroundColor: 'var(--status-review)', color: 'var(--status-review-text)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>🏷️ {file.tag}</span>
              )}
              {getFileStatusBadge(file)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <FileMoreMenuInline
              onViewDetails={() => openFileDetails(fileWithTitle)}
              onOpenPath={() => openFolderInExplorer(file.id, false, file.original_name || file.filename, false)}
              onDelete={canDelete ? () => confirmDeleteFile(assignmentId, file.id, file.original_name || file.filename) : undefined}
              onChecking={checkerActions?.onChecking ? () => checkerActions.onChecking(file) : undefined}
              onChecklist={(file.checker_note || file.status === 'revision' || file.status === 'checked') ? () => setChecklistViewModal({ isOpen: true, file }) : undefined}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderRecursiveItems = (assignment, files, level = 1, parentKey = '', parentIsLastArr = [], isAttachment = true, checkerActions = null, stripPrefix = null) => {
    // Strip the top-level folder prefix from relative_path so recursiveGroupByPath
    // sees paths relative to the current folder, not the global root.
    // e.g. files with relative_path="TESTING!/New folder/file.pdf" inside the
    // "TESTING!" folder should be processed as "New folder/file.pdf".
    const normalizedFiles = stripPrefix
      ? files.map(f => {
        const file = f.file || f;
        const rp = (file.relative_path || '').replace(/\\/g, '/');
        const prefix = stripPrefix.replace(/\\/g, '/') + '/';
        const stripped = rp.startsWith(prefix) ? rp.slice(prefix.length) : rp;
        return { ...f, file: { ...file, relative_path: stripped } };
      })
      : files;

    const { subfolders, rootFiles } = recursiveGroupByPath(normalizedFiles);
    const subItems = [];

    const subfolderEntries = Object.entries(subfolders);
    const totalSubfolders = subfolderEntries.length;
    const totalRootFiles = rootFiles.length;

    // 1. Render subfolders
    subfolderEntries.forEach(([subName, subFiles], index) => {
      const isLast = (index === totalSubfolders - 1) && (totalRootFiles === 0);
      const subKey = parentKey ? `${parentKey}__${subName}` : `${assignment.id}__${subName}`;
      const isSubOpen = expandedFolders[subKey];
      const subFirstFile = subFiles[0].file || subFiles[0];

      subItems.push(
        <div key={`subfolder-${subKey}`} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="tl-tree-container" style={{ marginBottom: '7px' }}>
            {parentIsLastArr.map((isLastParent, i) => (
              <div key={i} className={isLastParent ? "tl-tree-line-empty" : "tl-tree-line-vertical"} />
            ))}
            {level > 0 && <div className={`tl-tree-line-connector ${isLast ? 'last-item' : ''}`} />}

            <div
              className="submitted-file-card"
              onClick={(e) => {
                e.stopPropagation();
                setExpandedFolders(prev => ({ ...prev, [subKey]: !prev[subKey] }));
              }}
              style={{
                cursor: 'pointer',
                backgroundColor: isSubOpen ? 'var(--status-review)' : 'var(--background-secondary)',
                padding: '14px 20px',
                flex: 1
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <div style={{ fontSize: '32px', flexShrink: 0 }}>{isSubOpen ? '📂' : '📁'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)' }}>{subName}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '1px' }}>
                    {isAttachment ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                        <span>{assignment.team_leader_fullname || assignment.team_leader_username || 'Team Leader'}</span>
                        <span style={{ color: 'var(--text-tertiary)' }}>•</span>
                        <span>{subFiles.length} file{subFiles.length !== 1 ? 's' : ''}</span>
                        {(subFirstFile.submitted_at || subFirstFile.uploaded_at || subFirstFile.created_at) && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--text-tertiary)' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                            </svg>
                            {formatDateTime(subFirstFile.submitted_at || subFirstFile.uploaded_at || subFirstFile.created_at)}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                        <span>Submitted by <span style={{ fontWeight: '500', color: 'var(--status-review-text)' }}>{subFirstFile.submitter_name || user.fullName || user.username}</span></span>
                        <span style={{ color: 'var(--text-tertiary)' }}>•</span>
                        <span>{subFiles.length} file{subFiles.length !== 1 ? 's' : ''}</span>
                        {(subFirstFile.submitted_at || subFirstFile.uploaded_at) && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--text-tertiary)' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                            </svg>
                            {formatDateTime(subFirstFile.submitted_at || subFirstFile.uploaded_at)}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ transform: isSubOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                  <path d="M4 6L8 10L12 6" stroke="var(--text-tertiary)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
          {isSubOpen && renderRecursiveItems(assignment, subFiles, level + 1, subKey, [...parentIsLastArr, isLast], isAttachment, checkerActions, null)}
        </div>
      );
    });

    // 2. Render root files
    rootFiles.forEach((fileItem, index) => {
      const isLast = index === totalRootFiles - 1;
      const file = fileItem.file || fileItem;

      if (isAttachment) {
        subItems.push(
          <div key={`file-${file.id}`} className="tl-tree-container" style={{ marginBottom: '7px' }}>
            {parentIsLastArr.map((isLastParent, i) => (
              <div key={i} className={isLastParent ? "tl-tree-line-empty" : "tl-tree-line-vertical"} />
            ))}
            {level > 0 && <div className={`tl-tree-line-connector ${isLast ? 'last-item' : ''}`} />}

            <div
              className="submitted-file-card nested-file-item"
              data-file-id={file.id}
              onClick={(e) => {
                e.stopPropagation();
                confirmOpenFile({ ...file, isAttachment: true });
              }}
              style={{
                cursor: 'pointer',
                backgroundColor: 'var(--background-secondary)',
                padding: '14px 20px',
                flex: 1
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <FileIcon fileType={(file.original_name || 'file').split('.').pop().toLowerCase()} size="default" style={{ width: '34px', height: '34px', minWidth: '34px', minHeight: '34px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '500', fontSize: '15px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.original_name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '1px' }}>{formatFileSize(file.file_size)}</div>
                </div>
                <AttachmentMoreMenu onDownload={() => handleDownloadFile(file)} onOpenPath={() => openFolderInExplorer(file.id, true, file.original_name, false)} />
              </div>
            </div>
          </div>
        );
      } else {
        const canDelete = file.status !== 'final_approved';
        const fileWithTitle = assignment.title ? { ...file, assignment_title: assignment.title } : file;
        subItems.push(
          <div key={`file-${file.id}`} className="tl-tree-container" style={{ marginBottom: '7px' }}>
            {parentIsLastArr.map((isLastParent, i) => (
              <div key={i} className={isLastParent ? "tl-tree-line-empty" : "tl-tree-line-vertical"} />
            ))}
            {level > 0 && <div className={`tl-tree-line-connector ${isLast ? 'last-item' : ''}`} />}

            <div
              className="submitted-file-card nested-file-item"
              data-file-id={file.id}
              onClick={(e) => {
                e.stopPropagation();
                confirmOpenFile({ ...file, isAttachment: false });
              }}
              style={{
                cursor: 'pointer',
                backgroundColor: 'var(--background-secondary)',
                padding: '14px 20px',
                flex: 1
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <FileIcon fileType={(file.original_name || file.filename || 'file').split('.').pop().toLowerCase()} size="default" style={{ width: '34px', height: '34px', minWidth: '34px', minHeight: '34px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '500', fontSize: '15px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.original_name || file.filename}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '1px' }}>
                    <span>by <span style={{ fontWeight: '500', color: 'var(--status-review-text)' }}>{file.submitter_name || user.fullName || user.username}</span></span>
                    <span style={{ color: 'var(--text-tertiary)' }}>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                      </svg>
                      {formatDateTime(file.submitted_at || file.uploaded_at)}
                    </span>
                    {file.tag && (
                      <span style={{ backgroundColor: 'var(--status-review)', color: 'var(--status-review-text)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>🏷️ {file.tag}</span>
                    )}
                    {getFileStatusBadge(file)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  <FileMoreMenuInline
                    onViewDetails={() => openFileDetails(fileWithTitle)}
                    onOpenPath={() => openFolderInExplorer(file.id, false, file.original_name || file.filename, false)}
                    onDelete={canDelete ? () => confirmDeleteFile(assignment.id, file.id, file.original_name || file.filename) : undefined}
                    onChecking={checkerActions?.onChecking ? () => checkerActions.onChecking(file) : undefined}
                    onChecklist={(file.checker_note || file.status === 'revision' || file.status === 'checked') ? () => setChecklistViewModal({ isOpen: true, file }) : undefined}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      }
    });

    return subItems;
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="tasks-container">
      {/* Header */}
      <div className="tasks-header">
        <div className="tasks-header-content">
          <div style={{ marginBottom: '12px' }}>
            <h1 style={{ margin: 0 }}>My Tasks</h1>
            <p className="tasks-subtitle" style={{ margin: '2px 0 0' }}>
              {activeTab === 'for-checking'
                ? `${forCheckingAssignments.length} task${forCheckingAssignments.length !== 1 ? 's' : ''} to check`
                : activeTab === 'done-tasks'
                  ? `${doneTaskAssignments.length} completed task${doneTaskAssignments.length !== 1 ? 's' : ''}`
                  : `${myTaskAssignments.length} active assignment${myTaskAssignments.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{ position: 'relative' }}>
              <select
                value={sortFilter}
                onChange={e => setSortFilter(e.target.value)}
                style={{
                  appearance: 'none', WebkitAppearance: 'none',
                  padding: '5px 30px 5px 12px', borderRadius: '20px',
                  border: '1.5px solid var(--border-color)', backgroundColor: 'var(--background-secondary)',
                  color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500',
                  cursor: 'pointer', outline: 'none',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)', transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--text-tertiary)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({filterCounts[opt.value] ?? 0})
                  </option>
                ))}
              </select>
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="var(--text-tertiary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            <div style={{
              display: 'inline-flex', alignItems: 'center',
              backgroundColor: 'var(--background-secondary)', borderRadius: '10px',
              padding: '4px', gap: '4px'
            }}>
              {/* My Tasks Tab */}
              <button
                onClick={() => setActiveTab('my-tasks')}
                style={{
                  padding: '6px 14px', border: 'none', cursor: 'pointer',
                  borderRadius: '8px',
                  fontSize: '13px', fontWeight: activeTab === 'my-tasks' ? '600' : '500',
                  transition: 'all 0.2s ease',
                  background: activeTab === 'my-tasks' ? 'var(--background-primary)' : 'transparent',
                  color: activeTab === 'my-tasks' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: activeTab === 'my-tasks' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M9 12h6"></path><path d="M9 16h6"></path></svg>
                Tasks
                <span style={{
                  backgroundColor: 'var(--background-secondary)',
                  color: 'var(--text-secondary)',
                  borderRadius: '10px',
                  padding: '2px 8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  marginLeft: '2px'
                }}>
                  {myTaskAssignments.length}
                </span>
              </button>

              {/* For Checking Tab */}
              <button
                onClick={() => setActiveTab('for-checking')}
                style={{
                  padding: '6px 14px', border: 'none', cursor: 'pointer',
                  borderRadius: '8px',
                  fontSize: '13px', fontWeight: activeTab === 'for-checking' ? '600' : '500',
                  transition: 'all 0.2s ease',
                  background: activeTab === 'for-checking' ? 'var(--background-primary)' : 'transparent',
                  color: activeTab === 'for-checking' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: activeTab === 'for-checking' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                For Checking
                <span style={{
                  backgroundColor: 'var(--status-pending)',
                  color: 'var(--status-pending-text)',
                  borderRadius: '10px',
                  padding: '2px 8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  marginLeft: '2px'
                }}>
                  {forCheckingAssignments.length}
                </span>
              </button>

              {/* Done Tasks Tab */}
              <button
                onClick={() => setActiveTab('done-tasks')}
                style={{
                  padding: '6px 14px', border: 'none', cursor: 'pointer',
                  borderRadius: '8px',
                  fontSize: '13px', fontWeight: activeTab === 'done-tasks' ? '600' : '500',
                  transition: 'all 0.2s ease',
                  background: activeTab === 'done-tasks' ? 'var(--background-primary)' : 'transparent',
                  color: activeTab === 'done-tasks' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: activeTab === 'done-tasks' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="9 12 11 14 15 10"></polyline></svg>
                Done Tasks
                <span style={{
                  backgroundColor: 'var(--status-approved)',
                  color: 'var(--status-approved-text)',
                  borderRadius: '10px',
                  padding: '2px 8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  marginLeft: '2px'
                }}>
                  {doneTaskAssignments.length}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ padding: '0 20px 4px', maxWidth: '340px', margin: '0 auto 0 20px', position: 'relative' }}>
        <svg style={{ position: 'absolute', left: '29px', top: '50%', transform: 'translateY(-50%)', color: '#c4c9d4', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '8px 28px 8px 28px',
            border: '1.5px solid #e8eaed', borderRadius: '8px',
            fontSize: '13.5px', color: 'var(--text-secondary)',
            outline: 'none', background: 'var(--background-secondary)',
            transition: 'border-color 0.15s',
            boxShadow: 'none'
          }}
          onFocus={e => e.target.style.borderColor = '#c4c9d4'}
          onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{ position: 'absolute', right: '28px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#c4c9d4', fontSize: '15px', lineHeight: 1, padding: '1px' }}
          >×</button>
        )}
      </div>

      {/* Team Filter Toggle */}
      {(() => {
        const teams = (user?.role === 'TEAM_LEADER' || user?.role === 'ADMIN') && user?.ledTeams?.length > 0
          ? user.ledTeams.map(t => t.name).sort()
          : [...new Set(assignments.map(a => a.team).filter(Boolean))].sort()
        if (teams.length < 2) return null
        const palette = [
          { bg: '#7c3aed', shadow: 'rgba(124,58,237,0.30)', dot: '#7c3aed' },
          { bg: '#0284c7', shadow: 'rgba(2,132,199,0.30)', dot: '#0284c7' },
          { bg: 'var(--status-approved-text)', shadow: 'rgba(5,150,105,0.30)', dot: 'var(--status-approved-text)' },
          { bg: 'var(--status-pending-text)', shadow: 'rgba(217,119,6,0.30)', dot: 'var(--status-pending-text)' },
          { bg: 'var(--status-rejected-text)', shadow: 'rgba(220,38,38,0.30)', dot: 'var(--status-rejected-text)' },
          { bg: '#db2777', shadow: 'rgba(219,39,119,0.30)', dot: '#db2777' },
        ]
        const filterOptions = [
          { value: 'all', label: 'All Teams', color: null },
          ...teams.map((t, i) => ({ value: t, label: t, color: palette[i % palette.length] }))
        ]
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 20px 10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-tertiary)', letterSpacing: '0.03em', userSelect: 'none' }}>Filter by team:</span>
            <div style={{ display: 'flex', gap: '0', background: 'var(--background-secondary)', borderRadius: '10px', padding: '3px', flexWrap: 'wrap' }}>
              {filterOptions.map(opt => {
                const isActive = teamFilter === opt.value
                const c = opt.color
                const activeBg = c && isActive ? c.bg : (isActive ? 'var(--background-primary)' : 'transparent')
                const activeColor = c && isActive ? 'var(--background-secondary)' : (isActive ? 'var(--text-primary)' : 'var(--text-tertiary)')
                const activeShadow = c && isActive ? `0 2px 8px ${c.shadow}` : (isActive ? '0 1px 4px rgba(0,0,0,0.10)' : 'none')
                return (
                  <button
                    key={opt.value}
                    onClick={() => setTeamFilter(opt.value)}
                    style={{
                      padding: '5px 16px', borderRadius: '8px', border: 'none',
                      fontWeight: '600', fontSize: '12.5px', cursor: 'pointer',
                      transition: 'all 0.18s',
                      background: activeBg, color: activeColor, boxShadow: activeShadow,
                      display: 'flex', alignItems: 'center', gap: '5px',
                    }}
                  >
                    {c && (
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isActive ? 'rgba(255,255,255,0.7)' : c.dot, display: 'inline-block', flexShrink: 0 }} />
                    )}
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      {isLoading ? (
        <div style={{ padding: '0 20px', maxWidth: '1400px', margin: '0 auto' }}>
          <LoadingCards count={3} />
        </div>
      ) : filteredAssignments.length > 0 ? (
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '16px 20px' }}>
          {filteredAssignments.map((assignment) => {
            const assignmentComments = comments[assignment.id] || [];
            const isCompleted = assignment.status === 'completed';
            const mySubmittedFiles = activeTab === 'for-checking'
              ? assignment.submitted_files
              : assignment.submitted_files?.filter(f => 
                !f.submitter_name
                || (user?.id && String(f.user_id) === String(user?.id))
                || (user?.username && f.submitter_username === user.username)
              );

            return (
              <div
                key={assignment.id}
                id={`user-assignment-${assignment.id}`}
                style={{ backgroundColor: 'var(--background-secondary)', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '20px', marginBottom: '16px', border: '1px solid var(--border-color)' }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '48px', height: '48px', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Avatar user={{
                        username: assignment.team_leader_username,
                        fullName: assignment.team_leader_fullname || assignment.team_leader_full_name,
                        profile_picture: assignment.team_leader_profile_picture
                      }} size="md" />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)' }}>
                          {assignment.team_leader_fullname || assignment.team_leader_username}
                        </span>
                        <span style={{ backgroundColor: 'transparent', color: 'var(--status-review-text)', padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', border: '1px solid var(--status-review-text)' }}>
                          {assignment.team_leader_role === 'TEAM_LEADER' ? 'TEAM LEADER' : assignment.team_leader_role || 'TEAM LEADER'}
                        </span>
                        {assignment.assigned_to === 'all' ? (
                          <span style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>assigned to <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>all team members</span></span>
                        ) : assignment.assigned_member_details?.length > 0 ? (
                          <span style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
                            assigned to <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                              {assignment.assigned_member_details.map((m, i) => <span key={m.id}>{m.fullName}{i < assignment.assigned_member_details.length - 1 && ', '}</span>)}
                            </span>
                          </span>
                        ) : assignment.assigned_user_fullname && (
                          <span style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>assigned to <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{assignment.assigned_user_fullname}</span></span>
                        )}
                      </div>
                      {(() => {
                        try {
                          const names = JSON.parse(assignment.checker_names || '[]')
                          if (!names.length) return null
                          return (
                            <div style={{ fontSize: '15px', color: 'var(--text-tertiary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: '700', color: 'var(--text-secondary)' }}>Check by:</span>
                              {names.map((name, i) => (
                                <span key={i} style={{ color: 'var(--status-review-text)', fontWeight: '700' }}>
                                  {name}{i < names.length - 1 ? ',' : ''}
                                </span>
                              ))}
                            </div>
                          )
                        } catch { return null }
                      })()}
                      <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📅 Assigned on: {formatDateTime(assignment.created_at)}</span>
                        {assignment.complexity && assignment.complexity !== 'Medium' && (
                          <span style={{ 
                            backgroundColor: assignment.complexity === 'High' ? '#fee2e2' : '#f3f4f6', 
                            color: assignment.complexity === 'High' ? '#dc2626' : '#4b5563', 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            fontSize: '11px', 
                            fontWeight: '600',
                            border: `1px solid ${assignment.complexity === 'High' ? '#fca5a5' : '#d1d5db'}`
                          }}>
                            {assignment.complexity} Complexity
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {isCompleted ? (
                      <div style={{ backgroundColor: 'var(--status-approved)', color: 'var(--status-approved-text)', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        ✓ Completed
                      </div>
                    ) : assignment.status === 'checked' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <div style={{ backgroundColor: 'var(--status-review)', color: 'var(--status-review-text)', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          ✓ Checked
                        </div>
                        {(() => {
                          const checkerName = assignment.submitted_files?.find(f => f.checked_by)?.checked_by;
                          if (!checkerName) return null;
                          return (
                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: '500' }}>
                              Checked by : <span style={{ color: 'var(--status-review-text)', fontWeight: '700' }}>{checkerName}</span>
                            </div>
                          );
                        })()}
                      </div>
                    ) : assignment.status === 'for_editing' ? (
                      activeTab === 'for-checking' ? (
                        <>
                          <div style={{ backgroundColor: 'transparent', color: 'var(--status-pending-text)', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', border: '1.5px solid #FDBA74' }}>
                            For Checking
                          </div>
                          {assignment.due_date_edited ? (
                            <div style={{ marginTop: '4px', textAlign: 'right' }}>
                              <span style={{ backgroundColor: 'var(--status-pending)', color: 'var(--status-pending-text)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>✎ Due Date Edited</span>
                            </div>
                          ) : null}
                        </>
                      ) : mySubmittedFiles?.length > 0 ? (
                        <>
                          <div style={{ backgroundColor: 'var(--status-approved)', color: 'var(--status-approved-text)', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #86EFAC' }}>
                            ✓ Submitted
                          </div>
                          {assignment.due_date_edited ? (
                            <div style={{ marginTop: '4px', textAlign: 'right' }}>
                              <span style={{ backgroundColor: 'var(--status-pending)', color: 'var(--status-pending-text)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>✎ Due Date Edited</span>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <div style={{ backgroundColor: 'var(--status-pending)', color: 'var(--status-pending-text)', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #FCD34D' }}>
                            ✎ For Editing
                          </div>
                          {assignment.due_date_edited ? (
                            <div style={{ marginTop: '4px', textAlign: 'right' }}>
                              <span style={{ backgroundColor: 'var(--status-pending)', color: 'var(--status-pending-text)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>✎ Due Date Edited</span>
                            </div>
                          ) : null}
                        </>
                      )
                    ) : mySubmittedFiles?.length > 0 ? (
                      activeTab === 'for-checking' ? (
                        <>
                          <div style={{ backgroundColor: 'transparent', color: 'var(--status-pending-text)', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', border: '1.5px solid #FDBA74' }}>
                            For Checking
                          </div>
                          {assignment.due_date_edited ? (
                            <div style={{ marginTop: '4px', textAlign: 'right' }}>
                              <span style={{ backgroundColor: 'var(--status-pending)', color: 'var(--status-pending-text)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>✎ Due Date Edited</span>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <div style={{ backgroundColor: 'var(--status-approved)', color: 'var(--status-approved-text)', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #86EFAC' }}>
                            ✓ Submitted
                          </div>
                          {assignment.due_date_edited ? (
                            <div style={{ marginTop: '4px', textAlign: 'right' }}>
                              <span style={{ backgroundColor: 'var(--status-pending)', color: 'var(--status-pending-text)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>✎ Due Date Edited</span>
                            </div>
                          ) : null}
                        </>
                      )
                    ) : (
                      <>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          Due: {assignment.due_date ? formatDate(assignment.due_date) : 'No due date'}
                          {assignment.due_date && (
                            <span style={{ color: getBusinessDaysColor(assignment.due_date, assignment.ot_dates), fontWeight: '400', marginLeft: '4px', whiteSpace: 'nowrap' }}>
                              ({formatBusinessDaysLeft(assignment.due_date, assignment.ot_dates)})
                            </span>
                          )}
                        </div>
                        {assignment.due_date_edited ? (
                          <div style={{ marginTop: '4px', textAlign: 'right' }}>
                            <span style={{ backgroundColor: 'var(--status-pending)', color: 'var(--status-pending-text)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              ✎ Due Date Edited
                            </span>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>{assignment.title}</div>

                {assignment.description && (
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>{assignment.description}</div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  {getStatusBadge(assignment, activeTab, user)}
                </div>

                {/* Team Leader Attachments */}
                {assignment.attachments?.length > 0 && (() => {
                  const { folders: attFolders, individualFiles: attIndividual } = groupFilesByFolder(assignment.attachments);
                  const folderNames = Object.keys(attFolders);
                  const totalItems = folderNames.length + attIndividual.length;
                  const attExpKey = `att-${assignment.id}`;
                  const attExpanded = showAllSubmittedFiles[attExpKey];
                  const allAttTop = [
                    ...folderNames.map(n => ({ type: 'folder', name: n })),
                    ...attIndividual.map(f => ({ type: 'file', file: f }))
                  ];
                  const visAttTop = attExpanded ? allAttTop : allAttTop.slice(0, 5);
                  const visAttFolderNames = new Set(visAttTop.filter(i => i.type === 'folder').map(i => i.name));
                  const visAttFiles = visAttTop.filter(i => i.type === 'file').map(i => i.file);
                  return (
                    <div className="submitted-files-section">
                      <div className="submitted-files-header">
                        📎 Attached Files ({totalItems === 1 ? '1 item' : `${folderNames.length} folder${folderNames.length !== 1 ? 's' : ''}${attIndividual.length > 0 ? `, ${attIndividual.length} file${attIndividual.length !== 1 ? 's' : ''}` : ''}`})
                      </div>
                      {folderNames.filter(fn => visAttFolderNames.has(fn)).map(folderName => {
                        const folderFiles = attFolders[folderName];
                        const key = `att-${assignment.id}-${folderName}`;
                        const isExpanded = expandedFolders[key];
                        return (
                          <div key={folderName} style={{ marginBottom: '8px' }}>
                            <div
                              className="submitted-file-card"
                              onClick={() => {
                                const newState = !expandedFolders[key];
                                setExpandedFolders(prev => ({ ...prev, [key]: newState }));
                                if (newState && folderFiles) prefetchFolderFiles(folderFiles, 'attachment');
                              }}
                              style={{ cursor: 'pointer', backgroundColor: isExpanded ? 'var(--background-primary)' : 'var(--background-secondary)' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ fontSize: '32px', flexShrink: 0 }}>{isExpanded ? '📂' : '📁'}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{folderName}</div>
                                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                    {assignment.team_leader_fullname || assignment.team_leader_username || 'Team Leader'} • {folderFiles.length} file{folderFiles.length !== 1 ? 's' : ''}
                                  </div>
                                </div>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                                  <path d="M4 6L8 10L12 6" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <AttachmentMoreMenu
                                  isFolder
                                  onDownload={() => handleDownloadFolder(folderFiles, folderName)}
                                  onOpenPath={() => openFolderInExplorer(folderFiles[0]?.id, true, folderName, true)}
                                />
                              </div>
                            </div>
                            {isExpanded && renderRecursiveItems(assignment, folderFiles, 1, key, [], true, null, folderName)}
                          </div>
                        );
                      })}
                      {visAttFiles.map(attachment => (
                        <div key={attachment.id} onClick={() => confirmOpenFile({ ...attachment, isAttachment: true })} className="submitted-file-card" style={{ cursor: 'pointer', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <FileIcon fileType={attachment.original_name.split('.').pop()} size="small" />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: '500', fontSize: '14px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.original_name}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>by <span style={{ fontWeight: '500', color: 'var(--status-review-text)' }}>{assignment.team_leader_fullname || assignment.team_leader_username || 'Team Leader'}</span></span>
                                <span style={{ color: 'var(--text-tertiary)' }}>•</span>
                                <span>{formatFileSize(attachment.file_size)}</span>
                              </div>
                            </div>
                            <AttachmentMoreMenu onDownload={() => handleDownloadFile(attachment)} onOpenPath={() => openFolderInExplorer(attachment.id, true, attachment.original_name, false)} />
                          </div>
                        </div>
                      ))}
                      {totalItems > 5 && (
                        <div style={{ marginTop: '8px', textAlign: 'center' }}>
                          <button
                            onClick={() => setShowAllSubmittedFiles(prev => ({ ...prev, [attExpKey]: !prev[attExpKey] }))}
                            style={{ background: 'none', border: 'none', color: 'var(--status-review-text)', fontSize: '14px', fontWeight: '500', cursor: 'pointer', padding: '8px 16px', textDecoration: 'underline' }}
                          >
                            {attExpanded ? 'See less' : `See more (${totalItems - 5} more)`}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Submitted Files */}
                {assignment.submitted_files?.length > 0 && (() => {
                  // In My Tasks tab: only show the current user's own submitted files
                  // In For Checking tab: show all members' files for review
                  const visibleFiles = activeTab === 'for-checking'
                    ? assignment.submitted_files
                    : assignment.submitted_files.filter(f =>
                      !f.submitter_name // attachment-style files (no submitter_name) always show
                      || String(f.user_id) === String(user.id)
                      || String(f.submitter_username) === String(user.username)
                    );

                  if (visibleFiles.length === 0) return null;

                  const sortedFiles = [...visibleFiles].sort((a, b) =>
                    new Date(b.submitted_at || b.uploaded_at) - new Date(a.submitted_at || a.uploaded_at)
                  );
                  const { folders, individualFiles } = groupFilesByFolder(sortedFiles);
                  const foldersToShow = Object.keys(folders);
                  const showAll = showAllSubmittedFiles[assignment.id];
                  const totalItems = foldersToShow.length + individualFiles.length;
                  const shouldShowSeeMore = totalItems > INITIAL_FILE_DISPLAY_LIMIT;

                  const checkerActions = activeTab === 'for-checking' ? {
                    onChecking: (file) => setCheckingModal({ isOpen: true, file, assignment }),
                  } : null;

                  let displayFolders = foldersToShow;
                  let displayIndividualFiles = individualFiles;
                  if (!showAll && shouldShowSeeMore) {
                    if (foldersToShow.length >= INITIAL_FILE_DISPLAY_LIMIT) {
                      displayFolders = foldersToShow.slice(0, INITIAL_FILE_DISPLAY_LIMIT);
                      displayIndividualFiles = [];
                    } else {
                      displayIndividualFiles = individualFiles.slice(0, INITIAL_FILE_DISPLAY_LIMIT - foldersToShow.length);
                    }
                  }

                  return (
                    <div className="submitted-files-section" style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
                      <div className="submitted-files-header" style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>📎</span>
                        Submitted Files ({visibleFiles.length}):
                      </div>

                      {displayFolders.map(folderName => {
                        const folderFiles = folders[folderName];
                        const key = `${assignment.id}-${folderName}`;
                        const isExpanded = expandedFolders[key];
                        return (
                          <div key={folderName} style={{ marginBottom: '8px' }}>
                            <div
                              className="submitted-file-card"
                              onClick={() => {
                                const newState = !expandedFolders[key];
                                setExpandedFolders(prev => ({ ...prev, [key]: newState }));
                                if (newState && folderFiles) prefetchFolderFiles(folderFiles, 'file');
                              }}
                              style={{ cursor: 'pointer', backgroundColor: isExpanded ? 'var(--status-review)' : 'var(--background-secondary)' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ fontSize: '32px', flexShrink: 0 }}>{isExpanded ? '📂' : '📁'}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{folderName}</div>
                                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span>Submitted by <span style={{ fontWeight: '500' }}>{folderFiles[0].submitter_name || user.fullName || user.username}</span> • {folderFiles.length} files</span>
                                    {renderFolderStatusBadges(folderFiles)}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                  <FileMoreMenuInline
                                    isFolder
                                    onViewDetails={() => { const firstFile = folderFiles[0]; if (firstFile) openFileDetails(firstFile); }}
                                    onOpenPath={() => openFolderInExplorer(folderFiles[0]?.id, false, folderName, true)}
                                    onDelete={() => {
                                      setFileToDelete({ assignmentId: assignment.id, fileId: null, fileName: folderName, isFolderDelete: true, folderFiles });
                                      setShowDeleteModal(true);
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                            {isExpanded && renderRecursiveItems(assignment, folderFiles, 1, key, [], false, checkerActions, folderName)}
                          </div>
                        );
                      })}

                      {displayIndividualFiles.map(file => renderFileCard(file, assignment.id, false, assignment.title, false, checkerActions))}

                      {shouldShowSeeMore && (
                        <div style={{ marginTop: '12px', textAlign: 'center' }}>
                          <button
                            onClick={() => setShowAllSubmittedFiles(prev => ({ ...prev, [assignment.id]: !prev[assignment.id] }))}
                            style={{ background: 'none', border: 'none', color: 'var(--status-review-text)', fontSize: '14px', fontWeight: '500', cursor: 'pointer', padding: '8px 16px', textDecoration: 'underline' }}
                          >
                            {showAll ? 'See less' : `See more (${totalItems - INITIAL_FILE_DISPLAY_LIMIT} more)`}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {(assignment.user_status === 'submitted' || assignment.status === 'completed') && !assignment.submitted_files?.length && (
                  <div style={{ backgroundColor: 'var(--status-pending)', border: '1px solid #F59E0B', borderRadius: '8px', padding: '12px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke='var(--status-pending-text)' strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    <div style={{ fontSize: '14px', color: 'var(--status-pending-text)', lineHeight: '1.5' }}><strong>No files found.</strong><br />Please upload files for this assignment.</div>
                  </div>
                )}

                {(assignment.assigned_to === 'all' || assignment.assigned_member_details?.some(m => m.id === user.id)) && (
                  <div style={{ paddingTop: '16px' }}>
                    <button
                      onClick={() => handleSubmit(assignment)}
                      style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', width: '100%', cursor: 'pointer', outline: 'none', gap: '12px' }}
                    >
                      <span style={{ backgroundColor: assignment.submitted_files?.length ? '#10b981' : 'var(--primary-color)', padding: '6px 16px', borderRadius: '4px', fontSize: '14px', fontWeight: '500', color: '#ffffff', whiteSpace: 'nowrap' }}>
                        {assignment.submitted_files?.length ? 'Add more files' : 'Submit file'}
                      </span>
                      <span style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
                        {assignment.submitted_files?.length ? 'Upload additional files' : 'Click to attach files'}
                      </span>
                    </button>
                  </div>
                )}

                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--background-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    onClick={() => openCommentsModal(assignment)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                    Comment
                    {(() => {
                      const count = assignmentComments.length > 0 ? assignmentComments.length : (assignment.comment_count || 0);
                      const hasRejected = assignment.submitted_files?.some(f =>
                        ['rejected_by_team_leader', 'rejected_by_admin'].includes(f.status)
                      );
                      return (
                        <span style={{
                          backgroundColor: hasRejected && count > 0 ? 'var(--status-rejected)' : 'var(--background-primary)',
                          color: hasRejected && count > 0 ? 'var(--status-rejected-text)' : 'var(--text-secondary)',
                          borderRadius: '10px', padding: '1px 8px', fontSize: '12px', fontWeight: '600',
                        }}>
                          {count}
                        </span>
                      );
                    })()}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="tasks-empty">
          <div className="tasks-empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </svg>
          </div>
          <h3>{searchQuery ? 'No Results Found' : sortFilter === 'all' ? 'No assignments' : `No ${SORT_OPTIONS.find(o => o.value === sortFilter)?.label.toLowerCase()} assignments`}</h3>
          <p>{searchQuery ? `No tasks match "${searchQuery}".` : sortFilter === 'all' ? "You don't have any assignments at this time." : 'Try a different filter.'}</p>
        </div>
      )}

      {showCommentsModal && currentCommentsAssignment && (
        <CommentsModal
          isOpen={showCommentsModal}
          onClose={handleCloseCommentsModal}
          assignment={currentCommentsAssignment}
          comments={comments[currentCommentsAssignment.id] || []}
          loadingComments={loadingComments}
          newComment={newComment[currentCommentsAssignment.id] || ''}
          setNewComment={handleSetNewComment}
          onPostComment={handlePostComment}
          isPostingComment={isPostingComment[currentCommentsAssignment.id]}
          onPostReply={postReply}
          isPostingReply={isPostingReply}
          onEditComment={editComment}
          onDeleteComment={deleteComment}
          onEditReply={editReply}
          onDeleteReply={deleteReply}
          visibleReplies={visibleReplies}
          toggleRepliesVisibility={toggleRepliesVisibility}
          getInitials={getInitials}
          formatTimeAgo={formatRelativeTime}
          user={user}
          highlightUsername={highlightCommentBy}
          highlightCommentId={highlightTargetCommentId}
        />
      )}

      {showDeleteModal && fileToDelete && (
        <div className="tasks-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="tasks-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="tasks-modal-header">
              <h3 style={{ color: 'var(--status-rejected-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚠ {fileToDelete.isFolderDelete ? 'Delete Folder' : 'Delete File'}
              </h3>
              <button className="tasks-modal-close" onClick={() => setShowDeleteModal(false)}>×</button>
            </div>
            <div className="tasks-modal-body">
              <div style={{ padding: '20px 0' }}>
                <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.6' }}>
                  {fileToDelete.isFolderDelete
                    ? `Are you sure you want to delete all ${fileToDelete.folderFiles?.length} files in this folder?`
                    : 'Do you really want to delete this file, or would you like to resubmit a new file instead?'}
                </p>
                <div style={{ backgroundColor: 'var(--status-rejected)', border: '1px solid var(--status-rejected-text)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--status-rejected-text)' }}>{fileToDelete.fileName}</span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0 }}>Deleting is permanent. Resubmitting allows you to upload a new version.</p>
              </div>
            </div>
            <div className="tasks-modal-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--background-secondary)', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                Cancel
              </button>
              {!fileToDelete.isFolderDelete && (
                <button
                  onClick={() => {
                    const assignment = assignments.find(a => a.id === fileToDelete.assignmentId);
                    if (assignment) {
                      setShowDeleteModal(false);
                      setFileToDelete(null);
                      handleSubmit(assignment);
                    }
                  }}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary-color)', color: '#ffffff', fontSize: '14px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  Resubmit
                </button>
              )}
              <button
                onClick={async () => {
                  if (fileToDelete.isFolderDelete) {
                    const { assignmentId, folderFiles, fileName: folderName } = fileToDelete;
                    setShowDeleteModal(false);
                    setFileToDelete(null);
                    const folderFileIds = new Set(folderFiles.map(f => f.id));
                    setAssignments(prev => prev.map(a =>
                      a.id !== assignmentId ? a : { ...a, submitted_files: a.submitted_files.filter(f => !folderFileIds.has(f.id)) }
                    ));
                    try {
                      await apiFetch(`/api/files/folder/delete`, {
                        method: 'POST',
                        body: JSON.stringify({ folderName, username: user.username, fileIds: folderFiles.map(f => f.id), userId: user.id, userRole: user.role, team: user.team }),
                      });
                    } catch (_e) { /* Directory cleanup failure is non-fatal — ignore */ }
                    setSuccessModal({ isOpen: true, title: 'Removed', message: 'Folder removed successfully', type: 'error' });
                    setTimeout(() => fetchAssignments(), 500);
                  } else {
                    handleRemoveSubmittedFile(fileToDelete.assignmentId, fileToDelete.fileId);
                  }
                }}
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#ef4444', color: '#ffffff', fontSize: '14px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {fileToDelete.isFolderDelete ? 'Delete Folder' : 'Delete Anyway'}
              </button>
            </div>
          </div>
        </div>
      )}

      <FileOpenModal
        isOpen={showOpenFileModal}
        onClose={() => { setShowOpenFileModal(false); setFileToOpen(null); }}
        onConfirm={handleOpenFile}
        file={fileToOpen}
        type={openModalType}
      />

      <ChecklistViewModal
        isOpen={checklistViewModal.isOpen}
        onClose={() => setChecklistViewModal({ isOpen: false, file: null })}
        file={checklistViewModal.file}
        currentUserRole={user?.role}
      />

      <CheckingModal
        isOpen={checkingModal.isOpen}
        onClose={() => setCheckingModal({ isOpen: false, file: null, assignment: null })}
        file={checkingModal.file}
        assignment={checkingModal.assignment}
        user={user}
        onMarkForEditing={async (fileId, wrongItems, additionalComment, penaltyPercentage) => {
          const parts = [];
          if (wrongItems.length > 0) parts.push(`Wrong items: ${wrongItems.join(', ')}`);
          if (additionalComment) parts.push(`Comment: ${additionalComment}`);
          const note = parts.length > 0 ? parts.join(' | ') : 'Marked for editing by checker.';
          await handleMarkForEditing(checkingModal.assignment, fileId, note, penaltyPercentage);
          setCheckingModal({ isOpen: false, file: null, assignment: null });
        }}
        onDoneChecking={async (fileId, additionalComment) => {
          const note = additionalComment ? `Comment: ${additionalComment}` : '';
          await handleMarkFileChecked(checkingModal.assignment, fileId, note);
          setCheckingModal({ isOpen: false, file: null, assignment: null });
        }}
      />

      <SuccessModal
        isOpen={successModal.isOpen}
        onClose={() => setSuccessModal({ ...successModal, isOpen: false })}
        title={successModal.title}
        message={successModal.message}
        type={successModal.type}
      />

      {downloadToast.show && (
        <div style={{ position: 'fixed', top: '28px', right: '28px', zIndex: 9999, background: 'var(--background-secondary)', border: '1px solid #bbf7d0', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.13)', padding: '18px 22px 14px 18px', display: 'flex', alignItems: 'flex-start', gap: '14px', minWidth: '280px', maxWidth: '380px', animation: 'slideInRight 0.25s ease' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--status-approved)', border: '2px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke='var(--status-approved-text)' strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--status-approved-text)', marginBottom: '4px' }}>Success</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {downloadToast.fileName ? `"${downloadToast.fileName}" downloaded successfully!` : 'File downloaded successfully!'}
            </div>
            <div style={{ marginTop: '10px', height: '4px', borderRadius: '2px', background: 'var(--status-approved)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '2px', background: '#22c55e', animation: 'shrinkBar 3.5s linear forwards' }} />
            </div>
          </div>
          <button onClick={() => setDownloadToast({ show: false, fileName: '' })} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '20px', lineHeight: 1, padding: 0 }}>×</button>
        </div>
      )}

      <style>{`
        @keyframes slideInRight { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes shrinkBar { from { width: 100%; } to { width: 0%; } }
      `}</style>

      {showSubmitModal && currentAssignment && (
        <div className="tasks-modal-overlay">
          <div className="tasks-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="tasks-modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div style={{ flex: 1, marginRight: '40px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px' }}>Submit Task</h3>
                <div style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)', borderLeft: '4px solid var(--primary-color)', borderRadius: '8px', padding: '12px 16px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)', margin: 0 }}>{currentAssignment.title}</h4>
                  {currentAssignment.description && (
                    <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '6px', marginBottom: 0, lineHeight: '1.5' }}>{currentAssignment.description}</p>
                  )}
                </div>
              </div>
              <button className="tasks-modal-close" onClick={() => { resetSubmitModal(); setShowSubmitModal(false); setLocalCreatedFolders([]); }}>×</button>
            </div>

            <div className="tasks-modal-body">
              <div className="tasks-file-selection">
                <div className="upload-section">
                  {(() => {
                    const existingFolders = [...new Set([
                      ...((currentAssignment.submitted_files || []).filter(f => f.folder_name).map(f => f.folder_name)),
                      ...localCreatedFolders
                    ])];
                    return (
                      <div style={{ marginBottom: '16px', padding: '14px 16px', backgroundColor: 'var(--status-review)', borderRadius: '10px', border: '1px solid var(--status-review-text)' }}>
                        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--status-review-text)', marginBottom: '8px', display: 'block' }}>📁 Group files into a folder (optional)</label>
                        {!isCreatingNewFolder ? (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <select
                              value={targetFolder || ''}
                              onChange={e => {
                                if (e.target.value === '__CREATE_NEW__') {
                                  setIsCreatingNewFolder(true);
                                  setTargetFolder('');
                                } else {
                                  setTargetFolder(e.target.value || null);
                                }
                              }}
                              style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '14px', backgroundColor: 'var(--background-secondary)', color: 'var(--text-primary)', outline: 'none' }}
                            >
                              <option value="">None (Upload to main assignment)</option>
                              {existingFolders.map(fn => <option key={fn} value={fn}>{fn}</option>)}
                              <option value="__CREATE_NEW__" style={{ fontWeight: '600', color: 'var(--primary-color)' }}>+ Create New Folder</option>
                            </select>
                            {targetFolder && localCreatedFolders.includes(targetFolder) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setLocalCreatedFolders(prev => prev.filter(f => f !== targetFolder));
                                  setTargetFolder(null);
                                }}
                                title="Delete this folder"
                                style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fecaca'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fee2e2'}
                              >
                                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              type="text"
                              value={targetFolder || ''}
                              onChange={e => setTargetFolder(e.target.value)}
                              placeholder="Type a new folder name..."
                              autoFocus
                              style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--status-review-text)', fontSize: '14px', backgroundColor: 'var(--background-secondary)', color: 'var(--text-primary)', outline: 'none', boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.1)' }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (targetFolder && targetFolder.trim() !== '') {
                                  const folderName = targetFolder.trim();
                                  setLocalCreatedFolders(prev => [...new Set([...prev, folderName])]);
                                  setTargetFolder(folderName);
                                  setIsCreatingNewFolder(false);
                                }
                              }}
                              disabled={!targetFolder || targetFolder.trim() === ''}
                              style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: (!targetFolder || targetFolder.trim() === '') ? 'var(--border-color)' : 'var(--primary-color)', border: 'none', color: (!targetFolder || targetFolder.trim() === '') ? 'var(--text-secondary)' : '#fff', cursor: (!targetFolder || targetFolder.trim() === '') ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500', transition: 'all 0.2s' }}
                            >
                              Create
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsCreatingNewFolder(false);
                                setTargetFolder(null);
                              }}
                              style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px', fontWeight: '500', transition: 'all 0.2s' }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--border-color)'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--background-secondary)'}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                        {targetFolder && !isCreatingNewFolder && <p style={{ fontSize: '12px', color: 'var(--status-review-text)', marginTop: '6px', margin: '6px 0 0' }}>✓ Files will be grouped under <strong>{targetFolder}</strong></p>}
                        {isCreatingNewFolder && <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '6px', margin: '6px 0 0' }}>Type a name and click Create to add it to the list.</p>}
                      </div>
                    );
                  })()}

                  <div className="file-upload-wrapper">
                    <input ref={fileInputRef} type="file" multiple onChange={e => {
                      const files = Array.from(e.target.files);
                      if (files.length) {
                        const inheritedFolder = targetFolder || uploadedFiles.find(f => f.folderName)?.folderName || null;
                        setUploadedFiles(prev => [...prev, ...files.map(f => inheritedFolder
                          ? { file: f, relativePath: `${inheritedFolder}/${f.name}`, folderName: inheritedFolder }
                          : { file: f, relativePath: f.name, folderName: null })]);
                        setUploadMode(inheritedFolder ? 'folder' : 'files');
                      }
                      e.target.value = '';
                    }} style={{ display: 'none' }} disabled={isUploading} />
                    <input ref={folderInputRef} type="file" webkitdirectory="" directory="" onChange={e => {
                      const files = Array.from(e.target.files);
                      if (files.length) {
                        const folderName = files[0].webkitRelativePath.split('/')[0];
                        setUploadedFiles(prev => [...prev, ...files.map(f => ({ file: f, relativePath: f.webkitRelativePath, folderName }))]);
                        setUploadMode('folder');
                      }
                      e.target.value = '';
                    }} style={{ display: 'none' }} disabled={isUploading} />

                    <div
                      className="file-upload-label"
                      style={{ border: '2px dashed #d1d5db', borderRadius: '12px', padding: '32px', textAlign: 'center', cursor: 'pointer', backgroundColor: 'var(--background-secondary)', transition: 'all 0.2s' }}
                      onDragOver={e => { e.preventDefault(); e.currentTarget.style.backgroundColor = 'var(--status-review)'; e.currentTarget.style.borderColor = 'var(--status-review-text)'; }}
                      onDragLeave={e => { e.preventDefault(); e.currentTarget.style.backgroundColor = 'var(--background-secondary)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                      onDrop={async e => {
                        e.preventDefault();
                        e.currentTarget.style.backgroundColor = 'var(--background-secondary)';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        const items = Array.from(e.dataTransfer.items || []);
                        const allFiles = (await Promise.all(
                          items.filter(i => i.kind === 'file').map(i => {
                            const entry = i.webkitGetAsEntry?.();
                            if (entry) return readAllFilesFromEntry(entry);
                            const file = i.getAsFile();
                            if (!file) return [];
                            const inheritedFolder = targetFolder || uploadedFiles.find(f => f.folderName)?.folderName || null;
                            return [inheritedFolder
                              ? { file, relativePath: `${inheritedFolder}/${file.name}`, folderName: inheritedFolder }
                              : { file, relativePath: file.name, folderName: null }];
                          })
                        )).flat();
                        if (allFiles.length) {
                          setUploadedFiles(prev => [...prev, ...allFiles]);
                          if (allFiles.some(f => f.folderName)) setUploadMode('folder');
                        }
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#FFC107" stroke="#E6A817" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>
                        <div>
                          <p style={{ fontSize: '15px', fontWeight: '500', color: 'var(--text-primary)', margin: '0 0 8px' }}>Drag and drop files or folders here</p>
                          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #4f46e5', backgroundColor: 'var(--background-secondary)', color: 'var(--status-review-text)', fontSize: '14px', fontWeight: '500', cursor: isUploading ? 'not-allowed' : 'pointer' }}>
                              📄 Browse Files
                            </button>
                            <button type="button" onClick={() => folderInputRef.current?.click()} disabled={isUploading} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--status-review-text)', color: 'var(--background-secondary)', fontSize: '14px', fontWeight: '500', cursor: isUploading ? 'not-allowed' : 'pointer' }}>
                              📁 Browse Folder
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {uploadedFiles.length > 0 && (
                  <div style={{ marginTop: '24px' }}>
                    <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', display: 'block', marginBottom: '12px' }}>
                      {uploadMode === 'folder' ? `Folder: ${uploadedFiles[0].folderName} (${uploadedFiles.length} files)` : `Selected Files (${uploadedFiles.length})`}
                    </label>

                    {uploadMode === 'folder' ? (
                      <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', backgroundColor: 'var(--background-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#fed7aa" stroke='var(--status-pending-text)' strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>{uploadedFiles[0]?.folderName}</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>{uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''}</div>
                            <div style={{ maxHeight: '300px', overflowY: 'auto', overflowX: 'hidden', backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px' }}>
                              {uploadedFiles.map((fileObj, index) => (
                                <div key={index} style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: index < uploadedFiles.length - 1 ? '1px solid var(--background-secondary)' : 'none' }}>
                                  <FileIcon fileType={fileObj.file.name.split('.').pop().toLowerCase()} isFolder={false} size="small" />
                                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileObj.relativePath}</span>
                                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>{formatFileSize(fileObj.file.size)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <button onClick={() => { setUploadedFiles([]); setUploadMode('files'); if (folderInputRef.current) folderInputRef.current.value = ''; }} disabled={isUploading} style={{ background: 'transparent', color: 'var(--text-tertiary)', border: 'none', borderRadius: '6px', padding: '6px', fontSize: '18px', cursor: 'pointer' }} title="Remove folder">×</button>
                        </div>
                      </div>
                    ) : (
                      uploadedFiles.map((fileObj, index) => (
                        <div key={index} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 16px', marginBottom: '8px', backgroundColor: 'var(--background-secondary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <FileIcon fileType={fileObj.file.name.split('.').pop().toLowerCase()} isFolder={false} size="default" />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: '500', fontSize: '14px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileObj.file.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{formatFileSize(fileObj.file.size)}</div>
                          </div>
                          <button onClick={() => handleRemoveFile(index)} disabled={isUploading} style={{ background: 'transparent', color: 'var(--text-tertiary)', border: 'none', borderRadius: '6px', padding: '6px', fontSize: '18px', cursor: 'pointer' }} title="Remove file">×</button>
                        </div>
                      ))
                    )}

                    <div style={{ marginTop: '24px', padding: '16px', backgroundColor: 'var(--background-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>🏷️ Tag</label>
                      <SingleSelectTags selectedTag={fileTag} onChange={setFileTag} disabled={isUploading} user={user} />
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)', marginTop: '16px' }}>✎ Description (optional)</label>
                      <textarea
                        value={fileDescription}
                        onChange={e => setFileDescription(e.target.value)}
                        placeholder="Add a brief description..."
                        rows="2"
                        disabled={isUploading}
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical', backgroundColor: 'var(--background-secondary)' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="tasks-modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', gap: '12px', justifyContent: 'flex-end', flexDirection: 'column' }}>
              {isUploading && (
                <div style={{ width: '100%', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--status-review-text)' }}>{uploadProgress < 100 ? 'Uploading files...' : 'Finalizing...'}</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--status-review-text)' }}>{uploadProgress}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--background-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${uploadProgress}%`, height: '100%', backgroundColor: 'var(--status-review-text)', transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { resetSubmitModal(); setShowSubmitModal(false); }}
                  disabled={false}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--background-secondary)', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
                >
                  {isUploading ? 'Stop Upload' : 'Cancel'}
                </button>
                <button
                  onClick={handleFileUpload}
                  disabled={!uploadedFiles.length || isUploading}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: !uploadedFiles.length || isUploading ? '#d1d5db' : 'var(--status-review-text)', color: 'var(--background-secondary)', fontSize: '14px', fontWeight: '500', cursor: !uploadedFiles.length || isUploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {isUploading ? '⏳ Uploading...' : `✓ Upload ${uploadedFiles.length > 0 ? `${uploadedFiles.length} ` : ''}File${uploadedFiles.length !== 1 ? 's' : ''} & Submit`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <FileModal
        showFileModal={showFileDetailsModal}
        setShowFileModal={setShowFileDetailsModal}
        selectedFile={fileDetailsTarget}
        fileComments={[]}
        formatFileSize={formatFileSize}
        onOpenFile={() => confirmOpenFile(fileDetailsTarget)}
      />
    </div>
  );
});

TasksTab.displayName = 'TasksTab';
export default TasksTab;
