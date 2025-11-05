import { useState, useEffect } from 'react'
import './TaskManagement.css'

const TaskManagement = ({ error, success, setError, setSuccess, clearMessages, user }) => {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedAssignments, setExpandedAssignments] = useState({})
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [comments, setComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    completed: 0,
    overdue: 0
  })

  useEffect(() => {
    fetchAllAssignments()
  }, [])

  const fetchAllAssignments = async () => {
    try {
      setLoading(true)
      clearMessages()
      
      console.log('Fetching all assignments for admin...')
      
      // Use the new admin endpoint to get ALL assignments
      const response = await fetch('http://localhost:3001/api/assignments/admin/all')
      const data = await response.json()
      
      console.log('Admin assignments response:', data)
      
      if (!data.success) {
        setError(data.message || 'Failed to fetch assignments')
        setLoading(false)
        return
      }

      const allAssignments = data.assignments || []
      console.log(`Fetched ${allAssignments.length} assignments`)
      
      // Calculate statistics
      const now = new Date()
      const statsData = {
        total: allAssignments.length,
        active: allAssignments.filter(a => a.status === 'active').length,
        completed: allAssignments.filter(a => a.status === 'completed').length,
        overdue: allAssignments.filter(a => 
          a.due_date && new Date(a.due_date) < now && a.status === 'active'
        ).length
      }
      
      console.log('Statistics:', statsData)
      
      setStats(statsData)
      setAssignments(allAssignments)
    } catch (error) {
      console.error('Error fetching assignments:', error)
      setError('Failed to load assignments')
    } finally {
      setLoading(false)
    }
  }

  const fetchComments = async (assignmentId) => {
    try {
      setLoadingComments(true)
      const response = await fetch(`http://localhost:3001/api/assignments/${assignmentId}/comments`)
      const data = await response.json()
      
      if (data.success) {
        setComments(data.comments || [])
      } else {
        setError('Failed to load comments')
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
      setError('Failed to load comments')
    } finally {
      setLoadingComments(false)
    }
  }

  const openCommentsModal = async (assignment) => {
    setSelectedAssignment(assignment)
    setShowCommentsModal(true)
    await fetchComments(assignment.id)
  }

  const closeCommentsModal = () => {
    setShowCommentsModal(false)
    setSelectedAssignment(null)
    setComments([])
    setNewComment('')
    setReplyingTo(null)
    setReplyText('')
  }

  const handlePostComment = async (e) => {
    e.preventDefault()
    
    if (!newComment.trim()) return

    try {
      // Use the user prop passed from AdminDashboard
      if (!user || !user.id) {
        setError('User session not found. Please log in again.')
        return
      }
      
      const currentUser = user

      const response = await fetch(`http://localhost:3001/api/assignments/${selectedAssignment.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: currentUser.id,
          username: currentUser.username,
          comment: newComment
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setNewComment('')
        await fetchComments(selectedAssignment.id)
        setSuccess('Comment posted successfully')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.message || 'Failed to post comment')
      }
    } catch (error) {
      console.error('Error posting comment:', error)
      setError('Failed to post comment')
    }
  }

  const handlePostReply = async (e, commentId) => {
    e.preventDefault()
    
    if (!replyText.trim()) return

    try {
      // Use the user prop passed from AdminDashboard
      if (!user || !user.id) {
        setError('User session not found. Please log in again.')
        return
      }
      
      const currentUser = user

      const response = await fetch(
        `http://localhost:3001/api/assignments/${selectedAssignment.id}/comments/${commentId}/replies`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: currentUser.id,
            username: currentUser.username,
            reply: replyText
          })
        }
      )

      const data = await response.json()
      
      if (data.success) {
        setReplyText('')
        setReplyingTo(null)
        await fetchComments(selectedAssignment.id)
        setSuccess('Reply posted successfully')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.message || 'Failed to post reply')
      }
    } catch (error) {
      console.error('Error posting reply:', error)
      setError('Failed to post reply')
    }
  }

  const toggleExpand = (assignmentId) => {
    setExpandedAssignments(prev => ({
      ...prev,
      [assignmentId]: !prev[assignmentId]
    }))
  }

  const getInitials = (name) => {
    if (!name) return '?'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'No due date'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
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

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Unknown'
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now - date) / 1000)
    
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A'
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)}MB`
  }

  if (loading) {
    return (
      <div className="task-feed">
        <div className="feed-header-simple">
          <h2>Global Tasks</h2>
        </div>
        <div className="task-count">Loading...</div>
        <div className="loading-skeleton">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-header">
                <div className="skeleton-avatar"></div>
                <div className="skeleton-text">
                  <div className="skeleton-line skeleton-line-short"></div>
                  <div className="skeleton-line skeleton-line-tiny"></div>
                </div>
              </div>
              <div className="skeleton-body">
                <div className="skeleton-line"></div>
                <div className="skeleton-line"></div>
                <div className="skeleton-line skeleton-line-short"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="task-feed">
      <div className="feed-header-simple">
        <h2>Global Tasks</h2>
      </div>

      {/* Messages */}
      {error && <div className="feed-message error-message">{error}</div>}
      {success && <div className="feed-message success-message">{success}</div>}
      
      {/* Task Count */}
      <div className="task-count">{assignments.length} assignments</div>

      {/* Feed */}
      <div className="feed-container">
        {assignments.length === 0 ? (
          <div className="empty-feed">
            <div className="empty-icon">📭</div>
            <h3>No Tasks Yet</h3>
            <p>Team leaders haven't created any assignments yet.</p>
          </div>
        ) : (
          assignments.map(assignment => (
              <div key={assignment.id} className="admin-assignment-card">
                {/* Card Header */}
                <div className="admin-card-header">
                  <div className="admin-author-section">
                    <div className="admin-author-avatar">
                      {getInitials(assignment.team_leader_fullname || assignment.team_leader_username)}
                    </div>
                    <div className="admin-author-info">
                      <div className="admin-author-name">
                        {assignment.team_leader_fullname || assignment.team_leader_username}
                      </div>
                      <div className="admin-team-badge">{assignment.team}</div>
                    </div>
                    <div className="admin-post-time">
                      {formatDateTime(assignment.created_at)}
                    </div>
                  </div>
                  {assignment.user_status === 'submitted' && (
                    <div className="admin-submitted-badge">
                      ✓ SUBMITTED
                    </div>
                  )}
                </div>

                {/* Card Content */}
                <div className="admin-card-content">
                  <h3 className="admin-assignment-title">{assignment.title}</h3>
                  
                  {assignment.description && (
                    <p className="admin-assignment-description">
                      {expandedAssignments[assignment.id] 
                        ? assignment.description 
                        : assignment.description.length > 200 
                          ? `${assignment.description.substring(0, 200)}...` 
                          : assignment.description}
                      {assignment.description.length > 200 && (
                        <button 
                          className="admin-expand-btn"
                          onClick={() => toggleExpand(assignment.id)}
                        >
                          {expandedAssignments[assignment.id] ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </p>
                  )}

                  {/* Attached File */}
                  {assignment.recent_submissions && assignment.recent_submissions.length > 0 && (
                    <div className="admin-attached-file">
                      <div className="admin-file-label">📎 Attached File:</div>
                      <div className="admin-file-item">
                        <div className="admin-file-icon">📄</div>
                        <div className="admin-file-details">
                          <div className="admin-file-name">{assignment.recent_submissions[0].original_name}</div>
                          <div className="admin-file-meta">Submitted on {formatDate(assignment.recent_submissions[0].submitted_at)}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Meta Info */}
                  <div className="admin-meta-section">
                    {assignment.due_date && (
                      <div className="admin-meta-item">
                        <span className="admin-meta-text">
                          Due: {formatDate(assignment.due_date)}
                          <span 
                            className="admin-days-left"
                            style={{ color: getStatusColor(assignment.due_date) }}
                          >
                            {' '}({formatDaysLeft(assignment.due_date)})
                          </span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Assigned Members */}
                  {assignment.assigned_member_details && assignment.assigned_member_details.length > 0 && (
                    <div className="admin-assigned-to">
                      <span className="admin-assigned-label">Assigned to:</span>
                      <div className="admin-member-avatar-small">
                        {getInitials(assignment.assigned_member_details[0].fullName || assignment.assigned_member_details[0].username)}
                      </div>
                      {assignment.assigned_member_details.length > 1 && (
                        <span className="admin-more-members">+{assignment.assigned_member_details.length - 1} more</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="admin-card-footer">
                  <div className="admin-footer-left">
                    <button className="admin-assigned-count">
                      <span className="admin-icon">👥</span>
                      {assignment.assigned_to === 'all' ? 'All Team Members' : `${assignment.assigned_members_count || 0} Specific Members`}
                    </button>
                  </div>
                  <div className="admin-footer-right">
                    <button 
                      className="admin-view-comments-btn"
                      onClick={() => openCommentsModal(assignment)}
                    >
                      💬 View Comments
                    </button>
                    <div className={`admin-status-badge ${assignment.status === 'active' ? 'active' : 'closed'}`}>
                      {assignment.status === 'active' ? 'ACTIVE' : 'CLOSED'}
                    </div>
                  </div>
                </div>
              </div>
          ))
        )}
      </div>

      {/* Comments Modal */}
      {showCommentsModal && selectedAssignment && (
        <div className="comments-modal-overlay" onClick={closeCommentsModal}>
          <div className="comments-modal" onClick={(e) => e.stopPropagation()}>
            <div className="comments-modal-header">
              <h3>💬 Comments - {selectedAssignment.title}</h3>
              <button className="close-modal-btn" onClick={closeCommentsModal}>
                ✕
              </button>
            </div>

            <div className="comments-modal-body">
              {loadingComments ? (
                <div className="loading-comments">
                  <div className="spinner"></div>
                  <p>Loading comments...</p>
                </div>
              ) : comments.length === 0 ? (
                <div className="no-comments">
                  <p>💬 No comments yet. Be the first to comment!</p>
                </div>
              ) : (
                <div className="comments-list">
                  {comments.map(comment => (
                    <div key={comment.id} className="comment-item">
                      <div className="comment-avatar">
                        {getInitials(comment.user_fullname || comment.username)}
                      </div>
                      <div className="comment-content">
                        <div className="comment-header">
                          <span className="comment-author">{comment.user_fullname || comment.username}</span>
                          <span className="comment-role">{comment.user_role}</span>
                          <span className="comment-time">{formatTimeAgo(comment.created_at)}</span>
                        </div>
                        <div className="comment-text">{comment.comment}</div>
                        <button 
                          className="reply-button"
                          onClick={() => setReplyingTo(comment.id)}
                        >
                          Reply
                        </button>

                        {/* Replies */}
                        {comment.replies && comment.replies.length > 0 && (
                          <div className="replies-list">
                            {comment.replies.map(reply => (
                              <div key={reply.id} className="reply-item">
                                <div className="reply-avatar">
                                  {getInitials(reply.user_fullname || reply.username)}
                                </div>
                                <div className="reply-content">
                                  <div className="reply-header">
                                    <span className="reply-author">{reply.user_fullname || reply.username}</span>
                                    <span className="reply-role">{reply.user_role}</span>
                                    <span className="reply-time">{formatTimeAgo(reply.created_at)}</span>
                                  </div>
                                  <div className="reply-text">{reply.reply}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reply Form */}
                        {replyingTo === comment.id && (
                          <form className="reply-form" onSubmit={(e) => handlePostReply(e, comment.id)}>
                            <textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Write a reply..."
                              rows="2"
                              autoFocus
                            />
                            <div className="reply-form-actions">
                              <button 
                                type="button" 
                                className="cancel-reply-btn"
                                onClick={() => {
                                  setReplyingTo(null)
                                  setReplyText('')
                                }}
                              >
                                Cancel
                              </button>
                              <button type="submit" className="post-reply-btn">
                                Post Reply
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comment Form */}
            <div className="comments-modal-footer">
              <form className="comment-form" onSubmit={handlePostComment}>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  rows="3"
                />
                <button type="submit" className="post-comment-btn">
                  Post Comment
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TaskManagement
