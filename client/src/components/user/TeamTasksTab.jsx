import { useState, useEffect, useRef, useCallback } from 'react'
import './css/TeamTasksTab.css'
import FileIcon from '../admin/FileIcon.jsx'

const TeamTasksTab = ({ user }) => {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [expandedAssignments, setExpandedAssignments] = useState({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isOpeningFile, setIsOpeningFile] = useState(false)

  // Comments state
  const [comments, setComments] = useState({})
  const [newComment, setNewComment] = useState({})
  const [replyText, setReplyText] = useState({})
  const [showCommentsModal, setShowCommentsModal] = useState(null) // null or assignmentId
  const [replyingTo, setReplyingTo] = useState({})
  const [visibleReplies, setVisibleReplies] = useState({})
  const [isPostingComment, setIsPostingComment] = useState({})
  const [isPostingReply, setIsPostingReply] = useState({})
  const [showAllFiles, setShowAllFiles] = useState({}) // Track which assignments show all files

  // Pagination state
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  
  // Ref for infinite scroll
  const observerRef = useRef(null)
  const loadMoreRef = useRef(null)

  useEffect(() => {
    if (user && user.team) {
      fetchInitialAssignments()
    }
  }, [user])

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showCommentsModal) {
        setShowCommentsModal(null)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [showCommentsModal])

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (loading || loadingMore || !hasMore) return

    const options = {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    }

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        console.log('Intersection detected, loading more...')
        fetchMoreAssignments()
      }
    }, options)

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [loading, loadingMore, hasMore, nextCursor])

  const fetchInitialAssignments = async () => {
    try {
      setLoading(true)
      setError('')
      
      console.log('Fetching team assignments for team:', user.team)
      
      const response = await fetch(`http://localhost:3001/api/assignments/team/${user.team}/all-tasks?limit=20`)
      const data = await response.json()
      
      console.log('Team assignments response:', data)
      
      if (!data.success) {
        setError(data.message || 'Failed to fetch team assignments')
        setLoading(false)
        return
      }

      const allAssignments = data.assignments || []
      console.log(`Fetched ${allAssignments.length} team assignments`)
      
      setAssignments(allAssignments)
      setNextCursor(data.nextCursor)
      setHasMore(data.hasMore)
      
      // Fetch comment counts for all assignments
      await fetchCommentCounts(allAssignments)
    } catch (error) {
      console.error('Error fetching team assignments:', error)
      setError('Failed to load team assignments')
    } finally {
      setLoading(false)
    }
  }

  const fetchMoreAssignments = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor) {
      console.log('Skipping fetch:', { loadingMore, hasMore, nextCursor })
      return
    }

    try {
      setLoadingMore(true)
      
      console.log('Fetching more team assignments with cursor:', nextCursor)
      
      const response = await fetch(`http://localhost:3001/api/assignments/team/${user.team}/all-tasks?cursor=${nextCursor}&limit=20`)
      const data = await response.json()
      
      console.log('More team assignments response:', data)
      
      if (!data.success) {
        setError(data.message || 'Failed to fetch more assignments')
        return
      }

      const newAssignments = data.assignments || []
      console.log(`Fetched ${newAssignments.length} more assignments`)
      
      setAssignments(prev => [...prev, ...newAssignments])
      setNextCursor(data.nextCursor)
      setHasMore(data.hasMore)
      
      // Fetch comment counts for new assignments
      await fetchCommentCounts(newAssignments)
    } catch (error) {
      console.error('Error fetching more assignments:', error)
      setError('Failed to load more assignments')
    } finally {
      setLoadingMore(false)
    }
  }, [nextCursor, hasMore, loadingMore, user.team])

  // Fetch comment counts for all assignments
  const fetchCommentCounts = async (assignmentsList) => {
    try {
      const commentCounts = {}
      
      // Fetch comment count for each assignment
      await Promise.all(
        assignmentsList.map(async (assignment) => {
          try {
            const response = await fetch(`http://localhost:3001/api/assignments/${assignment.id}/comments`)
            const data = await response.json()
            
            if (data.success) {
              commentCounts[assignment.id] = data.comments || []
            }
          } catch (error) {
            console.error(`Error fetching comments for assignment ${assignment.id}:`, error)
          }
        })
      )
      
      // Update comments state with all fetched comments
      setComments(prev => ({ ...prev, ...commentCounts }))
    } catch (error) {
      console.error('Error fetching comment counts:', error)
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

  const getStatusColor = (dueDate) => {
    if (!dueDate) return '#95a5a6'
    const date = new Date(dueDate)
    const now = new Date()
    const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return '#e74c3c'
    if (diffDays <= 2) return '#f39c12'
    return '#27ae60'
  }

  const handleOpenFile = async (filePath, fileId) => {
    if (!filePath) {
      setError('File path not available')
      return
    }

    try {
      setIsOpeningFile(true)
      setError('')
      setSuccess('Opening file...')

      await new Promise(resolve => setTimeout(resolve, 300));

      const isElectron = window.electron && window.electron.openFileInApp;

      if (isElectron) {
        console.log('💻 Running in Electron - using Windows default application');

        const pathResponse = await fetch(
          `http://localhost:3001/api/files/${fileId}/path`
        );
        const pathData = await pathResponse.json();

        if (!pathData.success) {
          throw new Error(pathData.message || 'Failed to get file path');
        }

        console.log('📂 Full path:', pathData.filePath);
        console.log('📄 File name:', pathData.fileName);

        const result = await window.electron.openFileInApp(pathData.filePath);

        if (result.success) {
          console.log('✅ Opened with Windows default application');
          setSuccess('File opened successfully');
        } else {
          throw new Error(result.error || 'Failed to open file');
        }
      } else {
        console.log('🌐 Running in browser - opening in new tab');

        const fileUrl = `http://localhost:3001${filePath}`;
        const newWindow = window.open(fileUrl, '_blank');

        if (!newWindow) {
          throw new Error('Pop-up blocked. Please allow pop-ups for this site.');
        }

        newWindow.focus();
        console.log('✅ Opened in browser tab');
        setSuccess('File opened in browser');
      }

    } catch (error) {
      console.error('❌ Error opening file:', error);
      setSuccess('')
      setError(`Error opening file: ${error.message || 'Failed to open file'}`);
    } finally {
      setIsOpeningFile(false)
      setTimeout(() => {
        setSuccess('')
        setError('')
      }, 3000)
    }
  }

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  // Fetch comments for an assignment
  const fetchComments = async (assignmentId) => {
    try {
      const response = await fetch(`http://localhost:3001/api/assignments/${assignmentId}/comments`)
      const data = await response.json()
      
      if (data.success) {
        setComments(prev => ({
          ...prev,
          [assignmentId]: data.comments || []
        }))
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
  }

  // Toggle comments section
  const toggleComments = async (assignmentId) => {
    if (showCommentsModal === assignmentId) {
      // Close modal
      setShowCommentsModal(null)
    } else {
      // Open modal
      setShowCommentsModal(assignmentId)
      
      // Fetch comments if not already loaded
      if (!comments[assignmentId]) {
        await fetchComments(assignmentId)
      }
    }
  }

  // Submit a new comment
  const handleSubmitComment = async (assignmentId) => {
    const commentText = newComment[assignmentId]?.trim()
    
    if (!commentText) return

    try {
      setIsPostingComment(prev => ({ ...prev, [assignmentId]: true }))
      
      const response = await fetch(`http://localhost:3001/api/assignments/${assignmentId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          username: user.username || user.fullName,
          comment: commentText
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Clear input
        setNewComment(prev => ({ ...prev, [assignmentId]: '' }))
        // Refresh comments
        await fetchComments(assignmentId)
        setSuccess('Comment posted successfully')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.message || 'Failed to post comment')
        setTimeout(() => setError(''), 3000)
      }
    } catch (error) {
      console.error('Error posting comment:', error)
      setError('Failed to post comment')
      setTimeout(() => setError(''), 3000)
    } finally {
      setIsPostingComment(prev => ({ ...prev, [assignmentId]: false }))
    }
  }

  // Submit a reply to a comment
  const handleSubmitReply = async (assignmentId, commentId) => {
    const reply = replyText[commentId]?.trim()
    
    if (!reply) return

    try {
      setIsPostingReply(prev => ({ ...prev, [commentId]: true }))
      
      const response = await fetch(`http://localhost:3001/api/assignments/${assignmentId}/comments/${commentId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          username: user.username || user.fullName,
          reply: reply
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Clear input and hide reply box
        setReplyText(prev => ({ ...prev, [commentId]: '' }))
        setReplyingTo(prev => ({ ...prev, [commentId]: false }))
        // Refresh comments
        await fetchComments(assignmentId)
        setSuccess('Reply posted successfully')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.message || 'Failed to post reply')
        setTimeout(() => setError(''), 3000)
      }
    } catch (error) {
      console.error('Error posting reply:', error)
      setError('Failed to post reply')
      setTimeout(() => setError(''), 3000)
    } finally {
      setIsPostingReply(prev => ({ ...prev, [commentId]: false }))
    }
  }

  // Format time ago
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now - date) / 1000)
    
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return formatDate(dateString)
  }

  const toggleRepliesVisibility = (commentId) => {
    setVisibleReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }))
  }

  const toggleReplyBox = (commentId) => {
    setReplyingTo(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }))
  }

  // Skeleton loader for initial load
  if (loading) {
    return (
      <div className="team-tasks-tab">
        <div className="team-tasks-header">
          <h2>Team Tasks</h2>
          <p className="team-tasks-subtitle">Tasks assigned to your team members</p>
        </div>
        <div className="team-tasks-count">Loading...</div>
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
    <div className={`team-tasks-tab ${isOpeningFile ? 'file-opening-cursor' : ''}`}>
      {/* Messages */}
      {error && (
        <div className="team-tasks-message error-message">
          {error}
          <button className="close-message-btn" onClick={clearMessages}>×</button>
        </div>
      )}

      {success && (
        <div className="team-tasks-message success-message">
          {success}
          <button className="close-message-btn" onClick={clearMessages}>×</button>
        </div>
      )}

      <div className="team-tasks-header">
        <h2>Team Tasks</h2>
        <p className="team-tasks-subtitle">Tasks assigned to your team members</p>
      </div>
      
      {/* Task Count */}
      <div className="team-tasks-count">
        {assignments.length} task{assignments.length !== 1 ? 's' : ''}
        {hasMore && ' • Scroll for more'}
      </div>

      {/* Feed */}
      <div className="team-tasks-container">
        {assignments.length === 0 ? (
          <div className="empty-team-tasks">
            <div className="empty-icon">📋</div>
            <h3>No Team Tasks Yet</h3>
            <p>Your team leader hasn't created any assignments yet.</p>
          </div>
        ) : (
          <>
            {assignments.map(assignment => (
              <div 
                key={assignment.id} 
                className="team-task-card"
              >
                {/* Card Header */}
                <div className="team-task-header">
                  <div className="team-task-header-left">
                    <div className="team-task-avatar">
                      {getInitials(assignment.team_leader_fullname || assignment.team_leader_username)}
                    </div>
                    <div className="team-task-header-info">
                      <div className="team-task-assigned">
                        <span className="team-leader-name">
                          {assignment.team_leader_fullname || assignment.team_leader_username}
                        </span>
                        <span className="role-badge team-leader">TEAM LEADER</span>
                        assigned to{' '}
                        <span className="assigned-user">
                          {assignment.assigned_member_details && assignment.assigned_member_details.length > 0
                            ? assignment.assigned_member_details.length === 1
                              ? assignment.assigned_member_details[0].fullName
                              : `${assignment.assigned_member_details.length} members (${assignment.assigned_member_details.map(m => m.fullName).join(', ')})`
                            : assignment.assigned_to === 'all'
                              ? 'All team members'
                              : 'Unknown User'}
                        </span>
                      </div>
                      <div className="team-task-created">
                        {assignment.created_at ? formatDateTime(assignment.created_at) : 'Unknown creation date'}
                      </div>
                    </div>
                  </div>
                  <div className="team-task-header-right">
                    {assignment.due_date && (
                      <div className="team-task-due-date">
                        Due: {formatDate(assignment.due_date)}
                        <span
                          className="days-left"
                          style={{ color: getStatusColor(assignment.due_date) }}
                        >
                          {' '}({formatDaysLeft(assignment.due_date)})
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Task Title */}
                <div className="team-task-title-section">
                  <h3 className="team-task-title">{assignment.title}</h3>
                </div>

                {/* Task Description */}
                {assignment.description && (
                  <div className="team-task-description-section">
                    <p className="team-task-description">
                      {expandedAssignments[assignment.id]
                        ? assignment.description
                        : assignment.description.length > 200
                          ? `${assignment.description.substring(0, 200)}...`
                          : assignment.description}
                      {assignment.description.length > 200 && (
                        <button
                          className="expand-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(assignment.id);
                          }}
                        >
                          {expandedAssignments[assignment.id] ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </p>
                  </div>
                )}

                {/* Attachment */}
                <div className="team-task-attachment-section">
                  {assignment.recent_submissions && assignment.recent_submissions.length > 0 ? (
                    <div className="team-task-attached-file">
                      <div className="file-label">
                        <span style={{ fontSize: '16px' }}>📎</span>
                        Attachment{assignment.recent_submissions.length > 1 ? 's' : ''} ({assignment.recent_submissions.length}):
                      </div>
                      {(() => {
                        // Simply sort all files by submitted_at (newest first)
                        const sortedFiles = [...assignment.recent_submissions].sort((a, b) => 
                          new Date(b.submitted_at) - new Date(a.submitted_at)
                        );

                        // Show only first 5 files unless "see more" is clicked
                        const filesToShow = showAllFiles[assignment.id] 
                          ? sortedFiles 
                          : sortedFiles.slice(0, 5);

                        return (
                          <>
                            {filesToShow.map((file, index) => (
                        <div
                          key={file.id}
                          className="file-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenFile(file.file_path, file.id);
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px'
                          }}>
                            <FileIcon
                              fileType={file.original_name.split('.').pop()}
                              size="small"
                              style={{
                                width: '48px',
                                height: '48px',
                                flexShrink: 0
                              }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ 
                                fontWeight: '500', 
                                fontSize: '15px', 
                                color: '#111827',
                                marginBottom: '6px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {file.original_name}
                              </div>
                              <div style={{ 
                                fontSize: '13px', 
                                color: '#6b7280',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                flexWrap: 'wrap'
                              }}>
                                <span>Submitted by <span style={{ fontWeight: '500', color: '#374151' }}>{file.fullName || file.username}</span></span>
                                <span style={{ color: '#d1d5db' }}>•</span>
                                <span>on {formatDate(file.submitted_at)}</span>
                                {file.tag && (
                                  <>
                                    <span style={{ color: '#d1d5db' }}>•</span>
                                    <span style={{
                                      backgroundColor: '#eff6ff',
                                      color: '#1e40af',
                                      padding: '2px 10px',
                                      borderRadius: '12px',
                                      fontSize: '11px',
                                      fontWeight: '600',
                                      border: '1px solid #bfdbfe',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}>
                                      <span>🏷️</span> {file.tag}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                            ))}
                            
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
                                  <span>See more ({sortedFiles.length - 5} more)</span>
                                )}
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="no-attachment">
                      <span className="no-attachment-icon">📄</span>
                      <span className="no-attachment-text">
                        No attachments yet
                      </span>
                    </div>
                  )}
                </div>

                {/* Comments Section */}
                <div className="team-task-comments-section" style={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                  paddingTop: '12px',
                  borderTop: '1px solid #f3f4f6'
                }}>
                  <button 
                    className="toggle-comments-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleComments(assignment.id);
                    }}
                    style={{
                      padding: '0',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#1c1e21',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>Comment</span>
                    {comments[assignment.id] && comments[assignment.id].length > 0 && (
                      <span>({comments[assignment.id].length})</span>
                    )}
                  </button>
                </div>
              </div>
            ))}

            {/* Inline Skeleton Loader for Loading More */}
            {loadingMore && (
              <div className="inline-skeleton-container">
                {[1, 2].map(i => (
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
            )}

            {/* Load More Trigger (Hidden) */}
            {hasMore && !loadingMore && (
              <div ref={loadMoreRef} style={{ height: '20px', margin: '20px 0' }} />
            )}
          </>
        )}
      </div>

      {/* Comments Modal - Admin Style */}
      {showCommentsModal && (
        <div className="comments-modal-overlay" onClick={() => setShowCommentsModal(null)}>
          <div className="comments-modal" onClick={(e) => e.stopPropagation()}>
            <div className="comments-modal-header">
              <h3>Comments</h3>
              <button className="close-modal-btn" onClick={() => setShowCommentsModal(null)}>
                ✕
              </button>
            </div>

            <div className="comments-modal-body">
              {comments[showCommentsModal]?.length > 0 ? (
                <div className="comments-list">
                  {comments[showCommentsModal].map((comment) => (
                    <div key={comment.id} className="comment-thread">
                      {/* Main Comment */}
                      <div className="comment-item">
                        <div className="comment-avatar">
                          {getInitials(comment.fullName || comment.username)}
                        </div>
                        <div className="comment-content">
                          <div className="comment-header">
                            <span className="comment-author">{comment.fullName || comment.username}</span>
                            <span className={`role-badge ${comment.user_role ? comment.user_role.toLowerCase().replace(' ', '-').replace('_', '-') : 'user'}`}>
                              {comment.user_role || 'USER'}
                            </span>
                            <span className="comment-time">{formatTimeAgo(comment.created_at)}</span>
                          </div>
                          <div className="comment-text">{comment.comment}</div>

                          {/* Action Buttons */}
                          <div className="comment-actions">
                            <button
                              className="reply-button"
                              onClick={() => toggleReplyBox(comment.id)}
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
                                {getInitials(reply.fullName || reply.username)}
                              </div>
                              <div className="reply-content">
                                <div className="reply-header">
                                  <span className="reply-author">{reply.fullName || reply.username}</span>
                                  <span className={`role-badge ${reply.user_role ? reply.user_role.toLowerCase().replace(' ', '-').replace('_', '-') : 'user'}`}>
                                    {reply.user_role || 'USER'}
                                  </span>
                                  <span className="reply-time">{formatTimeAgo(reply.created_at)}</span>
                                </div>
                                <div className="reply-text">{reply.reply}</div>
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
                                  handleSubmitReply(showCommentsModal, comment.id);
                                }
                              }}
                              disabled={isPostingReply[comment.id]}
                              autoFocus
                            />
                            <button
                              className="comment-submit-btn"
                              onClick={() => handleSubmitReply(showCommentsModal, comment.id)}
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
                    value={newComment[showCommentsModal] || ''}
                    onChange={(e) => setNewComment(prev => ({ 
                      ...prev, 
                      [showCommentsModal]: e.target.value 
                    }))}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmitComment(showCommentsModal);
                      }
                    }}
                    disabled={isPostingComment[showCommentsModal]}
                  />
                  <button
                    className="comment-submit-btn"
                    onClick={() => handleSubmitComment(showCommentsModal)}
                    disabled={!newComment[showCommentsModal]?.trim() || isPostingComment[showCommentsModal]}
                  >
                    {isPostingComment[showCommentsModal] ? '...' : '➤'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TeamTasksTab
