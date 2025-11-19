import { useState, useEffect } from 'react'
import './css/AssignmentsTab.css'
import FileIcon from '../admin/FileIcon.jsx'
import { CardSkeleton } from '../common/InlineSkeletonLoader'

const AssignmentsTab = ({
  isLoadingAssignments,
  assignments,
  formatDate,
  fetchAssignmentDetails,
  deleteAssignment,
  setShowCreateAssignmentModal,
  openReviewModal,
  user,
  notificationCommentContext,
  onClearNotificationContext,
  highlightedAssignmentId,
  onClearHighlight
}) => {
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState([])
  const [comments, setComments] = useState({})
  const [newComment, setNewComment] = useState({})
  const [isPostingComment, setIsPostingComment] = useState({})
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [currentCommentsAssignment, setCurrentCommentsAssignment] = useState(null)
  const [replyingTo, setReplyingTo] = useState({})
  const [replyText, setReplyText] = useState({})
  const [isPostingReply, setIsPostingReply] = useState({})
  const [showReplies, setShowReplies] = useState({})
  const [showMenuForAssignment, setShowMenuForAssignment] = useState(null)

  useEffect(() => {
    // Fetch comments for all assignments when they load
    assignments.forEach(assignment => {
      fetchComments(assignment.id)
    })
  }, [assignments])

  // Handle notification comment context - automatically open comments modal
  useEffect(() => {
    if (notificationCommentContext && assignments.length > 0) {
      const assignment = assignments.find(a => a.id === notificationCommentContext.assignmentId)
      if (assignment) {
        // Open comments modal for this assignment
        toggleComments(assignment)
        // Clear the context after opening
        if (onClearNotificationContext) {
          onClearNotificationContext()
        }
      }
    }
  }, [notificationCommentContext, assignments])

  // Handle clicking outside to close menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMenuForAssignment && !event.target.closest('.tl-assignment-card-menu')) {
        setShowMenuForAssignment(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenuForAssignment])

  // Handle highlighting and scrolling to specific assignment
  useEffect(() => {
    if (highlightedAssignmentId && assignments.length > 0) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const element = document.getElementById(`assignment-card-${highlightedAssignmentId}`)
        if (element) {
          // Scroll to element with smooth behavior
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })

          // Add highlight effect
          element.classList.add('tl-assignment-highlighted')

          // Remove highlight after animation
          setTimeout(() => {
            element.classList.remove('tl-assignment-highlighted')
            if (onClearHighlight) {
              onClearHighlight()
            }
          }, 1500)
        }
      }, 300)
    }
  }, [highlightedAssignmentId, assignments])

  const fetchComments = async (assignmentId) => {
    try {
      console.log(`🔍 Fetching comments for assignment ${assignmentId}`)
      const response = await fetch(`http://localhost:3001/api/assignments/${assignmentId}/comments`)
      const data = await response.json()

      console.log(`💬 Comments response for ${assignmentId}:`, data)

      if (data.success) {
        console.log(`✅ Setting ${data.comments?.length || 0} comments for assignment ${assignmentId}`)
        setComments(prev => ({
          ...prev,
          [assignmentId]: data.comments || []
        }))
      } else {
        console.log(`❌ Failed to fetch comments for assignment ${assignmentId}`)
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
  }

  const postComment = async (assignmentId) => {
    const commentText = newComment[assignmentId]?.trim()
    if (!commentText) return

    setIsPostingComment(prev => ({ ...prev, [assignmentId]: true }))

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
      })

      const data = await response.json()

      if (data.success) {
        setNewComment(prev => ({ ...prev, [assignmentId]: '' }))
        fetchComments(assignmentId)
      }
    } catch (error) {
      console.error('Error posting comment:', error)
    } finally {
      setIsPostingComment(prev => ({ ...prev, [assignmentId]: false }))
    }
  }

  const postReply = async (assignmentId, commentId) => {
    const replyTextValue = replyText[commentId]?.trim()
    if (!replyTextValue) return

    setIsPostingReply(prev => ({ ...prev, [commentId]: true }))
    
    try {
      const response = await fetch(`http://localhost:3001/api/assignments/${assignmentId}/comments/${commentId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          username: user.username || user.fullName,
          reply: replyTextValue
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setReplyText(prev => ({ ...prev, [commentId]: '' }))
        setReplyingTo(prev => ({ ...prev, [commentId]: false }))
        fetchComments(assignmentId)
      }
    } catch (error) {
      console.error('Error posting reply:', error)
    } finally {
      setIsPostingReply(prev => ({ ...prev, [commentId]: false }))
    }
  }

  const toggleReplyBox = (commentId) => {
    setReplyingTo(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }))
  }

  const toggleShowReplies = (commentId) => {
    setShowReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }))
  }

  const toggleComments = (assignment) => {
    setCurrentCommentsAssignment(assignment)
    setShowCommentsModal(true)
  }

  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now - date) / 1000)
    
    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w ago`
    
    return formatDate(dateString)
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Unknown'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDaysLeft = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = date - now
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return `${Math.abs(diffDays)} days overdue`
    } else if (diffDays === 0) {
      return 'Due today'
    } else if (diffDays === 1) {
      return '1 day left'
    } else {
      return `${diffDays} days left`
    }
  }

  const getStatusColor = (dueDate) => {
    if (!dueDate) return '#95a5a6'
    const date = new Date(dueDate)
    const now = new Date()
    const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return '#e74c3c'
    if (diffDays <= 2) return '#f39c12'
    return '#27ae60'
  }

  const handleShowMembers = (members, e) => {
    e.stopPropagation()
    setSelectedMembers(members)
    setShowMembersModal(true)
  }

  const renderAssignedTo = (assignment) => {
    const assignedTo = assignment.assigned_to || assignment.assignedTo
    
    if (assignedTo === 'all') {
      return (
        <span className="tl-assignment-assigned-user">All team members</span>
      )
    }
    
    const members = assignment.assigned_member_details || []
    const memberCount = members.length
    
    if (memberCount === 0) {
      return <span className="tl-assignment-assigned-user">No members assigned</span>
    } else if (memberCount === 1) {
      return (
        <span className="tl-assignment-assigned-user">
          {members[0].fullName || members[0].username}
        </span>
      )
    } else if (memberCount <= 4) {
      // Show all names if 4 or fewer
      const names = members.map(m => m.fullName || m.username).join(', ')
      return (
        <span className="tl-assignment-assigned-user">{names}</span>
      )
    } else {
      // Show first 4 names and +X more with tooltip
      const displayedMembers = members.slice(0, 4)
      const remainingMembers = members.slice(4)
      const displayedNames = displayedMembers.map(m => m.fullName || m.username).join(', ')
      const remainingNames = remainingMembers.map(m => m.fullName || m.username).join(', ')
      
      return (
        <span className="tl-assignment-assigned-user">
          {displayedNames}
          <span className="tl-assignment-more-members" data-tooltip={remainingNames}>
            {' '}+{remainingMembers.length} more
          </span>
        </span>
      )
    }
  }

  const getInitials = (name) => {
    if (!name) return 'TL';
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
  }

  // Loading State
  if (isLoadingAssignments) {
    return (
      <div className="tl-content">
        <div className="tl-assignments-feed">
          <div className="tl-page-header">
            <div>
              <h1>Tasks</h1>
              <p>Manage team tasks and submissions</p>
            </div>
            <button className="tl-btn success" onClick={() => setShowCreateAssignmentModal(true)}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Create Task
            </button>
          </div>

          <div className="tl-assignments-feed-container">
            {/* Skeleton assignment cards */}
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="tl-assignment-card">
                {/* Card Header Skeleton */}
                <div className="tl-assignment-card-header">
                  <div className="tl-assignment-header-left">
                    <div className="tl-assignment-avatar">
                      <div className="skeleton-box-inline" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                    </div>
                    <div className="tl-assignment-header-info">
                      <div className="tl-assignment-assigned">
                        <div className="skeleton-box-inline" style={{ width: '120px', height: '16px', marginBottom: '4px' }} />
                        <div className="skeleton-box-inline" style={{ width: '80px', height: '14px' }} />
                      </div>
                      <div className="tl-assignment-created">
                        <div className="skeleton-box-inline" style={{ width: '100px', height: '12px' }} />
                      </div>
                    </div>
                  </div>
                  <div className="tl-assignment-header-right">
                    <div className="tl-assignment-due-date">
                      <div className="skeleton-box-inline" style={{ width: '80px', height: '14px' }} />
                    </div>
                  </div>
                </div>

                {/* Task Title Skeleton */}
                <div className="tl-assignment-task-title-section">
                  <div className="skeleton-box-inline" style={{ width: '200px', height: '20px' }} />
                </div>

                {/* Task Description Skeleton */}
                <div className="tl-assignment-task-description-section">
                  <div className="skeleton-box-inline" style={{ width: '100%', height: '16px', marginBottom: '8px' }} />
                  <div className="skeleton-box-inline" style={{ width: '80%', height: '16px' }} />
                </div>

                {/* Attachment Section Skeleton */}
                <div className="tl-assignment-attachment-section">
                  <div className="tl-assignment-attached-file">
                    <div className="tl-assignment-file-label">
                      <div className="skeleton-box-inline" style={{ width: '150px', height: '16px', marginBottom: '12px' }} />
                    </div>
                    {[1, 2].map((j) => (
                      <div key={j} className="tl-assignment-file-item">
                        <div className="skeleton-box-inline" style={{ width: '24px', height: '24px', borderRadius: '4px', marginRight: '12px' }} />
                        <div className="tl-assignment-file-details">
                          <div className="tl-assignment-file-name">
                            <div className="skeleton-box-inline" style={{ width: '120px', height: '16px', marginBottom: '4px' }} />
                          </div>
                          <div className="tl-assignment-file-meta">
                            <div className="skeleton-box-inline" style={{ width: '80px', height: '14px' }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Comments Section Skeleton */}
                <div className="tl-assignment-comments-section">
                  <div className="skeleton-box-inline" style={{ width: '100px', height: '16px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="tl-content">
      {/* Feed */}
      <div className="tl-assignments-feed">
        {/* Page Header */}
        <div className="tl-page-header">
          <div>
            <h1>Tasks ({assignments.length})</h1>
            <p>Manage team tasks and submissions</p>
          </div>
          <button className="tl-btn success" onClick={() => setShowCreateAssignmentModal(true)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Create Task
          </button>
        </div>


        {assignments.length === 0 ? (
          <div className="tl-assignments-empty">
            <div className="tl-assignments-empty-icon">📭</div>
            <h3>No tasks yet</h3>
            <p>Create a task to get started.</p>
            <button className="tl-btn success" onClick={() => setShowCreateAssignmentModal(true)}>
              Create Your First Task
            </button>
          </div>
        ) : (
          <div className="tl-assignments-feed-container">
            {assignments.map((assignment) => {
              const assignmentComments = comments[assignment.id] || []

              return (
                <div key={assignment.id} id={`assignment-card-${assignment.id}`} className="tl-assignment-card">
                  {/* Card Header */}
                  <div className="tl-assignment-card-header">
                    <div className="tl-assignment-header-left">
                      <div className="tl-assignment-avatar">
                        {getInitials(user.fullName || user.username || assignment.team_leader_fullname || assignment.team_leader_username)}
                      </div>
                      <div className="tl-assignment-header-info">
                        <div className="tl-assignment-assigned">
                          <span className="tl-assignment-team-leader-name">
                            {user.fullName || user.username || assignment.team_leader_fullname || assignment.team_leader_username}
                          </span>
                          <span className="tl-assignments-role-badge team-leader">TEAM LEADER</span>
                          assigned to {renderAssignedTo(assignment)}
                        </div>
                        <div className="tl-assignment-created">
                          {formatDateTime(assignment.created_at || assignment.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="tl-assignment-header-right">
                      {(assignment.due_date || assignment.dueDate) && (
                        <div className="tl-assignment-due-date">
                          Due: {formatDate(assignment.due_date || assignment.dueDate)}
                          <span
                            className="tl-assignment-days-left"
                            style={{ color: getStatusColor(assignment.due_date || assignment.dueDate) }}
                          >
                            {' '}({formatDaysLeft(assignment.due_date || assignment.dueDate)})
                          </span>
                        </div>
                      )}
                      <div className="tl-assignment-card-menu">
                        <button
                          className="tl-assignment-menu-btn"
                          onClick={() => setShowMenuForAssignment(showMenuForAssignment === assignment.id ? null : assignment.id)}
                          title="More options"
                        >
                          ⋮
                        </button>
                        {showMenuForAssignment === assignment.id && (
                          <div className="tl-assignment-menu-dropdown">
                            <button
                              className="tl-assignment-menu-item tl-assignment-delete-menu-item"
                              onClick={() => {
                                deleteAssignment(assignment.id, assignment.title)
                                setShowMenuForAssignment(null)
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Task Title */}
                  <div className="tl-assignment-task-title-section">
                    <h3 className="tl-assignment-title">{assignment.title}</h3>
                  </div>

                  {/* Task Description */}
                  {assignment.description ? (
                    <div className="tl-assignment-task-description-section">
                      <p className="tl-assignment-description">{assignment.description}</p>
                    </div>
                  ) : (
                    <div className="tl-assignment-task-description-section">
                      <p className="tl-assignment-no-description">No description</p>
                    </div>
                  )}

                  {/* Attachment Section */}
                  <div className="tl-assignment-attachment-section">
                    {assignment.recent_submissions && assignment.recent_submissions.length > 0 ? (
                      <div className="tl-assignment-attached-file">
                        <div className="tl-assignment-file-label">
                          📎 Submitted Files ({assignment.recent_submissions.length})
                        </div>
                        {assignment.recent_submissions.map((submission) => (
                          <div
                            key={submission.id}
                            className="tl-assignment-file-item"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (openReviewModal && submission.id) {
                                openReviewModal(submission, null)
                              }
                            }}
                          >
                            <FileIcon
                              fileType={(submission.original_name || submission.file_name).split('.').pop()}
                              size="small"
                              className="tl-assignment-file-icon"
                            />
                            <div className="tl-assignment-file-details">
                              <div className="tl-assignment-file-name">
                                {submission.original_name || submission.file_name}
                              </div>
                              <div className="tl-assignment-file-meta">
                                <span>
                                  by <span className="tl-assignment-file-submitter">
                                    {submission.fullName || submission.username || 'Unknown'}
                                  </span>
                                </span>
                                {submission.tag && (
                                  <span className="tl-assignment-file-tag">
                                    🏷️ {submission.tag}
                                  </span>
                                )}
                                {submission.description && (
                                  <span className="tl-assignment-file-description">
                                    {submission.description}
                                  </span>
                                )}
                                <span className={`tl-assignment-file-status ${
                                  submission.status === 'uploaded' ? 'uploaded' :
                                  submission.status === 'team_leader_approved' ? 'team-leader-approved' :
                                  submission.status === 'final_approved' ? 'final-approved' : 
                                  submission.status === 'rejected_by_team_leader' || submission.status === 'rejected_by_admin' ? 'rejected' :
                                  'uploaded'
                                }`}>
                                  {submission.status === 'uploaded' ? 'NEW' :
                                   submission.status === 'team_leader_approved' ? 'PENDING ADMIN' :
                                   submission.status === 'final_approved' ? '✓ APPROVED' :
                                   submission.status === 'rejected_by_team_leader' ? '✗ REJECTED' :
                                   submission.status === 'rejected_by_admin' ? '✗ REJECTED' :
                                   'PENDING'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {(assignment.submission_count || 0) > assignment.recent_submissions.length && (
                          <div className="tl-assignment-more-files">
                            +{(assignment.submission_count || 0) - assignment.recent_submissions.length} more
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="tl-assignment-no-attachment">
                        <span className="tl-assignment-no-attachment-icon">ℹ️</span>
                        <div className="tl-assignment-no-attachment-text">
                          <strong>No submissions yet.</strong>
                          Waiting for team members to submit files.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Comments Section */}
                  <div className="tl-assignment-comments-section">
                    <button 
                      className="tl-assignment-comments-text"
                      onClick={() => toggleComments(assignment)}
                    >
                      💬 Comments ({assignmentComments.length})
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Comments Modal */}
      {showCommentsModal && currentCommentsAssignment && (
        <div className="tl-comments-modal-overlay" onClick={() => setShowCommentsModal(false)}>
          <div className="tl-comments-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tl-comments-modal-header">
              <h3>Comments - {currentCommentsAssignment.title}</h3>
              <button 
                className="tl-comments-modal-close" 
                onClick={() => setShowCommentsModal(false)}
              >
                ×
              </button>
            </div>

            <div className="tl-comments-modal-body">
              <div className="tl-comments-section">
                {comments[currentCommentsAssignment.id]?.length > 0 ? (
                  <div className="tl-comments-list">
                    {comments[currentCommentsAssignment.id].map((comment) => (
                      <div key={comment.id} className="tl-comment-item">
                        <div className="tl-comment-avatar">
                          {getInitials(comment.fullName || comment.username)}
                        </div>
                        <div className="tl-comment-content">
                          <div className="tl-comment-bubble">
                            <div className="tl-comment-author">{comment.fullName || comment.username}</div>
                            <div className="tl-comment-text">{comment.comment}</div>
                          </div>
                          <div className="tl-comment-actions">
                            <span className="tl-comment-timestamp">
                              {formatRelativeTime(comment.created_at)}
                            </span>
                            <button 
                              className="tl-comment-action-btn"
                              onClick={() => toggleReplyBox(comment.id)}
                            >
                              Reply
                            </button>
                            {comment.replies && comment.replies.length > 0 && (
                              <button 
                                className="tl-comment-action-btn"
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
                            <div className="tl-replies-list">
                              {comment.replies.map((reply) => (
                                <div key={reply.id} className="tl-reply-item">
                                  <div className="tl-comment-avatar tl-reply-avatar">
                                    {getInitials(reply.fullName || reply.username)}
                                  </div>
                                  <div className="tl-comment-content">
                                    <div className="tl-comment-bubble">
                                      <div className="tl-comment-author">{reply.fullName || reply.username}</div>
                                      <div className="tl-comment-text">{reply.reply}</div>
                                    </div>
                                    <div className="tl-comment-timestamp">
                                      {formatRelativeTime(reply.created_at)}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Reply Input Box */}
                          {replyingTo[comment.id] && (
                            <div className="tl-reply-input-box">
                              <div className="tl-comment-avatar tl-reply-avatar">
                                {getInitials(user.username || user.fullName)}
                              </div>
                              <div className="tl-comment-input-wrapper">
                                <input
                                  type="text"
                                  className="tl-comment-input"
                                  placeholder="Write a reply..."
                                  value={replyText[comment.id] || ''}
                                  onChange={(e) => setReplyText(prev => ({ 
                                    ...prev, 
                                    [comment.id]: e.target.value 
                                  }))}
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault()
                                      postReply(currentCommentsAssignment.id, comment.id)
                                    }
                                  }}
                                  disabled={isPostingReply[comment.id]}
                                  autoFocus
                                />
                                <button
                                  className="tl-comment-submit-btn"
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
                  <div className="tl-comments-no-comments">
                    <div className="tl-comments-no-comments-icon">💬</div>
                    <p>No comments yet</p>
                    <p>Be the first to comment on this task</p>
                  </div>
                )}

                {/* Add Comment */}
                <div className="tl-add-comment">
                  <div className="tl-comment-avatar">
                    {getInitials(user.username || user.fullName)}
                  </div>
                  <div className="tl-comment-input-wrapper">
                    <input
                      type="text"
                      className="tl-comment-input"
                      placeholder="Write a comment..."
                      value={newComment[currentCommentsAssignment.id] || ''}
                      onChange={(e) => setNewComment(prev => ({ 
                        ...prev, 
                        [currentCommentsAssignment.id]: e.target.value 
                      }))}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          postComment(currentCommentsAssignment.id)
                        }
                      }}
                      disabled={isPostingComment[currentCommentsAssignment.id]}
                    />
                    <button
                      className="tl-comment-submit-btn"
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

      {/* Members Modal */}
      {showMembersModal && (
        <div className="tl-modal-overlay" onClick={() => setShowMembersModal(false)}>
          <div className="tl-modal" onClick={e => e.stopPropagation()}>
            <div className="tl-modal-header">
              <h3>Assigned Members ({selectedMembers.length})</h3>
              <button onClick={() => setShowMembersModal(false)}>×</button>
            </div>
            <div className="tl-modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedMembers.map((member) => (
                  <div key={member.id} style={{
                    padding: '12px',
                    background: 'var(--background-primary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--primary-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}>
                      {(member.fullName || member.username).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                        {member.fullName || member.username}
                      </div>
                      {member.fullName && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          @{member.username}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AssignmentsTab
