import { useRef, useCallback, useState, useEffect, startTransition, useMemo, memo } from 'react';
import useStore from '@/store/useStore';
import { apiFetch, API_BASE_URL } from '@/config/api';
import './css/TasksTab-Enhanced.css';
import './css/TasksTab-Comments.css';
import { FileIcon, FileOpenModal, PremiumTaskCard, PremiumModal } from '../shared';
import FileModal from './FileModal';
import CommentsModal from '../shared/CommentsModal';
import SingleSelectTags from './SingleSelectTags';
import { LoadingCards } from '../common/InlineSkeletonLoader';
import SuccessModal from './SuccessModal';
import { useSmartNavigation } from '../shared/SmartNavigation';
import '../shared/SmartNavigation/SmartNavigation.css';
import { formatDate, formatDateTime, formatFileSize, groupFilesByFolder, getInitials } from '../../utils/ui-helpers';
import { openFile, downloadFile, downloadFolder } from '../../utils/file-actions';

// ─── Constants ────────────────────────────────────────────────────────────────
const INITIAL_FILE_DISPLAY_LIMIT = 5;
const SORT_OPTIONS = [
  { value: 'all', label: 'All Tasks' },
  { value: 'completed', label: 'Completed' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'no_due_date', label: 'No Due Date' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Functions moved to shared/utils/ui-helpers.js

const getAssignmentStatus = (assignment) => {
  // If the assignment itself is marked completed (by TL or admin), always treat as completed
  // regardless of whether the user uploaded files
  if (assignment.status === 'completed') return 'completed';
  const hasFiles = assignment.submitted_files?.length > 0;
  if (hasFiles) return 'completed';
  if (!assignment.due_date) return 'no_due_date';
  const dueDate = new Date(assignment.due_date);
  const now = new Date();
  dueDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  if (dueDate < now) return 'overdue';
  return 'active';
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const FileMoreMenuInline = memo(({ onDelete, onViewDetails, isFolder = false }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!onDelete && !onViewDetails) return null;

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(prev => !prev); }}
        title="More options"
        style={{
          background: 'transparent', border: 'none', borderRadius: '6px',
          width: '30px', height: '30px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', color: '#9ca3af',
          padding: 0, flexShrink: 0, transition: 'all 0.15s',
          fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px'
        }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f3f4f6'; e.currentTarget.style.color = '#374151'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
      >
        •••
      </button>
      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', right: 0, top: '34px', zIndex: 1000,
            backgroundColor: '#fff', border: '1px solid #e5e7eb',
            borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            minWidth: '160px', overflow: 'hidden',
          }}
        >
          {onViewDetails && (
            <button
              onClick={() => { setOpen(false); onViewDetails(); }}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none',
                padding: '10px 14px', fontSize: '13px', color: '#374151',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              File Details
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => { setOpen(false); onDelete(); }}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none',
                padding: '10px 14px', fontSize: '13px', color: '#dc2626',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
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
          justifyContent: 'center', cursor: 'pointer', color: '#9ca3af', padding: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f3f4f6'; e.currentTarget.style.color = '#374151'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
        title="More options"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: '4px',
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 200,
          minWidth: '160px', padding: '4px',
        }}>
          {onOpenPath && (
            <button
              onClick={() => { onOpenPath(); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                padding: '8px 12px', background: 'transparent', border: 'none',
                borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#374151', textAlign: 'left',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
              </svg>
              {isFolder ? 'Open Folder Path' : 'Open File Path'}
            </button>
          )}
          <button
            onClick={() => { onDownload(); setOpen(false); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
              padding: '8px 12px', background: 'transparent', border: 'none',
              borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#374151', textAlign: 'left',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {isFolder ? 'Download Folder' : 'Download'}
          </button>
        </div>
      )}
    </div>
  );
});
AttachmentMoreMenu.displayName = 'AttachmentMoreMenu';

const getFileStatusBadge = (status) => {
  const badges = {
    uploaded: { bg: '#1d4ed8', color: '#fff', label: 'New', radius: '20px' },
    team_leader_approved: { bg: '#fef9c3', color: '#92400e', label: 'Pending Admin', radius: '20px' },
    final_approved: { bg: '#d1fae5', color: '#065f46', label: '✓ APPROVED', radius: '4px', weight: '600' },
    rejected_by_team_leader: { bg: '#ffe4e6', color: '#be123c', label: 'Rejected', radius: '20px' },
    rejected_by_admin: { bg: '#ffe4e6', color: '#be123c', label: 'Rejected', radius: '20px' },
    under_revision: { bg: '#fef3c7', color: '#92400e', label: '✎ REVISED', radius: '4px', weight: '600' },
  };
  const b = badges[status] || badges.uploaded;
  return (
    <span style={{ backgroundColor: b.bg, color: b.color, padding: '3px 10px', borderRadius: b.radius, fontSize: '11px', fontWeight: b.weight || '500', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      {b.label}
    </span>
  );
};

const getStatusBadge = (assignment) => {
  // If TL/admin marked the task as completed, show Completed badge regardless of file uploads
  if (assignment.status === 'completed') {
    return <span style={{ backgroundColor: '#F0FDF4', color: '#15803D', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>✓ COMPLETED</span>;
  }
  if (assignment.submitted_files?.length > 0) {
    return <span style={{ backgroundColor: '#F0FDF4', color: '#15803D', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>✓ SUBMITTED</span>;
  }
  if (!assignment.due_date) return null;

  const dueDate = new Date(assignment.due_date);
  const now = new Date();
  dueDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

  if (assignment.user_status === 'submitted' && !assignment.submitted_files?.length) {
    return <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>⚠ MISSING</span>;
  }
  if (daysUntilDue < 0) {
    return <span style={{ backgroundColor: '#FEF2F2', color: '#DC2626', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>⚠ OVERDUE</span>;
  }
  if (daysUntilDue <= 4) {
    return <span style={{ backgroundColor: '#FFF7ED', color: '#EA580C', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>⏱ PENDING</span>;
  }
  return null;
};

// ─── Main Component ───────────────────────────────────────────────────────────
const TasksTab = memo(({
  user,
  highlightedAssignmentId,
  highlightedFileId,
  notificationCommentContext,
  onClearHighlight,
  onClearFileHighlight,
  onClearNotificationContext,
}) => {
  // Core data
  const setAssignmentsCache = useStore(state => state.setAssignmentsCache);
  const cacheKey = `user-${user.id}`;
  const assignments = useStore(state => state.assignmentsCache[cacheKey]) || [];
  const [isLoading, setIsLoading] = useState(!useStore.getState().assignmentsCache[cacheKey]);

  // UI state
  const [sortFilter, setSortFilter] = useState('all');
  const [successModal, setSuccessModal] = useState({ isOpen: false, title: '', message: '', type: 'success' });
  const [downloadToast, setDownloadToast] = useState({ show: false, fileName: '' });
  const [fileOpenToast, setFileOpenToast] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [showAllSubmittedFiles, setShowAllSubmittedFiles] = useState({});

  // Comments
  const [comments, setComments] = useState({});
  const [newComment, setNewComment] = useState({});
  const [isPostingComment, setIsPostingComment] = useState({});
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [currentCommentsAssignment, setCurrentCommentsAssignment] = useState(null);
  const [highlightCommentBy, setHighlightCommentBy] = useState(null);
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

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);

  // File open modal
  const [showOpenFileModal, setShowOpenFileModal] = useState(false);
  const [fileToOpen, setFileToOpen] = useState(null);

  // File Details modal
  const [showFileDetailsModal, setShowFileDetailsModal] = useState(false);
  const [fileDetailsTarget, setFileDetailsTarget] = useState(null);

  // Refs
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const currentAssignmentIdRef = useRef(null);
  const newCommentRef = useRef(newComment);
  newCommentRef.current = newComment;

  // ─── Fetch helpers ─────────────────────────────────────────────────────────
  const showError = useCallback((message) =>
    setSuccessModal({ isOpen: true, title: 'Error', message, type: 'error' }), []);

  const fetchComments = useCallback(async (assignmentId) => {
    setLoadingComments(true);
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments`);
      if (data.success) {
        setComments(prev => ({ ...prev, [assignmentId]: data.comments || [] }));
        setAssignmentsCache(cacheKey, prev => prev.map(a =>
          a.id === assignmentId ? { ...a, comment_count: (data.comments || []).length } : a
        ));
      }
    } catch { /* silent */ } finally {
      setLoadingComments(false);
    }
  }, []);

  const fetchAssignments = useCallback(async () => {
    const currentAssignments = useStore.getState().assignmentsCache[cacheKey];
    if (!currentAssignments) setIsLoading(true);
    try {
      const data = await apiFetch(`/api/assignments/user/${user.id}`);
      if (data.success) {
        setAssignmentsCache(cacheKey, data.assignments || []);
      } else {
        showError('Failed to fetch assignments');
      }
    } catch {
      showError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  }, [user.id, showError]);

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

  // Keep currentAssignmentIdRef in sync
  currentAssignmentIdRef.current = currentCommentsAssignment?.id;

  // ─── Smart Navigation ──────────────────────────────────────────────────────
  useSmartNavigation({
    role: 'user',
    items: assignments,
    highlightedItemId: highlightedAssignmentId,
    highlightedFileId,
    notificationContext: notificationCommentContext,
    onClearHighlight,
    onClearFileHighlight,
    onClearNotificationContext,
    openCommentsModal,
    setVisibleReplies,
    showCommentsModal,
    selectedItem: currentCommentsAssignment,
    comments: comments[currentCommentsAssignment?.id] || [],
  });

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
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments/${commentId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, username: user.username || user.fullName, reply: replyTextValue.trim() }),
      });
      if (data.success) { onSuccess?.(); fetchComments(assignmentId); }
      else showError(data.message || 'Failed to post reply');
    } catch { showError('Failed to post reply'); }
  }, [user.id, user.username, user.fullName, fetchComments, showError]);

  const editComment = useCallback(async (assignmentId, commentId, newText) => {
    try {
      const data = await apiFetch(`/api/assignments/comments/${commentId}`, {
        method: 'PUT',
        body: JSON.stringify({ userId: user.id, comment: newText }),
      });
      if (data.success) fetchComments(assignmentId);
      else showError(data.message || 'Failed to edit comment');
    } catch { showError('Failed to edit comment'); }
  }, [user.id, fetchComments, showError]);

  const deleteComment = useCallback(async (assignmentId, commentId) => {
    try {
      const data = await apiFetch(`/api/assignments/comments/${commentId}`, {
        method: 'DELETE',
        body: JSON.stringify({ userId: user.id }),
      });
      if (data.success) fetchComments(assignmentId);
      else showError(data.message || 'Failed to delete comment');
    } catch { showError('Failed to delete comment'); }
  }, [user.id, fetchComments, showError]);

  const editReply = useCallback(async (assignmentId, commentId, replyId, newText) => {
    try {
      const data = await apiFetch(`/api/assignments/comments/${replyId}`, {
        method: 'PUT',
        body: JSON.stringify({ userId: user.id, comment: newText }),
      });
      if (data.success) fetchComments(assignmentId);
      else showError(data.message || 'Failed to edit reply');
    } catch { showError('Failed to edit reply'); }
  }, [user.id, fetchComments, showError]);

  const deleteReply = useCallback(async (assignmentId, commentId, replyId) => {
    try {
      const data = await apiFetch(`/api/assignments/comments/${replyId}`, {
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
      const result = await window.electron.downloadFile(fileUrl, fileName);
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

  const handleDownloadFolder = useCallback(async (folderFiles, folderName) => {
    const fileIds = folderFiles.map(f => f.id).join(',');
    const fileUrl = `${API_BASE_URL}/api/files/folder/zip?fileIds=${fileIds}&folderName=${encodeURIComponent(folderName)}`;
    const fileName = `${folderName}.zip`;
    if (window.electron?.downloadFile) {
      const result = await window.electron.downloadFile(fileUrl, fileName);
      if (result && !result.success && !result.canceled) showError(result.error || 'Folder download failed');
    } else {
      const a = Object.assign(document.createElement('a'), { href: fileUrl, download: fileName });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
  }, [showError]);

  const handleOpenFile = useCallback(async () => {
    if (!fileToOpen) return;
    setShowOpenFileModal(false);
    const file = fileToOpen;
    setFileToOpen(null);
    try {
      const pathData = await apiFetch(`/api/files/${file.id}/path`);
      if (!pathData.success || !pathData.filePath) throw new Error(pathData.message || 'Could not resolve file path');

      if (window.electron?.openFileInApp) {
        const result = await window.electron.openFileInApp(pathData.filePath);
        if (!result.success) showError(result.error || 'Failed to open file');
        else {
          setFileOpenToast(true);
          setTimeout(() => setFileOpenToast(false), 3500);
        }
      } else {
        const ext = (pathData.filePath.split('.').pop() || '').toLowerCase();
        const browserViewable = ['pdf','png','jpg','jpeg','gif','svg','webp','txt','html','css','js','json','xml','mp4','mp3'];
        if (browserViewable.includes(ext)) {
          window.open(`${API_BASE_URL}/api/files/${file.id}/stream`, '_blank', 'noopener,noreferrer');
        } else {
          const a = Object.assign(document.createElement('a'), {
            href: `${API_BASE_URL}/api/files/${file.id}/stream`,
            download: file.original_name || 'file',
          });
          a.click();
        }
        setFileOpenToast(true);
        setTimeout(() => setFileOpenToast(false), 3500);
      }
    } catch { showError('Failed to open file. Please try again.'); }
  }, [fileToOpen, showError]);

  const confirmDeleteFile = useCallback((assignmentId, fileId, fileName) => {
    setFileToDelete({ assignmentId, fileId, fileName });
    setShowDeleteModal(true);
  }, []);

  const confirmOpenFile = useCallback((file) => {
    setFileToOpen(file);
    setShowOpenFileModal(true);
  }, []);

  const handleRemoveSubmittedFile = useCallback(async (assignmentId, fileId) => {
    setShowDeleteModal(false);
    setFileToDelete(null);
    // Optimistic update
    setAssignmentsCache(cacheKey, prev => prev.map(a =>
      a.id === assignmentId
        ? { ...a, submitted_files: a.submitted_files?.filter(f => f.id !== fileId) }
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
        }).catch(() => {});
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

  // ─── Submit modal helpers ─────────────────────────────────────────────────
  const resetSubmitModal = useCallback(() => {
    setUploadedFiles([]);
    setFileDescription('');
    setFileTag('');
    setUploadMode('files');
    setTargetFolder(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  }, []);

  const handleSubmit = useCallback((assignment) => {
    setCurrentAssignment(assignment);
    resetSubmitModal();
    setShowSubmitModal(true);
  }, [resetSubmitModal]);

  const handleRemoveFile = useCallback((index) =>
    setUploadedFiles(prev => prev.filter((_, i) => i !== index)), []);

  const handleFileUpload = useCallback(async () => {
    if (!uploadedFiles.length || !currentAssignment) return;
    setIsUploading(true);
    try {
      // Auto-replace duplicate file names
      if (currentAssignment.submitted_files?.length) {
        for (const fileObj of uploadedFiles) {
          const match = currentAssignment.submitted_files.find(
            f => f.original_name === fileObj.file.name || f.filename === fileObj.file.name
          );
          if (match) {
            await apiFetch(`/api/assignments/${currentAssignment.id}/files/${match.id}`, {
              method: 'DELETE',
              body: JSON.stringify({ userId: user.id }),
            }).catch(() => {});
          }
        }
      }

      const uploadedFileIds = [];
      const uploadErrors = [];

      for (const fileObj of uploadedFiles) {
        const formData = new FormData();
        formData.append('file', fileObj.file);
        formData.append('userId', user.id);
        formData.append('username', user.username);
        formData.append('fullName', user.fullName);
        formData.append('userTeam', user.team);
        formData.append('userRole', user.role || '');
        formData.append('description', fileDescription || '');
        formData.append('tag', fileTag || '');
        formData.append('replaceExisting', 'true');

        const effectiveFolderName = targetFolder || fileObj.folderName;
        if (effectiveFolderName) {
          formData.append('folderName', effectiveFolderName);
          formData.append('relativePath', `${effectiveFolderName}/${fileObj.file.name}`);
          formData.append('isFolder', 'true');
        } else {
          formData.append('isFolder', 'false');
        }

        const isRevision = currentAssignment.submitted_files?.some(
          f => (f.original_name === fileObj.file.name || f.filename === fileObj.file.name) &&
            ['rejected_by_team_leader', 'rejected_by_admin'].includes(f.status)
        ) ?? false;
        formData.append('isRevision', String(isRevision));

        const uploadData = await apiFetch(`/api/files/upload`, { 
          method: 'POST', 
          body: formData,
          headers: {} // Important: Don't set Content-Type for FormData
        });
        if (uploadData.success) uploadedFileIds.push(uploadData.file.id);
        else uploadErrors.push(`${fileObj.file.name}: ${uploadData.message}`);
      }

      if (!uploadedFileIds.length) throw new Error('No files were uploaded successfully. ' + uploadErrors.join(', '));

      const submissionErrors = [];
      for (const fileId of uploadedFileIds) {
        const submitData = await apiFetch(`/api/assignments/submit`, {
          method: 'POST',
          body: JSON.stringify({ assignmentId: currentAssignment.id, userId: user.id, fileId }),
        });
        if (!submitData.success) submissionErrors.push(`File ID ${fileId}: ${submitData.message}`);
      }

      if (!submissionErrors.length) {
        setSuccessModal({ isOpen: true, title: 'Success', message: `${uploadedFileIds.length} file(s) uploaded and submitted successfully!`, type: 'success' });
      } else if (submissionErrors.length < uploadedFileIds.length) {
        setSuccessModal({ isOpen: true, title: 'Partially Submitted', message: `${uploadedFileIds.length - submissionErrors.length} of ${uploadedFileIds.length} file(s) submitted.\n\nFailed:\n${submissionErrors.join('\n')}`, type: 'error' });
      } else {
        throw new Error('Failed to submit files: ' + submissionErrors.join(', '));
      }

      setShowSubmitModal(false);
      resetSubmitModal();
      fetchAssignments();
    } catch (err) {
      showError(err.message || 'Failed to upload files');
    } finally {
      setIsUploading(false);
    }
  }, [uploadedFiles, currentAssignment, user, fileDescription, fileTag, targetFolder, fetchAssignments, resetSubmitModal, showError]);

  // ─── Utility ───────────────────────────────────────────────────────────────
  const formatRelativeTime = useCallback((dateString) => {
    // This is now handled by formatTimeAgo in ui-helpers.js
    // keeping the name formatRelativeTime for compatibility with local usage if any
    return formatDate(dateString);
  }, []);

  const getInitialsLocal = useCallback((name) => {
    return getInitials(name);
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
      const res = await fetch(`${API_BASE_URL}/api/files/${file.id}`);
      const data = await res.json();
      const fileData = data.file || file;
      // Preserve assignment_title if passed in (from notification path or from tasks data)
      if (file.assignment_title && !fileData.assignment_title) {
        fileData.assignment_title = file.assignment_title;
      }
      setFileDetailsTarget(fileData);
    } catch {
      setFileDetailsTarget(file);
    }
    setShowFileDetailsModal(true);
  }, []);

  // Open FileModal when navigated from a notification
  useEffect(() => {
    const fileId = sessionStorage.getItem('openFileDetailsId');
    if (!fileId || assignments.length === 0) return;
    sessionStorage.removeItem('openFileDetailsId');

    // Find assignment title from already-loaded assignments
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

  const openFolderInExplorer = useCallback(async (fileId) => {
    if (!window.electron?.openFolderInExplorer) return;
    try {
      const data = await apiFetch(`/api/files/${fileId}/path`);
      if (data.success && data.filePath) await window.electron.openFolderInExplorer(data.filePath);
    } catch (e) { console.error('Open folder path error:', e); }
  }, []);

  // ─── Sorted + Filtered assignments ────────────────────────────────────────
  const filteredAssignments = useMemo(() => {
    const sorted = [...assignments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (sortFilter === 'all') return sorted;
    return sorted.filter(a => getAssignmentStatus(a) === sortFilter);
  }, [assignments, sortFilter]);

  // ─── Filter counts for badge ───────────────────────────────────────────────
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

  // ─── Drag-and-drop file reader helper ────────────────────────────────────
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
    const pending = folderFiles.filter(f => !f.status || f.status === 'uploaded').length;

    if (approved === total) return <span style={{ background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>✓ All Approved</span>;
    if (rejected === total) return <span style={{ background: '#ffe4e6', color: '#be123c', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>All Rejected</span>;

    return (
      <>
        {(tlApproved > 0 || (approved > 0 && !pending && !rejected)) && <span style={{ background: '#fef9c3', color: '#92400e', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '500', marginRight: '4px' }}>Pending Admin</span>}
        {pending > 0 && <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', marginRight: '4px' }}>Pending Review</span>}
        {rejected > 0 && <span style={{ background: '#ffe4e6', color: '#be123c', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500', marginRight: '4px' }}>{rejected} Rejected</span>}
        {approved > 0 && approved < total && <span style={{ background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>{approved} Approved</span>}
      </>
    );
  };

  const renderFileCard = (file, assignmentId, indented = false, assignmentTitle = null) => {
    const canDelete = file.status !== 'final_approved';
    const fileWithTitle = assignmentTitle ? { ...file, assignment_title: assignmentTitle } : file;
    return (
      <div
        key={file.id}
        className="submitted-file-card"
        onClick={() => confirmOpenFile(file)}
        style={{ cursor: 'pointer', marginBottom: indented ? '4px' : undefined }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ flexShrink: 0 }}>
            <FileIcon file={file} size={indented ? 'small' : 'default'} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: '500', fontSize: indented ? '14px' : '15px', color: '#111827', marginBottom: indented ? '2px' : '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file.original_name || file.filename}
            </div>
            <div style={{ fontSize: indented ? '12px' : '13px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: indented ? '6px' : '8px', flexWrap: 'wrap' }}>
              <span>by <span style={{ fontWeight: '500', color: '#2563eb' }}>{file.submitter_name || user.fullName || user.username}</span></span>
              <span style={{ color: '#9ca3af' }}>•</span>
              <span>{formatDate(file.submitted_at || file.uploaded_at)}</span>
              {file.tag && (
                <span style={{ backgroundColor: '#eff6ff', color: '#1e40af', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>🏷️ {file.tag}</span>
              )}
              {getFileStatusBadge(file.status)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <FileMoreMenuInline
              onViewDetails={() => openFileDetails(fileWithTitle)}
              onDelete={canDelete ? () => confirmDeleteFile(assignmentId, file.id, file.original_name || file.filename) : undefined}
            />
          </div>
        </div>
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="tasks-container">
      {/* Header */}
      <div className="tasks-header">
        <div className="tasks-header-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1>My Tasks</h1>
            <p className="tasks-subtitle" style={{ margin: 0 }}>{assignments.length} assignment{assignments.length !== 1 ? 's' : ''}</p>
          </div>

          {/* ── Sort Dropdown ── */}
          <div style={{ position: 'relative' }}>
            <select
              value={sortFilter}
              onChange={e => setSortFilter(e.target.value)}
              style={{
                appearance: 'none',
                WebkitAppearance: 'none',
                padding: '5px 30px 5px 12px',
                borderRadius: '20px',
                border: '1.5px solid #d1d5db',
                backgroundColor: '#ffffff',
                color: '#374151',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                outline: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#9ca3af'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#d1d5db'; }}
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({filterCounts[opt.value] ?? 0})
                </option>
              ))}
            </select>
            {/* chevron icon */}
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <SuccessModal
        isOpen={successModal.isOpen}
        onClose={() => setSuccessModal({ isOpen: false, title: '', message: '', type: 'success' })}
        title={successModal.title}
        message={successModal.message}
        type={successModal.type}
      />

      {/* Content */}
      {isLoading ? (
        <div style={{ padding: '0 20px', maxWidth: '1400px', margin: '0 auto' }}>
          <LoadingCards count={3} />
        </div>
      ) : filteredAssignments.length > 0 ? (
        <div className="user-tasks-feed" style={{ maxWidth: '1400px', margin: '0 auto', padding: '16px 20px' }}>
          {filteredAssignments.map(assignment => (
            <PremiumTaskCard
              key={assignment.id}
              task={assignment}
              role="user"
              onCommentClick={openCommentsModal}
              onActionClick={(action, t) => {
                if (action === 'refresh') fetchAssignments();
              }}
              onPrimaryClick={(action, t) => action === 'submit' && handleSubmit(t)}
              onFileClick={confirmOpenFile}
              onDownloadFile={handleDownloadFile}
              onFileDelete={(file) => confirmDeleteFile(assignment.id, file.id, file.original_name || file.filename)}
              onOpenPath={openFolderInExplorer}
              className="user-task-card-margin"
            />
          ))}
        </div>
      ) : (
        <div className="tasks-empty">
          <div className="tasks-empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </svg>
          </div>
          <h3>{sortFilter === 'all' ? 'No assignments' : `No ${SORT_OPTIONS.find(o => o.value === sortFilter)?.label.toLowerCase()} assignments`}</h3>
          <p>{sortFilter === 'all' ? "You don't have any assignments at this time." : 'Try a different filter.'}</p>
        </div>
      )}

      {/* Comments Modal */}
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
          onPostReply={postReply}
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
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && fileToDelete && (
        <div className="tasks-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="tasks-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="tasks-modal-header">
              <h3 style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚠ {fileToDelete.isFolderDelete ? 'Delete Folder' : 'Delete File'}
              </h3>
              <button className="tasks-modal-close" onClick={() => setShowDeleteModal(false)}>×</button>
            </div>
            <div className="tasks-modal-body">
              <div style={{ padding: '20px 0' }}>
                <p style={{ fontSize: '15px', color: '#374151', marginBottom: '16px', lineHeight: '1.6' }}>
                  {fileToDelete.isFolderDelete
                    ? `Are you sure you want to delete all ${fileToDelete.folderFiles?.length} files in this folder?`
                    : 'Are you sure you want to permanently delete this file?'}
                </p>
                <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#991b1b' }}>{fileToDelete.fileName}</span>
                </div>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                  This action is permanent and cannot be undone.
                </p>
              </div>
            </div>
            <div className="tasks-modal-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: '#fff', color: '#374151', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (fileToDelete.isFolderDelete) {
                    const { assignmentId, folderFiles, fileName: folderName } = fileToDelete;
                    setShowDeleteModal(false);
                    setFileToDelete(null);
                    setAssignmentsCache(cacheKey, prev => prev.map(a =>
                      a.id === assignmentId
                        ? { ...a, submitted_files: a.submitted_files?.filter(f => !folderFiles.some(ff => ff.id === f.id)) }
                        : a
                    ));
                    for (const file of folderFiles) {
                      try {
                        await apiFetch(`/api/assignments/${assignmentId}/files/${file.id}`, { method: 'DELETE', body: JSON.stringify({ userId: user.id }) });
                        await apiFetch(`/api/files/${file.id}`, { method: 'DELETE', body: JSON.stringify({ adminId: user.id, adminUsername: user.username, adminRole: user.role, team: user.team }) });
                      } catch (e) { console.error('Error deleting folder file:', e); }
                    }
                    try {
                      await apiFetch(`/api/files/folder/delete`, {
                        method: 'POST',
                        body: JSON.stringify({ folderName, username: user.username, fileIds: folderFiles.map(f => f.id), userId: user.id, userRole: user.role, team: user.team }),
                      });
                    } catch (e) { console.error('Error deleting folder directory:', e); }
                    setSuccessModal({ isOpen: true, title: 'Removed', message: 'Folder removed successfully', type: 'error' });
                    setTimeout(() => fetchAssignments(), 500);
                  } else {
                    handleRemoveSubmittedFile(fileToDelete.assignmentId, fileToDelete.fileId);
                  }
                }}
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#dc2626', color: '#fff', fontSize: '14px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                🗑 {fileToDelete.isFolderDelete ? 'Delete Folder' : 'Delete File'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Open Modal */}
      <FileOpenModal
        isOpen={showOpenFileModal}
        onClose={() => { setShowOpenFileModal(false); setFileToOpen(null); }}
        onConfirm={handleOpenFile}
        file={fileToOpen}
      />

      {/* File Open Toast */}
      {fileOpenToast && (
        <div style={{ position: 'fixed', top: '28px', right: '28px', zIndex: 9999, background: '#fff', border: '1px solid #bbf7d0', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.13)', padding: '18px 22px 14px 18px', display: 'flex', alignItems: 'flex-start', gap: '14px', minWidth: '280px', maxWidth: '380px', animation: 'slideInRight 0.25s ease' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#dcfce7', border: '2px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#15803d', marginBottom: '4px' }}>Success</div>
            <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.4' }}>File opened successfully!</div>
            <div style={{ marginTop: '10px', height: '4px', borderRadius: '2px', background: '#dcfce7', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '2px', background: '#22c55e', animation: 'shrinkBar 3.5s linear forwards' }} />
            </div>
          </div>
          <button onClick={() => setFileOpenToast(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '20px', lineHeight: 1, padding: 0 }}>×</button>
        </div>
      )}

      {/* Download Toast */}
      {downloadToast.show && (
        <div style={{ position: 'fixed', top: '28px', right: '28px', zIndex: 9999, background: '#fff', border: '1px solid #bbf7d0', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.13)', padding: '18px 22px 14px 18px', display: 'flex', alignItems: 'flex-start', gap: '14px', minWidth: '280px', maxWidth: '380px', animation: 'slideInRight 0.25s ease' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#dcfce7', border: '2px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#15803d', marginBottom: '4px' }}>Success</div>
            <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.4' }}>
              {downloadToast.fileName ? `"${downloadToast.fileName}" downloaded successfully!` : 'File downloaded successfully!'}
            </div>
            <div style={{ marginTop: '10px', height: '4px', borderRadius: '2px', background: '#dcfce7', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '2px', background: '#22c55e', animation: 'shrinkBar 3.5s linear forwards' }} />
            </div>
          </div>
          <button onClick={() => setDownloadToast({ show: false, fileName: '' })} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '20px', lineHeight: 1, padding: 0 }}>×</button>
        </div>
      )}

      <style>{`
        @keyframes slideInRight { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes shrinkBar { from { width: 100%; } to { width: 0%; } }
      `}</style>

      {/* File Details Modal */}
      {showFileDetailsModal && fileDetailsTarget && (
        <FileModal
          showFileModal={showFileDetailsModal}
          setShowFileModal={setShowFileDetailsModal}
          selectedFile={fileDetailsTarget}
          fileComments={[]}
          formatFileSize={formatFileSize}
        />
      )}

      {/* Submit Modal */}
      {showSubmitModal && currentAssignment && (
        <div className="tasks-modal-overlay">
          <div className="tasks-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="tasks-modal-header" style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '16px' }}>
              <div style={{ flex: 1, marginRight: '40px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>Submit Task</h3>
                <div style={{ backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderLeft: '4px solid #6b7280', borderRadius: '8px', padding: '12px 16px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#374151', margin: 0 }}>{currentAssignment.title}</h4>
                  {currentAssignment.description && (
                    <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '6px', marginBottom: 0, lineHeight: '1.5' }}>{currentAssignment.description}</p>
                  )}
                </div>
              </div>
              <button className="tasks-modal-close" onClick={() => { setShowSubmitModal(false); resetSubmitModal(); }}>×</button>
            </div>

            <div className="tasks-modal-body">
              <div className="tasks-file-selection">
                <div className="upload-section">
                  {/* Existing folder picker */}
                  {(() => {
                    const existingFolders = [...new Set((currentAssignment.submitted_files || []).filter(f => f.folder_name).map(f => f.folder_name))];
                    if (!existingFolders.length) return null;
                    return (
                      <div style={{ marginBottom: '16px', padding: '14px 16px', backgroundColor: '#f0f4ff', borderRadius: '10px', border: '1px solid #c7d7fe' }}>
                        <label style={{ fontSize: '13px', fontWeight: '600', color: '#1e40af', marginBottom: '8px', display: 'block' }}>📁 Add files to an existing folder (optional)</label>
                        <select value={targetFolder || ''} onChange={e => setTargetFolder(e.target.value || null)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #93c5fd', fontSize: '14px', backgroundColor: '#fff', color: '#111827', cursor: 'pointer', outline: 'none' }}>
                          <option value=''>— Upload as separate files —</option>
                          {existingFolders.map(fn => <option key={fn} value={fn}>📁 {fn}</option>)}
                        </select>
                        {targetFolder && <p style={{ fontSize: '12px', color: '#1e40af', marginTop: '6px', margin: '6px 0 0' }}>✓ Files will be added into <strong>{targetFolder}</strong></p>}
                      </div>
                    );
                  })()}

                  <div className="file-upload-wrapper">
                    <input ref={fileInputRef} type="file" multiple onChange={e => {
                      const files = Array.from(e.target.files);
                      if (files.length) { setUploadedFiles(prev => [...prev, ...files.map(f => ({ file: f, relativePath: f.name, folderName: null }))]); setUploadMode('files'); }
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

                    {/* Drop zone */}
                    <div
                      className="file-upload-label"
                      style={{ border: '2px dashed #d1d5db', borderRadius: '12px', padding: '32px', textAlign: 'center', cursor: 'pointer', backgroundColor: '#fafafa', transition: 'all 0.2s' }}
                      onDragOver={e => { e.preventDefault(); e.currentTarget.style.backgroundColor = '#e0e7ff'; e.currentTarget.style.borderColor = '#4f46e5'; }}
                      onDragLeave={e => { e.preventDefault(); e.currentTarget.style.backgroundColor = '#fafafa'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                      onDrop={async e => {
                        e.preventDefault();
                        e.currentTarget.style.backgroundColor = '#fafafa';
                        e.currentTarget.style.borderColor = '#d1d5db';
                        const items = Array.from(e.dataTransfer.items || []);
                        const allFiles = (await Promise.all(
                          items.filter(i => i.kind === 'file').map(i => {
                            const entry = i.webkitGetAsEntry?.();
                            if (entry) return readAllFilesFromEntry(entry);
                            const file = i.getAsFile();
                            return file ? [{ file, relativePath: file.name, folderName: null }] : [];
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
                          <p style={{ fontSize: '15px', fontWeight: '500', color: '#111827', margin: '0 0 8px' }}>Drag and drop files or folders here</p>
                          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #4f46e5', backgroundColor: '#fff', color: '#4f46e5', fontSize: '14px', fontWeight: '500', cursor: isUploading ? 'not-allowed' : 'pointer' }}>
                              📄 Browse Files
                            </button>
                            <button type="button" onClick={() => folderInputRef.current?.click()} disabled={isUploading} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#4f46e5', color: '#fff', fontSize: '14px', fontWeight: '500', cursor: isUploading ? 'not-allowed' : 'pointer' }}>
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
                    <label style={{ fontSize: '14px', fontWeight: '600', color: '#111827', display: 'block', marginBottom: '12px' }}>
                      {uploadMode === 'folder' ? `Folder: ${uploadedFiles[0].folderName} (${uploadedFiles.length} files)` : `Selected Files (${uploadedFiles.length})`}
                    </label>

                    {uploadMode === 'folder' ? (
                      <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px', backgroundColor: '#f9fafb' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#fed7aa" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', fontSize: '16px', color: '#1a1a1a', marginBottom: '4px' }}>{uploadedFiles[0]?.folderName}</div>
                            <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '12px' }}>{uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''}</div>
                            <div style={{ maxHeight: '300px', overflowY: 'auto', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px' }}>
                              {uploadedFiles.map((fileObj, index) => (
                                <div key={index} style={{ fontSize: '12px', color: '#4b5563', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: index < uploadedFiles.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                                  <FileIcon file={fileObj.file} size="small" />
                                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileObj.relativePath}</span>
                                  <span style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0 }}>{formatFileSize(fileObj.file.size)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <button onClick={() => { setUploadedFiles([]); setUploadMode('files'); if (folderInputRef.current) folderInputRef.current.value = ''; }} disabled={isUploading} style={{ background: 'transparent', color: '#9ca3af', border: 'none', borderRadius: '6px', padding: '6px', fontSize: '18px', cursor: 'pointer' }} title="Remove folder">×</button>
                        </div>
                      </div>
                    ) : (
                      uploadedFiles.map((fileObj, index) => (
                        <div key={index} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px 16px', marginBottom: '8px', backgroundColor: '#fff', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <FileIcon file={fileObj.file} size="default" />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: '500', fontSize: '14px', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileObj.file.name}</div>
                            <div style={{ fontSize: '12px', color: '#6B7280' }}>{formatFileSize(fileObj.file.size)}</div>
                          </div>
                          <button onClick={() => handleRemoveFile(index)} disabled={isUploading} style={{ background: 'transparent', color: '#9ca3af', border: 'none', borderRadius: '6px', padding: '6px', fontSize: '18px', cursor: 'pointer' }} title="Remove file">×</button>
                        </div>
                      ))
                    )}

                    {/* Tag + Description */}
                    <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#111827' }}>🏷️ Tag</label>
                      <SingleSelectTags selectedTag={fileTag} onChange={setFileTag} disabled={isUploading} user={user} />
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#111827', marginTop: '16px' }}>✎ Description (optional)</label>
                      <textarea
                        value={fileDescription}
                        onChange={e => setFileDescription(e.target.value)}
                        placeholder="Add a brief description..."
                        rows="2"
                        disabled={isUploading}
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical', backgroundColor: '#fff' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="tasks-modal-footer" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowSubmitModal(false); resetSubmitModal(); }}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: '#fff', color: '#374151', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleFileUpload}
                disabled={!uploadedFiles.length || isUploading}
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: !uploadedFiles.length || isUploading ? '#d1d5db' : '#4f46e5', color: '#fff', fontSize: '14px', fontWeight: '500', cursor: !uploadedFiles.length || isUploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {isUploading ? '⏳ Uploading...' : `✓ Upload ${uploadedFiles.length > 0 ? `${uploadedFiles.length} ` : ''}File${uploadedFiles.length !== 1 ? 's' : ''} & Submit`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Details Modal */}
      <FileModal
        showFileModal={showFileDetailsModal}
        setShowFileModal={setShowFileDetailsModal}
        selectedFile={fileDetailsTarget}
        fileComments={[]}
        formatFileSize={formatFileSize}
      />
    </div>
  );
});

TasksTab.displayName = 'TasksTab';
export default TasksTab;
