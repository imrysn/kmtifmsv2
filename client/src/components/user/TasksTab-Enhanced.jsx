import { useState, useEffect, useRef } from 'react';
import './css/TasksTab-Enhanced.css';
import FileIcon from '../admin/FileIcon';
import SingleSelectTags from './SingleSelectTags';

const TasksTab = ({ user }) => {
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileDescription, setFileDescription] = useState('');
  const [fileTag, setFileTag] = useState(''); // Add tag state
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [showReplies, setShowReplies] = useState({}); // Track which comments have visible replies

  // Check for sessionStorage when component mounts or becomes visible
  useEffect(() => {
    const checkAndOpenComments = () => {
      const assignmentId = sessionStorage.getItem('scrollToAssignment');
      const highlightUser = sessionStorage.getItem('highlightCommentBy');
      
      if (assignmentId && assignments.length > 0) {
        console.log('📍 Found assignment to open:', assignmentId);
        console.log('📍 Found user to highlight:', highlightUser);
        
        // Clear the session storage immediately
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
    };

    // Check immediately when assignments are loaded
    if (assignments.length > 0) {
      checkAndOpenComments();
    }
  }, [assignments]);

  useEffect(() => {
    fetchAssignments();
    fetchUserFiles();
  }, [user.id]);

  const fetchAssignments = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`http://localhost:3001/api/assignments/user/${user.id}`);
      const data = await response.json();

      if (data.success) {
        console.log('Fetched assignments:', data.assignments);
        console.log('Current user ID:', user.id);
        if (data.assignments.length > 0) {
          console.log('First assignment data:', data.assignments[0]);
          console.log('assigned_member_details:', data.assignments[0].assigned_member_details);
          console.log('assigned_member_details IDs:', data.assignments[0].assigned_member_details?.map(m => m.id));
          console.log('assigned_to:', data.assignments[0].assigned_to);
          // Check if user should see submit button
          const firstAssignment = data.assignments[0];
          const canSubmit = firstAssignment.assigned_to === 'all' || 
            (firstAssignment.assigned_member_details && firstAssignment.assigned_member_details.some(member => member.id === user.id));
          console.log('Can submit first assignment?', canSubmit);
          console.log('User status:', firstAssignment.user_status);
          console.log('Submitted file ID:', firstAssignment.submitted_file_id);
          // Log submitted assignments to check file data
          const submittedOnes = data.assignments.filter(a => a.user_status === 'submitted');
          if (submittedOnes.length > 0) {
            console.log('🔍 Submitted assignments:', submittedOnes);
            submittedOnes.forEach(a => {
              console.log(`Assignment "${a.title}":`, {
                submitted_file_id: a.submitted_file_id,
                submitted_file_name: a.submitted_file_name,
                submitted_file_path: a.submitted_file_path,
                user_submitted_at: a.user_submitted_at
              });
            });
          }
        }
        setAssignments(data.assignments || []);
        // Fetch comments for each assignment
        data.assignments.forEach(assignment => {
          fetchComments(assignment.id);
        });
      } else {
        setError('Failed to fetch assignments');
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchComments = async (assignmentId) => {
    try {
      const response = await fetch(`http://localhost:3001/api/assignments/${assignmentId}/comments`);
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
      const response = await fetch(`http://localhost:3001/api/assignments/${assignmentId}/comments`, {
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
        setError('Failed to post comment');
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      setError('Failed to post comment');
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
      const response = await fetch(`http://localhost:3001/api/assignments/${assignmentId}/comments/${commentId}/replies`, {
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
      
      if (data.success) {
        setReplyText(prev => ({ ...prev, [commentId]: '' }));
        setReplyingTo(prev => ({ ...prev, [commentId]: false }));
        fetchComments(assignmentId);
      } else {
        setError('Failed to post reply');
      }
    } catch (error) {
      console.error('Error posting reply:', error);
      setError('Failed to post reply');
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

  const toggleShowReplies = (commentId) => {
    setShowReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  const fetchUserFiles = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/files/user/${user.id}`);
      const data = await response.json();

      if (data.success) {
        console.log('📁 All user files:', data.files);
        const approvedFiles = data.files.filter(f => f.status === 'final_approved');
        console.log('✅ Final approved files:', approvedFiles);
        const unsubmittedFiles = data.files.filter(file =>
          !assignments.some(assignment => assignment.submitted_file_id === file.id)
        );
        console.log('📂 Unsubmitted files:', unsubmittedFiles);
        setUserFiles(unsubmittedFiles || []);
      }
    } catch (error) {
      console.error('Error fetching user files:', error);
    }
  };

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
    const dueDate = new Date(assignment.due_date)
    const now = new Date()
    const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24))

    if (assignment.user_status === 'submitted') {
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
    setUploadedFile(null);
    setFileDescription('');
    setFileTag(''); // Reset tag
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setShowSubmitModal(true);
  };

  const handleFileUpload = async () => {
    if (!uploadedFile || !currentAssignment) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('userId', user.id);
      formData.append('username', user.username);
      formData.append('fullName', user.fullName);
      formData.append('userTeam', user.team);
      formData.append('description', fileDescription);
      formData.append('tag', fileTag); // Add tag

      const uploadResponse = await fetch('http://localhost:3001/api/files/upload', {
        method: 'POST',
        body: formData
      });

      const uploadData = await uploadResponse.json();

      if (uploadData.success) {
        // Now submit the assignment with the newly uploaded file
        const submitResponse = await fetch('http://localhost:3001/api/assignments/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            assignmentId: currentAssignment.id,
            userId: user.id,
            fileId: uploadData.file.id
          })
        });

        const submitData = await submitResponse.json();

        if (submitData.success) {
          setSuccess('File uploaded and assignment submitted successfully!');
          setShowSubmitModal(false);
          setUploadedFile(null);
          setFileDescription('');
          setFileTag(''); // Reset tag
          setCurrentAssignment(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          fetchAssignments();
          fetchUserFiles();
          
          setTimeout(() => setSuccess(''), 5000);
        } else {
          setError(submitData.message || 'Failed to submit assignment');
        }
      } else {
        setError(uploadData.message || 'Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setError('Failed to upload file');
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

  const clearMessages = () => {
    setError('');
    setSuccess('');
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

      {/* Alerts */}
      {error && (
        <div className="tasks-alert tasks-alert-error">
          <span>{error}</span>
          <button onClick={clearMessages} className="tasks-alert-close">×</button>
        </div>
      )}
      {success && (
        <div className="tasks-alert tasks-alert-success">
          <span>{success}</span>
          <button onClick={clearMessages} className="tasks-alert-close">×</button>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="tasks-loading">
          <div className="tasks-spinner"></div>
          <p>Loading assignments...</p>
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
                      {getInitials(assignment.team_leader_username)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '600', fontSize: '15px', color: '#050505' }}>
                          {assignment.team_leader_username}
                        </span>
                        {assignment.assigned_to === 'all' ? (
                          <span style={{ fontSize: '15px', color: '#050505' }}>
                            Assigned to: <span style={{ fontWeight: '600' }}>all team members</span>
                          </span>
                        ) : assignment.assigned_member_details && assignment.assigned_member_details.length > 0 ? (
                          <span style={{ fontSize: '15px', color: '#050505' }}>
                            Assigned to: <span style={{ fontWeight: '600' }}>
                              {assignment.assigned_member_details.map((member, idx) => (
                                <span key={member.id}>
                                  {member.fullName || member.username}
                                  {idx < assignment.assigned_member_details.length - 1 && ', '}
                                </span>
                              ))}
                            </span>
                          </span>
                        ) : assignment.assigned_user_fullname && (
                          <span style={{ fontSize: '15px', color: '#050505' }}>
                            Assigned to: <span style={{ fontWeight: '600' }}>{assignment.assigned_user_fullname}</span>
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '13px', color: '#6B7280' }}>
                        {formatDateTime(assignment.created_at)}
                      </div>
                    </div>
                  </div>
                  {/* Show due date at top right */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px' }}>📅</span>
                      <span style={{ fontSize: '14px', color: '#374151' }}>
                        Due: {assignment.due_date ? formatDate(assignment.due_date) : 'No due date'}
                        {daysLeft !== null && (
                          <span style={{ 
                            color: daysLeft < 0 ? '#DC2626' : daysLeft <= 2 ? '#EA580C' : '#059669',
                            fontWeight: '600',
                            marginLeft: '4px'
                          }}>
                            {getDaysText(assignment)}
                          </span>
                        )}
                      </span>
                    </div>
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

                {/* Status badge and warning */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  {getStatusBadge(assignment)}
                  {assignment.user_status === 'submitted' && !assignment.submitted_file_id && (
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
                      ⚠️ FILE DELETED
                    </span>
                  )}
                </div>

                {/* Submitted File Display - Only show if file still exists */}
                {assignment.user_status === 'submitted' && assignment.submitted_file_id && (assignment.submitted_file_name || assignment.submitted_file_id) && (
                  <div 
                    onClick={async () => {
                      try {
                        // Check if running in Electron
                        if (window.electron && window.electron.openFileInApp) {
                          // Get the actual file path from server
                          const response = await fetch(`http://localhost:3001/api/files/${assignment.submitted_file_id}/path`);
                          const data = await response.json();
                          
                          if (data.success && data.filePath) {
                            // Open file with system default application
                            const result = await window.electron.openFileInApp(data.filePath);
                            
                            if (!result.success) {
                              setError(result.error || 'Failed to open file with system application');
                            }
                          } else {
                            throw new Error('Could not get file path');
                          }
                        } else {
                          // In browser - get file path and open in new tab
                          const response = await fetch(`http://localhost:3001/api/files/${assignment.submitted_file_id}`);
                          const fileData = await response.json();
                          
                          if (fileData.success && fileData.file) {
                            const fileUrl = `http://localhost:3001${fileData.file.file_path}`;
                            window.open(fileUrl, '_blank', 'noopener,noreferrer');
                          } else {
                            throw new Error('Could not get file information');
                          }
                        }
                      } catch (error) {
                        console.error('Error opening file:', error);
                        setError('Failed to open file. Please try again.');
                      }
                    }}
                    style={{
                      backgroundColor: '#f0f7ff',
                      border: '1px solid #e3f2fd',
                      borderRadius: '8px',
                      padding: '12px',
                      marginBottom: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#e3f2fd';
                      e.currentTarget.style.borderColor = '#2196F3';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f0f7ff';
                      e.currentTarget.style.borderColor = '#e3f2fd';
                    }}
                  >
                    <div style={{ 
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#1565c0',
                      marginBottom: '8px'
                    }}>
                      📎 Submit File:
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}>
                      <FileIcon 
                        fileType={(assignment.submitted_file_name || 'file').split('.').pop().toLowerCase()} 
                        isFolder={false}
                        size="default"
                        style={{
                          width: '40px',
                          height: '40px',
                          flexShrink: 0
                        }}
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
                          {assignment.submitted_file_name || 'Submitted File'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span>Submitted on {assignment.user_submitted_at ? formatDate(assignment.user_submitted_at) : 'N/A'}</span>
                          {assignment.submitted_file_tag && (
                            <span style={{
                              backgroundColor: '#e0f2fe',
                              color: '#0369a1',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600'
                            }}>
                              🏷️ {assignment.submitted_file_tag}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Message when submitted file was deleted */}
                {assignment.user_status === 'submitted' && !assignment.submitted_file_id && (
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
                    <span style={{ fontSize: '20px', flexShrink: 0 }}>⚠️</span>
                    <div style={{ fontSize: '14px', color: '#92400E', lineHeight: '1.5' }}>
                      <strong>Your submitted file was deleted.</strong>
                      <br />
                      Please upload a new file to resubmit this assignment.
                    </div>
                  </div>
                )}

                {/* Submit button - Show only if user is assigned AND (pending OR file was deleted) */}
                {(assignment.assigned_to === 'all' || 
                 (assignment.assigned_member_details && assignment.assigned_member_details.some(member => member.id === user.id))) && 
                 (assignment.user_status !== 'submitted' || (assignment.user_status === 'submitted' && !assignment.submitted_file_id)) && (
                  <div style={{ paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>
                    {/* Attached Files button */}
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
                      <span style={{
                        backgroundColor: '#000000',
                        color: '#ffffff',
                        padding: '6px 16px',
                        borderRadius: '4px',
                        fontSize: '14px',
                        fontWeight: '500',
                        whiteSpace: 'nowrap'
                      }}>
                        Submit file
                      </span>
                      <span style={{ fontSize: '14px', color: '#6b7280' }}>
                        No file attached
                      </span>
                    </button>
                  </div>
                )}

                {/* Comment toggle */}
                <div style={{ marginTop: '12px' }}>
                  <button 
                    onClick={() => toggleComments(assignment)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#6B7280',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 0'
                    }}
                  >
                    💬 Comment ({assignmentComments.length})
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

      {/* Comments Modal */}
      {showCommentsModal && currentCommentsAssignment && (
        <div className="tasks-modal-overlay" onClick={() => setShowCommentsModal(false)}>
          <div className="tasks-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="tasks-modal-header">
              <h3>Comments - {currentCommentsAssignment.title}</h3>
              <button className="tasks-modal-close" onClick={() => setShowCommentsModal(false)}>×</button>
            </div>

            <div className="tasks-modal-body" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {/* Comments Section */}
              <div className="comments-section">
                {comments[currentCommentsAssignment.id]?.length > 0 ? (
                  <div className="comments-list">
                    {comments[currentCommentsAssignment.id].map((comment) => {
                      // Check if this comment should be highlighted
                      const shouldHighlight = highlightCommentBy && comment.username === highlightCommentBy;
                      
                      return (
                      <div 
                        key={comment.id} 
                        className="comment-item"
                      >
                        <div className="comment-avatar">
                          {getInitials(comment.username)}
                        </div>
                        <div className="comment-content">
                          <div className="comment-bubble">
                            <div className="comment-author">{comment.username}</div>
                            <div className="comment-text">{comment.comment}</div>
                          </div>
                          <div className="comment-actions">
                            <span className="comment-timestamp">{formatRelativeTime(comment.created_at)}</span>
                            <button 
                              className="comment-action-btn"
                              onClick={() => toggleReplyBox(comment.id)}
                            >
                              Reply
                            </button>
                            {comment.replies && comment.replies.length > 0 && (
                              <button 
                                className="comment-action-btn view-replies-btn"
                                onClick={() => toggleShowReplies(comment.id)}
                              >
                                {showReplies[comment.id] 
                                  ? 'Hide replies' 
                                  : `View ${comment.replies.length} ${comment.replies.length === 1 ? 'reply' : 'replies'}`
                                }
                              </button>
                            )}
                          </div>

                          {/* Replies */}
                          {showReplies[comment.id] && comment.replies && comment.replies.length > 0 && (
                            <div className="replies-list">
                              {comment.replies.map((reply) => {
                                // Check if this reply should be highlighted
                                const shouldHighlightReply = highlightCommentBy && reply.username === highlightCommentBy;
                                
                                return (
                                <div 
                                  key={reply.id} 
                                  className="reply-item"
                                >
                                  <div className="comment-avatar reply-avatar">
                                    {getInitials(reply.username)}
                                  </div>
                                  <div className="comment-content">
                                    <div className="comment-bubble">
                                      <div className="comment-author">{reply.username}</div>
                                      <div className="comment-text">{reply.reply}</div>
                                    </div>
                                    <div className="comment-timestamp">
                                      {formatRelativeTime(reply.created_at)}
                                    </div>
                                  </div>
                                </div>
                              )})}
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
                      </div>
                    )})}  
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6B7280' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
                    <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>No comments yet</p>
                    <p style={{ fontSize: '14px' }}>Be the first to comment on this task</p>
                  </div>
                )}

                {/* Add Comment */}
                <div className="add-comment" style={{ marginTop: '20px', borderTop: '1px solid #E5E7EB', paddingTop: '20px' }}>
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
        </div>
      )}

      {/* Submit Modal */}
      {showSubmitModal && currentAssignment && (
        <div className="tasks-modal-overlay" onClick={() => setShowSubmitModal(false)}>
          <div className="tasks-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tasks-modal-header">
              <h3>Submit Task</h3>
              <button className="tasks-modal-close" onClick={() => setShowSubmitModal(false)}>×</button>
            </div>

            <div className="tasks-modal-body">
              <div className="tasks-assignment-info">
                <h4 className="tasks-assignment-title">{currentAssignment.title}</h4>
                {currentAssignment.description && (
                  <p className="tasks-assignment-description">{currentAssignment.description}</p>
                )}
              </div>

              {/* Upload file section */}
              <div className="tasks-file-selection">
                  <h4 className="tasks-selection-title">Upload a new file:</h4>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: '#101828' }}>
                      Select File:
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setUploadedFile(file);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px dashed #d1d5db',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        backgroundColor: '#f9fafb'
                      }}
                      disabled={isUploading}
                    />
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                      <p style={{ margin: '4px 0' }}>All file types are supported</p>
                      <p style={{ margin: '4px 0' }}>No file size limit</p>
                    </div>
                  </div>

                  {uploadedFile && (
                    <div style={{
                      padding: '12px',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <FileIcon 
                        fileType={uploadedFile.name.split('.').pop().toLowerCase()} 
                        isFolder={false}
                        size="default"
                        style={{
                          width: '40px',
                          height: '40px',
                          flexShrink: 0
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', fontSize: '14px', color: '#101828' }}>
                          {uploadedFile.name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6B7280' }}>
                          {formatFileSize(uploadedFile.size)}
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: '#101828' }}>
                      Tag:
                    </label>
                    <SingleSelectTags 
                      selectedTag={fileTag}
                      onChange={setFileTag}
                      disabled={isUploading}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: '#101828' }}>
                      Description (optional):
                    </label>
                    <textarea
                      className="file-description-textarea"
                      value={fileDescription}
                      onChange={(e) => setFileDescription(e.target.value)}
                      placeholder="Provide a brief description of this file..."
                      rows="3"
                      disabled={isUploading}
                    />
                  </div>
                </div>
            </div>

            <div className="tasks-modal-footer">
              <button
                className="tasks-btn tasks-btn-cancel"
                onClick={() => {
                  setShowSubmitModal(false);
                  setUploadedFile(null);
                  setFileDescription('');
                  setFileTag(''); // Reset tag
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              >
                Cancel
              </button>
              <button
                className="tasks-btn tasks-btn-submit"
                onClick={handleFileUpload}
                disabled={!uploadedFile || isUploading}
              >
                {isUploading ? 'Uploading & Submitting...' : 'Upload & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksTab;
