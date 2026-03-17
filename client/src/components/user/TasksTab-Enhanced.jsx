import { useRef, useCallback, useState, useEffect } from 'react';
import { API_BASE_URL } from '@/config/api';
import './css/TasksTab-Enhanced.css';
import './css/TasksTab-Comments.css';
import { FileIcon, FileOpenModal } from '../shared';
import SingleSelectTags from './SingleSelectTags';
import { LoadingTable, LoadingCards } from '../common/InlineSkeletonLoader';
import SuccessModal from './SuccessModal';
import { useSmartNavigation } from '../shared/SmartNavigation';
import '../shared/SmartNavigation/SmartNavigation.css';

const TasksTab = ({
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
  const [replyingTo, setReplyingTo] = useState({});
  const [replyText, setReplyText] = useState({});
  const [isPostingReply, setIsPostingReply] = useState({});
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [currentCommentsAssignment, setCurrentCommentsAssignment] = useState(null);
  const [highlightCommentBy, setHighlightCommentBy] = useState(null);
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
  const [expandedCommentTexts, setExpandedCommentTexts] = useState({}); // Track which comment texts are expanded
  const [expandedReplyTexts, setExpandedReplyTexts] = useState({}); // Track which reply texts are expanded
  const [showAllSubmittedFiles, setShowAllSubmittedFiles] = useState({}); // Track which assignments show all submitted files
  const INITIAL_FILE_DISPLAY_LIMIT = 5; // Show first 5 files/folders initially

  // Check for sessionStorage when component mounts - run ONCE when assignments first load
  useEffect(() => {
    const assignmentId = sessionStorage.getItem('scrollToAssignment');
    const highlightUser = sessionStorage.getItem('highlightCommentBy');

    // Only run if we have both the session data AND assignments have loaded
    if (assignmentId && assignments.length > 0) {
      console.log('Found assignment to open:', assignmentId);
      console.log('Found user to highlight:', highlightUser);

      // Clear the session storage immediately to prevent re-triggering
      sessionStorage.removeItem('scrollToAssignment');
      sessionStorage.removeItem('highlightCommentBy');

      // Find the assignment
      const assignment = assignments.find(a => a.id === parseInt(assignmentId));
      if (assignment) {
        console.log('Assignment found, opening comments...');

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
      } else {
        console.log('Assignment not found in list');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments.length]); // Only re-run when assignments.length changes, not the entire array

  // SMART NAVIGATION HOOK
  // IMPORTANT: Called after function definitions (will be moved by build, but placed here for clarity)
  // We need to make sure openCommentsModal and other functions are available.
  // Since we are inside the component, we can pass the functions we defined.

  // NOTE: openCommentsModal is the stable interface for useSmartNavigation.
  // Uses state setters directly (stable refs) so the callback never changes reference.
  const openCommentsModal = useCallback((assignment) => {
    console.log('openCommentsModal called for:', assignment.title);
    setCurrentCommentsAssignment(assignment);
    setShowCommentsModal(true);
  }, []); // empty deps — setters are stable React guarantees

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
        console.log('Fetched assignments:', data.assignments);
        console.log('Current user ID:', user.id);
        if (data.assignments.length > 0) {
          console.log('First assignment data:', data.assignments[0]);
          console.log('First assignment submitted_files:', data.assignments[0].submitted_files);
          // Check each assignment for submitted files
          data.assignments.forEach(a => {
            if (a.submitted_files && a.submitted_files.length > 0) {
              console.log(`Assignment "${a.title}" has ${a.submitted_files.length} submitted file(s):`, a.submitted_files);
            } else {
              console.log(`Assignment "${a.title}" has no submitted files`);
            }
          });
        }
        setAssignments(data.assignments || []);
        // Fetch comments for each assignment
        data.assignments.forEach(assignment => {
          fetchComments(assignment.id);
        });
        // Fetch user files after assignments are loaded - pass the fresh data
        fetchUserFiles(data.assignments);
      } else {
        setSuccessModal({ isOpen: true, title: 'Error', message: 'Failed to fetch assignments', type: 'error' });
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setSuccessModal({ isOpen: true, title: 'Error', message: 'Failed to connect to server', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchComments = async (assignmentId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/assignments/${assignmentId}/comments`);
      const data = await response.json();

      if (data.success) {
        setComments(prev => ({
          ...prev,
          [assignmentId]: data.comments || []
        }));
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const postComment = async (assignmentId) => {
    const commentText = newComment[assignmentId]?.trim();
    if (!commentText) return;

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
          comment: commentText
        })
      });

      const data = await response.json();

      if (data.success) {
        setNewComment(prev => ({ ...prev, [assignmentId]: '' }));
        fetchComments(assignmentId);
      } else {
        setSuccessModal({ isOpen: true, title: 'Error', message: 'Failed to post comment', type: 'error' });
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      setSuccessModal({ isOpen: true, title: 'Error', message: 'Failed to post comment', type: 'error' });
    } finally {
      setIsPostingComment(prev => ({ ...prev, [assignmentId]: false }));
    }
  };

  function toggleComments(assignment) {
    console.log('toggleComments called for:', assignment.title);
    setCurrentCommentsAssignment(assignment);
    setShowCommentsModal(true);
  }

  const postReply = async (assignmentId, commentId) => {
    const replyTextValue = replyText[commentId]?.trim();
    if (!replyTextValue) return;

    setIsPostingReply(prev => ({ ...prev, [commentId]: true }));

    try {
      console.log('Posting reply:', { assignmentId, commentId, replyTextValue });
      const response = await fetch(`${API_BASE_URL}/api/assignments/${assignmentId}/comments/${commentId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          username: user.username || user.fullName,
          reply: replyTextValue
        })
      });

      const data = await response.json();
      console.log('Reply response:', data);

      if (data.success) {
        setReplyText(prev => ({ ...prev, [commentId]: '' }));
        setReplyingTo(prev => ({ ...prev, [commentId]: false }));
        fetchComments(assignmentId);
        setSuccessModal({ isOpen: true, title: 'Success', message: 'Reply posted successfully', type: 'success' });
      } else {
        setSuccessModal({ isOpen: true, title: 'Error', message: data.message || 'Failed to post reply', type: 'error' });
      }
    } catch (error) {
      console.error('Error posting reply:', error);
      setSuccessModal({ isOpen: true, title: 'Error', message: 'Failed to post reply: ' + error.message, type: 'error' });
    } finally {
      setIsPostingReply(prev => ({ ...prev, [commentId]: false }));
    }
  };

  const toggleReplyBox = (commentId) => {
    setReplyingTo(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  const toggleRepliesVisibility = (commentId) => {
    setVisibleReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  const fetchUserFiles = useCallback(async (currentAssignments = assignments) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/files/user/${user.id}`);
      const data = await response.json();

      if (data.success) {
        console.log('All user files:', data.files);

        // Get all file IDs that are currently in ACTIVE assignment submissions
        const activeSubmittedFileIds = new Set();
        currentAssignments.forEach(assignment => {
          if (assignment.submitted_files && assignment.submitted_files.length > 0) {
            assignment.submitted_files.forEach(file => {
              activeSubmittedFileIds.add(file.id);
            });
          }
        });

        console.log('Files currently in active assignments:', Array.from(activeSubmittedFileIds));

        // Filter out ONLY files that are currently in active assignment submissions
        // This means completed/finished assignment files will show up again in "My Files"
        const unsubmittedFiles = data.files.filter(file =>
          !activeSubmittedFileIds.has(file.id)
        );

        console.log('Available files (excluding active submissions):', unsubmittedFiles);
        setUserFiles(unsubmittedFiles || []);
      }
    } catch (error) {
      console.error('Error fetching user files:', error);
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

  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w ago`;

    return formatDate(dateString);
  };

  const getInitials = (name) => {
    if (!name) return '?';
    if (name.includes('.')) {
      const parts = name.split('.');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
    }
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const getDaysUntilDue = (dueDate) => {
    if (!dueDate) return null;
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

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

    // Immediately update UI BEFORE making the API call
    console.log('Removing file from UI immediately:', { assignmentId, fileId });
    setAssignments(prevAssignments => 
      prevAssignments.map(assignment => {
        if (assignment.id === assignmentId) {
          console.log('Found assignment, filtering out file:', fileId);
          const newFiles = assignment.submitted_files.filter(file => file.id !== fileId);
          console.log('Files before:', assignment.submitted_files.length, 'Files after:', newFiles.length);
          return {
            ...assignment,
            submitted_files: newFiles
          };
        }
        return assignment;
      })
    );

    try {
      console.log('📡 Now calling server to delete:', { assignmentId, fileId, userId: user.id });
      
      const response = await fetch(`${API_BASE_URL}/api/assignments/${assignmentId}/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id
        })
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (data.success) {
        console.log('Server confirmed assignment unlink, now deleting file from My Files...');
        
        // Also delete the actual file from the files table + storage
        try {
          const fileDeleteResponse = await fetch(`${API_BASE_URL}/api/files/${fileId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: user.id, adminUsername: user.username, adminRole: user.role, team: user.team })
          });
          const fileDeleteData = await fileDeleteResponse.json();
          if (fileDeleteData.success) {
            console.log('File also deleted from My Files');
          } else {
            console.warn('File unlinked from task but could not delete from My Files:', fileDeleteData.message);
          }
        } catch (fileDeleteErr) {
          console.warn('Error deleting file from My Files:', fileDeleteErr);
        }

        setSuccessModal({ isOpen: true, title: 'Removed', message: 'File removed successfully', type: 'error' });
        
        // Refresh user files after a short delay to ensure server has processed
        setTimeout(() => {
          fetchUserFiles();
        }, 500);
      } else {
        console.error('Server returned error:', data.message);
        // Revert the optimistic update
        fetchAssignments();
        setSuccessModal({ isOpen: true, title: 'Error', message: data.message || 'Failed to remove file', type: 'error' });
      }
    } catch (error) {
      console.error('Error removing file:', error);
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

    // Close modal first
    setShowOpenFileModal(false);
    const file = fileToOpen;
    setFileToOpen(null);

    try {
      // Check if running in Electron
      if (window.electron && window.electron.openFileInApp) {
        // Get the actual file path from server
        const response = await fetch(`${API_BASE_URL}/api/files/${file.id}/path`);
        const data = await response.json();

        if (data.success && data.filePath) {
          // Open file with system default application
          const result = await window.electron.openFileInApp(data.filePath);

          if (!result.success) {
            setSuccessModal({ isOpen: true, title: 'Error', message: result.error || 'Failed to open file with system application', type: 'error' });
          }
        } else {
          throw new Error('Could not get file path');
        }
      } else {
        // In browser - get file path and open in new tab
        const response = await fetch(`${API_BASE_URL}/api/files/${file.id}`);
        const fileData = await response.json();

        if (fileData.success && fileData.file) {
          const fileUrl = `${API_BASE_URL}${fileData.file.file_path}`;
          window.open(fileUrl, '_blank', 'noopener,noreferrer');
        } else {
          throw new Error('Could not get file information');
        }
      }
    } catch (error) {
      console.error('Error opening file:', error);
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
        console.log(`Checking for duplicate files among ${currentAssignment.submitted_files.length} existing file(s)...`);
        console.log(`AUTO-REPLACE MODE: Any matching files will be automatically replaced`);

        // Check each new file against ALL existing files
        for (const fileObj of uploadedFiles) {
          const newFileName = fileObj.file.name;

          // Find ANY existing file with the same name (regardless of status - APPROVED, PENDING, REJECTED, etc.)
          const matchingExistingFile = currentAssignment.submitted_files.find(
            existingFile => existingFile.original_name === newFileName || existingFile.filename === newFileName
          );

          if (matchingExistingFile) {
            console.log(`AUTO-REPLACING: Found existing file "${matchingExistingFile.original_name}" (status: ${matchingExistingFile.status}) - deleting to replace with new version`);
            replacedFiles.push(newFileName); // Track this as a replacement

            try {
              const deleteResponse = await fetch(
                `${API_BASE_URL}/api/assignments/${currentAssignment.id}/files/${matchingExistingFile.id}`,
                {
                  method: 'DELETE',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    userId: user.id
                  })
                }
              );

              const deleteData = await deleteResponse.json();
              if (deleteData.success) {
                console.log(`Successfully deleted existing file: ${matchingExistingFile.original_name}`);
              } else {
                console.warn(`Could not delete existing file ${matchingExistingFile.original_name}:`, deleteData.message);
                // Continue with upload - the server will handle the duplicate
              }
            } catch (deleteError) {
              console.error(`Error deleting existing file ${matchingExistingFile.id}:`, deleteError);
              // Continue with upload - the server will handle the duplicate
            }
          } else {
            console.log(`No existing file found with name: ${newFileName} - will upload as new file`);
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

        if (isRevision) {
          console.log(`Marking ${fileObj.file.name} as REVISION (replacing rejected file)`);
        } else if (replacedFiles.includes(fileObj.file.name)) {
          console.log(`Replacing ${fileObj.file.name} (normal replacement, NOT a revision)`);
        }

        const uploadResponse = await fetch(`${API_BASE_URL}/api/files/upload`, {
          method: 'POST',
          body: formData
        });

        const uploadData = await uploadResponse.json();

        if (uploadData.success) {
          uploadedFileIds.push(uploadData.file.id);
          console.log(`Uploaded file: ${fileObj.file.name} with ID: ${uploadData.file.id}`);
        } else {
          uploadErrors.push(`${fileObj.file.name}: ${uploadData.message}`);
          console.error(`Failed to upload ${fileObj.file.name}:`, uploadData.message);
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
          console.log(`Submitted file ID ${fileId} to assignment ${currentAssignment.id}`);
        } else {
          submissionErrors.push(`File ID ${fileId}: ${submitData.message}`);
          console.error(`Failed to submit file ID ${fileId}:`, submitData.message);
        }
      }

      // Show success message
      if (submissionErrors.length === 0) {
        setSuccessModal({ isOpen: true, title: 'Success', message: `${uploadedFileIds.length} file(s) uploaded and submitted successfully!`, type: 'success' });
      } else if (submissionErrors.length < uploadedFileIds.length) {
        setSuccessModal({ isOpen: true, title: 'Success', message: `${uploadedFileIds.length - submissionErrors.length} file(s) submitted successfully. Some files had errors.`, type: 'success' });
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
      console.error('Error uploading files:', error);
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

  // Sort assignments by created date (newest first)
  const sortedAssignments = [...assignments].sort((a, b) => {
    const dateA = new Date(a.created_at)
    const dateB = new Date(b.created_at)
    return dateB - dateA
  })

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
            const daysLeft = getDaysUntilDue(assignment.due_date);
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
                    {assignment.status === 'completed' ? (
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
                                    <FileIcon fileType={file.original_name.split('.').pop()} size="small" />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: '500', fontSize: '14px', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.original_name}</div>
                                      <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{formatFileSize(file.file_size)}</div>
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
                          style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '12px', border: '1px solid #9CA3AF', borderRadius: '8px', cursor: 'pointer', marginBottom: '8px', transition: 'background-color 0.2s ease', backgroundColor: 'transparent' }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(156, 163, 175, 0.1)'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <div style={{ flexShrink: 0 }}>
                            <FileIcon fileType={attachment.original_name.split('.').pop()} size="small" />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: '500', color: '#1c1e21', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {attachment.original_name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#65676b', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <span>by <span style={{ color: '#1877f2', fontWeight: '600' }}>{assignment.team_leader_fullname || assignment.team_leader_username || 'Team Leader'}</span></span>
                              <span>{formatFileSize(attachment.file_size)}</span>
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
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setFileToDelete({ assignmentId: assignment.id, fileId: null, fileName: folderName, isFolderDelete: true, folderFiles });
                                        setShowDeleteModal(true);
                                      }}
                                      style={{
                                        background: 'transparent',
                                        color: '#9ca3af',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '8px',
                                        fontSize: '16px',
                                        cursor: 'pointer',
                                        flexShrink: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s',
                                        lineHeight: 1,
                                        width: '32px',
                                        height: '32px'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#fee2e2';
                                        e.currentTarget.style.color = '#dc2626';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                        e.currentTarget.style.color = '#9ca3af';
                                      }}
                                      title={`Remove folder "${folderName}"`}
                                    >
                                      ×
                                    </button>
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
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              confirmDeleteFile(assignment.id, file.id, file.original_name || file.filename);
                                            }}
                                            style={{
                                              background: 'transparent',
                                              color: '#9ca3af',
                                              border: 'none',
                                              borderRadius: '6px',
                                              padding: '6px',
                                              fontSize: '14px',
                                              cursor: 'pointer',
                                              flexShrink: 0,
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              transition: 'all 0.2s',
                                              width: '28px',
                                              height: '28px'
                                            }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.backgroundColor = '#fee2e2';
                                              e.currentTarget.style.color = '#dc2626';
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.backgroundColor = 'transparent';
                                              e.currentTarget.style.color = '#9ca3af';
                                            }}
                                            title="Remove file"
                                          >
                                            ×
                                          </button>
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
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    confirmDeleteFile(assignment.id, file.id, file.original_name || file.filename);
                                  }}
                                  style={{
                                    background: 'transparent',
                                    color: '#9ca3af',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '8px',
                                    fontSize: '16px',
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s',
                                    lineHeight: 1,
                                    width: '32px',
                                    height: '32px'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#fee2e2';
                                    e.currentTarget.style.color = '#dc2626';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = '#9ca3af';
                                  }}
                                  title="Remove file"
                                >
                                  ×
                                </button>
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

                {/* Message when no files submitted yet but marked as submitted */}
                {assignment.user_status === 'submitted' && (!assignment.submitted_files || assignment.submitted_files.length === 0) && (
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
                    Comment ({assignmentComments.length})
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

      {/* Comments Modal - Admin Style */}
      {showCommentsModal && currentCommentsAssignment && (
        <div className="comments-modal-overlay" onClick={() => setShowCommentsModal(false)}>
          <div className="comments-modal" onClick={(e) => e.stopPropagation()}>
            <div className="comments-modal-header">
              <h3>Comments - {currentCommentsAssignment.title}</h3>
              <button className="close-modal-btn" onClick={() => setShowCommentsModal(false)}>
                ✕
              </button>
            </div>

            <div className="comments-modal-body">
              {comments[currentCommentsAssignment.id]?.length > 0 ? (
                <div className="comments-list">
                  {comments[currentCommentsAssignment.id].map((comment) => (
                    <div key={comment.id} className="comment-thread">
                      {/* Main Comment */}
                      <div className="comment-item">
                        <div className="comment-avatar">
                          {getInitials(comment.user_fullname || comment.fullName || comment.username)}
                        </div>
                        <div className="comment-content">
                          <div className="comment-header">
                            <span className="comment-author">{comment.user_fullname || comment.fullName || comment.username}</span>
                            <span className={`role-badge ${comment.user_role ? comment.user_role.toLowerCase().replace(' ', '-').replace('_', '-') : 'user'}`}>
                              {comment.user_role || 'USER'}
                            </span>
                            <span className="comment-time">{formatRelativeTime(comment.created_at)}</span>
                          </div>
                          <div className="comment-text">
                            {(() => {
                              const MAX_LENGTH = 150;
                              const isLong = comment.comment.length > MAX_LENGTH;
                              const isExpanded = expandedCommentTexts[comment.id];

                              return (
                                <>
                                  {isLong && !isExpanded
                                    ? comment.comment.substring(0, MAX_LENGTH) + '...'
                                    : comment.comment}
                                  {isLong && (
                                    <button
                                      className="see-more-btn"
                                      onClick={() => setExpandedCommentTexts(prev => ({
                                        ...prev,
                                        [comment.id]: !prev[comment.id]
                                      }))}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#3b82f6',
                                        fontSize: '13px',
                                        fontWeight: '500',
                                        cursor: 'pointer',
                                        padding: '0',
                                        marginLeft: '4px'
                                      }}
                                    >
                                      {isExpanded ? 'See less' : 'See more'}
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          </div>

                          {/* Action Buttons */}
                          <div className="comment-actions">
                            <button
                              className="reply-button"
                              onClick={() => setReplyingTo(prev => ({ ...prev, [comment.id]: true }))}
                            >
                              Reply
                            </button>

                            {/* View Replies Button */}
                            {comment.replies && comment.replies.length > 0 && (
                              <button
                                className="view-replies-button"
                                onClick={() => toggleRepliesVisibility(comment.id)}
                              >
                                {visibleReplies[comment.id] ? 'Hide' : 'View'} {comment.replies.length}{' '}
                                {comment.replies.length === 1 ? 'reply' : 'replies'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Replies Thread */}
                      {comment.replies && comment.replies.length > 0 && visibleReplies[comment.id] && (
                        <div className="replies-thread">
                          {comment.replies.map(reply => (
                            <div key={reply.id} className="reply-item">
                              <div className="reply-avatar">
                                {getInitials(reply.user_fullname || reply.fullName || reply.username)}
                              </div>
                              <div className="reply-content">
                                <div className="reply-header">
                                  <span className="reply-author">{reply.user_fullname || reply.fullName || reply.username}</span>
                                  <span className={`role-badge ${reply.user_role ? reply.user_role.toLowerCase().replace(' ', '-').replace('_', '-') : 'user'}`}>
                                    {reply.user_role || 'USER'}
                                  </span>
                                  <span className="reply-time">{formatRelativeTime(reply.created_at)}</span>
                                </div>
                                <div className="reply-text">
                                  {(() => {
                                    const MAX_LENGTH = 150;
                                    const isLong = reply.reply.length > MAX_LENGTH;
                                    const isExpanded = expandedReplyTexts[reply.id];

                                    return (
                                      <>
                                        {isLong && !isExpanded
                                          ? reply.reply.substring(0, MAX_LENGTH) + '...'
                                          : reply.reply}
                                        {isLong && (
                                          <button
                                            className="see-more-btn"
                                            onClick={() => setExpandedReplyTexts(prev => ({
                                              ...prev,
                                              [reply.id]: !prev[reply.id]
                                            }))}
                                            style={{
                                              background: 'none',
                                              border: 'none',
                                              color: '#3b82f6',
                                              fontSize: '12px',
                                              fontWeight: '500',
                                              cursor: 'pointer',
                                              padding: '0',
                                              marginLeft: '4px'
                                            }}
                                          >
                                            {isExpanded ? 'See less' : 'See more'}
                                          </button>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply Input Box */}
                      {replyingTo[comment.id] && (
                        <div className="reply-input-box">
                          <div className="comment-avatar reply-avatar">
                            {getInitials(user.username || user.fullName)}
                          </div>
                          <div className="comment-input-wrapper">
                            <input
                              type="text"
                              className="comment-input"
                              placeholder="Write a reply..."
                              value={replyText[comment.id] || ''}
                              onChange={(e) => setReplyText(prev => ({
                                ...prev,
                                [comment.id]: e.target.value
                              }))}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  postReply(currentCommentsAssignment.id, comment.id);
                                }
                              }}
                              disabled={isPostingReply[comment.id]}
                              autoFocus
                            />
                            <button
                              className="comment-submit-btn"
                              onClick={() => postReply(currentCommentsAssignment.id, comment.id)}
                              disabled={!replyText[comment.id]?.trim() || isPostingReply[comment.id]}
                            >
                              {isPostingReply[comment.id] ? '...' : '➤'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-comments">
                  <p><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'6px',verticalAlign:'middle'}}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> No comments yet. Be the first to comment!</p>
                </div>
              )}
            </div>

            {/* Comment Form */}
            <div className="comments-modal-footer">
              <div className="add-comment">
                <div className="comment-avatar">
                  {getInitials(user.username || user.fullName)}
                </div>
                <div className="comment-input-wrapper">
                  <input
                    type="text"
                    className="comment-input"
                    placeholder="Write a comment..."
                    value={newComment[currentCommentsAssignment.id] || ''}
                    onChange={(e) => setNewComment(prev => ({
                      ...prev,
                      [currentCommentsAssignment.id]: e.target.value
                    }))}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        postComment(currentCommentsAssignment.id);
                      }
                    }}
                    disabled={isPostingComment[currentCommentsAssignment.id]}
                  />
                  <button
                    className="comment-submit-btn"
                    onClick={() => postComment(currentCommentsAssignment.id)}
                    disabled={!newComment[currentCommentsAssignment.id]?.trim() || isPostingComment[currentCommentsAssignment.id]}
                  >
                    {isPostingComment[currentCommentsAssignment.id] ? '...' : '➤'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
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
};

export default TasksTab;
