import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { API_BASE_URL } from '@/config/api'
import './TaskManagement.css'
import FileIcon from '../shared/FileIcon.jsx'
import { AlertMessage, ConfirmationModal, CommentsModal } from './modals'
import { useAuth, useNetwork } from '../../contexts'
import { withErrorBoundary } from '../common'

const TaskManagement = ({ error, success, setError, setSuccess, clearMessages, user, contextAssignmentId }) => {
  const { user: authUser } = useAuth()
  const { isConnected } = useNetwork()

  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [expandedAssignments, setExpandedAssignments] = useState({})
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [comments, setComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [visibleReplies, setVisibleReplies] = useState({})
  const [isOpeningFile, setIsOpeningFile] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [assignmentToDelete, setAssignmentToDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showMenuForAssignment, setShowMenuForAssignment] = useState(null)
  const [expandedAttachments, setExpandedAttachments] = useState({})

  // Pagination state
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)

  // Ref for infinite scroll
  const observerRef = useRef(null)
  const loadMoreRef = useRef(null)

  useEffect(() => {
    fetchInitialAssignments()
  }, [])

  // Handle context from notifications (open assignment and highlight comment)
  useEffect(() => {
    if (contextAssignmentId && typeof contextAssignmentId === 'object') {
      const { assignmentId, commentId, shouldOpenComments } = contextAssignmentId

      if (assignmentId && shouldOpenComments) {
        // Find the assignment
        const assignment = assignments.find(a => a.id === assignmentId)
        if (assignment) {
          // Open comments modal
          openCommentsModal(assignment)

          // Highlight the comment after modal opens
          if (commentId) {
            setTimeout(() => {
              const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`)
              if (commentElement) {
                commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                commentElement.classList.add('highlight-comment')
                setTimeout(() => {
                  commentElement.classList.remove('highlight-comment')
                }, 2000)
              }
            }, 500)
          }
        }
      }
    }
  }, [contextAssignmentId, assignments])

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (loading || loadingMore || !hasMore) return

    const options = {
      root: null,
      rootMargin: '100px', // Start loading 100px before reaching the bottom
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

  // Handle clicking outside to close menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMenuForAssignment && !event.target.closest('.admin-card-menu')) {
        setShowMenuForAssignment(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenuForAssignment])

  const fetchInitialAssignments = async () => {
    try {
      setLoading(true)
      clearMessages()

      console.log('Fetching initial assignments...')

      const response = await fetch(`${API_BASE_URL}/api/assignments/admin/all?limit=20`)
      const data = await response.json()

      console.log('Initial assignments response:', data)

      if (!data.success) {
        setError(data.message || 'Failed to fetch assignments')
        setLoading(false)
        return
      }

      const allAssignments = data.assignments || []
      console.log(`Fetched ${allAssignments.length} initial assignments`)

      setAssignments(allAssignments)
      setNextCursor(data.nextCursor)
      setHasMore(data.hasMore)
    } catch (error) {
      console.error('Error fetching assignments:', error)
      setError('Failed to load assignments')
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

      console.log('Fetching more assignments with cursor:', nextCursor)

      const response = await fetch(`${API_BASE_URL}/api/assignments/admin/all?cursor=${nextCursor}&limit=20`)
      const data = await response.json()

      console.log('More assignments response:', data)

      if (!data.success) {
        setError(data.message || 'Failed to fetch more assignments')
        return
      }

      const newAssignments = data.assignments || []
      console.log(`Fetched ${newAssignments.length} more assignments`)

      setAssignments(prev => [...prev, ...newAssignments])
      setNextCursor(data.nextCursor)
      setHasMore(data.hasMore)
    } catch (error) {
      console.error('Error fetching more assignments:', error)
      setError('Failed to load more assignments')
    } finally {
      setLoadingMore(false)
    }
  }, [nextCursor, hasMore, loadingMore])

  // ⚡ OPTIMIZATION: Memoized fetchComments to prevent recreation
  const fetchComments = useCallback(async (assignmentId) => {
    try {
      setLoadingComments(true)
      const response = await fetch(`${API_BASE_URL}/api/assignments/${assignmentId}/comments`)
      const data = await response.json()

      if (data.success) {
        setComments(data.comments || [])
      } else {
        setError(data.message || 'Failed to load comments. Please try again.')
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
      setError('Failed to load comments')
    } finally {
      setLoadingComments(false)
    }
  }, [setError])

  // ⚡ OPTIMIZATION: Parallel loading - modal opens immediately, comments load in background
  const openCommentsModal = useCallback((assignment) => {
    setSelectedAssignment(assignment)
    setShowCommentsModal(true)
    // Don't await - let comments load in background for faster perceived performance
    fetchComments(assignment.id)
  }, [fetchComments])

  // ⚡ OPTIMIZATION: Memoized close handler
  const closeCommentsModal = useCallback(() => {
    setShowCommentsModal(false)
    setSelectedAssignment(null)
    setComments([])
    setNewComment('')
    setReplyingTo(null)
    setReplyText('')
  }, [])

  // ⚡ OPTIMIZATION: Optimistic update + memoized handler
  const handlePostComment = useCallback(async (e) => {
    e.preventDefault()

    if (!newComment.trim()) return

    try {
      if (!user || !user.id) {
        setError('User session not found. Please log in again.')
        return
      }

      const currentUser = user
      const commentText = newComment

      // ⚡ OPTIMIZATION: Optimistic update - add comment to UI immediately
      const optimisticComment = {
        id: `temp-${Date.now()}`,
        comment: commentText,
        user_id: currentUser.id,
        username: currentUser.username,
        user_fullname: currentUser.fullName,
        user_role: currentUser.role,
        created_at: new Date().toISOString(),
        replies: []
      }
      setComments(prev => [...prev, optimisticComment])
      setNewComment('')

      const response = await fetch(`${API_BASE_URL}/api/assignments/${selectedAssignment.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: currentUser.id,
          username: currentUser.username,
          comment: commentText
        })
      })

      const data = await response.json()

      if (data.success) {
        // ⚡ OPTIMIZATION: Only refetch to get the real ID and any server updates
        await fetchComments(selectedAssignment.id)
        setSuccess('Comment posted successfully')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        // Rollback optimistic update on error
        setComments(prev => prev.filter(c => c.id !== optimisticComment.id))
        setNewComment(commentText)
        setError(data.message || 'Failed to post comment')
      }
    } catch (error) {
      console.error('Error posting comment:', error)
      setError('Failed to post comment')
    }
  }, [newComment, user, selectedAssignment, fetchComments, setError, setSuccess])

  // ⚡ OPTIMIZATION: Optimistic update + memoized handler
  const handlePostReply = useCallback(async (e, commentId) => {
    e.preventDefault()

    if (!replyText.trim()) return

    try {
      if (!user || !user.id) {
        setError('User session not found. Please log in again.')
        return
      }

      const currentUser = user
      const replyMessage = replyText

      // ⚡ OPTIMIZATION: Optimistic update - add reply to UI immediately
      const optimisticReply = {
        id: `temp-${Date.now()}`,
        reply: replyMessage,
        user_id: currentUser.id,
        username: currentUser.username,
        user_fullname: currentUser.fullName,
        user_role: currentUser.role,
        created_at: new Date().toISOString()
      }

      setComments(prev => prev.map(comment =>
        comment.id === commentId
          ? { ...comment, replies: [...(comment.replies || []), optimisticReply] }
          : comment
      ))
      setReplyText('')
      setReplyingTo(null)

      const response = await fetch(
        `${API_BASE_URL}/api/assignments/${selectedAssignment.id}/comments/${commentId}/reply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: currentUser.id,
            username: currentUser.username,
            reply: replyMessage
          })
        }
      )

      const data = await response.json()

      if (data.success) {
        // ⚡ OPTIMIZATION: Only refetch to sync with server
        await fetchComments(selectedAssignment.id)
        setSuccess('Reply posted successfully')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        // Rollback optimistic update on error
        setComments(prev => prev.map(comment =>
          comment.id === commentId
            ? { ...comment, replies: (comment.replies || []).filter(r => r.id !== optimisticReply.id) }
            : comment
        ))
        setReplyText(replyMessage)
        setReplyingTo(commentId)
        setError(data.message || 'Failed to post reply')
      }
    } catch (error) {
      console.error('Error posting reply:', error)
      setError('Failed to post reply')
    }
  }, [replyText, user, selectedAssignment, fetchComments, setError, setSuccess])

  const toggleExpand = (assignmentId) => {
    setExpandedAssignments(prev => ({
      ...prev,
      [assignmentId]: !prev[assignmentId]
    }))
  }

  const toggleAttachments = (assignmentId) => {
    setExpandedAttachments(prev => ({
      ...prev,
      [assignmentId]: !prev[assignmentId]
    }))
  }

  // ⚡ OPTIMIZATION: Memoized utility function
  const getInitials = useCallback((name) => {
    if (!name) return '?'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }, [])

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

  // ⚡ OPTIMIZATION: Memoized utility function
  const formatTimeAgo = useCallback((dateString) => {
    if (!dateString) return 'Unknown'
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now - date) / 1000)

    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }, [])

  const getStatusColor = (dueDate) => {
    if (!dueDate) return '#95a5a6'
    const date = new Date(dueDate)
    const now = new Date()
    const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return '#e74c3c'
    if (diffDays <= 2) return '#f39c12'
    return '#27ae60'
  }

  // ⚡ OPTIMIZATION: Memoized toggle handler
  const toggleRepliesVisibility = useCallback((commentId) => {
    setVisibleReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }))
  }, [])

  const handleCommentKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handlePostComment(e)
    }
  }

  const handleReplyKeyDown = (e, commentId) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handlePostReply(e, commentId)
    }
  }

  const handleOpenFile = async (filePath, fileId) => {
    if (!filePath) {
      setError('File path not available')
      return
    }

    try {
      setIsOpeningFile(true)
      // Clear any previous messages
      clearMessages()

      // Show loading message
      setSuccess('Opening file...')

      // Small delay for UI feedback
      await new Promise(resolve => setTimeout(resolve, 300));

      // Check if running in Electron
      const isElectron = window.electron && window.electron.openFileInApp;

      if (isElectron) {
        console.log('💻 Running in Electron - using Windows default application');

        // For uploaded files, get the full system path from server
        const pathResponse = await fetch(
          `${API_BASE_URL}/api/files/${fileId}/path`
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

        // For browser, open the file directly using the static file serving
        const fileUrl = `${API_BASE_URL}${filePath}`;
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
      setSuccess('') // Clear loading message
      setError(`Error opening file: File deleted/rejected or ${error.message || 'Failed to open file'}`);
    } finally {
      setIsOpeningFile(false)
    }
  }

  const handleDeleteAssignment = async () => {
    if (!assignmentToDelete) return

    try {
      setIsDeleting(true)
      clearMessages()
      setSuccess('Deleting assignment and associated files...')

      const response = await fetch(`${API_BASE_URL}/api/assignments/${assignmentToDelete.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        // Remove the assignment from the local state
        setAssignments(prev => prev.filter(assignment => assignment.id !== assignmentToDelete.id))
        setSuccess('Assignment and associated files deleted successfully')
        setTimeout(() => setSuccess(''), 3000)
        setShowDeleteModal(false)
        setAssignmentToDelete(null)
      } else {
        setError(data.message || 'Failed to delete assignment')
      }
    } catch (error) {
      console.error('Error deleting assignment:', error)
      setError('Failed to delete assignment')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false)
    setAssignmentToDelete(null)
  }

  // Skeleton loader for initial load
  if (loading) {
    return (
      <div className="task-management-container">
        <div className="task-feed">
          <div className="feed-header-simple">
            <h2>All Tasks</h2>
          </div>
          <div className="task-count">Loading...</div>
          <div className="feed-container">
            <div className="loading-skeleton">
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton-assignment-card">
                  {/* Card Header */}
                  <div className="skeleton-card-header">
                    <div className="skeleton-header-left">
                      <div className="skeleton-avatar"></div>
                      <div className="skeleton-header-info">
                        <div className="skeleton-line skeleton-line-medium"></div>
                        <div className="skeleton-line skeleton-line-small"></div>
                      </div>
                    </div>
                    <div className="skeleton-header-right">
                      <div className="skeleton-line skeleton-line-tiny"></div>
                    </div>
                  </div>

                  {/* Task Title */}
                  <div className="skeleton-title-section">
                    <div className="skeleton-line skeleton-line-title"></div>
                  </div>

                  {/* Task Description */}
                  <div className="skeleton-description-section">
                    <div className="skeleton-line skeleton-line-full"></div>
                    <div className="skeleton-line skeleton-line-full"></div>
                    <div className="skeleton-line skeleton-line-medium"></div>
                  </div>

                  {/* Attachments */}
                  <div className="skeleton-attachment-section">
                    <div className="skeleton-line skeleton-line-small"></div>
                    <div className="skeleton-file-item">
                      <div className="skeleton-file-icon"></div>
                      <div className="skeleton-file-info">
                        <div className="skeleton-line skeleton-line-medium"></div>
                        <div className="skeleton-line skeleton-line-small"></div>
                      </div>
                    </div>
                  </div>

                  {/* Comments */}
                  <div className="skeleton-comments-section">
                    <div className="skeleton-line skeleton-line-tiny"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`task-management-container ${isOpeningFile ? 'file-opening-cursor' : ''}`}>
      {/* Messages */}
      {error && (
        <AlertMessage
          type="error"
          message={error}
          onClose={clearMessages}
        />
      )}

      {success && (
        <AlertMessage
          type="success"
          message={success}
          onClose={clearMessages}
        />
      )}

      <div className="task-feed">
        <div className="feed-header-simple">
          <h2>All Tasks</h2>
        </div>

        {/* Task Count */}
        <div className="task-count">
          {assignments.length} task{assignments.length !== 1 ? 's' : ''}
          {hasMore && ' • Scroll for more'}
        </div>

        {/* Feed */}
        <div className="feed-container">
          {assignments.length === 0 ? (
            <div className="empty-feed">
              <div className="empty-icon">📭</div>
              <h3>No Tasks Yet</h3>
              <p>Team leaders haven't created any assignments yet.</p>
            </div>
          ) : (
            <>
              {assignments.map(assignment => (
                <div key={assignment.id} className="admin-assignment-card">
                  {/* Card Header */}
                  <div className="admin-card-header">
                    <div className="admin-header-left">
                      <div className="admin-avatar">
                        {getInitials(assignment.team_leader_fullname || assignment.team_leader_username)}
                      </div>
                      <div className="admin-header-info">
                        <div className="admin-assignment-assigned">
                          <span className="admin-team-leader-name">
                            {assignment.team_leader_fullname || assignment.team_leader_username}
                          </span>
                          <span className="role-badge team-leader">TEAM LEADER</span>
                          assigned to{' '}
                          <span className="admin-assigned-user">
                            {assignment.assigned_member_details && assignment.assigned_member_details.length > 0
                              ? assignment.assigned_member_details.length === 1
                                ? (assignment.assigned_member_details[0].fullName || assignment.assigned_member_details[0].username)
                                : `${assignment.assigned_member_details.length} members (${assignment.assigned_member_details.map(m => m.fullName || m.username).join(', ')})`
                              : assignment.assigned_to === 'all'
                                ? 'All team members'
                                : 'Unknown User'}
                          </span>
                        </div>
                        <div className="admin-assignment-created">
                          {assignment.created_at ? formatDateTime(assignment.created_at) : 'Unknown creation date'}
                        </div>
                      </div>
                    </div>
                    <div className="admin-header-right">
                      <div className="admin-card-menu">
                        <button
                          className="admin-menu-btn"
                          onClick={() => setShowMenuForAssignment(showMenuForAssignment === assignment.id ? null : assignment.id)}
                          title="More options"
                        >
                          ⋮
                        </button>
                        {showMenuForAssignment === assignment.id && (
                          <div className="admin-menu-dropdown">
                            <button
                              className="admin-menu-item admin-delete-menu-item"
                              onClick={() => {
                                setAssignmentToDelete(assignment)
                                setShowDeleteModal(true)
                                setShowMenuForAssignment(null)
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                      {assignment.due_date && (
                        <div className="admin-due-date">
                          Due: {formatDate(assignment.due_date)}
                          <span
                            className="admin-days-left"
                            style={{ color: getStatusColor(assignment.due_date) }}
                          >
                            {' '}({formatDaysLeft(assignment.due_date)})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Task Title */}
                  <div className="admin-task-title-section">
                    <h3 className="admin-assignment-title">{assignment.title}</h3>
                  </div>

                  {/* Task Description */}
                  {assignment.description && (
                    <div className="admin-task-description-section">
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
                    </div>
                  )}

                  {/* Attachment */}
                  <div className="admin-attachment-section">
                    {assignment.recent_submissions && assignment.recent_submissions.length > 0 ? (
                      <div className="admin-attached-file">
                        <div className="admin-file-label">📎 Attachment{assignment.recent_submissions.length > 1 ? 's' : ''} ({assignment.recent_submissions.length}):</div>
                        {(expandedAttachments[assignment.id]
                          ? assignment.recent_submissions
                          : assignment.recent_submissions.slice(0, 5)
                        ).map((file, index) => (
                          <div
                            key={file.id}
                            className="admin-file-item"
                            onClick={() => handleOpenFile(file.file_path, file.id)}
                            style={{
                              cursor: 'pointer',
                              marginBottom: index < (expandedAttachments[assignment.id] ? assignment.recent_submissions.length : Math.min(5, assignment.recent_submissions.length)) - 1 ? '8px' : '0'
                            }}
                          >
                            <FileIcon
                              fileType={file.original_name.split('.').pop()}
                              size="small"
                              className="admin-file-icon"
                            />
                            <div className="admin-file-details">
                              <div className="admin-file-name">{file.original_name}</div>
                              <div className="admin-file-meta">
                                Submitted by <span className="admin-file-submitter">{file.fullName || file.username}</span> on {formatDate(file.submitted_at)}
                                {file.tag && (
                                  <span style={{
                                    backgroundColor: '#dbeafe',
                                    color: '#1e40af',
                                    padding: '4px 10px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    border: '1px solid #93c5fd',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    marginLeft: '8px'
                                  }}>
                                    🏷️ {file.tag}
                                  </span>
                                )}
                                <span className={`admin-file-status ${file.status === 'uploaded' ? 'uploaded' :
                                  file.status === 'team_leader_approved' ? 'team-leader-approved' :
                                    file.status === 'final_approved' ? 'final-approved' :
                                      file.status === 'rejected_by_team_leader' || file.status === 'rejected_by_admin' ? 'rejected' :
                                        'uploaded'
                                  }`}>
                                  {file.status === 'uploaded' ? 'PENDING TEAM LEADER' :
                                    file.status === 'team_leader_approved' ? 'PENDING ADMIN' :
                                      file.status === 'final_approved' ? '✓ APPROVED' :
                                        file.status === 'rejected_by_team_leader' ? '✗ REJECTED' :
                                          file.status === 'rejected_by_admin' ? '✗ REJECTED' :
                                            'DELETED by user'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {assignment.recent_submissions.length > 5 && (
                          <button
                            className="admin-attachment-toggle-btn"
                            onClick={() => toggleAttachments(assignment.id)}
                          >
                            {expandedAttachments[assignment.id]
                              ? 'See less'
                              : `See more (${assignment.recent_submissions.length - 5} more)`}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="admin-no-attachment">
                        <span className="admin-no-attachment-icon">📄</span>
                        <span className="admin-no-attachment-text">
                          No attachments yet
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Comments */}
                  <div className="admin-comments-section">
                    <div className="admin-comments-text" onClick={() => openCommentsModal(assignment)}>
                      Comments ({assignment.comment_count || 0})
                    </div>
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

        {/* Comments Modal */}
        <CommentsModal
          isOpen={showCommentsModal}
          onClose={closeCommentsModal}
          assignment={selectedAssignment}
          comments={comments}
          loadingComments={loadingComments}
          newComment={newComment}
          setNewComment={setNewComment}
          onPostComment={handlePostComment}
          replyingTo={replyingTo}
          setReplyingTo={setReplyingTo}
          replyText={replyText}
          setReplyText={setReplyText}
          onPostReply={handlePostReply}
          visibleReplies={visibleReplies}
          toggleRepliesVisibility={toggleRepliesVisibility}
          getInitials={getInitials}
          formatTimeAgo={formatTimeAgo}
          user={user}
        />

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={handleCloseDeleteModal}
          onConfirm={handleDeleteAssignment}
          title="Delete Task"
          message="Are you sure you want to delete this task?"
          confirmText="Delete Task"
          cancelText="Cancel"
          variant="danger"
          isLoading={isDeleting}
          itemInfo={assignmentToDelete ? {
            name: assignmentToDelete.title,
            details: `${assignmentToDelete.comment_count || 0} comment${(assignmentToDelete.comment_count || 0) !== 1 ? 's' : ''} • ${assignmentToDelete.recent_submissions?.length || 0} submission${(assignmentToDelete.recent_submissions?.length || 0) !== 1 ? 's' : ''}`
          } : null}
        >
          <p className="warning-text">
            This action cannot be undone. The task and all associated comments will be permanently removed from the system.
          </p>
        </ConfirmationModal>
      </div>
    </div>
  )
}

export default withErrorBoundary(TaskManagement, {
  componentName: 'Task Management'
})
