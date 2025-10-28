import { useState, useEffect } from 'react';
import './css/TasksTab-Enhanced.css';

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

  useEffect(() => {
    fetchAssignments();
    fetchUserFiles();
  }, []);

  const fetchAssignments = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`http://localhost:3001/api/assignments/user/${user.id}`);
      const data = await response.json();

      if (data.success) {
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
        // Clear input
        setNewComment(prev => ({ ...prev, [assignmentId]: '' }));
        // Refresh comments
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

  const toggleComments = (assignmentId) => {
    setExpandedComments(prev => ({
      ...prev,
      [assignmentId]: !prev[assignmentId]
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
    // Handle usernames with dots (e.g., team.leader -> TL)
    if (name.includes('.')) {
      const parts = name.split('.');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
    }
    // Handle names with spaces
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

  const getStatusInfo = (assignment) => {
    if (assignment.user_status === 'submitted') {
      return { text: 'PENDING', icon: '⏳', class: 'status-pending-review' };
    } else if (isOverdue(assignment.due_date)) {
      return { text: 'OVERDUE', icon: '⚠️', class: 'status-overdue' };
    } else {
      const days = getDaysUntilDue(assignment.due_date);
      if (days !== null && days <= 2) {
        return { text: 'DUE SOON', icon: '🔔', class: 'status-due-soon' };
      }
      return { text: 'PENDING', icon: '⏳', class: 'status-pending' };
    }
  };

  const handleSubmit = (assignment) => {
    setCurrentAssignment(assignment);
    setSelectedFile(null);
    setShowSubmitModal(true);
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
        <div className="tasks-content">
          {/* Pending Assignments */}
          {pendingAssignments.length > 0 && (
            <div className="tasks-section">
              <h2 className="tasks-section-title">Pending Assignments</h2>
              <div className="tasks-list">
                {pendingAssignments.map((assignment) => {
                  const status = getStatusInfo(assignment);
                  const daysLeft = getDaysUntilDue(assignment.due_date);
                  const assignmentComments = comments[assignment.id] || [];
                  const isCommentsExpanded = expandedComments[assignment.id];

                  return (
                    <div key={assignment.id} className="tasks-post-card">
                      {/* Post Header - Facebook Style */}
                      <div className="post-header">
                        <div className="post-author">
                          <div className="author-avatar">
                            {getInitials(assignment.team_leader_username)}
                          </div>
                          <div className="author-info">
                            <div className="author-name">{assignment.team_leader_username}</div>
                            <div className="post-timestamp">{formatDateTime(assignment.created_at)}</div>
                          </div>
                        </div>
                        <span className={`tasks-status-badge ${status.class}`}>
                          {status.icon} {status.text}
                        </span>
                      </div>

                      {/* Post Content */}
                      <div className="post-content">
                        <h3 className="post-title">{assignment.title}</h3>
                        {assignment.description && (
                          <p className="post-description">{assignment.description}</p>
                        )}

                        <div className="post-details">
                          <div className="detail-item">
                            <span className="detail-icon">📅</span>
                            <span className="detail-text">
                              Due: {assignment.due_date ? formatDate(assignment.due_date) : 'No due date'}
                              {daysLeft !== null && (
                                <span className={`days-indicator ${daysLeft < 0 ? 'overdue' : daysLeft <= 2 ? 'urgent' : ''}`}>
                                  {daysLeft < 0 ? ` (${Math.abs(daysLeft)} days overdue)` : daysLeft === 0 ? ' (Due today!)' : daysLeft === 1 ? ' (Due tomorrow)' : ` (${daysLeft} days left)`}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-icon">💾</span>
                            <span className="detail-text">Max: {assignment.max_file_size ? formatFileSize(assignment.max_file_size) : '10 MB'}</span>
                          </div>
                        </div>

                        <div className="post-action">
                          <button
                            className="submit-assignment-btn"
                            onClick={() => handleSubmit(assignment)}
                            disabled={userFiles.filter(f => f.status === 'final_approved').length === 0}
                          >
                            Submit Assignment
                          </button>
                        </div>
                      </div>

                      {/* Comments Section */}
                      <div className="post-footer">
                        <button 
                          className="comment-toggle-btn"
                          onClick={() => toggleComments(assignment.id)}
                        >
                          💬 Comment ({assignmentComments.length})
                        </button>
                      </div>

                      {/* Comments List - Expanded View */}
                      {isCommentsExpanded && (
                        <div className="comments-section">
                          {assignmentComments.length > 0 && (
                            <div className="comments-list">
                              {assignmentComments.map((comment) => (
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
                                      <button className="comment-action-btn">Reply</button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add Comment */}
                          <div className="add-comment">
                            <div className="comment-avatar">
                              {getInitials(user.username || user.fullName)}
                            </div>
                            <div className="comment-input-wrapper">
                              <input
                                type="text"
                                className="comment-input"
                                placeholder="Write a comment..."
                                value={newComment[assignment.id] || ''}
                                onChange={(e) => setNewComment(prev => ({ 
                                  ...prev, 
                                  [assignment.id]: e.target.value 
                                }))}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    postComment(assignment.id);
                                  }
                                }}
                                disabled={isPostingComment[assignment.id]}
                              />
                              <button
                                className="comment-submit-btn"
                                onClick={() => postComment(assignment.id)}
                                disabled={!newComment[assignment.id]?.trim() || isPostingComment[assignment.id]}
                              >
                                {isPostingComment[assignment.id] ? '...' : '➤'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submitted Assignments */}
          {submittedAssignments.length > 0 && (
            <div className="tasks-section">
              <h2 className="tasks-section-title">Submitted Assignments</h2>
              <div className="tasks-list">
                {submittedAssignments.map((assignment) => {
                  const assignmentComments = comments[assignment.id] || [];
                  const isCommentsExpanded = expandedComments[assignment.id];

                  return (
                    <div key={assignment.id} className="tasks-post-card submitted-post">
                      {/* Post Header */}
                      <div className="post-header">
                        <div className="post-author">
                          <div className="author-avatar">
                            {getInitials(assignment.team_leader_username)}
                          </div>
                          <div className="author-info">
                            <div className="author-name">{assignment.team_leader_username}</div>
                            <div className="post-timestamp">{formatDateTime(assignment.created_at)}</div>
                          </div>
                        </div>
                        <span className="tasks-status-badge status-submitted">
                          ✓ Submitted
                        </span>
                      </div>

                      {/* Post Content */}
                      <div className="post-content">
                        <h3 className="post-title">{assignment.title}</h3>
                        {assignment.description && (
                          <p className="post-description">{assignment.description}</p>
                        )}

                        {assignment.user_submitted_at && (
                          <div className="submitted-info">
                            <span className="detail-icon">✅</span>
                            <span>Submitted on {formatDate(assignment.user_submitted_at)}</span>
                          </div>
                        )}
                      </div>

                      {/* Comments Section */}
                      <div className="post-footer">
                        <button 
                          className="comment-toggle-btn"
                          onClick={() => toggleComments(assignment.id)}
                        >
                          💬 Comment ({assignmentComments.length})
                        </button>
                      </div>

                      {/* Comments List - Expanded View */}
                      {isCommentsExpanded && (
                        <div className="comments-section">
                          {assignmentComments.length > 0 && (
                            <div className="comments-list">
                              {assignmentComments.map((comment) => (
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
                                      <button className="comment-action-btn">Reply</button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add Comment */}
                          <div className="add-comment">
                            <div className="comment-avatar">
                              {getInitials(user.username || user.fullName)}
                            </div>
                            <div className="comment-input-wrapper">
                              <input
                                type="text"
                                className="comment-input"
                                placeholder="Write a comment..."
                                value={newComment[assignment.id] || ''}
                                onChange={(e) => setNewComment(prev => ({ 
                                  ...prev, 
                                  [assignment.id]: e.target.value 
                                }))}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    postComment(assignment.id);
                                  }
                                }}
                                disabled={isPostingComment[assignment.id]}
                              />
                              <button
                                className="comment-submit-btn"
                                onClick={() => postComment(assignment.id)}
                                disabled={!newComment[assignment.id]?.trim() || isPostingComment[assignment.id]}
                              >
                                {isPostingComment[assignment.id] ? '...' : '➤'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="tasks-empty">
          <div className="tasks-empty-icon">📋</div>
          <h3>No assignments</h3>
          <p>You don't have any assignments at this time.</p>
        </div>
      )}

      {/* Submit Modal */}
      {showSubmitModal && currentAssignment && (
        <div className="tasks-modal-overlay" onClick={() => setShowSubmitModal(false)}>
          <div className="tasks-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tasks-modal-header">
              <h3>Submit Assignment</h3>
              <button className="tasks-modal-close" onClick={() => setShowSubmitModal(false)}>×</button>
            </div>

            <div className="tasks-modal-body">
              <div className="tasks-assignment-info">
                <h4 className="tasks-assignment-title">{currentAssignment.title}</h4>
                {currentAssignment.description && (
                  <p className="tasks-assignment-description">{currentAssignment.description}</p>
                )}
              </div>

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
                    <p>You need to have approved files to submit assignments.</p>
                    <p>Please upload files and wait for approval first.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="tasks-modal-footer">
              <button
                className="tasks-btn tasks-btn-cancel"
                onClick={() => setShowSubmitModal(false)}
              >
                Cancel
              </button>
              <button
                className="tasks-btn tasks-btn-submit"
                onClick={submitAssignment}
                disabled={!selectedFile || isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksTab;
