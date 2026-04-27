import { useRef, useCallback, useState, useEffect, startTransition, useMemo, memo } from 'react';
import { API_BASE_URL } from '@/config/api';
import './css/TasksTab-Enhanced.css';
import './css/TasksTab-Comments.css';
import { FileIcon, FileOpenModal } from '../shared';
import CommentsModal from '../shared/CommentsModal';
import SingleSelectTags from './SingleSelectTags';
import { LoadingTable, LoadingCards } from '../common/InlineSkeletonLoader';
import SuccessModal from './SuccessModal';
import { useSmartNavigation } from '../shared/SmartNavigation';
import '../shared/SmartNavigation/SmartNavigation.css';

const TasksTab = memo(({
  user,
  highlightedAssignmentId,
  highlightedFileId,
  notificationCommentContext,
  onClearHighlight,
  onClearFileHighlight,
  onClearNotificationContext
}) => {
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [successModal, setSuccessModal] = useState({ isOpen: false, title: '', message: '', type: 'success' });
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [userFiles, setUserFiles] = useState([]);
  const [comments, setComments] = useState({});
  const [newComment, setNewComment] = useState({});
  const [isPostingComment, setIsPostingComment] = useState({});
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [currentCommentsAssignment, setCurrentCommentsAssignment] = useState(null);
  const [highlightCommentBy, setHighlightCommentBy] = useState(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fileDescription, setFileDescription] = useState('');
  const [fileTag, setFileTag] = useState(''); // Add tag state
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [uploadMode, setUploadMode] = useState('files'); // 'files' or 'folder'
  const [visibleReplies, setVisibleReplies] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [showOpenFileModal, setShowOpenFileModal] = useState(false);
  const [fileToOpen, setFileToOpen] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({}); // Track which folders are expanded
  const [showAllSubmittedFiles, setShowAllSubmittedFiles] = useState({}); // Track which assignments show all submitted files
  const INITIAL_FILE_DISPLAY_LIMIT = 5; // Show first 5 files/folders initially
  const [downloadToast, setDownloadToast] = useState({ show: false, fileName: '' });

  // Check for sessionStorage when component mounts - run ONCE when assignments first load
  useEffect(() => {
    const assignmentId = sessionStorage.getItem('scrollToAssignment');
    const highlightUser = sessionStorage.getItem('highlightCommentBy');

    // Only run if we have both the session data AND assignments have loaded
    if (assignmentId && assignments.length > 0) {
      // Clear the session storage immediately to prevent re-triggering
      sessionStorage.removeItem('scrollToAssignment');
      sessionStorage.removeItem('highlightCommentBy');

      // Find the assignment
      const assignment = assignments.find(a => a.id === parseInt(assignmentId));
      if (assignment) {
        // Set highlight user if provided
        if (highlightUser) {
          setHighlightCommentBy(highlightUser);
        }

        // Open the comments modal for this assignment after a delay
        setTimeout(() => {
          toggleComments(assignment);

          // Scroll to the comments modal after it opens
          setTimeout(() => {
            const modalBody = document.querySelector('.tasks-modal-body');
            if (modalBody) {
              modalBody.scrollTop = 0; // Scroll to top to see comments
            }

            // Clear highlight after 3 seconds
            setTimeout(() => {
              setHighlightCommentBy(null);
            }, 3000);
          }, 100);
        }, 500);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments.length]); // Only re-run when assignments.length changes, not the entire array

  // fetchComments must be declared BEFORE openCommentsModal (which depends on it)
  const fetchComments = useCallback(async (assignmentId) => {
    setLoadingComments(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/assignments/${assignmentId}/comments`);
      const data = await response.json();
      if (data.success) {
        setComments(prev => ({
          ...prev,
          [assignmentId]: data.comments || []
        }));
        // Keep the card comment count in sync with fetched data
        setAssignments(prev => prev.map(a =>
          a.id === assignmentId ? { ...a, comment_count: (data.comments || []).length } : a
        ));
      }
    } catch {
      // silent
    } finally {
      setLoadingComments(false);
    }
  }, []);

  // Stable ref — always holds the current open assignment id
  // Declared here so postReply and other callbacks can use it without deps
  const currentAssignmentIdRef = useRef(null);

  // SMART NAVIGATION HOOK
  const openCommentsModal = useCallback((assignment) => {
    setCurrentCommentsAssignment(assignment);
    setShowCommentsModal(true);
    startTransition(() => {
      setComments(prev => ({ ...prev, [assignment.id]: [] }));
    });
    setTimeout(() => fetchComments(assignment.id), 0);
  }, [fetchComments]);

  useSmartNavigation({
    role: 'user',
    items: assignments,
    highlightedItemId: highlightedAssignmentId,
    highlightedFileId,
    notificationContext: notificationCommentContext,
    onClearHighlight,
    onClearFileHighlight,
    onClearNotificationContext,
    openCommentsModal: openCommentsModal,
    setVisibleReplies,
    showCommentsModal,
    selectedItem: currentCommentsAssignment,
    // Pass the comments array for the currently open assignment (not the whole object)
    comments: comments[currentCommentsAssignment?.id] || []
  });

  useEffect(() => {
    fetchAssignments();
    // Don't call fetchUserFiles here - it will be called after assignments are fetched
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const fetchAssignments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/assignments/user/${user.id}`);
      const data = await response.json();

      if (data.success) {
        setAssignments(data.assignments || []);
        // Fetch user files after assignments are loaded - pass the fresh data
        fetchUserFiles(data.assignments);
        // NOTE: Comments are fetched on-demand when user opens the modal, NOT here.
      } else {
        setSuccessModal({ isOpen: true, title: 'Error', message: 'Failed to fetch assignments', type: 'error' });
      }
    } catch {
      setSuccessModal({ isOpen: true, title: 'Error', message: 'Failed to connect to server', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const postComment = async (assignmentId, commentText) => {
    if (!commentText?.trim()) return;

    setIsPostingComment(prev => ({ ...prev, [assignmentId]: true }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/assignments/${assignmentId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          username: user.username || user.fullName,
          comment: commentText.trim()
        })
      });

      const data = await response.json();

      if (data.success) {
        setNewComment(prev => ({ ...prev, [assignmentId]: '' }));
        fetchComments(assignmentId);
      } else {
        setSuccessModal({ isOpen: true, title: 'Error', message: 'Failed to post comment', type: 'error' });
      }
    } catch {
      setSuccessModal({ isOpen: true, title: 'Error', message: 'Failed to post comment', type: 'error' });
    } finally {
      setIsPostingComment(prev => ({ ...prev, [assignmentId]: false }));
    }
  };

  function toggleComments(assignment) {
    // Batch all state updates — show modal instantly, fetch after
    setCurrentCommentsAssignment(assignment);
    setShowCommentsModal(true);
    // Clear stale comments and start fetch in background
    startTransition(() => {
      setComments(prev => ({ ...prev, [assignment.id]: [] }));
    });
    setTimeout(() => fetchComments(assignment.id), 0);
  }

  const postReply = useCallback(async (e, commentId, replyTextValue, onSuccess) => {
    const assignmentId = currentAssignmentIdRef.current;
    if (!assignmentId || !commentId || !replyTextValue?.trim()) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/assignments/${assignmentId}/comments/${commentId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          username: user.username || user.fullName,
          reply: replyTextValue.trim()
        })
      });
      const data = await response.json();
      if (data.success) {
        onSuccess && onSuccess();
        fetchComments(assignmentId);
      } else {
        setSuccessModal({ isOpen: true, title: 'Error', message: data.message || 'Failed to post reply', type: 'error' });
      }
    } catch {
      setSuccessModal({ isOpen: true, title: 'Error', message: 'Failed to post reply', type: 'error' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, user.username, user.fullName, fetchComments]);

  const toggleRepliesVisibility = useCallback((commentId) => {
    setVisibleReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  }, []);

  const editComment = useCallback(async (assignmentId, commentId, newText) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/assignments/${assignmentId}/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, comment: newText })
      });
      const data = await res.json();
      if (data.success) {
        fetchComments(assignmentId);
      } else {
        setSuccessModal({ isOpen: true, title: 'Error', message: data.message || 'Failed to edit comment', type: 'error' });
      }
    } catch {
      setSuccessModal({ isOpen: true, title: 'Error', message: 'Failed to edit comment', type: 'error' });
    }
  }, [user.id, fetchComments]);

  const deleteComment = useCallback(async (assignmentId, commentId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/assignments/${assignmentId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (data.success) {
        fetchComments(assignmentId);
      } else {
        setSuccessModal({ isOpen: true, title: 'Error', message: data.message || 'Failed to delete comment', type: 'error' });
      }
    } catch {
      setSuccessModal({ isOpen: true, title: 'Error', message: 'Failed to delete comment', type: 'error' });
    }
  }, [user.id, fetchComments]);

  const editReply = useCallback(async (assignmentId, commentId, replyId, newText) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/assignments/${assignmentId}/comments/${commentId}/reply/${replyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, reply: newText })
      });
      const data = await res.json();
      if (data.success) {
        fetchComments(assignmentId);
      } else {
        setSuccessModal({ isOpen: true, title: 'Error', message: data.message || 'Failed to edit reply', type: 'error' });
      }
    } catch {
      setSuccessModal({ isOpen: true, title: 'Error', message: 'Failed to edit reply', type: 'error' });
    }
  }, [user.id, fetchComments]);

  const deleteReply = useCallback(async (assignmentId, commentId, replyId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/assignments/${assignmentId}/comments/${commentId}/reply/${replyId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (data.success) {
        fetchComments(assignmentId);
      } else {
        setSuccessModal({ isOpen: true, title: 'Error', message: data.message || 'Failed to delete reply', type: 'error' });
      }
    } catch {
      setSuccessModal({ isOpen: true, title: 'Error', message: 'Failed to delete reply', type: 'error' });
    }
  }, [user.id, fetchComments]);

  const fetchUserFiles = useCallback(async (currentAssignments = assignments) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/files/user/${user.id}`);
      const data = await response.json();

      if (data.success) {
        // Get all file IDs that are currently in ACTIVE assignment submissions
        const activeSubmittedFileIds = new Set();
        currentAssignments.forEach(assignment => {
          if (assignment.submitted_files && assignment.submitted_files.length > 0) {
            assignment.submitted_files.forEach(file => {
              activeSubmittedFileIds.add(file.id);
            });
          }
        });

        const unsubmittedFiles = data.files.filter(file =>
          !activeSubmittedFileIds.has(file.id)
        );
        setUserFiles(unsubmittedFiles || []);
      }
    } catch {
      // silent
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }) + ' at ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatRelativeTime = useCallback((dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w ago`;
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, []);

  const getInitials = useCallback((name) => {
    if (!name) return '?';
    if (name.includes('.')) {
      const parts = name.split('.');
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  }, []);

  // Returns a styled badge for an individual file's review status
  const getFileStatusBadge = (status) => {
    switch (status) {
      case 'uploaded':
        return <span style={{ backgroundColor: '#1d4ed8', color: '#ffffff', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>New</span>;
      case 'team_leader_approved':
        return <span style={{ backgroundColor: '#fef9c3', color: '#92400e', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>Pending Admin</span>;
      case 'final_approved':
        return <span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '3px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>✓ APPROVED</span>;
      case 'rejected_by_team_leader':
      case 'rejected_by_admin':
        return <span style={{ backgroundColor: '#ffe4e6', color: '#be123c', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>Rejected</span>;
      case 'under_revision':
        return <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '3px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'3px'}}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> REVISED</span>;
      default:
        return <span style={{ backgroundColor: '#1d4ed8', color: '#ffffff', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>New</span>;
    }
  };

  const getStatusBadge = (assignment) => {
    // If assignment has submitted files, show SUBMITTED status regardless of due date
    if (assignment.submitted_files && assignment.submitted_files.length > 0) {
      return (
        <span style={{
          backgroundColor: '#F0FDF4',
          color: '#15803D',
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: '600',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          ✓ SUBMITTED
        </span>
      )
    }

    // Completed by team leader but no files from user yet
    if (assignment.status === 'completed') {
      return null
    }

    if (!assignment.due_date) return null;

    const dueDate = new Date(assignment.due_date)
    const now = new Date()
    // Set both dates to start of day for accurate comparison
    dueDate.setHours(0, 0, 0, 0)
    now.setHours(0, 0, 0, 0)
    const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24))

    // Check if marked as submitted but no files - show MISSING
    if (assignment.user_status === 'submitted' && (!assignment.submitted_files || assignment.submitted_files.length === 0)) {
      return (
        <span style={{
          backgroundColor: '#FEF3C7',
          color: '#92400E',
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: '600',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> MISSING
        </span>
      )
    } else if (daysUntilDue < 0) {
      return (
        <span style={{
          backgroundColor: '#FEF2F2',
          color: '#DC2626',
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: '600',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> OVERDUE
        </span>
      )
    } else if (daysUntilDue <= 4) {
      return (
        <span style={{
          backgroundColor: '#FFF7ED',
          color: '#EA580C',
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: '600',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> PENDING
        </span>
      )
    }
    return null
  }

  const getDaysText = (assignment) => {
    // If files are submitted, don't show overdue text
    if (assignment.submitted_files && assignment.submitted_files.length > 0) {
      return ''
    }

    const dueDate = new Date(assignment.due_date)
    const now = new Date()
    // Set both dates to start of day for accurate comparison
    dueDate.setHours(0, 0, 0, 0)
    now.setHours(0, 0, 0, 0)
    const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24))

    if (daysUntilDue < 0) {
      return `(${Math.abs(daysUntilDue)} days overdue)`
    } else if (daysUntilDue === 0) {
      return '(Due today)'
    } else {
      return `(${daysUntilDue} days left)`
    }
  }

  const handleSubmit = (assignment) => {
    setCurrentAssignment(assignment);
    setUploadedFiles([]);
    setFileDescription('');
    setFileTag(''); // Reset tag
    setUploadMode('files'); // Reset upload mode
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
    setShowSubmitModal(true);
  };

  const handleRemoveFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveSubmittedFile = async (assignmentId, fileId) => {
    // Close the modal first
    setShowDeleteModal(false);
    setFileToDelete(null);

    // Immediately update UI BEFORE making the API call (optimistic update)
    setAssignments(prevAssignments => 
      prevAssignments.map(assignment => {
        if (assignment.id === assignmentId) {
          return {
            ...assignment,
            submitted_files: assignment.submitted_files.filter(file => file.id !== fileId)
          };
        }
        return assignment;
      })
    );

    try {
      const response = await fetch(`${API_BASE_URL}/api/assignments/${assignmentId}/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id
        })
      });

      const data = await response.json();

      if (data.success) {
        // Also delete the actual file from the files table + storage
        try {
          await fetch(`${API_BASE_URL}/api/files/${fileId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: user.id, adminUsername: user.username, adminRole: user.role, team: user.team })
          });
        } catch {
          // File unlink succeeded; storage cleanup failure is non-critical
        }

        setSuccessModal({ isOpen: true, title: 'Removed', message: 'File removed successfully', type: 'error' });
        
        // Refresh user files after a short delay to ensure server has processed
        setTimeout(() => {
          fetchUserFiles();
        }, 500);
      } else {
        // Revert the optimistic update
        fetchAssignments();
        setSuccessModal({ isOpen: true, title: 'Error', message: data.message || 'Failed to remove file', type: 'error' });
      }
    } catch {
      // Revert the optimistic update
      fetchAssignments();
      setSuccessModal({ isOpen: true, title: 'Error', message: 'Failed to remove file. Please try again.', type: 'error' });
    }
  };

  const confirmDeleteFile = (assignmentId, fileId, fileName) => {
    setFileToDelete({ assignmentId, fileId, fileName });
    setShowDeleteModal(true);
  };

  const confirmOpenFile = (file) => {
    setFileToOpen(file);
    setShowOpenFileModal(true);
  };

  const handleOpenFile = async () => {
    if (!fileToOpen) return;

    setShowOpenFileModal(false);
    const file = fileToOpen;
    setFileToOpen(null);

    try {
      const pathRes = await fetch(`${API_BASE_URL}/api/files/${file.id}/path`);
      const pathData = await pathRes.json();

      if (!pathData.success || !pathData.filePath) {
        throw new Error(pathData.message || 'Could not resolve file path');
      }

      const resolvedPath = pathData.filePath;

      // Always use Electron openFileInApp — it runs on the server machine
      // which has NAS access, so UNC paths work fine
      if (window.electron && window.electron.openFileInApp) {
        const result = await window.electron.openFileInApp(resolvedPath);
        if (!result.success) {
          setSuccessModal({ isOpen: true, title: 'Error', message: result.error || 'Failed to open file', type: 'error' });
        }
      } else {
        // Non-Electron fallback: stream only for browser-viewable types (images, PDFs, text)
        const ext = (resolvedPath.split('.').pop() || '').toLowerCase();
        const browserViewable = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'txt', 'html', 'css', 'js', 'json', 'xml', 'mp4', 'mp3'];
        if (browserViewable.includes(ext)) {
          window.open(`${API_BASE_URL}/api/files/${file.id}/stream`, '_blank', 'noopener,noreferrer');
        } else {
          // For Office files etc., trigger a download
          const a = document.createElement('a');
          a.href = `${API_BASE_URL}/api/files/${file.id}/stream`;
          a.download = file.original_name || 'file';
          a.click();
        }
      }
    } catch {
      setSuccessModal({ isOpen: true, title: 'Error', message: 'Failed to open file. Please try again.', type: 'error' });
    }
  };

  const handleFileUpload = async () => {
    if (uploadedFiles.length === 0 || !currentAssignment) return;

    setIsUploading(true);
    try {
      const replacedFiles = []; // Track which files we're replacing

      // First, check for ANY existing files with the same name and delete them AUTOMATICALLY (regardless of status)
      // This implements automatic file replacement on upload
      if (currentAssignment.submitted_files && currentAssignment.submitted_files.length > 0) {
        for (const fileObj of uploadedFiles) {
          const newFileName = fileObj.file.name;
          const matchingExistingFile = currentAssignment.submitted_files.find(
            existingFile => existingFile.original_name === newFileName || existingFile.filename === newFileName
          );

          if (matchingExistingFile) {
            replacedFiles.push(newFileName);
            try {
              await fetch(
                `${API_BASE_URL}/api/assignments/${currentAssignment.id}/files/${matchingExistingFile.id}`,
                {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: user.id })
                }
              );
            } catch {
              // Continue — server will handle the duplicate
            }
          }
        }
      }

      const uploadedFileIds = [];
      let uploadErrors = [];

      // Upload each file
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
        
        // Add folder information if uploading a folder
        // Always use the file's own folderName property — do NOT rely on uploadMode
        // because uploadMode can be overridden (e.g. user adds individual files after a folder)
        if (fileObj.folderName) {
          formData.append('folderName', fileObj.folderName);
          formData.append('relativePath', fileObj.relativePath || fileObj.file.name);
          formData.append('isFolder', 'true');
        } else {
          formData.append('isFolder', 'false');
        }

        // Check if this file is replacing a REJECTED file (only then mark as revision)
        const existingRejectedFile = currentAssignment.submitted_files?.find(
          f => (f.original_name === fileObj.file.name || f.filename === fileObj.file.name) &&
               (f.status === 'rejected_by_team_leader' || f.status === 'rejected_by_admin')
        );
        
        const isRevision = existingRejectedFile ? true : false;
        formData.append('isRevision', isRevision.toString());
        // IMPORTANT: Set replaceExisting=true to automatically replace duplicate files
        formData.append('replaceExisting', 'true');

        const uploadResponse = await fetch(`${API_BASE_URL}/api/files/upload`, {
          method: 'POST',
          body: formData
        });

        const uploadData = await uploadResponse.json();

        if (uploadData.success) {
          uploadedFileIds.push(uploadData.file.id);
        } else {
          uploadErrors.push(`${fileObj.file.name}: ${uploadData.message}`);
        }
      }

      // If no files were uploaded successfully, show error
      if (uploadedFileIds.length === 0) {
        throw new Error('No files were uploaded successfully. ' + uploadErrors.join(', '));
      }

      // Submit ALL uploaded files to the assignment
      let submissionErrors = [];
      for (const fileId of uploadedFileIds) {
        const submitResponse = await fetch(`${API_BASE_URL}/api/assignments/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            assignmentId: currentAssignment.id,
            userId: user.id,
            fileId: fileId
          })
        });

        const submitData = await submitResponse.json();

        if (submitData.success) {
          // submitted
        } else {
          submissionErrors.push(`File ID ${fileId}: ${submitData.message}`);
        }
      }

      // Show success message
      if (submissionErrors.length === 0) {
        setSuccessModal({ isOpen: true, title: 'Success', message: `${uploadedFileIds.length} file(s) uploaded and submitted successfully!`, type: 'success' });
      } else if (submissionErrors.length < uploadedFileIds.length) {
        const successCount = uploadedFileIds.length - submissionErrors.length;
        setSuccessModal({
          isOpen: true,
          title: 'Partially Submitted',
          message: `${successCount} of ${uploadedFileIds.length} file(s) submitted successfully.\n\nFailed files:\n${submissionErrors.join('\n')}`,
          type: 'error'
        });
      } else {
        throw new Error('Failed to submit files: ' + submissionErrors.join(', '));
      }

      setShowSubmitModal(false);
      setUploadedFiles([]);
      setFileDescription('');
      setFileTag('');
      setCurrentAssignment(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (folderInputRef.current) {
        folderInputRef.current.value = '';
      }
      fetchAssignments();
      fetchUserFiles();
    } catch (error) {
      setSuccessModal({ isOpen: true, title: 'Error', message: error.message || 'Failed to upload files', type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper function to group files by folder
  const groupFilesByFolder = (files) => {
    const folders = {};
    const individualFiles = [];

    files.forEach(file => {
      if (file.folder_name) {
        // File is part of a folder
        if (!folders[file.folder_name]) {
          folders[file.folder_name] = [];
        }
        folders[file.folder_name].push(file);
      } else {
        // Individual file
        individualFiles.push(file);
      }
    });

    return { folders, individualFiles };
  };

  // ─── File/Folder three-dot menu ──────────────────────────────────────────
  const handleDownloadFile = useCallback(async (file) => {
    const fileUrl = `${API_BASE_URL}/api/files/${file.id}/download`;
    const fileName = file.original_name || file.filename || 'file';
    if (window.electron && window.electron.downloadFile) {
      const result = await window.electron.downloadFile(fileUrl, fileName);
      if (result && !result.success && !result.canceled) {
        setSuccessModal({ isOpen: true, title: 'Error', message: result.error || 'Download failed', type: 'error' });
      } else if (result && result.success) {
        setDownloadToast({ show: true, fileName });
        setTimeout(() => setDownloadToast({ show: false, fileName: '' }), 3500);
      }
    } else {
      // Fallback for non-Electron (browser)
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDownloadToast({ show: true, fileName });
      setTimeout(() => setDownloadToast({ show: false, fileName: '' }), 3500);
    }
  }, []);

  const handleDownloadFolder = useCallback(async (folderFiles, folderName) => {
    const fileIds = folderFiles.map(f => f.id).join(',');
    const fileUrl = `${API_BASE_URL}/api/files/folder/zip?fileIds=${fileIds}&folderName=${encodeURIComponent(folderName)}`;
    const fileName = `${folderName}.zip`;
    if (window.electron && window.electron.downloadFile) {
      const result = await window.electron.downloadFile(fileUrl, fileName);
      if (result && !result.success && !result.canceled) {
        setSuccessModal({ isOpen: true, title: 'Error', message: result.error || 'Folder download failed', type: 'error' });
      }
    } else {
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, []);

  // Keep ref in sync on every render
  currentAssignmentIdRef.current = currentCommentsAssignment?.id;

  // ─── Inline three-dot menu for files/folders ─────────────────────────────
  function FileMoreMenuInline({ onDownload, onDelete, isFolder = false }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
      if (!open) return;
      const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
      document.addEventListener('mousedown', close);
      return () => document.removeEventListener('mousedown', close);
    }, [open]);
    return (
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
          style={{
            background: 'transparent', border: 'none', borderRadius: '6px',
            width: '28px', height: '28px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', color: '#9ca3af', padding: 0,
            transition: 'all 0.15s',
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
          <div
            style={{
              position: 'absolute', right: 0, top: '100%', marginTop: '4px',
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 100,
              minWidth: '150px', padding: '4px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => { setOpen(false); onDownload(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                padding: '8px 12px', background: 'transparent', border: 'none',
                borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                color: '#374151', textAlign: 'left',
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
            {onDelete && (
              <button
                onClick={() => { setOpen(false); onDelete(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                  padding: '8px 12px', background: 'transparent', border: 'none',
                  borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                  color: '#dc2626', textAlign: 'left',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fee2e2'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                </svg>
                {isFolder ? 'Delete Folder' : 'Delete'}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  const handleCloseCommentsModal = useCallback(() => setShowCommentsModal(false), []);

  const handleSetNewComment = useCallback((val) => {
    setNewComment(prev => ({ ...prev, [currentAssignmentIdRef.current]: val }));
  }, []);

  // newComment ref so handlePostComment never needs newComment in its dep array
  const newCommentRef = useRef(newComment);
  newCommentRef.current = newComment;

  const handlePostComment = useCallback(() => {
    const id = currentAssignmentIdRef.current;
    if (!id) return;
    // Read from ref — always up-to-date, avoids stale closure over newComment state
    const commentText = newCommentRef.current[id]?.trim();
    if (!commentText) return;
    postComment(id, commentText);
  // postComment only uses its parameters + stable setters, so no dep needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);




  // Sort assignments by created date (newest first) — memoized so it only re-sorts when assignments change
  const sortedAssignments = useMemo(() => [...assignments].sort((a, b) => {
    return new Date(b.created_at) - new Date(a.created_at);
  }), [assignments]);

  return (
    <div className="tasks-container">
      {/* Header */}
      <div className="tasks-header">
        <div className="tasks-header-content">
          <h1>My Tasks</h1>
          <p className="tasks-subtitle">{assignments.length} assignment{assignments.length !== 1 ? 's' : ''}</p>
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
          <div style={{ marginTop: '24px' }}>
            <LoadingTable rows={5} columns={4} />
          </div>
        </div>
      ) : assignments.length > 0 ? (
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
          {sortedAssignments.map((assignment) => {
            const daysLeft = assignment.due_date
              ? Math.ceil((new Date(assignment.due_date) - new Date()) / (1000 * 60 * 60 * 24))
              : null;
            const assignmentComments = comments[assignment.id] || [];

            return (
              <div
                key={assignment.id}
                id={`user-assignment-${assignment.id}`}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  padding: '20px',
                  marginBottom: '16px',
                  border: '1px solid #E5E7EB'
                }}
              >
                {/* Header with user info and status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: '#4f39f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: '600',
                      fontSize: '18px'
                    }}>
                      {getInitials(assignment.team_leader_fullname || assignment.team_leader_username)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '600', fontSize: '15px', color: '#050505' }}>
                          {assignment.team_leader_fullname || assignment.team_leader_username}
                        </span>
                        <span style={{
                          backgroundColor: 'transparent',
                          color: '#1D4ED8',
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          border: '1px solid #1D4ED8'
                        }}>
                          {assignment.team_leader_role === 'TEAM_LEADER' ? 'TEAM LEADER' : assignment.team_leader_role || 'TEAM LEADER'}
                        </span>
                        {assignment.assigned_to === 'all' ? (
                          <span style={{ fontSize: '14px', color: '#6B7280' }}>
                            assigned to <span style={{ fontWeight: '600', color: '#050505' }}>all team members</span>
                          </span>
                        ) : assignment.assigned_member_details && assignment.assigned_member_details.length > 0 ? (
                          <span style={{ fontSize: '14px', color: '#6B7280' }}>
                            assigned to <span style={{ fontWeight: '600', color: '#050505' }}>
                              {assignment.assigned_member_details.map((member, idx) => (
                                <span key={member.id}>
                                  {member.fullName}
                                  {idx < assignment.assigned_member_details.length - 1 && ', '}
                                </span>
                              ))}
                            </span>
                          </span>
                        ) : assignment.assigned_user_fullname && (
                          <span style={{ fontSize: '14px', color: '#6B7280' }}>
                            assigned to <span style={{ fontWeight: '600', color: '#050505' }}>{assignment.assigned_user_fullname}</span>
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '13px', color: '#6B7280' }}>
                        {formatDateTime(assignment.created_at)}
                      </div>
                    </div>
                  </div>
                  {/* Show completed badge or due date at top right */}
                  <div style={{ textAlign: 'right' }}>
                    {assignment.status === 'completed' && assignment.submitted_files && assignment.submitted_files.length > 0 ? (
                      <div style={{
                        backgroundColor: '#d1fae5',
                        color: '#059669',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '13px',
                        fontWeight: '600',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        ✓ Completed
                      </div>
                    ) : (
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#000000' }}>
                        Due: {assignment.due_date ? formatDate(assignment.due_date) : 'No due date'}
                        {daysLeft !== null && (
                          <span style={{
                            color: daysLeft < 0 ? '#DC2626' : '#16A34A',
                            fontWeight: '400',
                            marginLeft: '4px'
                          }}>
                            {daysLeft < 0 ? `(${Math.abs(daysLeft)} days overdue)` : `(${daysLeft} days left)`}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Title */}
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#101828', marginBottom: '8px' }}>
                  {assignment.title}
                </div>

                {/* Description */}
                {assignment.description && (
                  <div style={{ fontSize: '14px', color: '#4B5563', marginBottom: '16px', lineHeight: '1.5' }}>
                    {assignment.description}
                  </div>
                )}

                {/* Status badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  {getStatusBadge(assignment)}
                </div>

                {/* Attachments Section - Files attached by Team Leader */}
                {assignment.attachments && assignment.attachments.length > 0 && (() => {
                  const { folders: attFolders, individualFiles: attIndividual } = groupFilesByFolder(assignment.attachments);
                  const folderNames = Object.keys(attFolders);
                  const totalItems = folderNames.length + attIndividual.length;
                  return (
                    <div style={{ padding: '8px 0px', marginBottom: '16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                        📎 Attached Files ({totalItems === 1 ? '1 item' : `${folderNames.length} folder${folderNames.length !== 1 ? 's' : ''}${attIndividual.length > 0 ? `, ${attIndividual.length} file${attIndividual.length !== 1 ? 's' : ''}` : ''}`})
                      </div>

                      {/* Folder attachments */}
                      {folderNames.map(folderName => {
                        const folderFiles = attFolders[folderName];
                        const isExpanded = expandedFolders[`att-${assignment.id}-${folderName}`];
                        return (
                          <div key={folderName} style={{ marginBottom: '8px' }}>
                            <div
                              className="submitted-file-card"
                              onClick={() => setExpandedFolders(prev => ({ ...prev, [`att-${assignment.id}-${folderName}`]: !prev[`att-${assignment.id}-${folderName}`] }))}
                              style={{ cursor: 'pointer', backgroundColor: isExpanded ? '#BFDBFE' : '#DBEAFE' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ fontSize: '32px', flexShrink: 0 }}>
                                  {isExpanded ? '📂' : '📁'}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>{folderName}</div>
                                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                    {assignment.team_leader_fullname || assignment.team_leader_username || 'Team Leader'} • {folderFiles.length} file{folderFiles.length !== 1 ? 's' : ''}
                                  </div>
                                </div>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
                                  <path d="M4 6L8 10L12 6" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </div>
                            </div>
                            {isExpanded && (
                              <div style={{ marginLeft: '8px', paddingLeft: '8px', marginTop: '4px' }}>
                                {folderFiles.map(file => (
                                  <div
                                    key={file.id}
                                    onClick={() => confirmOpenFile(file)}
                                    className="submitted-file-card"
                                    style={{ cursor: 'pointer', marginBottom: '4px' }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                      <div style={{ flexShrink: 0 }}>
                                        <FileIcon fileType={file.original_name.split('.').pop()} size="small" />
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: '500', fontSize: '14px', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.original_name}</div>
                                        <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                                          <span>by <span style={{ fontWeight: '500', color: '#2563eb' }}>{assignment.team_leader_fullname || assignment.team_leader_username || 'Team Leader'}</span></span>
                                          <span style={{ color: '#9ca3af' }}>•</span>
                                          <span>{formatFileSize(file.file_size)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Individual file attachments */}
                      {attIndividual.map(attachment => (
                        <div
                          key={attachment.id}
                          onClick={() => confirmOpenFile(attachment)}
                          className="submitted-file-card"
                          style={{ cursor: 'pointer', marginBottom: '8px' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ flexShrink: 0 }}>
                              <FileIcon fileType={attachment.original_name.split('.').pop()} size="small" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: '500', fontSize: '14px', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {attachment.original_name}
                              </div>
                              <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                                <span>by <span style={{ fontWeight: '500', color: '#2563eb' }}>{assignment.team_leader_fullname || assignment.team_leader_username || 'Team Leader'}</span></span>
                                <span style={{ color: '#9ca3af' }}>•</span>
                                <span>{formatFileSize(attachment.file_size)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Submitted Files Display - Show all submitted files */}
                {assignment.submitted_files && assignment.submitted_files.length > 0 && (
                  <div className="submitted-files-section">
                    <div className="submitted-files-header">
                      <span style={{ fontSize: '16px' }}>📎</span>
                      Submitted Files ({assignment.submitted_files.length}):
                    </div>
                    {(() => {
                      // Sort files by submitted_at (newest first)
                      const sortedFiles = [...assignment.submitted_files].sort((a, b) =>
                        new Date(b.submitted_at || b.uploaded_at) - new Date(a.submitted_at || a.uploaded_at)
                      );

                      // Group files by folder
                      const { folders, individualFiles } = groupFilesByFolder(sortedFiles);
                      const foldersToShow = Object.keys(folders);
                      
                      // Check if we should show all files for this assignment
                      const showAll = showAllSubmittedFiles[assignment.id];
                      const totalItems = foldersToShow.length + individualFiles.length;
                      const shouldShowSeeMore = totalItems > INITIAL_FILE_DISPLAY_LIMIT;
                      
                      // Limit items if not showing all
                      let displayFolders = foldersToShow;
                      let displayIndividualFiles = individualFiles;
                      
                      if (!showAll && shouldShowSeeMore) {
                        const foldersCount = foldersToShow.length;
                        if (foldersCount >= INITIAL_FILE_DISPLAY_LIMIT) {
                          // Show only folders up to limit
                          displayFolders = foldersToShow.slice(0, INITIAL_FILE_DISPLAY_LIMIT);
                          displayIndividualFiles = [];
                        } else {
                          // Show all folders + remaining individual files up to limit
                          const remainingSlots = INITIAL_FILE_DISPLAY_LIMIT - foldersCount;
                          displayIndividualFiles = individualFiles.slice(0, remainingSlots);
                        }
                      }

                      return (
                        <>
                          {/* Display Folders */}
                          {displayFolders.map((folderName) => {
                            const folderFiles = folders[folderName];
                            const isExpanded = expandedFolders[`${assignment.id}-${folderName}`];
                            
                            return (
                              <div key={folderName} style={{ marginBottom: '8px' }}>
                                {/* Folder Header - Clickable */}
                                <div
                                  className="submitted-file-card"
                                  onClick={() => {
                                    setExpandedFolders(prev => ({
                                      ...prev,
                                      [`${assignment.id}-${folderName}`]: !prev[`${assignment.id}-${folderName}`]
                                    }));
                                  }}
                                  style={{ 
                                    cursor: 'pointer',
                                    backgroundColor: isExpanded ? '#BFDBFE' : '#DBEAFE'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ fontSize: '32px', flexShrink: 0 }}>
                                      {isExpanded ? '📂' : '📁'}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>
                                        {folderName}
                                      </div>
                                      <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                        <span>Submitted by <span style={{ fontWeight: '500' }}>{folderFiles[0].submitter_name || user.fullName || user.username}</span> • {folderFiles.length} files</span>
                                        {(() => {
                                          const total = folderFiles.length;
                                          const approved = folderFiles.filter(f => f.status === 'final_approved').length;
                                          const tlApproved = folderFiles.filter(f => f.status === 'team_leader_approved').length;
                                          const rejected = folderFiles.filter(f => f.status === 'rejected_by_team_leader' || f.status === 'rejected_by_admin').length;
                                          const pending = folderFiles.filter(f => f.status === 'uploaded' || !f.status).length;
                                          const badges = [];
                                          if (approved === total) return <span style={{ background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>✓ All Approved</span>;
                                          if (rejected === total) return <span style={{ background: '#ffe4e6', color: '#be123c', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>All Rejected</span>;
                                          const pendingAdmin = tlApproved;
                                          if (pendingAdmin > 0 || (approved > 0 && pending === 0 && rejected === 0)) {
                                            badges.push(<span key="pa" style={{ background: '#fef9c3', color: '#92400e', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '500', marginRight: '4px' }}>Pending Admin</span>);
                                          }
                                          if (pending > 0) {
                                            badges.push(<span key="pt" style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', marginRight: '4px' }}>Pending Review</span>);
                                          }
                                          if (rejected > 0) {
                                            badges.push(<span key="rj" style={{ background: '#ffe4e6', color: '#be123c', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500', marginRight: '4px' }}>{rejected} Rejected</span>);
                                          }
                                          if (approved > 0 && approved < total) {
                                            badges.push(<span key="ap" style={{ background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>{approved} Approved</span>);
                                          }
                                          return badges.length > 0 ? <>{badges}</> : <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>Pending Review</span>;
                                        })()}
                                      </div>
                                    </div>
                                    <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                      <FileMoreMenuInline
                                        onDownload={() => handleDownloadFolder(folderFiles, folderName)}
                                        onDelete={() => {
                                          setFileToDelete({ assignmentId: assignment.id, fileId: null, fileName: folderName, isFolderDelete: true, folderFiles });
                                          setShowDeleteModal(true);
                                        }}
                                        isFolder
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Folder Contents - Expandable */}
                                {isExpanded && (
                                  <div style={{
                                    marginLeft: '8px',
                                    marginTop: '4px',
                                    paddingLeft: '8px'
                                  }}>
                                    {folderFiles.map((file) => (
                                      <div
                                        key={file.id}
                                        className="submitted-file-card"
                                        onClick={() => confirmOpenFile(file)}
                                        style={{ cursor: 'pointer', marginBottom: '4px' }}
                                      >
                                        <div style={{
                                          display: 'flex',
                                          alignItems: 'flex-start',
                                          gap: '12px',
                                        }}>
                                          <div style={{ flexShrink: 0 }}>
                                            <FileIcon
                                              fileType={(file.original_name || file.filename || 'file').split('.').pop().toLowerCase()}
                                              isFolder={false}
                                              size="default"
                                              style={{ width: '36px', height: '36px' }}
                                            />
                                          </div>
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                              fontWeight: '500',
                                              fontSize: '14px',
                                              color: '#111827',
                                              marginBottom: '6px',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                              whiteSpace: 'nowrap'
                                            }}>
                                              {file.original_name || file.filename}
                                            </div>
                                            <div style={{
                                              fontSize: '12px',
                                              color: '#6b7280',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '6px',
                                              flexWrap: 'wrap'
                                            }}>
                                              <span>by <span style={{ fontWeight: '500', color: '#2563eb' }}>{file.submitter_name || user.fullName || user.username}</span></span>
                                              <span style={{ color: '#9ca3af' }}>•</span>
                                              <span>{formatDate(file.submitted_at || file.uploaded_at)}</span>
                                              {file.tag && (
                                              <span style={{
                                              backgroundColor: '#eff6ff',
                                              color: '#1e40af',
                                              padding: '2px 8px',
                                              borderRadius: '3px',
                                              fontSize: '10px',
                                              fontWeight: '600',
                                              }}>
                                              🏷️ {file.tag}
                                              </span>
                                              )}
                                              {getFileStatusBadge(file.status)}
                                            </div>
                                          </div>
                                          {file.status !== 'final_approved' ? (
                                          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                                            <FileMoreMenuInline
                                              onDownload={() => handleDownloadFile(file)}
                                              onDelete={() => confirmDeleteFile(assignment.id, file.id, file.original_name || file.filename)}
                                            />
                                          </div>
                                          ) : (
                                          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                                            <FileMoreMenuInline
                                              onDownload={() => handleDownloadFile(file)}
                                            />
                                          </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Display Individual Files */}
                          {displayIndividualFiles.map((file) => (
                            <div
                              key={file.id}
                              className="submitted-file-card"
                              onClick={() => confirmOpenFile(file)}
                              style={{ cursor: 'pointer' }}
                            >
                              <div style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '12px',
                              }}>
                                <div style={{ flexShrink: 0 }}>
                                  <FileIcon
                                    fileType={(file.original_name || file.filename || 'file').split('.').pop().toLowerCase()}
                                    isFolder={false}
                                    size="default"
                                    style={{ width: '48px', height: '48px' }}
                                  />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{
                                    fontWeight: '500',
                                    fontSize: '15px',
                                    color: '#111827',
                                    marginBottom: '8px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {file.original_name || file.filename}
                                  </div>
                                  <div style={{
                                    fontSize: '13px',
                                    color: '#6b7280',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    flexWrap: 'wrap'
                                  }}>
                                    <span>by <span style={{ fontWeight: '500', color: '#2563eb' }}>{file.submitter_name || user.fullName || user.username}</span></span>
                                    <span style={{ color: '#9ca3af' }}>•</span>
                                    <span>{formatDate(file.submitted_at || file.uploaded_at)}</span>
                                    {file.tag && (
                                      <span style={{
                                        backgroundColor: '#eff6ff',
                                        color: '#1e40af',
                                        padding: '3px 10px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> {file.tag}
                                      </span>
                                    )}
                                    {getFileStatusBadge(file.status)}
                                  </div>
                                </div>
                                {file.status !== 'final_approved' ? (
                                <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                  <FileMoreMenuInline
                                    onDownload={() => handleDownloadFile(file)}
                                    onDelete={() => confirmDeleteFile(assignment.id, file.id, file.original_name || file.filename)}
                                  />
                                </div>
                                ) : (
                                <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                  <FileMoreMenuInline
                                    onDownload={() => handleDownloadFile(file)}
                                  />
                                </div>
                                )}
                              </div>
                            </div>
                          ))}
                          
                          {/* See more button */}
                          {shouldShowSeeMore && (
                            <div style={{ marginTop: '12px', textAlign: 'center' }}>
                              <button
                                onClick={() => setShowAllSubmittedFiles(prev => ({
                                  ...prev,
                                  [assignment.id]: !prev[assignment.id]
                                }))}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#2563eb',
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  padding: '8px 16px',
                                  textDecoration: 'underline',
                                  transition: 'color 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.color = '#1d4ed8'}
                                onMouseLeave={(e) => e.currentTarget.style.color = '#2563eb'}
                              >
                                {showAll 
                                  ? 'See less' 
                                  : `See more (${totalItems - INITIAL_FILE_DISPLAY_LIMIT} more)`
                                }
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Message when no files submitted yet but marked as submitted or completed */}
                {(assignment.user_status === 'submitted' || assignment.status === 'completed') && (!assignment.submitted_files || assignment.submitted_files.length === 0) && (
                  <div style={{
                    backgroundColor: '#FEF3C7',
                    border: '1px solid #F59E0B',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <div style={{ fontSize: '14px', color: '#92400E', lineHeight: '1.5' }}>
                      <strong>No files found.</strong>
                      <br />
                      Please upload files for this assignment.
                    </div>
                  </div>
                )}

                {/* Submit button - Show for assigned users */}
                {(assignment.assigned_to === 'all' ||
                  (assignment.assigned_member_details && assignment.assigned_member_details.some(member => member.id === user.id))) && (
                    <div style={{ paddingTop: '16px' }}>
                      {/* Show different button text based on submission status */}
                      <button
                        onClick={() => handleSubmit(assignment)}
                        style={{
                          backgroundColor: '#f3f4f6',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          padding: '10px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          width: '100%',
                          cursor: 'pointer',
                          outline: 'none',
                          gap: '12px'
                        }}
                      >
                        <span className="submit-button-label" style={{
                          backgroundColor: assignment.submitted_files && assignment.submitted_files.length > 0 ? '#10b981' : '#000000',
                          padding: '6px 16px',
                          borderRadius: '4px',
                          fontSize: '14px',
                          fontWeight: '500',
                          whiteSpace: 'nowrap'
                        }}>
                          {assignment.submitted_files && assignment.submitted_files.length > 0 ? 'Add more files' : 'Submit file'}
                        </span>
                        <span style={{ fontSize: '14px', color: '#6b7280' }}>
                          {assignment.submitted_files && assignment.submitted_files.length > 0
                            ? 'Upload additional files'
                            : 'Click to attach files'}
                        </span>
                      </button>
                    </div>
                  )}

                {/* Comment toggle */}
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f3f4f6' }}>
                  <button
                    onClick={() => toggleComments(assignment)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#1c1e21',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '0'
                    }}
                  >
                    Comment ({assignmentComments.length > 0 ? assignmentComments.length : (assignment.comment_count || 0)})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="tasks-empty">
          <div className="tasks-empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div>
          <h3>No assignments</h3>
          <p>You don't have any assignments at this time.</p>
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
          <div className="tasks-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="tasks-modal-header">
              <h3 style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                {fileToDelete.isFolderDelete ? 'Delete Folder' : 'Delete File'}
              </h3>
              <button className="tasks-modal-close" onClick={() => setShowDeleteModal(false)}>×</button>
            </div>

            <div className="tasks-modal-body">
              <div style={{ padding: '20px 0' }}>
                <p style={{ fontSize: '15px', color: '#374151', marginBottom: '16px', lineHeight: '1.6' }}>
                  {fileToDelete.isFolderDelete
                    ? `Are you sure you want to delete all ${fileToDelete.folderFiles?.length} files in this folder?`
                    : 'Are you sure you want to permanently delete this file?'
                  }
                </p>
                <div style={{
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {fileToDelete.isFolderDelete ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#991b1b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#991b1b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>}
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#991b1b' }}>
                      {fileToDelete.fileName}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                  This action will permanently delete {fileToDelete.isFolderDelete ? 'all files in the folder' : 'the file'} from the database and storage. This cannot be undone.
                </p>
              </div>
            </div>

            <div className="tasks-modal-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#ffffff',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (fileToDelete.isFolderDelete) {
                    const { assignmentId, folderFiles } = fileToDelete;
                    setShowDeleteModal(false);
                    setFileToDelete(null);
                    // Remove all folder files from UI immediately
                    setAssignments(prev => prev.map(a => {
                      if (a.id !== assignmentId) return a;
                      const folderFileIds = new Set(folderFiles.map(f => f.id));
                      return { ...a, submitted_files: a.submitted_files.filter(f => !folderFileIds.has(f.id)) };
                    }));
                    // Delete each file from assignment AND from My Files
                    const folderName = fileToDelete.fileName;
                    const fileIds = folderFiles.map(f => f.id);
                    for (const file of folderFiles) {
                      try {
                        await fetch(`${API_BASE_URL}/api/assignments/${assignmentId}/files/${file.id}`, {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ userId: user.id })
                        });
                        // Also delete the actual file record
                        await fetch(`${API_BASE_URL}/api/files/${file.id}`, {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ adminId: user.id, adminUsername: user.username, adminRole: user.role, team: user.team })
                        });
                      } catch (e) { console.error('Error deleting folder file:', e); }
                    }
                    // Delete the physical folder directory from NAS
                    try {
                      await fetch(`${API_BASE_URL}/api/files/folder/delete`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          folderName,
                          username: user.username,
                          fileIds,
                          userId: user.id,
                          userRole: user.role,
                          team: user.team
                        })
                      });
                    } catch (e) { console.error('Error deleting folder directory:', e); }
                    setSuccessModal({ isOpen: true, title: 'Removed', message: 'Folder removed successfully', type: 'error' });
                    setTimeout(() => fetchUserFiles(), 500);
                  } else {
                    handleRemoveSubmittedFile(fileToDelete.assignmentId, fileToDelete.fileId);
                  }
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                {fileToDelete.isFolderDelete ? 'Delete Folder' : 'Delete File'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Open Modal */}
      <FileOpenModal
        isOpen={showOpenFileModal}
        onClose={() => {
          setShowOpenFileModal(false)
          setFileToOpen(null)
        }}
        onConfirm={handleOpenFile}
        file={fileToOpen}
      />

      {/* Download Success Toast */}
      {downloadToast.show && (
        <div
          style={{
            position: 'fixed',
            top: '28px',
            right: '28px',
            zIndex: 9999,
            background: '#fff',
            border: '1px solid #bbf7d0',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
            padding: '18px 22px 14px 18px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
            minWidth: '280px',
            maxWidth: '380px',
            animation: 'slideInRight 0.25s ease',
          }}
        >
          {/* Green circle check — matches SuccessModal style */}
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: '#dcfce7', border: '2px solid #86efac',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0, marginTop: '1px'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#15803d', marginBottom: '4px' }}>
              Success
            </div>
            <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.4' }}>
              {downloadToast.fileName
                ? `"${downloadToast.fileName}" downloaded successfully!`
                : 'File downloaded successfully!'}
            </div>
            {/* Green progress bar at bottom */}
            <div style={{ marginTop: '10px', height: '4px', borderRadius: '2px', background: '#dcfce7', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '2px', background: '#22c55e',
                animation: 'shrinkBar 3.5s linear forwards'
              }} />
            </div>
          </div>
          <button
            onClick={() => setDownloadToast({ show: false, fileName: '' })}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#9ca3af', fontSize: '20px', lineHeight: 1,
              padding: '0', flexShrink: 0, borderRadius: '4px',
              marginTop: '-2px'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#374151'}
            onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
          >×</button>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes shrinkBar {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>

      {/* Submit Modal */}
      {showSubmitModal && currentAssignment && (
        <div className="tasks-modal-overlay">
          <div className="tasks-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="tasks-modal-header" style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '16px' }}>
              <div style={{ flex: 1, marginRight: '40px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>Submit Task</h3>
                <div style={{
                  marginTop: '8px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderLeft: '4px solid #6b7280',
                  borderRadius: '8px',
                  padding: '12px 16px'
                }}>
                  <h4 style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '4px',
                    margin: 0
                  }}>
                    {currentAssignment.title}
                  </h4>
                  {currentAssignment.description && (
                    <p style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      marginTop: '6px',
                      marginBottom: 0,
                      lineHeight: '1.5'
                    }}>
                      {currentAssignment.description}
                    </p>
                  )}
                </div>
              </div>
              <button className="tasks-modal-close" onClick={() => setShowSubmitModal(false)}>×</button>
            </div>

            <div className="tasks-modal-body">
              <div className="tasks-file-selection">
                <div className="upload-section">
                <div className="file-upload-wrapper">
                    {/* Hidden file input for individual files */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files);
                        if (files.length > 0) {
                          const newFiles = files.map(file => ({
                            file: file,
                            relativePath: file.name,
                            folderName: null
                          }));
                          setUploadedFiles(prev => [...prev, ...newFiles]);
                          setUploadMode('files');
                        }
                        e.target.value = '';
                      }}
                      style={{ display: 'none' }}
                      id="file-upload-input"
                      disabled={isUploading}
                    />
                {/* Hidden folder input */}
                <input
                ref={folderInputRef}
                type="file"
                webkitdirectory=""
                directory=""
                onChange={(e) => {
                const files = Array.from(e.target.files);
                if (files.length > 0) {
                // Get folder name from the first file's path
                const firstFile = files[0];
                const pathParts = firstFile.webkitRelativePath.split('/');
                const folderName = pathParts[0];
                  
                  // Group files by folder structure
                    const newFiles = files.map(file => ({
                      file: file,
                      relativePath: file.webkitRelativePath,
                      folderName: folderName
                      }));
                          
                          setUploadedFiles(prev => [...prev, ...newFiles]);
                          setUploadMode('folder');
                        }
                        e.target.value = '';
                      }}
                      style={{ display: 'none' }}
                      id="folder-upload-input"
                      disabled={isUploading}
                    />
                    {/* Drop zone that works for both files and folders */}
                    <div
                      className="file-upload-label" 
                      style={{
                        border: '2px dashed #d1d5db',
                        borderRadius: '12px',
                        padding: '32px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        backgroundColor: '#fafafa'
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.style.backgroundColor = '#e0e7ff';
                        e.currentTarget.style.borderColor = '#4f46e5';
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.style.backgroundColor = '#fafafa';
                        e.currentTarget.style.borderColor = '#d1d5db';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.style.backgroundColor = '#fafafa';
                        e.currentTarget.style.borderColor = '#d1d5db';
                        
                        const files = Array.from(e.dataTransfer.files);
                        if (files.length > 0) {
                          const newFiles = files.map(file => ({
                            file: file
                          }));
                          setUploadedFiles(prev => [...prev, ...newFiles]);
                        }
                      }}
                    >
                      <div className="file-upload-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        <div><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#FFC107" stroke="#E6A817" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg></div>
                        <div className="upload-text">
                          <p style={{ fontSize: '15px', fontWeight: '500', color: '#111827', margin: '0 0 8px 0' }}>Drag and drop files or folders here</p>
                          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isUploading}
                              style={{
                                padding: '10px 20px',
                                borderRadius: '8px',
                                border: '1px solid #4f46e5',
                                backgroundColor: '#ffffff',
                                color: '#4f46e5',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: isUploading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                              onMouseEnter={(e) => {
                                if (!isUploading) {
                                  e.currentTarget.style.backgroundColor = '#eff6ff';
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#ffffff';
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'4px'}}><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg> Browse Files
                            </button>
                            <button
                              type="button"
                              onClick={() => folderInputRef.current?.click()}
                              disabled={isUploading}
                              style={{
                                padding: '10px 20px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: '#4f46e5',
                                color: '#ffffff',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: isUploading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                              onMouseEnter={(e) => {
                                if (!isUploading) {
                                  e.currentTarget.style.backgroundColor = '#4338ca';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isUploading) {
                                  e.currentTarget.style.backgroundColor = '#4f46e5';
                                }
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'4px'}}><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg> Browse Folder
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {uploadedFiles.length > 0 && (
                  <div style={{ marginTop: '24px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '12px'
                    }}>
                      <label style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                        {uploadMode === 'folder' && uploadedFiles.length > 0
                          ? `Folder: ${uploadedFiles[0].folderName} (${uploadedFiles.length} files)`
                          : `Selected Files (${uploadedFiles.length})`
                        }
                      </label>
                    </div>
                    
                    {uploadMode === 'folder' ? (
                      // Folder view - show folder structure
                      <div style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '10px',
                        padding: '16px',
                        marginBottom: '8px',
                        backgroundColor: '#f9fafb',
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px',
                          marginBottom: '12px'
                        }}>
                          <div><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#fed7aa" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg></div>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontWeight: '600',
                              fontSize: '16px',
                              color: '#1a1a1a',
                              marginBottom: '4px'
                            }}>
                              {uploadedFiles[0]?.folderName}
                            </div>
                            <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '12px' }}>
                              {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''}
                            </div>
                            
                            {/* Show file tree */}
                            <div style={{
                              maxHeight: '300px',
                              overflowY: 'auto',
                              backgroundColor: '#ffffff',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              padding: '8px'
                            }}>
                              {uploadedFiles.map((fileObj, index) => (
                                <div key={index} style={{
                                  fontSize: '12px',
                                  color: '#4b5563',
                                  padding: '4px 8px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  borderBottom: index < uploadedFiles.length - 1 ? '1px solid #f3f4f6' : 'none'
                                }}>
                                  <FileIcon
                                    fileType={fileObj.file.name.split('.').pop().toLowerCase()}
                                    isFolder={false}
                                    size="small"
                                    style={{ width: '20px', height: '20px', flexShrink: 0 }}
                                  />
                                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {fileObj.relativePath}
                                  </span>
                                  <span style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0 }}>
                                    {formatFileSize(fileObj.file.size)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setUploadedFiles([]);
                              setUploadMode('files');
                              if (folderInputRef.current) {
                                folderInputRef.current.value = '';
                              }
                            }}
                            style={{
                              background: 'transparent',
                              color: '#9ca3af',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px',
                              fontSize: '18px',
                              cursor: 'pointer',
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#fee2e2';
                              e.currentTarget.style.color = '#dc2626';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#9ca3af';
                            }}
                            disabled={isUploading}
                            title="Remove folder"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Individual files view
                      uploadedFiles.map((fileObj, index) => (
                        <div key={index} style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: '10px',
                          padding: '12px 16px',
                          marginBottom: '8px',
                          backgroundColor: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          transition: 'all 0.2s'
                        }}>
                          <FileIcon
                            fileType={fileObj.file.name.split('.').pop().toLowerCase()}
                            isFolder={false}
                            size="default"
                            style={{ width: '40px', height: '40px', flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontWeight: '500',
                              fontSize: '14px',
                              color: '#1a1a1a',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {fileObj.file.name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6B7280' }}>
                              {formatFileSize(fileObj.file.size)}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveFile(index)}
                            style={{
                              background: 'transparent',
                              color: '#9ca3af',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px',
                              fontSize: '18px',
                              cursor: 'pointer',
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#fee2e2';
                              e.currentTarget.style.color = '#dc2626';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#9ca3af';
                            }}
                            disabled={isUploading}
                            title="Remove file"
                          >
                            ×
                          </button>
                        </div>
                      ))
                    )}

                    {/* Single Tag field for all files */}
                    <div style={{ marginTop: '24px', marginBottom: '16px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#111827' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'5px',verticalAlign:'middle'}}><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> Tag
                      </label>
                      <SingleSelectTags
                        selectedTag={fileTag}
                        onChange={(newTag) => setFileTag(newTag)}
                        disabled={isUploading}
                        user={user}
                      />

                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#111827', marginTop: '16px' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'5px',verticalAlign:'middle'}}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Description (optional)
                      </label>
                      <textarea
                        value={fileDescription}
                        onChange={(e) => setFileDescription(e.target.value)}
                        placeholder="Add a brief description..."
                        rows="2"
                        disabled={isUploading}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontFamily: 'inherit',
                          resize: 'vertical',
                          backgroundColor: '#ffffff'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="tasks-modal-footer" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowSubmitModal(false);
                  setUploadedFiles([]);
                  setFileDescription('');
                  setFileTag('');
                  setUploadMode('files');
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                  if (folderInputRef.current) {
                    folderInputRef.current.value = '';
                  }
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#ffffff',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
              >
                Cancel
              </button>
              <button
                onClick={handleFileUpload}
                disabled={uploadedFiles.length === 0 || isUploading}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: uploadedFiles.length === 0 || isUploading ? '#d1d5db' : '#4f46e5',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: uploadedFiles.length === 0 || isUploading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  if (uploadedFiles.length > 0 && !isUploading) {
                    e.currentTarget.style.backgroundColor = '#4338ca';
                  }
                }}
                onMouseLeave={(e) => {
                  if (uploadedFiles.length > 0 && !isUploading) {
                    e.currentTarget.style.backgroundColor = '#4f46e5';
                  }
                }}
              >
                {isUploading ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline-block',animation:'spin 1s linear infinite'}}><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                    Uploading...
                  </>
                ) : (
                  <>
                    ✓ Upload {uploadedFiles.length > 0 ? `${uploadedFiles.length} ` : ''}File{uploadedFiles.length !== 1 ? 's' : ''} & Submit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

TasksTab.displayName = 'TasksTab';
export default TasksTab;
