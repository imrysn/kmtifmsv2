import { useState, useEffect, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { apiFetch, API_BASE_URL } from '@/config/api'
import './css/TeamTasksTab.css'
import { FileIcon, FileOpenModal, FileViewersButton } from '../shared'
import CommentsModal from '../shared/CommentsModal'
import SuccessModal from './SuccessModal'
import { recursiveGroupByPath } from '@utils/folderUtils'

// ── CUSTOM HOOK: useDropdownPosition ─────────────────────────────────────────
const useDropdownPosition = (btnRef, menuRef, isOpen) => {
  const [pos, setPos] = useState({ top: 0, left: 0, ready: false, up: false })
  const updatePosition = useCallback(() => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const menuH = menuRef.current?.offsetHeight || 100
    const menuW = menuRef.current?.offsetWidth || 160
    const spaceBelow = window.innerHeight - rect.bottom
    const shouldOpenUp = spaceBelow < menuH + 10 && rect.top > menuH + 10
    const top = shouldOpenUp ? rect.top - menuH - 4 : rect.bottom + 4
    let left = rect.right - menuW
    if (left < 10) left = 10
    setPos({ top, left, ready: true, up: shouldOpenUp })
  }, [btnRef, menuRef])

  useEffect(() => {
    if (isOpen) {
      updatePosition()
      const rafId = requestAnimationFrame(updatePosition)
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)
      return () => {
        cancelAnimationFrame(rafId)
        window.removeEventListener('scroll', updatePosition, true)
        window.removeEventListener('resize', updatePosition)
      }
    } else {
      setPos(prev => ({ ...prev, ready: false }))
    }
  }, [isOpen, updatePosition])

  return pos
}

