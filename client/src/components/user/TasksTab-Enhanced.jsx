import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '@/config/api';
import './css/TasksTab-Enhanced.css';
import './css/TasksTab-Comments.css';
import { FileIcon, FileOpenModal } from '../shared';
import SingleSelectTags from './SingleSelectTags';
import { LoadingTable, LoadingCards } from '../common/InlineSkeletonLoader';
import SuccessModal from './SuccessModal';

const TasksTab = ({ user }) => {
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [successModal, setSuccessModal] = useState({ isOpen: false, title: '', message: '', type: 'success' });
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [userFiles, setUserFiles] = useState([]);
  const [expandedComments, setExpandedComments] = useState({});
  const [comments, setComments] = useState({});
  const [newComment, setNewComment] = useState({});
  const [isPostingComment, setIsPostingComment] = useState({});
  const [replyingTo, setReplyingTo] = useState({});
  const [replyText, setReplyText] = useState({});
  const [isPostingReply, setIsPostingReply] = useState({});
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [currentCommentsAssignment, setCurrentCommentsAssignment] = useState(null);
  const [highlightCommentBy, setHighlightCommentBy] = useState(null); // Track who to highlight
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fileDescription, setFileDescription] = useState('');
  const [fileTag, setFileTag] = useState(''); // Add tag state
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [showReplies, setShowReplies] = useState({}); // Track which comments have visible replies renamed to visibleReplies
  const [visibleReplies, setVisibleReplies] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [showOpenFileModal, setShowOpenFileModal] = useState(false);
  const [fileToOpen, setFileToOpen] = useState(null);
  const [showAllFiles, setShowAllFiles] = useState({}); // Track which assignments show all files
  const [expandedCommentTexts, setExpandedCommentTexts] = useState({}); // Track which comment texts are expanded
  const [expandedReplyTexts, setExpandedReplyTexts] = useState({}); // Track which reply texts are expanded

  // Check for sessionStorage when component mounts - run ONCE when assignments first load
  useEffect(() => {
    const assignmentId = sessionStorage.getItem('scrollToAssignment');
    const highlightUser = sessionStorage.getItem('highlightCommentBy');

    // Only run if we have both the session data AND assignments have loaded
    if (assignmentId && assignments.length > 0) {
      console.log('📍 Found assignment to open:', assignmentId);
      console.log('📍 Found user to highlight:', highlightUser);

      // Clear the session storage immediately to prevent re-triggering
      sessionStorage.removeItem('scrollToAssignment');
      sessionStorage.removeItem('highlightCommentBy');

      // Find the assignment
      const assignment = assignments.find(a => a.id === parseInt(assignmentId));
      if (assignment) {
        console.log('✅ Assignment found, opening comments...');

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
        console.log('❌ Assignment not found in list');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments.length]); // Only re-run when assignments.length changes, not the entire array

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
              console.log(`📁 Assignment "${a.title}" has ${a.submitted_files.length} submitted file(s):`, a.submitted_files);
            } else {
              console.log(`ℹ️ Assignment "${a.title}" has no submitted files`);
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

  const toggleComments = (assignment) => {
    console.log('🔵 toggleComments called for:', assignment.title);
    setCurrentCommentsAssignment(assignment);
    setShowCommentsModal(true);
  };

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
        console.log('📁 All user files:', data.files);

        // Get all file IDs that are currently in ACTIVE assignment submissions
        const activeSubmittedFileIds = new Set();
        currentAssignments.forEach(assignment => {
          if (assignment.submitted_files && assignment.submitted_files.length > 0) {
            assignment.submitted_files.forEach(file => {
              activeSubmittedFileIds.add(file.id);
            });
          }
        });

        console.log('🔒 Files currently in active assignments:', Array.from(activeSubmittedFileIds));

        // Filter out ONLY files that are currently in active assignment submissions
        // This means completed/finished assignment files will show up again in "My Files"
        const unsubmittedFiles = data.files.filter(file =>
          !activeSubmittedFileIds.has(file.id)
        );

        console.log('📂 Available files (excluding active submissions):', unsubmittedFiles);
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

    const dueDate = new Date(assignment.due_date)
    const now = new Date()
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
          ⚠️ MISSING
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
          ⚠️ OVERDUE
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
          ⏰ PENDING
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
        setSuccessModal({ isOpen: true, title: 'Success', message: 'File removed successfully', type: 'success' });
        // Refresh assignments to update the UI
        await fetchAssignments();
      } else {
        setSuccessModal({ isOpen: true, title: 'Error', message: data.message || 'Failed to remove file', type: 'error' });
      }
    } catch (error) {
      console.error('Error removing file:', error);
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
      const replacedRejectedFiles = []; // Track which rejected files we're replacing

      // First, check for rejected files with the same name and delete them
      if (currentAssignment.submitted_files && currentAssignment.submitted_files.length > 0) {
        const rejectedFiles = currentAssignment.submitted_files.filter(
          file => file.status === 'rejected_by_team_leader' || file.status === 'rejected_by_admin'
        );

        if (rejectedFiles.length > 0) {
          console.log(`🔍 Found ${rejectedFiles.length} rejected file(s), checking for same names...`);

          // Check each new file against rejected files
          for (const fileObj of uploadedFiles) {
            const newFileName = fileObj.file.name;

            // Find rejected file with the same name
            const matchingRejectedFile = rejectedFiles.find(
              rejectedFile => rejectedFile.original_name === newFileName || rejectedFile.filename === newFileName
            );

            if (matchingRejectedFile) {
              console.log(`🗑️ Found matching rejected file: ${matchingRejectedFile.original_name} - will replace it`);
              replacedRejectedFiles.push(newFileName); // Track this as a revision

              try {
                const deleteResponse = await fetch(
                  `${API_BASE_URL}/api/assignments/${currentAssignment.id}/files/${matchingRejectedFile.id}`,
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
                  console.log(`✅ Deleted rejected file: ${matchingRejectedFile.original_name}`);
                } else {
                  console.warn(`⚠️ Could not delete rejected file ${matchingRejectedFile.original_name}:`, deleteData.message);
                }
              } catch (deleteError) {
                console.error(`❌ Error deleting rejected file ${matchingRejectedFile.id}:`, deleteError);
                // Continue with upload even if delete fails
              }
            } else {
              console.log(`ℹ️ No matching rejected file found for: ${newFileName}`);
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
        formData.append('description', fileDescription || '');
        formData.append('tag', fileTag || '');

        // Mark as revision if this file replaced a rejected one
        const isRevision = replacedRejectedFiles.includes(fileObj.file.name);
        formData.append('isRevision', isRevision.toString());
        // IMPORTANT: Set replaceExisting=true to automatically replace duplicate files
        formData.append('replaceExisting', 'true');

        if (isRevision) {
          console.log(`📝 Marking ${fileObj.file.name} as REVISION`);
        }

        const uploadResponse = await fetch(`${API_BASE_URL}/api/files/upload`, {
          method: 'POST',
          body: formData
        });

        const uploadData = await uploadResponse.json();

        if (uploadData.success) {
          uploadedFileIds.push(uploadData.file.id);
          console.log(`✅ Uploaded file: ${fileObj.file.name} with ID: ${uploadData.file.id}`);
        } else {
          uploadErrors.push(`${fileObj.file.name}: ${uploadData.message}`);
          console.error(`❌ Failed to upload ${fileObj.file.name}:`, uploadData.message);
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
          console.log(`✅ Submitted file ID ${fileId} to assignment ${currentAssignment.id}`);
        } else {
          submissionErrors.push(`File ID ${fileId}: ${submitData.message}`);
          console.error(`❌ Failed to submit file ID ${fileId}:`, submitData.message);
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

  // Treat assignments with deleted files as pending (allow resubmission)
  const pendingAssignments = assignments.filter(assignment =>
    assignment.user_status !== 'submitted' ||
    (assignment.user_status === 'submitted' && !assignment.submitted_file_id)
  );
  const submittedAssignments = assignments.filter(assignment =>
    assignment.user_status === 'submitted' && assignment.submitted_file_id
  );

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
            const isCommentsExpanded = expandedComments[assignment.id];

            return (
              <div
                key={assignment.id}
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
                            color: '#DC2626',
                            fontWeight: '400',
                            marginLeft: '4px'
                          }}>
                            ({Math.abs(daysLeft)} days overdue)
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
                {assignment.attachments && assignment.attachments.length > 0 && (
                  <div style={{ padding: '8px 0px', marginBottom: '16px' }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      📎 Attached Files ({assignment.attachments.length})
                    </div>
                    {assignment.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        onClick={() => confirmOpenFile(attachment)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '20px',
                          gap: '12px',
                          border: '1px solid #9CA3AF',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          marginBottom: '8px',
                          transition: 'background-color 0.2s ease',
                          backgroundColor: 'transparent'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(156, 163, 175, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div style={{ flexShrink: 0 }}>
                          <FileIcon
                            fileType={attachment.original_name.split('.').pop()}
                            size="small"
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '500', color: '#1c1e21', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {attachment.original_name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#65676b', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <span>by <span style={{ color: '#1877f2', fontWeight: '600' }}>
                              {assignment.team_leader_fullname || assignment.team_leader_username || 'Team Leader'}
                            </span></span>
                            <span>{formatFileSize(attachment.file_size)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

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

                      // Show only first 5 files unless "see more" is clicked
                      const filesToShow = showAllFiles[assignment.id]
                        ? sortedFiles
                        : sortedFiles.slice(0, 5);

                      return (
                        <>
                          {filesToShow.map((file, index) => {
                            // Log file status for debugging
                            console.log(`File "${file.original_name || file.filename}" has status: "${file.status}"`);

                            return (
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
                                  <div
                                    style={{
                                      flexShrink: 0
                                    }}
                                  >
                                    <FileIcon
                                      fileType={(file.original_name || file.filename || 'file').split('.').pop().toLowerCase()}
                                      isFolder={false}
                                      size="default"
                                      style={{
                                        width: '48px',
                                        height: '48px'
                                      }}
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
                                      {file.tag && (
                                        <>
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
                                            <span>🏷️</span> {file.tag}
                                          </span>
                                        </>
                                      )}
                                      {file.status === 'under_revision' && (
                                        <span style={{
                                          backgroundColor: '#fef3c7',
                                          color: '#92400e',
                                          padding: '3px 10px',
                                          borderRadius: '4px',
                                          fontSize: '11px',
                                          fontWeight: '600',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px'
                                        }}>
                                          📝 REVISED
                                        </span>
                                      )}
                                      {file.status === 'approved_by_team_leader' && (
                                        <span style={{
                                          backgroundColor: '#dcfce7',
                                          color: '#166534',
                                          padding: '3px 10px',
                                          borderRadius: '4px',
                                          fontSize: '11px',
                                          fontWeight: '600',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px'
                                        }}>
                                          ✓ APPROVED
                                        </span>
                                      )}
                                      {(file.status === 'rejected_by_team_leader' || file.status === 'rejected_by_admin') && (
                                        <span style={{
                                          backgroundColor: '#fee2e2',
                                          color: '#991b1b',
                                          padding: '3px 10px',
                                          borderRadius: '4px',
                                          fontSize: '11px',
                                          fontWeight: '600',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px'
                                        }}>
                                          ✗ REJECTED
                                        </span>
                                      )}
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
                                      fontSize: '20px',
                                      cursor: 'pointer',
                                      flexShrink: 0,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'all 0.2s',
                                      lineHeight: 1
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
                            );
                          })}

                          {/* See More / See Less Button */}
                          {sortedFiles.length > 5 && (
                            <button
                              className="see-more-files-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowAllFiles(prev => ({
                                  ...prev,
                                  [assignment.id]: !prev[assignment.id]
                                }));
                              }}
                            >
                              {showAllFiles[assignment.id] ? (
                                <span>See less</span>
                              ) : (
                                <span>See more ({sortedFiles.length - 5} more files)</span>
                              )}
                            </button>
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
                    <span style={{ fontSize: '20px', flexShrink: 0 }}>ℹ️</span>
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
                          transition: 'all 0.2s',
                          outline: 'none',
                          gap: '12px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#e5e7eb';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#f3f4f6';
                        }}
                      >
                        <span className="submit-button-label" style={{
                          backgroundColor: assignment.user_status === 'submitted' && assignment.submitted_file_id ? '#10b981' : '#000000',
                          padding: '6px 16px',
                          borderRadius: '4px',
                          fontSize: '14px',
                          fontWeight: '500',
                          whiteSpace: 'nowrap'
                        }}>
                          {assignment.user_status === 'submitted' && assignment.submitted_file_id ? 'Add more files' : 'Submit file'}
                        </span>
                        <span style={{ fontSize: '14px', color: '#6b7280' }}>
                          {assignment.user_status === 'submitted' && assignment.submitted_file_id
                            ? 'Upload additional files'
                            : (assignment.user_status === 'submitted' && !assignment.submitted_file_id
                              ? 'File was deleted - resubmit'
                              : 'No file attached')}
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
          <div className="tasks-empty-icon">📋</div>
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
                  <p>💬 No comments yet. Be the first to comment!</p>
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
                <span style={{ fontSize: '24px' }}>⚠️</span>
                Remove File
              </h3>
              <button className="tasks-modal-close" onClick={() => setShowDeleteModal(false)}>×</button>
            </div>

            <div className="tasks-modal-body">
              <div style={{ padding: '20px 0' }}>
                <p style={{ fontSize: '15px', color: '#374151', marginBottom: '16px', lineHeight: '1.6' }}>
                  Are you sure you want to remove this file from the submission?
                </p>
                <div style={{
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>📄</span>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#991b1b' }}>
                      {fileToDelete.fileName}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                  This action cannot be undone.
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
                onClick={() => handleRemoveSubmittedFile(fileToDelete.assignmentId, fileToDelete.fileId)}
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
                <span>🗑️</span>
                Remove File
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
        <div className="tasks-modal-overlay" onClick={() => setShowSubmitModal(false)}>
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
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files);
                        if (files.length > 0) {
                          const newFiles = files.map(file => ({
                            file: file
                          }));
                          setUploadedFiles(prev => [...prev, ...newFiles]);
                        }
                        // Clear input so same files can be added again if needed
                        e.target.value = '';
                      }}
                      className="file-input"
                      id="file-upload-input"
                      disabled={isUploading}
                    />
                    <label htmlFor="file-upload-input" className="file-upload-label" style={{
                      border: '2px dashed #d1d5db',
                      borderRadius: '12px',
                      padding: '32px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      backgroundColor: '#fafafa'
                    }}>
                      <div className="file-upload-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <div style={{ fontSize: '48px' }}>📁</div>
                        <div className="upload-text">
                          <p style={{ fontSize: '15px', fontWeight: '500', color: '#111827', margin: '0 0 4px 0' }}>Click to browse or drag and drop</p>
                          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>All file types • No size limit • Multiple files</p>
                        </div>
                      </div>
                    </label>
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
                        📎 Selected Files ({uploadedFiles.length})
                      </label>
                    </div>
                    {uploadedFiles.map((fileObj, index) => (
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
                    ))}

                    {/* Single Tag field for all files */}
                    <div style={{ marginTop: '24px', marginBottom: '16px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#111827' }}>
                        🏷️ Tag
                      </label>
                      <SingleSelectTags
                        selectedTag={fileTag}
                        onChange={(newTag) => setFileTag(newTag)}
                        disabled={isUploading}
                        user={user}
                      />

                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#111827', marginTop: '16px' }}>
                        📝 Description (optional)
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
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
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
                    <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
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
