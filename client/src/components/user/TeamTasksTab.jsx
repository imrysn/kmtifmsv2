import { useState, useEffect, useRef, useCallback } from 'react'
import useStore from '@/store/useStore'
import { apiFetch, API_BASE_URL } from '@/config/api'
import './css/TeamTasksTab.css'
import { FileIcon, FileOpenModal, FileViewersButton, PremiumTaskCard, PremiumModal } from '../shared'
import CommentsModal from '../shared/CommentsModal'
import { formatDate, formatDateTime, formatFileSize, groupFilesByFolder, getInitials } from '../../utils/ui-helpers';
import { openFile, downloadFile, downloadFolder } from '../../utils/file-actions';

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

// Helpers moved to shared/utils/ui-helpers.js and file-actions.js

const TeamTasksTab = ({ user }) => {
  const setTeamTasksCache = useStore(state => state.setTeamTasksCache)
  const assignments = useStore(state => state.teamTasksCache[user.team]) || []
  const [loading, setLoading] = useState(!useStore.getState().teamTasksCache[user.team])
  const [loadingMore, setLoadingMore] = useState(false)
  const [expandedAssignments, setExpandedAssignments] = useState({})
  const [error, setError] = useState('')
  const [fileOpenToast, setFileOpenToast] = useState(false)

  // Comments state
  const [comments, setComments] = useState({})
  const [newComment, setNewComment] = useState('')
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [currentCommentsAssignment, setCurrentCommentsAssignment] = useState(null)
  const [visibleReplies, setVisibleReplies] = useState({})
  const [loadingComments, setLoadingComments] = useState(false)
  const [showAllFiles, setShowAllFiles] = useState({}) // Track which assignments show all files

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
      const isCacheEmpty = !useStore.getState().teamTasksCache[user.team]
      if (isCacheEmpty) setLoading(true)
      setError('')

      const data = await apiFetch(`/api/assignments/team/${user.team}/all-tasks?limit=20`)

      if (!data.success) {
        setError(data.message || 'Failed to fetch team assignments')
        setLoading(false)
        return
      }

      const allAssignments = data.assignments || []
      setTeamTasksCache(user.team, allAssignments)
      setNextCursor(data.nextCursor)
      setHasMore(data.hasMore)
    } catch (error) {
      console.error('Error fetching team assignments:', error)
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
      setTeamTasksCache(user.team, prev => {
        const existingIds = new Set(prev.map(a => a.id));
        const uniqueNew = newAssignments.filter(a => !existingIds.has(a.id));
        return [...prev, ...uniqueNew];
      })
      setNextCursor(data.nextCursor)
      setHasMore(data.hasMore)
    } catch (error) {
      console.error('Error fetching more assignments:', error)
      setError('Failed to load more assignments')
    } finally {
      setLoadingMore(false)
    }
  }, [nextCursor, hasMore, loadingMore, user.team, setTeamTasksCache])

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
        setTeamTasksCache(user.team, prev => prev.map(a =>
          a.id === assignmentId ? { ...a, comment_count: (data.comments || []).length } : a
        ))
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
    } finally {
      setLoadingComments(false)
    }
  }, [user.team, setTeamTasksCache])

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
    <div className="team-tasks-tab">
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
            <div className="team-tasks-grid">
              {assignments.map((assignment) => (
                <PremiumTaskCard
                  key={assignment.id}
                  task={{
                    ...assignment,
                    submitted_files: assignment.recent_submissions
                  }}
                  role={user.role?.toLowerCase() === 'team_leader' ? 'teamleader' : (user.role?.toLowerCase() || 'user')}
                  hideSubmit={true}
                  onCommentClick={openCommentsModal}
                  onFileClick={(file) => {
                    setOpenedFileIds(prev => new Set([...prev, file.id]));
                    setFileOpenToast(true);
                    setTimeout(() => setFileOpenToast(false), 3500);
                  }}
                  onDownloadFile={handleDownloadFile}
                  onOpenPath={(file) => handleOpenFolderPath(file.id)}
                  openedFileIds={openedFileIds}
                  className="team-task-card-margin"
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


    </div>
  )
}

export default TeamTasksTab
