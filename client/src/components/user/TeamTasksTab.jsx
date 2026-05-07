import { useState, useEffect, useRef, useCallback } from 'react'
import { apiFetch, API_BASE_URL } from '@/config/api'
import './css/TeamTasksTab.css'
import { FileIcon, FileOpenModal, FileViewersButton } from '../shared'
import CommentsModal from '../shared/CommentsModal'

// ── Read-only three-dot menu (Download + Open Folder Path, NO delete) ────────
function FileMoreMenu({ onDownload, onOpenPath, isFolder = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        style={{
          background: 'transparent', border: 'none', borderRadius: '6px',
          width: '28px', height: '28px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', color: '#9ca3af', padding: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f3f4f6'; e.currentTarget.style.color = '#374151' }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9ca3af' }}
        title="More options"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: '4px',
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 200,
          minWidth: '160px', padding: '4px',
        }}>
          {onOpenPath && (
            <button
              onClick={() => { onOpenPath(); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                padding: '8px 12px', background: 'transparent', border: 'none',
                borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#374151', textAlign: 'left',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
              </svg>
              {isFolder ? 'Open Folder Path' : 'Open File Path'}
            </button>
          )}
          <button
            onClick={() => { onDownload(); setOpen(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
              padding: '8px 12px', background: 'transparent', border: 'none',
              borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#374151', textAlign: 'left',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {isFolder ? 'Download Folder' : 'Download'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatFileSize = (bytes) => {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const groupFilesByFolder = (files) => {
  const folders = {};
  const individualFiles = [];

  files.forEach(file => {
    if (file.folder_name) {
      if (!folders[file.folder_name]) {
        folders[file.folder_name] = [];
      }
      folders[file.folder_name].push(file);
    } else {
      individualFiles.push(file);
    }
  });

  return { folders, individualFiles };
};

const TeamTasksTab = ({ user }) => {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [expandedAssignments, setExpandedAssignments] = useState({})
  const [error, setError] = useState('')
  const [isOpeningFile, setIsOpeningFile] = useState(false)
  const [fileOpenToast, setFileOpenToast] = useState(false)

  // Comments state
  const [comments, setComments] = useState({})
  const [newComment, setNewComment] = useState('')
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [currentCommentsAssignment, setCurrentCommentsAssignment] = useState(null)
  const [visibleReplies, setVisibleReplies] = useState({})
  const [loadingComments, setLoadingComments] = useState(false)
  const [showAllFiles, setShowAllFiles] = useState({}) // Track which assignments show all files
  const [showOpenFileConfirmation, setShowOpenFileConfirmation] = useState(false)
  const [fileToOpen, setFileToOpen] = useState(null)
  const [expandedFolders, setExpandedFolders] = useState({}) // Track which folders are expanded
  const [showAllSubmittedFiles, setShowAllSubmittedFiles] = useState({}) // Track which assignments show all submitted files
  const INITIAL_FILE_DISPLAY_LIMIT = 5; // Show first 5 files/folders initially

  // Track which files have been viewed (persists across sessions)
  const [openedFileIds, setOpenedFileIds] = useState(new Set())
  const [openedFilesStorageReady, setOpenedFilesStorageReady] = useState(false)

  // Pagination state
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)

  // Ref for infinite scroll
  const observerRef = useRef(null)
  const loadMoreRef = useRef(null)

  // Load viewed file IDs from persistent storage on mount
  useEffect(() => {
    ;(async () => {
      try {
        let stored = null
        if (window.electron?.appStorage) {
          stored = await window.electron.appStorage.get('kmti_opened_files_team_tasks')
        }
        if (!stored) stored = localStorage.getItem('kmti_opened_files_team_tasks')
        if (stored) setOpenedFileIds(new Set(JSON.parse(stored)))
      } catch {}
      setOpenedFilesStorageReady(true)
    })()
  }, [])

  // Save viewed file IDs to persistent storage whenever they change
  useEffect(() => {
    if (!openedFilesStorageReady) return
    const data = JSON.stringify([...openedFileIds])
    if (window.electron?.appStorage) {
      window.electron.appStorage.set('kmti_opened_files_team_tasks', data)
    }
    try { localStorage.setItem('kmti_opened_files_team_tasks', data) } catch {}
  }, [openedFileIds, openedFilesStorageReady])

  useEffect(() => {
    if (user && user.team) {
      fetchInitialAssignments()
    }
  }, [user])

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showCommentsModal) {
        setShowCommentsModal(false)
        setCurrentCommentsAssignment(null)
        document.body.style.overflow = ''
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

      const data = await apiFetch(`/api/assignments/team/${user.team}/all-tasks?limit=20`)

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

      const data = await apiFetch(`/api/assignments/team/${user.team}/all-tasks?cursor=${nextCursor}&limit=20`)

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
            const data = await apiFetch(`/api/assignments/${assignment.id}/comments`)

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

  const formatDaysLeft = (dateString, hasSubmissions) => {
    if (!dateString) return ''

    // If there are submissions, don't show overdue text
    if (hasSubmissions) return ''

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

      await new Promise(resolve => setTimeout(resolve, 300));

      const isElectron = window.electron && window.electron.openFileInApp;

      if (isElectron) {
        console.log('💻 Running in Electron - using Windows default application');

        const pathData = await apiFetch(
          `/api/files/${fileId}/path`
        );

        if (!pathData.success) {
          throw new Error(pathData.message || 'Failed to get file path');
        }

        console.log('📂 Full path:', pathData.filePath);
        console.log('📄 File name:', pathData.fileName);

        const result = await window.electron.openFileInApp(pathData.filePath);

        if (result.success) {
          console.log('✅ Opened with Windows default application');
          setFileOpenToast(true);
          setTimeout(() => setFileOpenToast(false), 3500);
          setOpenedFileIds(prev => new Set([...prev, fileId]));
        } else {
          throw new Error(result.error || 'Failed to open file');
        }
      } else {
        console.log('🌐 Running in browser - opening in new tab');

        const fileUrl = `${API_BASE_URL}${filePath}`;
        const newWindow = window.open(fileUrl, '_blank');

        if (!newWindow) {
          throw new Error('Pop-up blocked. Please allow pop-ups for this site.');
        }

        newWindow.focus();
        console.log('✅ Opened in browser tab');
        setFileOpenToast(true);
        setTimeout(() => setFileOpenToast(false), 3500);
        setOpenedFileIds(prev => new Set([...prev, fileId]));
      }

    } catch (error) {
      console.error('❌ Error opening file:', error);
      setError(`Error opening file: ${error.message || 'Failed to open file'}`);
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsOpeningFile(false)
    }
  }

  const clearMessages = () => {
    setError('')
  }

  // Download a single file
  const handleDownloadFile = async (file) => {
    const fileUrl = `${API_BASE_URL}/api/files/${file.id}/download`
    const fileName = file.original_name || file.filename || 'file'
    if (window.electron?.downloadFile) {
      await window.electron.downloadFile(fileUrl, fileName)
    } else {
      const a = document.createElement('a')
      a.href = fileUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  // Download all files in a folder as a zip
  const handleDownloadFolder = async (folderFiles, folderName) => {
    const fileIds = folderFiles.map(f => f.id).join(',')
    const fileUrl = `${API_BASE_URL}/api/files/folder/zip?fileIds=${fileIds}&folderName=${encodeURIComponent(folderName)}`
    const fileName = `${folderName}.zip`
    if (window.electron?.downloadFile) {
      await window.electron.downloadFile(fileUrl, fileName)
    } else {
      const a = document.createElement('a')
      a.href = fileUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  // Open the folder containing a file in Windows Explorer
  // Record that the current user viewed a file
  const recordView = async (fileId) => {
    if (!user || !fileId) return
    try {
      await apiFetch(`/api/files/${fileId}/view`, {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role || 'user'
        })
      })
    } catch {}
  }

  const handleOpenFolderPath = async (fileId) => {
    if (!window.electron?.openFolderInExplorer) return
    try {
      const data = await apiFetch(`/api/files/${fileId}/path`)
      if (data.success && data.filePath) {
        await window.electron.openFolderInExplorer(data.filePath)
      }
    } catch (e) { console.error('Open folder path error:', e) }
  }

  // Fetch comments for an assignment
  const fetchComments = useCallback(async (assignmentId) => {
    setLoadingComments(true)
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments`)
      if (data.success) {
        setComments(prev => ({ ...prev, [assignmentId]: data.comments || [] }))
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
    } finally {
      setLoadingComments(false)
    }
  }, [])

  // Open comments modal
  const openCommentsModal = useCallback(async (assignment) => {
    setCurrentCommentsAssignment(assignment)
    setNewComment('')
    setShowCommentsModal(true)
    await fetchComments(assignment.id)
  }, [fetchComments])

  // Close comments modal
  const closeCommentsModal = useCallback(() => {
    setShowCommentsModal(false)
    setCurrentCommentsAssignment(null)
    setNewComment('')
  }, [])

  // Submit a new comment
  const handleSubmitComment = useCallback(async () => {
    if (!newComment.trim() || !currentCommentsAssignment) return
    try {
      const data = await apiFetch(`/api/assignments/${currentCommentsAssignment.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, username: user.username || user.fullName, comment: newComment.trim() })
      })
      if (data.success) {
        setNewComment('')
        fetchComments(currentCommentsAssignment.id)
      }
    } catch (error) {
      console.error('Error posting comment:', error)
    }
  }, [newComment, currentCommentsAssignment, user, fetchComments])

  // Post a reply
  const handlePostReply = useCallback(async (_e, commentId, replyTextValue, onSuccess) => {
    if (!replyTextValue?.trim() || !currentCommentsAssignment) return
    try {
      const data = await apiFetch(`/api/assignments/${currentCommentsAssignment.id}/comments/${commentId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, username: user.username || user.fullName, reply: replyTextValue.trim() })
      })
      if (data.success) { onSuccess?.(); fetchComments(currentCommentsAssignment.id) }
    } catch (error) {
      console.error('Error posting reply:', error)
    }
  }, [currentCommentsAssignment, user, fetchComments])

  // Edit a comment
  const handleEditComment = useCallback(async (assignmentId, commentId, newText) => {
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments/${commentId}`, {
        method: 'PUT',
        body: JSON.stringify({ userId: user.id, comment: newText })
      })
      if (data.success) fetchComments(assignmentId)
    } catch (e) { console.error(e) }
  }, [user.id, fetchComments])

  // Delete a comment
  const handleDeleteComment = useCallback(async (assignmentId, commentId) => {
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments/${commentId}`, {
        method: 'DELETE',
        body: JSON.stringify({ userId: user.id })
      })
      if (data.success) fetchComments(assignmentId)
    } catch (e) { console.error(e) }
  }, [user.id, fetchComments])

  // Edit a reply
  const handleEditReply = useCallback(async (assignmentId, commentId, replyId, newText) => {
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments/${commentId}/reply/${replyId}`, {
        method: 'PUT',
        body: JSON.stringify({ userId: user.id, reply: newText })
      })
      if (data.success) fetchComments(assignmentId)
    } catch (e) { console.error(e) }
  }, [user.id, fetchComments])

  // Delete a reply
  const handleDeleteReply = useCallback(async (assignmentId, commentId, replyId) => {
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments/${commentId}/reply/${replyId}`, {
        method: 'DELETE',
        body: JSON.stringify({ userId: user.id })
      })
      if (data.success) fetchComments(assignmentId)
    } catch (e) { console.error(e) }
  }, [user.id, fetchComments])

  const toggleRepliesVisibility = useCallback((commentId) =>
    setVisibleReplies(prev => ({ ...prev, [commentId]: !prev[commentId] })), [])

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
                        {' '}<span className="role-badge team-leader">TEAM LEADER</span>{' '}
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

                {/* Attachment Section */}
                <div className="team-task-attachment-section">
                  {/* Section 1: Team Leader Attached Files */}
                  {assignment.attachments && assignment.attachments.length > 0 && (
                    <div className="team-task-attached-file tl-attachments" style={{ marginBottom: '16px', borderLeft: '4px solid #3b82f6' }}>
                      <div className="file-label" style={{ color: '#1d4ed8' }}>
                        <span style={{ fontSize: '16px' }}>📎</span>
                        Attached Files ({assignment.attachments.length}):
                      </div>
                      {(() => {
                        const { folders, individualFiles } = groupFilesByFolder(assignment.attachments);
                        const items = [];

                        // Render folders
                        Object.keys(folders).forEach(folderName => {
                          const folderFiles = folders[folderName];
                          const isExpanded = expandedFolders[`att-${assignment.id}-${folderName}`];
                          const firstFile = folderFiles[0];

                          items.push(
                            <div
                              key={`att-folder-${assignment.id}-${folderName}`}
                              className="file-item folder-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedFolders(prev => ({
                                  ...prev,
                                  [`att-${assignment.id}-${folderName}`]: !prev[`att-${assignment.id}-${folderName}`]
                                }));
                              }}
                              style={{ cursor: 'pointer', backgroundColor: isExpanded ? '#BFDBFE' : '#DBEAFE' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                <div style={{ fontSize: '32px', flexShrink: 0 }}>
                                  {isExpanded ? '📂' : '📁'}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>
                                    {folderName}
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                    {assignment.team_leader_fullname || assignment.team_leader_username || 'Team Leader'} • {folderFiles.length} files
                                  </div>
                                </div>
                                <FileMoreMenu
                                  isFolder
                                  onDownload={() => handleDownloadFolder(folderFiles, folderName)}
                                  onOpenPath={() => handleOpenFolderPath(firstFile.id)}
                                />
                              </div>
                            </div>
                          );

                          if (isExpanded) {
                            folderFiles.forEach(file => {
                              items.push(
                                <div
                                  key={`att-${file.id}`}
                                  className="file-item nested-file-item"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFileToOpen(file);
                                    setShowOpenFileConfirmation(true);
                                    recordView(file.id);
                                  }}
                                  style={{ paddingLeft: '40px', backgroundColor: openedFileIds.has(file.id) ? '#f0fdf4' : '#fafafa' }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                    <FileIcon fileType={file.original_name.split('.').pop()} size="small" style={{ width: '40px', height: '40px', flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: '500', fontSize: '14px', color: '#111827', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {file.relative_path || file.original_name}
                                      </div>
                                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                        {formatFileSize(file.file_size)}
                                      </div>
                                    </div>
                                      <FileViewersButton fileId={file.id} />
                                      <FileMoreMenu
                                        onDownload={() => handleDownloadFile(file)}
                                        onOpenPath={() => handleOpenFolderPath(file.id)}
                                      />
                                  </div>
                                </div>
                              );
                            });
                          }
                        });

                        // Render individual files
                        individualFiles.forEach(file => {
                          items.push(
                            <div
                              key={`att-${file.id}`}
                              className="file-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFileToOpen(file);
                                setShowOpenFileConfirmation(true);
                                recordView(file.id);
                              }}
                              style={{ backgroundColor: openedFileIds.has(file.id) ? '#f0fdf4' : undefined }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                <FileIcon fileType={file.original_name.split('.').pop()} size="small" style={{ width: '48px', height: '48px', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: '500', fontSize: '15px', color: '#111827', marginBottom: '6px' }}>
                                    {file.original_name}
                                  </div>
                                  <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                    {formatFileSize(file.file_size)}
                                  </div>
                                </div>
                                  <FileViewersButton fileId={file.id} />
                                  <FileMoreMenu
                                    onDownload={() => handleDownloadFile(file)}
                                    onOpenPath={() => handleOpenFolderPath(file.id)}
                                  />
                              </div>
                            </div>
                          );
                        });

                        return items;
                      })()}
                    </div>
                  )}

                  {/* Section 2: Member Submissions */}
                  {assignment.recent_submissions && assignment.recent_submissions.length > 0 ? (
                    <div className="team-task-attached-file member-submissions">
                      <div className="file-label">
                        <span style={{ fontSize: '16px' }}>📤</span>
                        Submitted Files ({assignment.recent_submissions.length}):
                      </div>
                      {(() => {
                        const { folders, individualFiles } = groupFilesByFolder(assignment.recent_submissions);
                        const items = [];

                        // Render folders
                        Object.keys(folders).forEach(folderName => {
                          const folderFiles = folders[folderName];
                          const isExpanded = expandedFolders[`sub-${assignment.id}-${folderName}`];
                          const firstFile = folderFiles[0];

                          items.push(
                            <div
                              key={`sub-folder-${assignment.id}-${folderName}`}
                              className="file-item folder-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedFolders(prev => ({
                                  ...prev,
                                  [`sub-${assignment.id}-${folderName}`]: !prev[`sub-${assignment.id}-${folderName}`]
                                }));
                              }}
                              style={{ cursor: 'pointer', backgroundColor: isExpanded ? '#BFDBFE' : '#DBEAFE' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                <div style={{ fontSize: '32px', flexShrink: 0 }}>
                                  {isExpanded ? '📂' : '📁'}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>
                                    {folderName}
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                    Submitted by <span style={{ fontWeight: '500' }}>{firstFile.fullName || firstFile.username}</span> • {folderFiles.length} files
                                  </div>
                                </div>
                                <FileMoreMenu
                                  isFolder
                                  onDownload={() => handleDownloadFolder(folderFiles, folderName)}
                                  onOpenPath={() => handleOpenFolderPath(firstFile.id)}
                                />
                              </div>
                            </div>
                          );

                          if (isExpanded) {
                            folderFiles.forEach(file => {
                              items.push(
                                <div
                                  key={`sub-${file.id}`}
                                  className="file-item nested-file-item"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFileToOpen(file);
                                    setShowOpenFileConfirmation(true);
                                    recordView(file.id);
                                  }}
                                  style={{ paddingLeft: '40px', backgroundColor: openedFileIds.has(file.id) ? '#f0fdf4' : '#fafafa' }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                    <FileIcon fileType={file.original_name.split('.').pop()} size="small" style={{ width: '40px', height: '40px', flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: '500', fontSize: '14px', color: '#111827', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span>{file.relative_path || file.original_name}</span>
                                        {openedFileIds.has(file.id) && <span style={{ fontSize: '10px', color: '#16a34a' }}>✓ Viewed</span>}
                                      </div>
                                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                        by {file.fullName || file.username} • {formatDate(file.submitted_at)}
                                      </div>
                                    </div>
                                    <FileViewersButton fileId={file.id} />
                                      <FileViewersButton fileId={file.id} />
                                      <FileMoreMenu
                                        onDownload={() => handleDownloadFile(file)}
                                        onOpenPath={() => handleOpenFolderPath(file.id)}
                                      />
                                  </div>
                                </div>
                              );
                            });
                          }
                        });

                        // Render individual files
                        individualFiles.forEach(file => {
                          items.push(
                            <div
                              key={`sub-${file.id}`}
                              className="file-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFileToOpen(file);
                                setShowOpenFileConfirmation(true);
                                recordView(file.id);
                              }}
                              style={{ backgroundColor: openedFileIds.has(file.id) ? '#f0fdf4' : undefined }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                <FileIcon fileType={file.original_name.split('.').pop()} size="small" style={{ width: '48px', height: '48px', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: '500', fontSize: '15px', color: '#111827', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>{file.original_name}</span>
                                    {openedFileIds.has(file.id) && <span style={{ fontSize: '10px', color: '#16a34a' }}>✓ Viewed</span>}
                                  </div>
                                  <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                    Submitted by {file.fullName || file.username} on {formatDate(file.submitted_at)}
                                  </div>
                                </div>
                                <FileViewersButton fileId={file.id} />
                                  <FileViewersButton fileId={file.id} />
                                  <FileMoreMenu
                                    onDownload={() => handleDownloadFile(file)}
                                    onOpenPath={() => handleOpenFolderPath(file.id)}
                                  />
                              </div>
                            </div>
                          );
                        });

                        const totalItems = items.length;
                        const isShowingAll = showAllSubmittedFiles[assignment.id];
                        const itemsToShow = isShowingAll ? items : items.slice(0, INITIAL_FILE_DISPLAY_LIMIT);
                        const remainingCount = totalItems - INITIAL_FILE_DISPLAY_LIMIT;

                        return (
                          <>
                            {itemsToShow}
                            {totalItems > INITIAL_FILE_DISPLAY_LIMIT && (
                              <div
                                style={{ padding: '12px 16px', textAlign: 'center', cursor: 'pointer' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowAllSubmittedFiles(prev => ({ ...prev, [assignment.id]: !prev[assignment.id] }));
                                }}
                              >
                                <span style={{ color: '#0066cc', fontSize: '14px', fontWeight: '500', textDecoration: 'underline' }}>
                                  {isShowingAll ? 'See less' : `See more (${remainingCount} more)`}
                                </span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : null}
                  
                  {(!assignment.attachments?.length && !assignment.recent_submissions?.length) && (
                    <div className="no-attachment">
                      <span className="no-attachment-icon">📄</span>
                      <span className="no-attachment-text">No attachments yet</span>
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
                      openCommentsModal(assignment);
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
                    {comments[assignment.id]?.length > 0 && (
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

      {/* Comments Modal - shared component with full @mention support */}
      <CommentsModal
        isOpen={showCommentsModal}
        onClose={closeCommentsModal}
        assignment={currentCommentsAssignment}
        comments={currentCommentsAssignment ? (comments[currentCommentsAssignment.id] || []) : []}
        loadingComments={loadingComments}
        newComment={newComment}
        setNewComment={setNewComment}
        onPostComment={handleSubmitComment}
        onPostReply={handlePostReply}
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

      {/* File Open Toast */}
      {fileOpenToast && (
        <div style={{ position: 'fixed', top: '28px', right: '28px', zIndex: 9999, background: '#fff', border: '1px solid #bbf7d0', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.13)', padding: '18px 22px 14px 18px', display: 'flex', alignItems: 'flex-start', gap: '14px', minWidth: '280px', maxWidth: '380px', animation: 'slideInRight 0.25s ease' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#dcfce7', border: '2px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#15803d', marginBottom: '4px' }}>Success</div>
            <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.4' }}>File opened successfully!</div>
            <div style={{ marginTop: '10px', height: '4px', borderRadius: '2px', background: '#dcfce7', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '2px', background: '#22c55e', animation: 'shrinkBar 3.5s linear forwards' }} />
            </div>
          </div>
          <button onClick={() => setFileOpenToast(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '20px', lineHeight: 1, padding: 0 }}>×</button>
        </div>
      )}

      <style>{`
        @keyframes slideInRight { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes shrinkBar { from { width: 100%; } to { width: 0%; } }
      `}</style>

      {/* File Open Modal */}
      <FileOpenModal
        isOpen={showOpenFileConfirmation}
        onClose={() => {
          setShowOpenFileConfirmation(false)
          setFileToOpen(null)
        }}
        onConfirm={async () => {
          if (!fileToOpen) return

          try {
            await handleOpenFile(fileToOpen.file_path, fileToOpen.id)
          } finally {
            setShowOpenFileConfirmation(false)
            setFileToOpen(null)
          }
        }}
        file={fileToOpen}
      />
    </div>
  )
}

export default TeamTasksTab
