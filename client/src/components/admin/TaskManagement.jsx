import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { apiFetch, API_BASE_URL } from '@/config/api'
import './TaskManagement.css'
import './SmartNavigation.css'
import { AlertMessage, ConfirmationModal, CommentsModal, FileOpenModal, PremiumTaskCard, PremiumModal } from '../shared'
import { useAuth, useNetwork } from '../../contexts'
import { withErrorBoundary } from '../common'
import { useSmartNavigation } from '../shared/SmartNavigation'
import { formatDate, formatDateTime, formatFileSize, groupFilesByFolder, getInitials } from '../../utils/ui-helpers';
import { openFile, downloadFile, downloadFolder } from '../../utils/file-actions';

// Helpers moved to shared/utils/ui-helpers.js and file-actions.js

const TaskManagement = ({
  error,
  success,
  setError,
  setSuccess,
  clearMessages,
  user,
  contextAssignmentId,
  // Smart Navigation Props
  highlightedAssignmentId,
  highlightedFileId,
  notificationCommentContext,
  onClearHighlight,
  onClearFileHighlight,
  onClearNotificationContext
}) => {
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
  const [showOpenFileConfirmation, setShowOpenFileConfirmation] = useState(false)
  const [fileToOpen, setFileToOpen] = useState(null)
  const [expandedFolders, setExpandedFolders] = useState({})
  const [downloadToast, setDownloadToast] = useState({ show: false, fileName: '' })
  const [openedFileIds, setOpenedFileIds] = useState(new Set())
  const [openedFilesStorageReady, setOpenedFilesStorageReady] = useState(false)

  // Load from persistent storage on mount
  useEffect(() => {
    ; (async () => {
      try {
        let stored = null
        if (window.electron?.appStorage) {
          stored = await window.electron.appStorage.get('kmti_opened_files_admin')
        }
        if (!stored) stored = localStorage.getItem('kmti_opened_files_admin')
        if (stored) setOpenedFileIds(new Set(JSON.parse(stored)))
      } catch { }
      setOpenedFilesStorageReady(true)
    })()
  }, [])

  // Save to persistent storage whenever it changes (only after initial load)
  useEffect(() => {
    if (!openedFilesStorageReady) return
    const data = JSON.stringify([...openedFileIds])
    if (window.electron?.appStorage) {
      window.electron.appStorage.set('kmti_opened_files_admin', data)
    }
    try { localStorage.setItem('kmti_opened_files_admin', data) } catch { }
  }, [openedFileIds, openedFilesStorageReady])

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

      const data = await apiFetch(`/api/assignments/admin/all?limit=20`)

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
      const data = await apiFetch(`/api/assignments/admin/all?cursor=${nextCursor}&limit=20`)

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
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments`)

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


  // SMART NAVIGATION: Use shared hook for all highlighting and modal effects
  // IMPORTANT: Must be called AFTER openCommentsModal is defined
  useSmartNavigation({
    role: 'admin',
    items: assignments,
    highlightedItemId: highlightedAssignmentId,
    highlightedFileId,
    notificationContext: notificationCommentContext,
    onClearHighlight,
    onClearFileHighlight,
    onClearNotificationContext,
    openCommentsModal,
    setVisibleReplies,
    showCommentsModal,
    selectedItem: selectedAssignment,
    comments
  });

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

      const data = await apiFetch(`/api/assignments/${selectedAssignment.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          userId: currentUser.id,
          username: currentUser.username,
          comment: commentText
        })
      })

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
  const handlePostReply = useCallback(async (e, commentId, replyTextArg, onSuccess) => {
    e.preventDefault()

    const replyMessage = (replyTextArg ?? replyText).trim()
    if (!replyMessage) return

    try {
      if (!user || !user.id) {
        setError('User session not found. Please log in again.')
        return
      }

      const currentUser = user

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
      if (onSuccess) onSuccess()

      const data = await apiFetch(
        `/api/assignments/${selectedAssignment.id}/comments/${commentId}/reply`,
        {
          method: 'POST',
          body: JSON.stringify({
            userId: currentUser.id,
            username: currentUser.username,
            reply: replyMessage
          })
        }
      )

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

  const toggleFolder = (assignmentId, folderName) => {
    const key = `${assignmentId}-${folderName}`
    setExpandedFolders(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const groupFilesByFolder = (files) => {
    const folders = {}
    const individualFiles = []

    files.forEach(file => {
      if (file.folder_name && file.folder_name.trim() !== '') {
        if (!folders[file.folder_name]) {
          folders[file.folder_name] = []
        }
        folders[file.folder_name].push(file)
      } else {
        individualFiles.push(file)
      }
    })

    return { folders, individualFiles }
  }

  const triggerDownloadToast = (fileName) => {
    setDownloadToast({ show: true, fileName })
    setTimeout(() => setDownloadToast({ show: false, fileName: '' }), 3500)
  }

  const recordView = async (fileId) => {
    if (!user || !fileId) return
    try {
      await apiFetch(`/api/files/${fileId}/view`, {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role || 'admin'
        })
      })
    } catch { }
  }

  const handleDownloadFile = async (file) => {
    const fileUrl = `${API_BASE_URL}/api/files/${file.id}/download`
    const fileName = file.original_name || file.filename || 'file'
    if (window.electron && window.electron.downloadFile) {
      const result = await window.electron.downloadFile(fileUrl, fileName)
      if (result && !result.success && !result.canceled) {
        setError(result.error || 'Download failed')
      } else if (result && result.success) {
        triggerDownloadToast(fileName)
      }
    } else {
      const a = document.createElement('a')
      a.href = fileUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      triggerDownloadToast(fileName)
    }
  }

  const handleDownloadFolder = async (folderFiles, folderName) => {
    const fileIds = folderFiles.map(f => f.id).join(',')
    const fileUrl = `${API_BASE_URL}/api/files/folder/zip?fileIds=${fileIds}&folderName=${encodeURIComponent(folderName)}`
    const fileName = `${folderName}.zip`
    if (window.electron && window.electron.downloadFile) {
      const result = await window.electron.downloadFile(fileUrl, fileName)
      if (result && !result.success && !result.canceled) {
        setError(result.error || 'Folder download failed')
      } else if (result && result.success) {
        triggerDownloadToast(fileName)
      }
    } else {
      const a = document.createElement('a')
      a.href = fileUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      triggerDownloadToast(fileName)
    }
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
        console.log('Running in Electron - using Windows default application');

        // For uploaded files, get the full system path from server
        const pathData = await apiFetch(
          `/api/files/${fileId}/path`
        );

        if (!pathData.success) {
          throw new Error(pathData.message || 'Failed to get file path');
        }

        console.log('Full path:', pathData.filePath);
        console.log('File name:', pathData.fileName);

        const result = await window.electron.openFileInApp(pathData.filePath);

        if (result.success) {
          console.log('Opened with Windows default application');
          setSuccess('File opened successfully');
          return true
        } else {
          throw new Error(result.error || 'Failed to open file');
        }
      } else {
        console.log('Running in browser - opening in new tab');

        // For browser, open the file directly using the static file serving
        const fileUrl = `${API_BASE_URL}${filePath}`;
        const newWindow = window.open(fileUrl, '_blank');

        if (!newWindow) {
          throw new Error('Pop-up blocked. Please allow pop-ups for this site.');
        }

        newWindow.focus();
        console.log('Opened in browser tab');
        setSuccess('File opened in browser');
        return true
      }

    } catch (error) {
      console.error('Error opening file:', error);
      setSuccess('') // Clear loading message
      setError(`Error opening file: File deleted/rejected or ${error.message || 'Failed to open file'}`);
      return false
    } finally {
      setIsOpeningFile(false)
    }
  }

  const handleDeleteAssignment = async () => {
    if (!assignmentToDelete) return

    try {
      setIsDeleting(true)
      clearMessages()

      const data = await apiFetch(`/api/assignments/${assignmentIdToDelete.id}`, {
        method: 'DELETE'
      })

      if (data.success) {
        // Remove the assignment from the local state
        setAssignments(prev => prev.filter(assignment => assignment.id !== assignmentToDelete.id))
        setError('Assignment deleted successfully')
        setTimeout(() => setError(''), 3000)
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

        <div className="task-count">
          {assignments.length} task{assignments.length !== 1 ? 's' : ''}
          {hasMore && ' • Scroll for more'}
        </div>

        <div className="feed-container">
          {assignments.length === 0 ? (
            <div className="empty-feed">
              <div className="empty-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-6l-2 3h-4l-2-3H2" />
                  <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
                </svg>
              </div>
              <h3>No Tasks Yet</h3>
              <p>Team leaders haven't created any assignments yet.</p>
            </div>
          ) : (
            <>
              <div className="admin-tasks-grid">
                {assignments.map(assignment => (
                  <PremiumTaskCard
                    key={assignment.id}
                    task={assignment}
                    role="admin"
                    onCommentClick={openCommentsModal}
                    onActionClick={(action, t) => {
                      if (action === 'delete') confirmDeleteAssignment(t);
                      if (action === 'refresh') fetchAssignments();
                    }}
                    onFileClick={(file) => handleOpenFile(file.file_path, file.id)}
                    openedFileIds={openedFileIds}
                    className="admin-task-card-margin"
                  />
                ))}
              </div>

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

        {/* File Open Modal */}
        <FileOpenModal
          isOpen={showOpenFileConfirmation}
          onClose={() => {
            setShowOpenFileConfirmation(false)
            setFileToOpen(null)
          }}
          onConfirm={async () => {
            if (!fileToOpen) return
            const fileId = fileToOpen.id
            try {
              const opened = await handleOpenFile(fileToOpen.file_path, fileToOpen.id)
              if (opened) setOpenedFileIds(prev => new Set([...prev, fileId]))
            } finally {
              setShowOpenFileConfirmation(false)
              setFileToOpen(null)
            }
          }}
          file={fileToOpen}
        />

        {/* Download Success Toast */}
        {downloadToast.show && (
          <div
            style={{
              position: 'fixed',
              top: '28px',
              right: '28px',
              zIndex: 9999,
              background: '#fff',
              border: '1px solid #bbf7d0',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
              padding: '18px 22px 14px 18px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px',
              minWidth: '280px',
              maxWidth: '380px',
              animation: 'adminSlideInRight 0.25s ease',
            }}
          >
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: '#dcfce7', border: '2px solid #86efac',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0, marginTop: '1px'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#15803d', marginBottom: '4px' }}>
                Success
              </div>
              <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.4' }}>
                {downloadToast.fileName
                  ? `"${downloadToast.fileName}" downloaded successfully!`
                  : 'File downloaded successfully!'}
              </div>
              <div style={{ marginTop: '10px', height: '4px', borderRadius: '2px', background: '#dcfce7', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '2px', background: '#22c55e',
                  animation: 'adminShrinkBar 3.5s linear forwards'
                }} />
              </div>
            </div>
            <button
              onClick={() => setDownloadToast({ show: false, fileName: '' })}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#9ca3af', fontSize: '20px', lineHeight: 1,
                padding: '0', flexShrink: 0, borderRadius: '4px', marginTop: '-2px'
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#374151'}
              onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
            >×</button>
          </div>
        )}

        <style>{`
          @keyframes adminSlideInRight {
            from { opacity: 0; transform: translateX(40px); }
            to   { opacity: 1; transform: translateX(0); }
          }
          @keyframes adminShrinkBar {
            from { width: 100%; }
            to   { width: 0%; }
          }
        `}</style>
      </div>
    </div>
  )
}

export default withErrorBoundary(TaskManagement, {
  componentName: 'Task Management'
})
