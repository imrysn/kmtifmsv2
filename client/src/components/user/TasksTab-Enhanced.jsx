import { useState, useEffect, useRef } from 'react';
import './css/TasksTab-Enhanced.css';
import FileIcon from '../admin/FileIcon';

const TasksTab = ({ user }) => {
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [userFiles, setUserFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedComments, setExpandedComments] = useState({});
  const [comments, setComments] = useState({});
  const [newComment, setNewComment] = useState({});
  const [isPostingComment, setIsPostingComment] = useState({});
  const [replyingTo, setReplyingTo] = useState({});
  const [replyText, setReplyText] = useState({});
  const [isPostingReply, setIsPostingReply] = useState({});
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [currentCommentsAssignment, setCurrentCommentsAssignment] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileDescription, setFileDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadSection, setShowUploadSection] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchAssignments();
    fetchUserFiles();

    // Poll for new assignments every 10 seconds
    const pollInterval = setInterval(() => {
      fetchAssignments();
    }, 10000);

    return () => clearInterval(pollInterval);
  }, [user.id]);

  const fetchAssignments = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`http://localhost:3001/api/assignments/user/${user.id}`);
      const data = await response.json();

      if (data.success) {
        console.log('Fetched assignments:', data.assignments);
        if (data.assignments.length > 0) {
          console.log('First assignment data:', data.assignments[0]);
          console.log('assigned_member_details:', data.assignments[0].assigned_member_details);
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

  const fetchUserFiles = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/files/user/${user.id}`);
      const data = await response.json();

      if (data.success) {
        const unsubmittedFiles = data.files.filter(file =>
          !assignments.some(assignment => assignment.submitted_file_id === file.id)
        );
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
    setSelectedFile(null);
    setUploadedFile(null);
    setFileDescription('');
    setShowUploadSection(false);
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
          setSelectedFile(null);
          setCurrentAssignment(null);
          setShowUploadSection(false);
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

  const submitAssignment = async () => {
    if (!currentAssignment || !selectedFile) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('http://localhost:3001/api/assignments/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assignmentId: currentAssignment.id,
          userId: user.id,
          fileId: selectedFile.id
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Assignment submitted successfully!');
        setShowSubmitModal(false);
        setSelectedFile(null);
        setCurrentAssignment(null);
        fetchAssignments();
        fetchUserFiles();
        
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError(data.message || 'Failed to submit assignment');
      }
    } catch (error) {
      console.error('Error submitting assignment:', error);
      setError('Failed to submit assignment');
    } finally {
      setIsSubmitting(false);
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

  const pendingAssignments = assignments.filter(assignment => assignment.user_status !== 'submitted');
  const submittedAssignments = assignments.filter(assignment => assignment.user_status === 'submitted');

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

      {/* Statistics Cards */}
      <div className="tasks-stats">
        <div className="tasks-stat-card tasks-stat-pending">
          <div className="tasks-stat-icon">⏱</div>
          <div className="tasks-stat-info">
            <div className="tasks-stat-number">{pendingAssignments.length}</div>
            <div className="tasks-stat-label">Pending</div>
          </div>
        </div>

        <div className="tasks-stat-card tasks-stat-submitted">
          <div className="tasks-stat-icon">✓</div>
          <div className="tasks-stat-info">
            <div className="tasks-stat-number">{submittedAssignments.length}</div>
            <div className="tasks-stat-label">Submitted</div>
          </div>
        </div>
      </div>

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
                  {getStatusBadge(assignment)}
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

                {/* Submitted File Display */}
                {assignment.user_status === 'submitted' && assignment.submitted_file_name && (
                  <div style={{
                    backgroundColor: '#F9FAFB',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <FileIcon 
                      fileType={assignment.submitted_file_name.split('.').pop().toLowerCase()} 
                      isFolder={false}
                      size="default"
                      style={{
                        width: '40px',
                        height: '40px'
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: '#101828', marginBottom: '2px' }}>
                        {assignment.submitted_file_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>
                        Submitted on {assignment.user_submitted_at ? formatDate(assignment.user_submitted_at) : 'N/A'}
                      </div>
                    </div>
                    <div style={{
                      padding: '4px 8px',
                      backgroundColor: '#DBEAFE',
                      color: '#1E40AF',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      Attached
                    </div>
                  </div>
                )}

                {/* Due date and max size */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>💾</span>
                    <span style={{ fontSize: '14px', color: '#374151' }}>
                      Max: {assignment.max_file_size ? formatFileSize(assignment.max_file_size) : '10 MB'}
                    </span>
                  </div>
                </div>

                {/* Submit button */}
                {assignment.user_status !== 'submitted' && (
                  <div style={{ paddingTop: '16px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => handleSubmit(assignment)}
                      disabled={userFiles.filter(f => f.status === 'final_approved').length === 0}
                      style={{
                        backgroundColor: '#2563EB',
                        color: 'white',
                        padding: '10px 24px',
                        borderRadius: '8px',
                        border: 'none',
                        fontWeight: '600',
                        fontSize: '14px',
                        cursor: 'pointer',
                        maxWidth: '200px',
                        transition: 'background-color 0.2s',
                        opacity: userFiles.filter(f => f.status === 'final_approved').length === 0 ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (userFiles.filter(f => f.status === 'final_approved').length > 0) {
                          e.target.style.backgroundColor = '#1D4ED8'
                        }
                      }}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#2563EB'}
                    >
                      Submit Task
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
                    {comments[currentCommentsAssignment.id].map((comment) => (
                      <div key={comment.id} className="comment-item">
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
                          </div>

                          {/* Replies */}
                          {comment.replies && comment.replies.length > 0 && (
                            <div className="replies-list">
                              {comment.replies.map((reply) => (
                                <div key={reply.id} className="reply-item">
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
                      </div>
                    ))}
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

              {/* Toggle between Upload and Select existing file */}
              <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', borderBottom: '2px solid #e4e6eb' }}>
                <button
                  onClick={() => setShowUploadSection(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: !showUploadSection ? '#fff' : 'transparent',
                    border: 'none',
                    borderBottom: !showUploadSection ? '2px solid #2563EB' : '2px solid transparent',
                    marginBottom: '-2px',
                    color: !showUploadSection ? '#2563EB' : '#6B7280',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Select Existing File
                </button>
                <button
                  onClick={() => setShowUploadSection(true)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: showUploadSection ? '#fff' : 'transparent',
                    border: 'none',
                    borderBottom: showUploadSection ? '2px solid #2563EB' : '2px solid transparent',
                    marginBottom: '-2px',
                    color: showUploadSection ? '#2563EB' : '#6B7280',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Upload New File
                </button>
              </div>

              {!showUploadSection ? (
                <div className="tasks-file-selection">
                  <h4 className="tasks-selection-title">Select a file to submit:</h4>
                  {userFiles.filter(f => f.status === 'final_approved').length > 0 ? (
                    <div className="tasks-file-list">
                      {userFiles
                        .filter(f => f.status === 'final_approved')
                        .map((file) => (
                          <div
                            key={file.id}
                            className={`tasks-file-item ${selectedFile?.id === file.id ? 'selected' : ''}`}
                            onClick={() => setSelectedFile(file)}
                          >
                            <FileIcon 
                              fileType={file.original_name.split('.').pop().toLowerCase()} 
                              isFolder={false}
                              size="default"
                              style={{
                                width: '40px',
                                height: '40px',
                                flexShrink: 0
                              }}
                            />
                            <div className="tasks-file-details">
                              <div className="tasks-file-name">{file.original_name}</div>
                              <div className="tasks-file-meta">
                                {formatFileSize(file.file_size)} • {formatDate(file.uploaded_at)}
                              </div>
                            </div>
                            <div className="tasks-radio">
                              {selectedFile?.id === file.id && <div className="tasks-radio-dot"></div>}
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="tasks-no-files">
                      <p>You don't have any approved files yet.</p>
                      <p>Upload a new file using the "Upload New File" tab above.</p>
                    </div>
                  )}
                </div>
              ) : (
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

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: '#101828' }}>
                      Description (optional):
                    </label>
                    <textarea
                      value={fileDescription}
                      onChange={(e) => setFileDescription(e.target.value)}
                      placeholder="Provide a brief description of this file..."
                      rows="3"
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        resize: 'vertical'
                      }}
                      disabled={isUploading}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="tasks-modal-footer">
              <button
                className="tasks-btn tasks-btn-cancel"
                onClick={() => {
                  setShowSubmitModal(false);
                  setUploadedFile(null);
                  setFileDescription('');
                  setShowUploadSection(false);
                }}
              >
                Cancel
              </button>
              {showUploadSection ? (
                <button
                  className="tasks-btn tasks-btn-submit"
                  onClick={handleFileUpload}
                  disabled={!uploadedFile || isUploading}
                >
                  {isUploading ? 'Uploading & Submitting...' : 'Upload & Submit'}
                </button>
              ) : (
                <button
                  className="tasks-btn tasks-btn-submit"
                  onClick={submitAssignment}
                  disabled={!selectedFile || isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksTab;