// ── FileMoreMenu: portal-based dropdown for folder/file actions ───────────────
function FileMoreMenu({ onDownload, onOpenPath, isFolder = false }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const pos = useDropdownPosition(btnRef, menuRef, open)

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !btnRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
      <button
        ref={btnRef}
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
      {open && ReactDOM.createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            visibility: pos.ready ? 'visible' : 'hidden',
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 99999,
            minWidth: '160px', padding: '4px',
            transformOrigin: pos.up ? 'bottom right' : 'top right',
            animation: 'dropdownFadeIn 0.15s ease-out'
          }}
        >
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
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download {isFolder ? 'Folder' : 'File'}
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatFileSize = (bytes) => {
  if (!bytes) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

const groupFilesByFolder = (files) => {
  const folders = {}
  const individualFiles = []
  for (const file of files) {
    if (file.folder_name) {
      if (!folders[file.folder_name]) folders[file.folder_name] = []
      folders[file.folder_name].push(file)
    } else {
      individualFiles.push(file)
    }
  }
  return { folders, individualFiles }
}

const groupBySubfolder = (files) => {
  const subfolders = {}
  const rootFiles = []
  for (const file of files) {
    const parts = (file.relative_path || '').split('/')
    if (parts.length > 2) {
      const subName = parts[1]
      if (!subfolders[subName]) subfolders[subName] = []
      subfolders[subName].push(file)
    } else {
      rootFiles.push(file)
    }
  }
  return { subfolders, rootFiles }
}

// ── Main Component ─────────────────────────────────────────────────────────────
const TeamTasksTab = ({ user }) => {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedAssignments, setExpandedAssignments] = useState({})
  const [error, setError] = useState('')
  const [successModal, setSuccessModal] = useState({ isOpen: false, title: '', message: '', type: 'success' })

  // Comments state
  const [comments, setComments] = useState({})
  const [newComment, setNewComment] = useState('')
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [currentCommentsAssignment, setCurrentCommentsAssignment] = useState(null)
  const [visibleReplies, setVisibleReplies] = useState({})
  const [isPostingComment, setIsPostingComment] = useState(false)
  const [isPostingReply, setIsPostingReply] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)

  // File display state
  const [showAllFiles, setShowAllFiles] = useState({})
  const [showAllSubmittedFiles, setShowAllSubmittedFiles] = useState({})
  const [expandedFolders, setExpandedFolders] = useState({})
  const INITIAL_FILE_DISPLAY_LIMIT = 5

  // File open modal state
  const [showOpenFileConfirmation, setShowOpenFileConfirmation] = useState(false)
  const [fileToOpen, setFileToOpen] = useState(null)
  const [openModalType, setOpenModalType] = useState('file')

  // Track which files have been viewed
  const [openedFileIds, setOpenedFileIds] = useState(new Set())
  const [openedFilesStorageReady, setOpenedFilesStorageReady] = useState(false)

  // Pagination state
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)

  // Viewer counts for instant UI updates
  const [viewerCounts, setViewerCounts] = useState({})

  // Refs
  const observerRef = useRef(null)
  const loadMoreRef = useRef(null)

  // ── Persistent storage for viewed file IDs ────────────────────────────────
  useEffect(() => {
    ;(async () => {
      try {
        let stored = null
        if (window.electron?.appStorage) {
          stored = await window.electron.appStorage.get('kmti_opened_files_team_tasks')
        }
        if (!stored) stored = localStorage.getItem('kmti_opened_files_team_tasks')
        if (stored) setOpenedFileIds(new Set(JSON.parse(stored)))
      } catch { /* ignore */ }
      setOpenedFilesStorageReady(true)
    })()
  }, [])

  useEffect(() => {
    if (!openedFilesStorageReady) return
    const data = JSON.stringify([...openedFileIds])
    if (window.electron?.appStorage) {
      window.electron.appStorage.set('kmti_opened_files_team_tasks', data)
    }
    try { localStorage.setItem('kmti_opened_files_team_tasks', data) } catch { /* ignore */ }
  }, [openedFileIds, openedFilesStorageReady])

  // ── Initial fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (user?.team) fetchInitialAssignments()
  }, [user])

  // ── Escape key to close comments modal ────────────────────────────────────
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

  // ── Infinite scroll observer ──────────────────────────────────────────────
  useEffect(() => {
    if (loading || loadingMore || !hasMore) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchMoreAssignments()
        }
      },
      { root: null, rootMargin: '100px', threshold: 0.1 }
    )

    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current)

    return () => { observerRef.current?.disconnect() }
  }, [loading, loadingMore, hasMore, nextCursor])

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchInitialAssignments = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await apiFetch(`/api/assignments/team/${user.team}/all-tasks?limit=20`)
      if (!data.success) {
        setError(data.message || 'Failed to fetch team assignments')
        return
      }
      const allAssignments = data.assignments || []
      setAssignments(allAssignments)
      setNextCursor(data.nextCursor)
      setHasMore(data.hasMore)
      await fetchCommentCounts(allAssignments)
    } catch {
      setError('Failed to load team assignments')
    } finally {
      setLoading(false)
    }
  }

  const fetchMoreAssignments = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor) return
    try {
      setLoadingMore(true)
      const data = await apiFetch(`/api/assignments/team/${user.team}/all-tasks?cursor=${nextCursor}&limit=20`)
      if (!data.success) {
        setError(data.message || 'Failed to fetch more assignments')
        return
      }
      const newAssignments = data.assignments || []
      setAssignments(prev => [...prev, ...newAssignments])
      setNextCursor(data.nextCursor)
      setHasMore(data.hasMore)
      await fetchCommentCounts(newAssignments)
    } catch {
      setError('Failed to load more assignments')
    } finally {
      setLoadingMore(false)
    }
  }, [nextCursor, hasMore, loadingMore, user.team])

  // fetchCommentCounts: fetches comment counts using the comment_count already
  // embedded in each assignment from the server query (no extra API calls needed).
  // Only fetches full comments for a single assignment when the user opens the modal.
  const fetchCommentCounts = async (assignmentsList) => {
    try {
      // Use the comment_count field returned by the server instead of N separate requests.
      // Full comments are loaded on-demand when a user opens the comments modal.
      const commentCounts = {}
      assignmentsList.forEach(a => {
        // Pre-seed with an empty array so the badge shows the count from server
        // without making extra requests. comment_count is already in the assignment object.
        commentCounts[a.id] = commentCounts[a.id] || []
      })
      setComments(prev => ({ ...prev, ...commentCounts }))
    } catch { /* ignore */ }
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  const toggleExpand = (assignmentId) => {
    setExpandedAssignments(prev => ({ ...prev, [assignmentId]: !prev[assignmentId] }))
  }

  const getInitials = (name) => {
    if (!name) return '?'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'No due date'
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatDaysLeft = (dateString, hasSubmissions) => {
    if (!dateString || hasSubmissions) return ''
    const diffDays = Math.ceil((new Date(dateString) - new Date()) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`
    if (diffDays === 0) return 'Due today'
    if (diffDays === 1) return '1 day left'
    return `${diffDays} days left`
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Unknown'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  const getStatusColor = (dueDate) => {
    if (!dueDate) return '#95a5a6'
    const diffDays = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return '#e74c3c'
    if (diffDays <= 2) return '#f39c12'
    return '#27ae60'
  }

  const formatTimeAgo = (dateString) => {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000)
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return formatDate(dateString)
  }

  // ── File open / folder path ───────────────────────────────────────────────
  /**
   * Opens a file or folder. Uses ?type=attachment for TL-attached files,
   * ?type=file for user-submitted files — matching the pattern in TasksTab-Enhanced.
   */
  const handleOpenFile = async (filePath, fileId) => {
    setSuccessModal({
      isOpen: true,
      title: 'Success',
      message: openModalType === 'folder' ? 'Folder opened successfully!' : 'File opened successfully!',
      type: 'success'
    })

    try {
      if (openModalType === 'folder' || openModalType === 'filePath') {
        if (!window.electron?.openFolderInExplorer) return
        const pathType = fileToOpen?.isAttachment ? 'attachment' : 'file'
        const data = await apiFetch(`/api/files/${fileId}/path?type=${pathType}`)
        if (data.success && data.filePath) {
          await window.electron.openFolderInExplorer(data.filePath)
        }
        return
      }

      if (!filePath && !fileId) return

      const pathType = fileToOpen?.isAttachment ? 'attachment' : 'file'
      const pathData = await apiFetch(`/api/files/${fileId}/path?type=${pathType}`)
      if (!pathData.success || !pathData.filePath) {
        setError(pathData.message || 'Could not resolve file path')
        return
      }

      if (window.electron?.openFileInApp) {
        const result = await window.electron.openFileInApp(pathData.filePath)
        if (result.success) {
          setOpenedFileIds(prev => new Set([...prev, fileId]))
        } else {
          setError(result.error || 'Failed to open file')
          setTimeout(() => setError(''), 3000)
        }
      } else {
        const ext = (pathData.filePath.split('.').pop() || '').toLowerCase()
        const browserViewable = ['pdf','png','jpg','jpeg','gif','svg','webp','txt','html','css','js','json','xml','mp4','mp3']
        if (browserViewable.includes(ext)) {
          window.open(`${API_BASE_URL}/api/files/${fileId}/stream`, '_blank', 'noopener,noreferrer')
        } else {
          const a = Object.assign(document.createElement('a'), {
            href: `${API_BASE_URL}/api/files/${fileId}/stream`,
            download: fileToOpen?.original_name || 'file',
          })
          a.click()
        }
        setOpenedFileIds(prev => new Set([...prev, fileId]))
      }
    } catch {
      setError('Failed to open file. Please try again.')
      setTimeout(() => setError(''), 3000)
    }
  }

  /**
   * Opens the folder containing a file in Windows Explorer.
   * isAttachment=true → uses ?type=attachment (TL reference files)
   * isAttachment=false → uses ?type=file (user submitted files)
   */
  const handleOpenFolderPath = async (fileId, isAttachment = false, isFolder = false, originalName = '') => {
    if (!window.electron?.openFolderInExplorer) return
    try {
      const pathType = isAttachment ? 'attachment' : 'file'
      const data = await apiFetch(`/api/files/${fileId}/path?type=${pathType}`)
      if (data.success && data.filePath) {
        setFileToOpen({ id: fileId, file_path: data.filePath, original_name: originalName || (isFolder ? 'Folder Path' : 'File Path'), isAttachment })
        setOpenModalType(isFolder ? 'folder' : 'filePath')
        setShowOpenFileConfirmation(true)
      }
    } catch { /* ignore */ }
  }

  // ── Download helpers ──────────────────────────────────────────────────────
  const handleDownloadFile = async (file) => {
    const fileUrl = `${API_BASE_URL}/api/files/${file.id}/download`
    const fileName = file.original_name || file.filename || 'file'
    if (window.electron?.downloadFile) {
      await window.electron.downloadFile(fileUrl, fileName)
    } else {
      const a = Object.assign(document.createElement('a'), { href: fileUrl, download: fileName })
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
    }
  }

  const handleDownloadFolder = async (folderFiles, folderName) => {
    if (!window.electron?.downloadFolder) {
      const fileIds = folderFiles.map(f => f.id).join(',')
      const a = Object.assign(document.createElement('a'), {
        href: `${API_BASE_URL}/api/files/folder/zip?fileIds=${fileIds}&folderName=${encodeURIComponent(folderName)}`,
        download: `${folderName}.zip`
      })
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
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
      if (!result?.success) setError(result?.error || 'Folder download failed')
    } catch (err) { setError(err.message || 'Folder download failed') }
  }

  // ── View tracking ─────────────────────────────────────────────────────────
  const recordView = async (fileId, isAttachment = false) => {
    if (!user || !fileId) return
    setViewerCounts(prev => ({ ...prev, [fileId]: (prev[fileId] ?? 0) + 1 }))
    try {
      await apiFetch(`/api/files/${fileId}/view?type=${isAttachment ? 'attachment' : 'submission'}`, {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role || 'user'
        })
      })
    } catch { /* ignore */ }
  }

  // ── Comments ──────────────────────────────────────────────────────────────
  const fetchComments = useCallback(async (assignmentId) => {
    setLoadingComments(true)
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments`)
      if (data.success) setComments(prev => ({ ...prev, [assignmentId]: data.comments || [] }))
    } catch { /* ignore */ } finally {
      setLoadingComments(false)
    }
  }, [])

  const openCommentsModal = useCallback(async (assignment) => {
    setCurrentCommentsAssignment(assignment)
    setNewComment('')
    setShowCommentsModal(true)
    await fetchComments(assignment.id)
  }, [fetchComments])

  const closeCommentsModal = useCallback(() => {
    setShowCommentsModal(false)
    setCurrentCommentsAssignment(null)
    setNewComment('')
  }, [])

  const handleSubmitComment = useCallback(async () => {
    if (!newComment.trim() || !currentCommentsAssignment) return
    setIsPostingComment(true)
    try {
      const data = await apiFetch(`/api/assignments/${currentCommentsAssignment.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, username: user.username || user.fullName, comment: newComment.trim() })
      })
      if (data.success) { setNewComment(''); fetchComments(currentCommentsAssignment.id) }
    } catch { /* ignore */ } finally {
      setIsPostingComment(false)
    }
  }, [newComment, currentCommentsAssignment, user, fetchComments])

  const handlePostReply = useCallback(async (_e, commentId, replyTextValue, onSuccess) => {
    if (!replyTextValue?.trim() || !currentCommentsAssignment) return
    setIsPostingReply(true)
    try {
      const data = await apiFetch(`/api/assignments/${currentCommentsAssignment.id}/comments/${commentId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, username: user.username || user.fullName, reply: replyTextValue.trim() })
      })
      if (data.success) { onSuccess?.(); fetchComments(currentCommentsAssignment.id) }
    } catch { /* ignore */ } finally {
      setIsPostingReply(false)
    }
  }, [currentCommentsAssignment, user, fetchComments])

  const handleEditComment = useCallback(async (assignmentId, commentId, newText) => {
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments/${commentId}`, {
        method: 'PUT',
        body: JSON.stringify({ userId: user.id, comment: newText })
      })
      if (data.success) fetchComments(assignmentId)
    } catch { /* ignore */ }
  }, [user.id, fetchComments])

  const handleDeleteComment = useCallback(async (assignmentId, commentId) => {
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments/${commentId}`, {
        method: 'DELETE',
        body: JSON.stringify({ userId: user.id })
      })
      if (data.success) fetchComments(assignmentId)
    } catch { /* ignore */ }
  }, [user.id, fetchComments])

  const handleEditReply = useCallback(async (assignmentId, commentId, replyId, newText) => {
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments/${commentId}/reply/${replyId}`, {
        method: 'PUT',
        body: JSON.stringify({ userId: user.id, reply: newText })
      })
      if (data.success) fetchComments(assignmentId)
    } catch { /* ignore */ }
  }, [user.id, fetchComments])

  const handleDeleteReply = useCallback(async (assignmentId, commentId, replyId) => {
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments/${commentId}/reply/${replyId}`, {
        method: 'DELETE',
        body: JSON.stringify({ userId: user.id })
      })
      if (data.success) fetchComments(assignmentId)
    } catch { /* ignore */ }
  }, [user.id, fetchComments])

  const toggleRepliesVisibility = useCallback((commentId) =>
    setVisibleReplies(prev => ({ ...prev, [commentId]: !prev[commentId] })), [])

  // ── Loading skeleton ──────────────────────────────────────────────────────
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

  const renderRecursiveItems = (assignment, files, level = 1, parentKey = '', parentIsLastArr = [], isAttachment = true) => {
    const { subfolders, rootFiles } = recursiveGroupByPath(files)
    const subItems = []

    const subfolderEntries = Object.entries(subfolders)
    const totalSubfolders = subfolderEntries.length
    const totalRootFiles = rootFiles.length

    // 1. Render subfolders
    subfolderEntries.forEach(([subName, subFiles], index) => {
      const isLast = (index === totalSubfolders - 1) && (totalRootFiles === 0)
      const subKey = parentKey ? `${parentKey}__${subName}` : `${assignment.id}__${subName}`
      const isSubOpen = expandedFolders[subKey]
      const subFirstFile = subFiles[0].file || subFiles[0]

      subItems.push(
        <div key={`subfolder-${subKey}`} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="tl-tree-container" style={{ marginBottom: '7px' }}>
            {parentIsLastArr.map((isLastParent, i) => (
              <div key={i} className={isLastParent ? "tl-tree-line-empty" : "tl-tree-line-vertical"} />
            ))}
            {level > 0 && <div className={`tl-tree-line-connector ${isLast ? 'last-item' : ''}`} />}
            
            <div
              className="file-item folder-item"
              onClick={(e) => {
                e.stopPropagation()
                setExpandedFolders(prev => ({ ...prev, [subKey]: !prev[subKey] }))
              }}
              style={{ 
                cursor: 'pointer', 
                backgroundColor: isSubOpen ? '#C7D7FD' : '#DBE9FE', 
                padding: '14px 20px',
                flex: 1
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <div style={{ fontSize: '32px', flexShrink: 0 }}>{isSubOpen ? '📂' : '📁'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '15px', color: '#111827' }}>{subName}</div>
                  <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '1px' }}>
                    {isAttachment
                      ? `${assignment.team_leader_fullname || assignment.team_leader_username || 'Team Leader'} • ${subFiles.length} file${subFiles.length !== 1 ? 's' : ''}`
                      : `Submitted by ${subFirstFile.fullName || subFirstFile.username} • ${subFiles.length} file${subFiles.length !== 1 ? 's' : ''}`}
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ transform: isSubOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                  <path d="M4 6L8 10L12 6" stroke="#6B7280" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
          {isSubOpen && renderRecursiveItems(assignment, subFiles, level + 1, subKey, [...parentIsLastArr, isLast], isAttachment)}
        </div>
      )
    })

    // 2. Render root files
    rootFiles.forEach((fileItem, index) => {
      const isLast = index === totalRootFiles - 1
      const file = fileItem.file || fileItem
      subItems.push(
        <div key={`file-${file.id}`} className="tl-tree-container" style={{ marginBottom: '7px' }}>
          {parentIsLastArr.map((isLastParent, i) => (
            <div key={i} className={isLastParent ? "tl-tree-line-empty" : "tl-tree-line-vertical"} />
          ))}
          {level > 0 && <div className={`tl-tree-line-connector ${isLast ? 'last-item' : ''}`} />}
          
          <div
            className="file-item nested-file-item"
            onClick={(e) => {
              e.stopPropagation()
              setFileToOpen({ ...file, isAttachment })
              setOpenModalType('file')
              setShowOpenFileConfirmation(true)
            }}
            style={{ 
              backgroundColor: openedFileIds.has(file.id) ? '#f0fdf4' : '#fafafa',
              padding: '14px 20px',
              flex: 1
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
              <FileIcon fileType={file.original_name.split('.').pop()} size="default" style={{ width: '34px', height: '34px', minWidth: '34px', minHeight: '34px' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '500', fontSize: '15px', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{file.original_name}</span>
                  {openedFileIds.has(file.id) && <span style={{ fontSize: '10.5px', fontWeight: '600', color: '#16a34a', backgroundColor: '#dcfce7', border: '1px solid #86efac', padding: '1px 6px', borderRadius: '10px' }}>✓ Viewed</span>}
                </div>
                <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '1px' }}>
                  {isAttachment
                    ? formatFileSize(file.file_size)
                    : `by ${file.fullName || file.username} • ${formatFileSize(file.file_size)}`}
                </div>
              </div>
              <FileViewersButton fileId={file.id} externalCount={viewerCounts[file.id]} minDate={assignment.created_at} fileSource={isAttachment ? 'attachment' : 'submission'}/>
              <FileMoreMenu onDownload={() => handleDownloadFile(file)} onOpenPath={() => handleOpenFolderPath(file.id, isAttachment, file.original_name)} />
            </div>
          </div>
        </div>
      )
    })

    return subItems
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="team-tasks-tab">
      {/* Error banner */}
      {error && (
        <div className="team-tasks-message error-message">
          {error}
          <button className="close-message-btn" onClick={() => setError('')}>×</button>
        </div>
      )}

      <div className="team-tasks-header">
        <h2>Team Tasks</h2>
        <p className="team-tasks-subtitle">Tasks assigned to your team members</p>
      </div>

      {/* Search Bar */}
      <div style={{ margin: '0 0 4px 0', position: 'relative', maxWidth: '320px' }}>
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

      <div className="team-tasks-count">
        {searchQuery
          ? `${assignments.filter(a => { const q = searchQuery.toLowerCase(); return (a.title||'').toLowerCase().includes(q)||(a.description||'').toLowerCase().includes(q)||(a.team_leader_fullname||'').toLowerCase().includes(q)||(a.team_leader_username||'').toLowerCase().includes(q) }).length} result${assignments.filter(a => { const q = searchQuery.toLowerCase(); return (a.title||'').toLowerCase().includes(q)||(a.description||'').toLowerCase().includes(q)||(a.team_leader_fullname||'').toLowerCase().includes(q)||(a.team_leader_username||'').toLowerCase().includes(q) }).length !== 1 ? 's' : ''} for "${searchQuery}"`
          : `${assignments.length} task${assignments.length !== 1 ? 's' : ''}${hasMore ? ' • Scroll for more' : ''}`
        }
      </div>

      <div className="team-tasks-container">
        {(() => {
          const filtered = searchQuery.trim()
            ? assignments.filter(a => {
                const q = searchQuery.toLowerCase()
                return (
                  (a.title || '').toLowerCase().includes(q) ||
                  (a.description || '').toLowerCase().includes(q) ||
                  (a.team_leader_fullname || '').toLowerCase().includes(q) ||
                  (a.team_leader_username || '').toLowerCase().includes(q)
                )
              })
            : assignments
          return filtered.length === 0 ? (
          <div className="empty-team-tasks">
            <div className="empty-icon">📋</div>
            <h3>{searchQuery ? 'No Results Found' : 'No Team Tasks Yet'}</h3>
            <p>{searchQuery ? `No tasks match "${searchQuery}".` : "Your team leader hasn't created any assignments yet."}</p>
          </div>
        ) : (
          <>
            {filtered.map(assignment => (
              <div key={assignment.id} className="team-task-card">
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
                          {assignment.assigned_member_details?.length > 0
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
                          onClick={(e) => { e.stopPropagation(); toggleExpand(assignment.id) }}
                        >
                          {expandedAssignments[assignment.id] ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </p>
                  </div>
                )}

                {/* Attachments */}
                <div className="team-task-attachment-section">

                  {/* Section 1: Team Leader Attached Files (isAttachment = true) */}
                  {assignment.attachments?.length > 0 && (
                    <div className="team-task-attached-file tl-attachments" style={{ marginBottom: '16px' }}>
                      <div className="file-label" style={{ color: '#1d4ed8' }}>
                        <span style={{ fontSize: '16px' }}>📎</span>
                        Attached Files ({assignment.attachments.length}):
                      </div>
                      {(() => {
                        const { folders, individualFiles } = groupFilesByFolder(assignment.attachments)
                        const items = []

                        Object.keys(folders).forEach(folderName => {
                          const folderFiles = folders[folderName]
                          const folderKey = `att-${assignment.id}-${folderName}`
                          const isExpanded = expandedFolders[folderKey]
                          const firstFile = folderFiles[0]

                          items.push(
                            <div
                              key={`att-folder-${assignment.id}-${folderName}`}
                              className="file-item folder-item"
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedFolders(prev => ({ ...prev, [folderKey]: !prev[folderKey] }))
                              }}
                              style={{ cursor: 'pointer', backgroundColor: isExpanded ? '#BFDBFE' : '#DBEAFE' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                <div style={{ fontSize: '32px', flexShrink: 0 }}>{isExpanded ? '📂' : '📁'}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>{folderName}</div>
                                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                    {assignment.team_leader_fullname || assignment.team_leader_username || 'Team Leader'} • {folderFiles.length} file{folderFiles.length !== 1 ? 's' : ''}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                                    <path d="M4 6L8 10L12 6" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                  <div onClick={e => e.stopPropagation()}>
                                    <FileMoreMenu
                                      isFolder
                                      onDownload={() => handleDownloadFolder(folderFiles, folderName)}
                                      onOpenPath={() => handleOpenFolderPath(firstFile.id, true, true, folderName)}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )

                          if (isExpanded) {
                            items.push(...renderRecursiveItems(assignment, folderFiles, 1, folderKey, [], true))
                          }
                        })

                        individualFiles.forEach(file => {
                          items.push(
                            <div
                              key={`att-${file.id}`}
                              className="file-item"
                              onClick={(e) => {
                                e.stopPropagation()
                                setFileToOpen({ ...file, isAttachment: true })
                                setOpenModalType('file')
                                setShowOpenFileConfirmation(true)
                              }}
                              style={{ backgroundColor: openedFileIds.has(file.id) ? '#f0fdf4' : undefined }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                <FileIcon fileType={file.original_name.split('.').pop()} size="small" style={{ width: '48px', height: '48px', flexShrink: 0 }}/>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: '500', fontSize: '14px', color: '#111827', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>{file.original_name}</span>
                                    {openedFileIds.has(file.id) && <span style={{ fontSize: '10px', color: '#16a34a' }}>✓ Viewed</span>}
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>by <span style={{ fontWeight: '500', color: '#2563eb' }}>{assignment.team_leader_fullname || assignment.team_leader_username || 'Team Leader'}</span></span>
                                    <span style={{ color: '#9ca3af' }}>•</span>
                                    <span>{formatFileSize(file.file_size)}</span>
                                  </div>
                                </div>
                                <FileViewersButton fileId={file.id} externalCount={viewerCounts[file.id]} minDate={assignment.created_at} fileSource="attachment"/>
                                <FileMoreMenu
                                  onDownload={() => handleDownloadFile(file)}
                                  onOpenPath={() => handleOpenFolderPath(file.id, true, false, file.original_name)}
                                />
                              </div>
                            </div>
                          )
                        })

                        const tlAttKey = `tlatt-${assignment.id}`
                        const isShowingAll = showAllFiles[tlAttKey]
                        const toShow = isShowingAll ? items : items.slice(0, INITIAL_FILE_DISPLAY_LIMIT)
                        const remaining = items.length - INITIAL_FILE_DISPLAY_LIMIT

                        return (
                          <>
                            {toShow}
                            {items.length > INITIAL_FILE_DISPLAY_LIMIT && (
                              <div
                                style={{ padding: '12px 16px', textAlign: 'center', cursor: 'pointer' }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setShowAllFiles(prev => ({ ...prev, [tlAttKey]: !prev[tlAttKey] }))
                                }}
                              >
                                <span style={{ color: '#0066cc', fontSize: '14px', fontWeight: '500', textDecoration: 'underline' }}>
                                  {isShowingAll ? 'See less' : `See more (${remaining} more)`}
                                </span>
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  )}

                  {/* Section 2: Member Submissions (isAttachment = false) */}
                  {assignment.recent_submissions?.length > 0 && (
                    <div className="team-task-attached-file member-submissions">
                      <div className="file-label">
                        <span style={{ fontSize: '16px' }}>📤</span>
                        Submitted Files ({assignment.recent_submissions.length}):
                      </div>
                      {(() => {
                        const { folders, individualFiles } = groupFilesByFolder(assignment.recent_submissions)
                        const items = []

                        Object.keys(folders).forEach(folderName => {
                          const folderFiles = folders[folderName]
                          const folderKey = `sub-${assignment.id}-${folderName}`
                          const isExpanded = expandedFolders[folderKey]
                          const firstFile = folderFiles[0]

                          items.push(
                            <div
                              key={`sub-folder-${assignment.id}-${folderName}`}
                              className="file-item folder-item"
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedFolders(prev => ({ ...prev, [folderKey]: !prev[folderKey] }))
                              }}
                              style={{ cursor: 'pointer', backgroundColor: isExpanded ? '#BFDBFE' : '#DBEAFE' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                <div style={{ fontSize: '32px', flexShrink: 0 }}>{isExpanded ? '📂' : '📁'}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>{folderName}</div>
                                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                    Submitted by <span style={{ fontWeight: '500' }}>{firstFile.fullName || firstFile.username}</span> • {folderFiles.length} files
                                  </div>
                                </div>
                                <FileMoreMenu
                                  isFolder
                                  onDownload={() => handleDownloadFolder(folderFiles, folderName)}
                                  onOpenPath={() => handleOpenFolderPath(firstFile.id, false, true, folderName)}
                                />
                              </div>
                            </div>
                          )

                          if (isExpanded) {
                            items.push(...renderRecursiveItems(assignment, folderFiles, 1, folderKey, [], false))
                          }
                        })

                        individualFiles.forEach(file => {
                          items.push(
                            <div
                              key={`sub-${file.id}`}
                              className="file-item"
                              onClick={(e) => {
                                e.stopPropagation()
                                setFileToOpen({ ...file, isAttachment: false })
                                setOpenModalType('file')
                                setShowOpenFileConfirmation(true)
                              }}
                              style={{ backgroundColor: openedFileIds.has(file.id) ? '#f0fdf4' : undefined }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                <FileIcon fileType={file.original_name.split('.').pop()} size="small" style={{ width: '48px', height: '48px', flexShrink: 0 }}/>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: '500', fontSize: '15px', color: '#111827', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>{file.original_name}</span>
                                    {openedFileIds.has(file.id) && <span style={{ fontSize: '10px', color: '#16a34a' }}>✓ Viewed</span>}
                                  </div>
                                  <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                    Submitted by {file.fullName || file.username} on {formatDate(file.submitted_at)}
                                  </div>
                                </div>
                                <FileViewersButton fileId={file.id} externalCount={viewerCounts[file.id]} minDate={assignment.created_at} fileSource="submission"/>
                                <FileMoreMenu
                                  onDownload={() => handleDownloadFile(file)}
                                  onOpenPath={() => handleOpenFolderPath(file.id, false, false, file.original_name)}
                                />
                              </div>
                            </div>
                          )
                        })

                        const isShowingAll = showAllSubmittedFiles[assignment.id]
                        const toShow = isShowingAll ? items : items.slice(0, INITIAL_FILE_DISPLAY_LIMIT)
                        const remaining = items.length - INITIAL_FILE_DISPLAY_LIMIT

                        return (
                          <>
                            {toShow}
                            {items.length > INITIAL_FILE_DISPLAY_LIMIT && (
                              <div
                                style={{ padding: '12px 16px', textAlign: 'center', cursor: 'pointer' }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setShowAllSubmittedFiles(prev => ({ ...prev, [assignment.id]: !prev[assignment.id] }))
                                }}
                              >
                                <span style={{ color: '#0066cc', fontSize: '14px', fontWeight: '500', textDecoration: 'underline' }}>
                                  {isShowingAll ? 'See less' : `See more (${remaining} more)`}
                                </span>
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  )}

                  {!assignment.attachments?.length && !assignment.recent_submissions?.length && (
                    <div className="no-attachment">
                      <span className="no-attachment-icon">📄</span>
                      <span className="no-attachment-text">No attachments yet</span>
                    </div>
                  )}
                </div>

                {/* Comments trigger */}
                <div className="team-task-comments-section" style={{
                  display: 'flex', justifyContent: 'flex-start',
                  paddingTop: '12px', borderTop: '1px solid #f3f4f6'
                }}>
                  <button
                    className="toggle-comments-btn"
                    onClick={(e) => { e.stopPropagation(); openCommentsModal(assignment) }}
                    style={{
                      padding: '0', backgroundColor: 'transparent', border: 'none',
                      color: '#1c1e21', fontSize: '14px', fontWeight: '500',
                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
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

            {/* Inline skeleton for loading more */}
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

            {hasMore && !loadingMore && (
              <div ref={loadMoreRef} style={{ height: '20px', margin: '20px 0' }}/>
            )}
          </>
        )
        })()
      }
      </div>

      {/* Comments Modal */}
      <CommentsModal
        isOpen={showCommentsModal}
        onClose={closeCommentsModal}
        assignment={currentCommentsAssignment}
        comments={currentCommentsAssignment ? (comments[currentCommentsAssignment.id] || []) : []}
        loadingComments={loadingComments}
        newComment={newComment}
        setNewComment={setNewComment}
        onPostComment={handleSubmitComment}
        isPostingComment={isPostingComment}
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

      {/* Success / error modal */}
      <SuccessModal
        isOpen={successModal.isOpen}
        onClose={() => setSuccessModal(prev => ({ ...prev, isOpen: false }))}
        title={successModal.title}
        message={successModal.message}
        type={successModal.type}
      />

      {/* File / folder open confirmation modal */}
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
            await handleOpenFile(fileToOpen.file_path, fileId)
            if (openModalType === 'file') recordView(fileId, fileToOpen.isAttachment)
          } finally {
            setShowOpenFileConfirmation(false)
            setFileToOpen(null)
          }
        }}
        file={fileToOpen}
        type={openModalType}
      />
    </div>
  )
}

export default TeamTasksTab
