import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { apiFetch, API_BASE_URL } from '@/config/api'
import './TaskManagement.css'
import './SmartNavigation.css'
import FileIcon from '../shared/FileIcon.jsx'
import FileViewersButton from '../shared/FileViewersButton.jsx'
import { AlertMessage, ConfirmationModal, CommentsModal, FileOpenModal } from './modals'
import { useAuth, useNetwork } from '../../contexts'
import { withErrorBoundary } from '../common'
import { useSmartNavigation } from '../shared/SmartNavigation'
import { recursiveGroupByPath } from '@utils/folderUtils'

// Utility function to format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

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
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [expandedAssignments, setExpandedAssignments] = useState({})
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [comments, setComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [isPostingComment, setIsPostingComment] = useState(false)
  const [isPostingReply, setIsPostingReply] = useState(false)
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
  // Map of fileId -> viewer count for instant badge update
  const [viewerCounts, setViewerCounts] = useState({})

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

  // Filtered assignments based on search
  const filteredAssignments = useMemo(() => {
    if (!searchQuery.trim()) return assignments
    const q = searchQuery.toLowerCase()
    return assignments.filter(a =>
      (a.title || '').toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q) ||
      (a.team_leader_fullname || '').toLowerCase().includes(q) ||
      (a.team_leader_username || '').toLowerCase().includes(q) ||
      (a.assigned_member_details || []).some(m =>
        (m.fullName || '').toLowerCase().includes(q) ||
        (m.username || '').toLowerCase().includes(q)
      )
    )
  }, [assignments, searchQuery])

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

      const data = await apiFetch(`/api/assignments/admin/all`)

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
      const data = await apiFetch(`/api/assignments/admin/all?cursor=${nextCursor}`)

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

      setIsPostingComment(true)
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
    } finally {
      setIsPostingComment(false)
    }
  }, [newComment, user, selectedAssignment, fetchComments, setError, setSuccess])

  const handleEditComment = useCallback(async (assignmentId, commentId, newText) => {
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments/${commentId}`, {
        method: 'PUT',
        body: JSON.stringify({ userId: user.id, comment: newText }),
      });
      if (data.success) fetchComments(assignmentId);
      else setError(data.message || 'Failed to edit comment');
    } catch (error) {
      console.error('Error editing comment:', error);
      setError('Failed to edit comment');
    }
  }, [user.id, fetchComments, setError]);

  const handleDeleteComment = useCallback(async (assignmentId, commentId) => {
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments/${commentId}`, {
        method: 'DELETE',
        body: JSON.stringify({ userId: user.id }),
      });
      if (data.success) fetchComments(assignmentId);
      else setError(data.message || 'Failed to delete comment');
    } catch (error) {
      console.error('Error deleting comment:', error);
      setError('Failed to delete comment');
    }
  }, [user.id, fetchComments, setError]);

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

      setIsPostingReply(true)
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
    } finally {
      setIsPostingReply(false)
    }
  }, [replyText, user, selectedAssignment, fetchComments, setError, setSuccess])

  const handleEditReply = useCallback(async (assignmentId, commentId, replyId, newText) => {
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments/${commentId}/reply/${replyId}`, {
        method: 'PUT',
        body: JSON.stringify({ userId: user.id, reply: newText }),
      });
      if (data.success) fetchComments(assignmentId);
      else setError(data.message || 'Failed to edit reply');
    } catch (error) {
      console.error('Error editing reply:', error);
      setError('Failed to edit reply');
    }
  }, [user.id, fetchComments, setError]);

  const handleDeleteReply = useCallback(async (assignmentId, commentId, replyId) => {
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments/${commentId}/reply/${replyId}`, {
        method: 'DELETE',
        body: JSON.stringify({ userId: user.id }),
      });
      if (data.success) fetchComments(assignmentId);
      else setError(data.message || 'Failed to delete reply');
    } catch (error) {
      console.error('Error deleting reply:', error);
      setError('Failed to delete reply');
    }
  }, [user.id, fetchComments, setError]);

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

  const recordView = async (fileId, isAttachment = false) => {
    if (!user || !fileId) return
    // Instantly bump badge count
    setViewerCounts(prev => ({ ...prev, [fileId]: (prev[fileId] ?? 0) + 1 }))
    try {
      await apiFetch(`/api/files/${fileId}/view?type=${isAttachment ? 'attachment' : 'submission'}`, {
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
    if (!window.electron || !window.electron.downloadFolder) {
      const fileIds = folderFiles.map(f => f.id).join(',')
      const fileUrl = `${API_BASE_URL}/api/files/folder/zip?fileIds=${fileIds}&folderName=${encodeURIComponent(folderName)}`
      const a = document.createElement('a')
      a.href = fileUrl
      a.download = `${folderName}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      return
    }
    try {
      const fileIds = folderFiles.map(f => f.id).filter(Boolean)
      const data = await apiFetch('/api/files/bulk-path', {
        method: 'POST',
        body: JSON.stringify({ fileIds, type: 'file' })
      })
      const fileInfoList = (data.results || []).map((r, i) => {
        const file = folderFiles.find(f => f.id === r.id) || folderFiles[i] || {}
        return { srcPath: r.success ? r.path : null, name: file.original_name || r.originalName, relativePath: file.relative_path || null }
      })
      const result = await window.electron.downloadFolder(folderName, fileInfoList)
      if (result && result.success) { triggerDownloadToast(folderName) }
      else if (result && !result.success) { setError(result.error || 'Folder download failed') }
    } catch (err) { setError(err.message || 'Folder download failed') }
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
      const absDays = Math.abs(diffDays)
      return `${absDays} ${absDays === 1 ? 'day' : 'days'} overdue`
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

      const data = await apiFetch(`/api/assignments/${assignmentToDelete.id}`, {
        method: 'DELETE'
      })

      if (data.success) {
        // Remove the assignment from the local state
        setAssignments(prev => prev.filter(assignment => assignment.id !== assignmentToDelete.id))
        setSuccess('Assignment deleted successfully')
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

        {/* Search Bar */}
        <div style={{ margin: '0 0 10px 0', position: 'relative', maxWidth: '320px' }}>
          <svg style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#c4c9d4', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '8px 28px 8px 28px',
              border: '1.5px solid #e8eaed', borderRadius: '8px',
              fontSize: '13.5px', color: '#374151',
              outline: 'none', background: '#fff',
              transition: 'border-color 0.15s',
              boxShadow: 'none'
            }}
            onFocus={e => e.target.style.borderColor = '#c4c9d4'}
            onBlur={e => e.target.style.borderColor = '#e8eaed'}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#c4c9d4', fontSize: '15px', lineHeight: 1, padding: '1px' }}
            >×</button>
          )}
        </div>

        {/* Task Count - search results only */}
        {searchQuery && (
          <div className="task-count">
            {filteredAssignments.length} result{filteredAssignments.length !== 1 ? 's' : ''} for "{searchQuery}"
          </div>
        )}

        {/* Feed */}
        <div className="feed-container">
          {filteredAssignments.length === 0 ? (
            <div className="empty-feed">
              <div className="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" /></svg></div>
              <h3>{searchQuery ? 'No Results Found' : 'No Tasks Yet'}</h3>
              <p>{searchQuery ? `No tasks match "${searchQuery}".` : "Team leaders haven't created any assignments yet."}</p>
            </div>
          ) : (
            <>
              {filteredAssignments.map(assignment => {
                const renderRecursiveItems = (files, level = 1, parentKey = '', parentIsLastArr = [], isAttachment = true) => {
                  const { subfolders, rootFiles } = recursiveGroupByPath(files);
                  const subItems = [];

                  const subfolderEntries = Object.entries(subfolders);
                  const totalSubfolders = subfolderEntries.length;
                  const totalRootFiles = rootFiles.length;

                  // 1. Render subfolders
                  subfolderEntries.forEach(([subName, subFiles], index) => {
                    const isLast = (index === totalSubfolders - 1) && (totalRootFiles === 0);
                    const subKey = parentKey ? `${parentKey}__${subName}` : `${assignment.id}__${subName}__${isAttachment ? 'att' : 'sub'}`;
                    const isSubOpen = expandedFolders[subKey];
                    const subFirstFile = subFiles[0].file || subFiles[0];

                    subItems.push(
                      <div key={`subfolder-${subKey}`} style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className="tl-tree-container" style={{ marginBottom: '7px' }}>
                          {parentIsLastArr.map((isLastParent, i) => (
                            <div key={i} className={isLastParent ? "tl-tree-line-empty" : "tl-tree-line-vertical"} />
                          ))}
                          {level > 0 && <div className={`tl-tree-line-connector ${isLast ? 'last-item' : ''}`} />}
                          
                          <div
                            className="admin-file-item admin-folder-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedFolders(prev => ({ ...prev, [subKey]: !prev[subKey] }));
                            }}
                            style={{ 
                              cursor: 'pointer', 
                              backgroundColor: isSubOpen ? '#BFDBFE' : '#DBEAFE', 
                              padding: '14px 20px',
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              border: isAttachment ? '1px solid #000000' : '1px solid #93c5fd'
                            }}
                          >
                            <div style={{ fontSize: '32px', flexShrink: 0 }}>{isSubOpen ? '📂' : '📁'}</div>
                            <div className="admin-file-details" style={{ flex: 1, minWidth: 0 }}>
                              <div className="admin-file-name" style={{ fontWeight: '600', fontSize: '15px', color: '#111827' }}>{subName}</div>
                              <div className="admin-file-meta" style={{ fontSize: '12px', color: '#4b5563', marginTop: '1px' }}>
                              {isAttachment ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span>Submitted by {assignment.team_leader_fullname || assignment.team_leader_username || 'Team Leader'}</span>
                              <span style={{ color: '#9ca3af' }}>•</span>
                              <span>{subFiles.length} file{subFiles.length !== 1 ? 's' : ''}</span>
                                  {(subFirstFile.submitted_at || subFirstFile.uploaded_at || subFirstFile.created_at) && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#6b7280' }}>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                  </svg>
                                  {formatDateTime(subFirstFile.submitted_at || subFirstFile.uploaded_at || subFirstFile.created_at)}
                              </span>
                              )}
                              </span>
                              ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span>Submitted by <span style={{ fontWeight: '600', color: '#2563eb' }}>{subFirstFile.fullName || subFirstFile.username || 'Member'}</span></span>
                              <span style={{ color: '#9ca3af' }}>•</span>
                                <span>{subFiles.length} file{subFiles.length !== 1 ? 's' : ''}</span>
                                  {(subFirstFile.submitted_at || subFirstFile.uploaded_at || subFirstFile.created_at) && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#6b7280' }}>
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                      </svg>
                                      {formatDateTime(subFirstFile.submitted_at || subFirstFile.uploaded_at || subFirstFile.created_at)}
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDownloadFolder(subFiles.map(f => f.file || f), subName) }}
                              title="Download folder as ZIP"
                              style={{
                                background: 'transparent', border: 'none', borderRadius: '6px',
                                width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', cursor: 'pointer', color: '#6b7280',
                                flexShrink: 0, transition: 'all 0.15s'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#dbeafe'; e.currentTarget.style.color = '#1d4ed8' }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#6b7280' }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        {isSubOpen && renderRecursiveItems(subFiles, level + 1, subKey, [...parentIsLastArr, isLast], isAttachment)}
                      </div>
                    );
                  });

                  // 2. Render root files
                  rootFiles.forEach((fileItem, index) => {
                    const isLast = index === totalRootFiles - 1;
                    const file = fileItem.file || fileItem;
                    const hasViewed = openedFileIds.has(file.id);

                    subItems.push(
                      <div key={`file-${file.id}`} className="tl-tree-container" style={{ marginBottom: '7px' }}>
                        {parentIsLastArr.map((isLastParent, i) => (
                          <div key={i} className={isLastParent ? "tl-tree-line-empty" : "tl-tree-line-vertical"} />
                        ))}
                        {level > 0 && <div className={`tl-tree-line-connector ${isLast ? 'last-item' : ''}`} />}
                        
                        <div
                          onClick={(e) => { e.stopPropagation(); setFileToOpen(file); setShowOpenFileConfirmation(true) }}
                          className={`admin-file-item${hasViewed ? ' admin-file-card-opened' : ''}`}
                          style={{ 
                            cursor: 'pointer', 
                            backgroundColor: '#fafafa',
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            padding: '14px 20px',
                            gap: '12px',
                            border: isAttachment ? '1px solid #000000' : '1px solid #dbeafe'
                          }}
                        >
                          <FileIcon fileType={file.original_name.split('.').pop()} size="default" style={{ width: '34px', height: '34px', minWidth: '34px', minHeight: '34px' }} />
                          <div className="admin-file-details" style={{ flex: 1, minWidth: 0 }}>
                            <div className="admin-file-name" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500', fontSize: '15px' }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.original_name}</span>
                              {hasViewed && (
                                <span style={{ fontSize: '10.5px', fontWeight: '600', color: '#16a34a', backgroundColor: '#dcfce7', border: '1px solid #86efac', padding: '1px 6px', borderRadius: '10px', flexShrink: 0 }}>
                                  ✓ Viewed
                                </span>
                              )}
                            </div>
                            <div className="admin-file-meta" style={{ fontSize: '12px', color: '#4b5563', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span>Submitted by <span className="admin-file-submitter" style={{ fontWeight: '600', color: '#2563eb' }}>
                                {isAttachment
                                  ? (assignment.team_leader_fullname || assignment.team_leader_username || 'Team Leader')
                                  : (file.fullName || file.username || 'Member')}
                              </span></span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#6b7280', fontWeight: '500' }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="10" />
                                  <polyline points="12 6 12 12 16 14" />
                                </svg>
                                {formatDateTime(file.submitted_at || file.uploaded_at || file.created_at)}
                              </span>
                              
                              {file.tag && (
                                <span style={{
                                  backgroundColor: '#dbeafe',
                                  color: '#1e40af',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  border: '1px solid #93c5fd',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  🏷️ {file.tag}
                                </span>
                              )}

                              {isAttachment ? (
                                <span className={`admin-file-status ${file.status === 'uploaded' ? 'reference' :
                                    file.status === 'team_leader_approved' ? 'reference' :
                                      file.status === 'final_approved' ? 'final-approved' :
                                        file.status === 'rejected_by_team_leader' || file.status === 'rejected_by_admin' ? 'rejected' :
                                          'reference'
                                  }`}>
                                  {file.status === 'uploaded' ? 'TASK REFERENCE' :
                                    file.status === 'team_leader_approved' ? 'TASK REFERENCE' :
                                      file.status === 'final_approved' ? '✓ APPROVED' :
                                        file.status === 'rejected_by_team_leader' ? '✗ REJECTED' :
                                          file.status === 'rejected_by_admin' ? '✗ REJECTED' :
                                            'TASK REFERENCE'}
                                </span>
                              ) : (
                                <span className={`admin-file-status ${file.status === 'uploaded' ? 'uploaded' :
                                    file.status === 'revision' ? 'revision' :
                                    file.status === 'team_leader_approved' ? 'team-leader-approved' :
                                      file.status === 'final_approved' ? 'final-approved' :
                                        file.status === 'rejected_by_team_leader' || file.status === 'rejected_by_admin' ? 'rejected' :
                                          'uploaded'
                                  }`}>
                                  {file.status === 'uploaded' ? 'PENDING TEAM LEADER' :
                                    file.status === 'revision' ? '✎ REVISION' :
                                    file.status === 'team_leader_approved' ? 'PENDING ADMIN' :
                                      file.status === 'final_approved' ? '✓ APPROVED' :
                                        file.status === 'rejected_by_team_leader' ? '✗ REJECTED' :
                                          file.status === 'rejected_by_admin' ? '✗ REJECTED' :
                                            file.status}
                                </span>
                              )}
                            </div>
                          </div>
                          <FileViewersButton fileId={file.id} externalCount={viewerCounts[file.id]} minDate={file.submitted_at || file.uploaded_at || file.created_at} fileSource={isAttachment ? 'attachment' : 'submission'} />
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDownloadFile(file) }}
                            title="Download file"
                            style={{
                              background: 'transparent', border: 'none', borderRadius: '6px',
                              width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', cursor: 'pointer', color: '#9ca3af',
                              flexShrink: 0, transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#dbeafe'; e.currentTarget.style.color = '#1d4ed8' }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9ca3af' }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  });

                  return subItems;
                };

                return (
                  <div key={assignment.id} id={`admin-assignment-${assignment.id}`} className="admin-assignment-card">
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
                            {assignment.created_at
                              ? <>📅 Assigned on: {formatDateTime(assignment.created_at)}</>
                              : 'Unknown creation date'}
                          </div>
                        </div>
                      </div>
                      <div className="admin-header-right">
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
                          assignment.due_date && (
                            <div className="admin-due-date">
                              Due: {formatDate(assignment.due_date)}
                              <span
                                className="admin-days-left"
                                style={{ color: getStatusColor(assignment.due_date) }}
                              >
                                {' '}({formatDaysLeft(assignment.due_date)})
                              </span>
                            </div>
                          )
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

                    {/* Attachments - Files attached by Team Leader */}
                    {assignment.attachments && assignment.attachments.length > 0 ? (
                      <div className="admin-attachment-section" style={{ marginBottom: '16px' }}>
                        <div className="admin-submitted-file">
                          <div className="admin-file-label admin-submitted-label">📎 Attachments ({assignment.attachments.length} item{assignment.attachments.length !== 1 ? 's' : ''}):</div>
                          {renderRecursiveItems(assignment.attachments, 0, '', [], true)}
                        </div>
                      </div>
                    ) : null}

                    {/* Submitted Files */}
                    <div className="admin-attachment-section">
                      {assignment.recent_submissions && assignment.recent_submissions.length > 0 ? (
                        <div className="admin-submitted-file">
                          <div className="admin-file-label admin-submitted-label">📎 Submitted Files ({assignment.recent_submissions.length}):</div>
                          {renderRecursiveItems(assignment.recent_submissions, 0, '', [], false)}
                        </div>
                      ) : (
                        <div className="admin-no-attachment">
                          <span className="admin-no-attachment-icon">📄</span>
                          <span className="admin-no-attachment-text">
                            No submissions yet
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Comments + 3-dot menu row */}
                    <div className="admin-comments-section" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div className="admin-comments-text" onClick={() => openCommentsModal(assignment)}>
                        Comments ({assignment.comment_count || 0})
                      </div>
                      {/* 3-dot menu */}
                      <div className="admin-card-menu" style={{ position: 'relative' }}>
                        <button
                          className="admin-menu-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowMenuForAssignment(prev => prev === assignment.id ? null : assignment.id)
                          }}
                          title="More options"
                          style={{
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            padding: '6px 8px', borderRadius: '8px', color: '#6b7280',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="5" cy="12" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="19" cy="12" r="2" />
                          </svg>
                        </button>
                        {showMenuForAssignment === assignment.id && (
                          <div
                            className="admin-menu-dropdown"
                            style={{
                              position: 'absolute', bottom: '110%', right: 0,
                              background: '#fff', border: '1px solid #e5e7eb',
                              borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                              minWidth: '140px', zIndex: 9999, overflow: 'hidden'
                            }}
                          >
                            <button
                              className="admin-menu-item admin-delete-menu-item"
                              onClick={(e) => {
                                e.stopPropagation()
                                setShowMenuForAssignment(null)
                                setAssignmentToDelete(assignment)
                                setShowDeleteModal(true)
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                width: '100%', padding: '10px 14px', background: 'transparent',
                                border: 'none', cursor: 'pointer', color: '#dc2626',
                                fontSize: '13px', fontWeight: '500', textAlign: 'left',
                                transition: 'background 0.15s'
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4h6v2" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

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
          isPostingComment={isPostingComment}
          replyingTo={replyingTo}
          setReplyingTo={setReplyingTo}
          replyText={replyText}
          setReplyText={setReplyText}
          onPostReply={handlePostReply}
          isPostingReply={isPostingReply}
          onEditComment={handleEditComment}
          onDeleteComment={handleDeleteComment}
          onEditReply={handleEditReply}
          onDeleteReply={handleDeleteReply}
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
              if (opened) {
                setOpenedFileIds(prev => new Set([...prev, fileId]))
                recordView(fileId, fileToOpen.isAttachment)
              }
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
