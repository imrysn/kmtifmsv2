import { useState, useEffect } from 'react'
import './TaskManagement.css'

const TaskManagement = ({ error, success, setError, setSuccess, clearMessages }) => {
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
      
      const usersResponse = await fetch('http://localhost:3001/api/users')
      const usersData = await usersResponse.json()
      
      if (!usersData.success) {
        setError('Failed to fetch users')
        setLoading(false)
        return
      }

      const teamLeaders = usersData.users.filter(user => user.role === 'TEAM_LEADER')
      
      if (teamLeaders.length === 0) {
        setAssignments([])
        setLoading(false)
        return
      }
      
      const allAssignments = []
      
      for (const leader of teamLeaders) {
        try {
          const response = await fetch(`http://localhost:3001/api/assignments/team-leader/${leader.team}`)
          const data = await response.json()
          
          if (data.success && data.assignments && data.assignments.length > 0) {
            const assignmentsWithLeader = data.assignments.map(assignment => ({
              ...assignment,
              team_leader_fullname: leader.fullName,
              team_leader_username: leader.username || assignment.team_leader_username,
              team_leader_team: leader.team,
              team_leader_email: leader.email
            }))
            allAssignments.push(...assignmentsWithLeader)
          }
        } catch (err) {
          console.error(`Error fetching assignments for ${leader.username}:`, err)
        }
      }

      allAssignments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      
      const now = new Date()
      const statsData = {
        total: allAssignments.length,
        active: allAssignments.filter(a => a.status === 'active').length,
        completed: allAssignments.filter(a => a.status === 'completed').length,
        overdue: allAssignments.filter(a => 
          a.due_date && new Date(a.due_date) < now && a.status === 'active'
        ).length
      }
      
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
      // Get current admin user from session storage
      const currentUser = JSON.parse(sessionStorage.getItem('user'))
      
      if (!currentUser) {
        setError('User session not found. Please log in again.')
        return
      }

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
      const currentUser = JSON.parse(sessionStorage.getItem('user'))
      
      if (!currentUser) {
        setError('User session not found. Please log in again.')
        return
      }

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
    const now = new Date()
    const diffTime = date - now
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''}`
    } else if (diffDays === 0) {
      return 'Due today'
    } else if (diffDays === 1) {
      return 'Due tomorrow'
    } else if (diffDays <= 7) {
      return `Due in ${diffDays} days`
    } else {
      return `Due ${date.toLocaleDateString()}`
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
        <div className="feed-header">
          <h2>📋 Team Tasks Feed</h2>
          <p className="feed-subtitle">All assignments from team leaders</p>
        </div>
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
      <div className="feed-header">
        <h2>📋 Team Tasks Feed</h2>
        <p className="feed-subtitle">
          All assignments from team leaders across the organization
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="stats-cards">
        <div className="stat-card-feed">
          <div className="stat-icon-feed">📊</div>
          <div className="stat-details">
            <div className="stat-number-feed">{stats.total}</div>
            <div className="stat-label-feed">Total Assignments</div>
          </div>
        </div>
        <div className="stat-card-feed">
          <div className="stat-icon-feed">✅</div>
          <div className="stat-details">
            <div className="stat-number-feed">{stats.active}</div>
            <div className="stat-label-feed">Active</div>
          </div>
        </div>
        <div className="stat-card-feed">
          <div className="stat-icon-feed">🎯</div>
          <div className="stat-details">
            <div className="stat-number-feed">{stats.completed}</div>
            <div className="stat-label-feed">Completed</div>
          </div>
        </div>
        <div className="stat-card-feed">
          <div className="stat-icon-feed">⚠️</div>
          <div className="stat-details">
            <div className="stat-number-feed">{stats.overdue}</div>
            <div className="stat-label-feed">Overdue</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && <div className="feed-message error-message">{error}</div>}
      {success && <div className="feed-message success-message">{success}</div>}

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
            <div key={assignment.id} className="feed-card">
              {/* Card Header */}
              <div className="card-header">
                <div className="author-info">
                  <div className="author-avatar">
                    {getInitials(assignment.team_leader_fullname || assignment.team_leader_username)}
                  </div>
                  <div className="author-details">
                    <div className="author-name">
                      {assignment.team_leader_fullname || assignment.team_leader_username}
                    </div>
                    <div className="author-meta">
                      <span className="team-badge">{assignment.team_leader_team || assignment.team}</span>
                      <span className="dot-separator">•</span>
                      <span className="post-time">
                        {formatDateTime(assignment.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="card-body">
                <h3 className="assignment-title">{assignment.title}</h3>
                
                {assignment.description && (
                  <p className="assignment-description">
                    {expandedAssignments[assignment.id] 
                      ? assignment.description 
                      : assignment.description.length > 200 
                        ? `${assignment.description.substring(0, 200)}...` 
                        : assignment.description}
                    {assignment.description.length > 200 && (
                      <button 
                        className="expand-btn"
                        onClick={() => toggleExpand(assignment.id)}
                      >
                        {expandedAssignments[assignment.id] ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </p>
                )}

                <div className="assignment-meta">
                  {assignment.due_date && (
                    <div className="meta-item">
                      <span className="meta-icon">📅</span>
                      <span 
                        className="meta-text"
                        style={{ 
                          color: getStatusColor(assignment.due_date),
                          fontWeight: 600
                        }}
                      >
                        {formatDate(assignment.due_date)}
                      </span>
                    </div>
                  )}
                  
                  {assignment.file_type_required && (
                    <div className="meta-item">
                      <span className="meta-icon">📎</span>
                      <span className="meta-text">
                        Required: {assignment.file_type_required.toUpperCase()}
                      </span>
                    </div>
                  )}

                  {assignment.max_file_size && (
                    <div className="meta-item">
                      <span className="meta-icon">💾</span>
                      <span className="meta-text">
                        Max: {formatFileSize(assignment.max_file_size)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Assignment Stats */}
                <div className="assignment-stats">
                  <div className="stat-item">
                    <span className="stat-icon">👥</span>
                    <span className="stat-value">{assignment.assigned_members_count || 0}</span>
                    <span className="stat-label">Assigned</span>
                  </div>
                  <div className="stat-divider"></div>
                  <div className="stat-item">
                    <span className="stat-icon">✅</span>
                    <span className="stat-value">{assignment.submission_count || 0}</span>
                    <span className="stat-label">Submitted</span>
                  </div>
                  <div className="stat-divider"></div>
                  <div className="stat-item">
                    <span className="stat-icon">⏳</span>
                    <span className="stat-value">
                      {(assignment.assigned_members_count || 0) - (assignment.submission_count || 0)}
                    </span>
                    <span className="stat-label">Pending</span>
                  </div>
                </div>

                {/* Assigned Members */}
                {assignment.assigned_member_details && assignment.assigned_member_details.length > 0 && (
                  <div className="assigned-members">
                    <div className="members-label">Assigned to:</div>
                    <div className="members-avatars">
                      {assignment.assigned_member_details.slice(0, 5).map((member, index) => (
                        <div 
                          key={member.id} 
                          className="member-avatar"
                          title={member.fullName || member.username}
                          style={{ zIndex: assignment.assigned_member_details.length - index }}
                        >
                          {getInitials(member.fullName || member.username)}
                        </div>
                      ))}
                      {assignment.assigned_member_details.length > 5 && (
                        <div className="member-avatar more-members">
                          +{assignment.assigned_member_details.length - 5}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Recent Submissions */}
                {assignment.recent_submissions && assignment.recent_submissions.length > 0 && (
                  <div className="recent-submissions">
                    <div className="submissions-label">📄 Recent submissions:</div>
                    {assignment.recent_submissions.map((submission, index) => (
                      <div key={index} className="submission-item">
                        <span className="submission-icon">📄</span>
                        <span className="submission-user">
                          {submission.fullName || submission.username}
                        </span>
                        <span className="submission-file">{submission.original_name}</span>
                        <span className="submission-time">
                          {new Date(submission.submitted_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="card-footer">
                <div className="assignment-type">
                  {assignment.assigned_to === 'all' ? (
                    <span className="type-badge type-all">🌐 All Team Members</span>
                  ) : (
                    <span className="type-badge type-specific">
                      👤 {assignment.assigned_members_count || 0} Specific Members
                    </span>
                  )}
                </div>
                <button 
                  className="comments-button"
                  onClick={() => openCommentsModal(assignment)}
                >
                  💬 View Comments
                </button>
                <div className="assignment-status">
                  {assignment.status === 'active' ? (
                    <span className="status-badge status-active">Active</span>
                  ) : (
                    <span className="status-badge status-closed">Closed</span>
                  )}
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
