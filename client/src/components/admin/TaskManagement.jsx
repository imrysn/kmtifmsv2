import { useState, useEffect, useCallback, useRef } from 'react'
import { API_BASE_URL } from '@/config/api'
import './TaskManagement.css'
import TaskCard from './subcomponents/TaskCard'
import TaskModals from './subcomponents/TaskModals'
import TaskSkeleton from './subcomponents/TaskSkeleton'
import { EditAssignmentModal } from './modals'
import { AlertMessage } from './modals'
import { useSmartNavigation } from '../shared/SmartNavigation'
import { withErrorBoundary } from '../common'

const TaskFilters = ({ filters, setFilters, teams, onReset }) => {
  return (
    <div className="task-filters-fidelity">
      <div className="filters-header">
        <h3>Filter assignments</h3>
        <button className="reset-filters-btn" onClick={onReset}>Reset Filters</button>
      </div>
      <div className="filters-grid">
        <div className="filter-item search">
          <label>Search assignments</label>
          <div className="search-input-wrapper">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input 
              type="text" 
              placeholder="Search by title or description..." 
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>
        </div>
        <div className="filter-item">
          <label>Status</label>
          <select 
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="filter-item">
          <label>Team</label>
          <select 
            value={filters.team}
            onChange={(e) => setFilters(prev => ({ ...prev, team: e.target.value }))}
          >
            <option value="all">All Teams</option>
            {teams.map(team => (
              <option key={team.id} value={team.name}>{team.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

const TaskManagement = ({ 
  user, 
  clearMessages, 
  error, 
  success, 
  setError, 
  setSuccess,
  highlightedAssignmentId,
  highlightedFileId,
  notificationCommentContext,
  onClearHighlight,
  onClearFileHighlight,
  onClearNotificationContext
}) => {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [teams, setTeams] = useState([])
  const [allUsers, setAllUsers] = useState([])
  
  // Filters state
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    team: 'all'
  })

  // Modal states
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [comments, setComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [visibleReplies, setVisibleReplies] = useState({})
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [assignmentToDelete, setAssignmentToDelete] = useState(null)
  const [assignmentToEdit, setAssignmentToEdit] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showMenuForAssignment, setShowMenuForAssignment] = useState(null)
  const [isOpeningFile, setIsOpeningFile] = useState(false)
  const [downloadToast, setDownloadToast] = useState({ show: false, fileName: '' })
  const [fileToOpen, setFileToOpen] = useState(null)
  const [showOpenFileConfirmation, setShowOpenFileConfirmation] = useState(false)
  
  const [expandedAssignments, setExpandedAssignments] = useState({})
  const [expandedAttachments, setExpandedAttachments] = useState({})
  const [expandedFolders, setExpandedFolders] = useState({})

  const loadMoreRef = useRef(null)

  // Fetch teams for filters
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/teams`)
        const data = await response.json()
        if (data.success) setTeams(data.teams || [])
      } catch (err) { console.error('Failed to fetch teams', err) }
    }
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/users`)
        const data = await response.json()
        if (data.success) setAllUsers(data.users || [])
      } catch (err) { console.error('Failed to fetch users', err) }
    }
    fetchTeams()
    fetchUsers()
  }, [])

  const fetchAssignments = useCallback(async (isInitial = false, currentCursor = null) => {
    try {
      if (isInitial) setLoading(true)
      else setLoadingMore(true)

      const params = new URLSearchParams()
      params.append('limit', '20')
      if (currentCursor) params.append('cursor', currentCursor)
      if (filters.search) params.append('search', filters.search)
      if (filters.status !== 'all') params.append('status', filters.status)
      if (filters.team !== 'all') params.append('team', filters.team)

      const response = await fetch(`${API_BASE_URL}/api/assignments/admin/all?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        if (isInitial) setAssignments(data.assignments || [])
        else setAssignments(prev => [...prev, ...(data.assignments || [])])
        
        setNextCursor(data.nextCursor)
        setHasMore(data.hasMore)
      } else {
        setError(data.message || 'Failed to fetch assignments')
      }
    } catch (err) {
      console.error('Error fetching assignments:', err)
      setError('Failed to load assignments')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [filters, setError])

  // Initial fetch and filter change
  useEffect(() => {
    fetchAssignments(true)
  }, [filters.status, filters.team, fetchAssignments])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAssignments(true)
    }, 500)
    return () => clearTimeout(timer)
  }, [filters.search, fetchAssignments])

  const handleResetFilters = () => {
    setFilters({ search: '', status: 'all', team: 'all' })
  }

  // Intersection Observer for Infinite Scroll
  useEffect(() => {
    if (!hasMore || loading || loadingMore) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) fetchAssignments(false, nextCursor)
    }, { threshold: 1.0 })
    if (loadMoreRef.current) observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, nextCursor, fetchAssignments])

  const fetchComments = useCallback(async (assignmentId) => {
    try {
      setLoadingComments(true)
      const response = await fetch(`${API_BASE_URL}/api/assignments/${assignmentId}/comments`)
      const data = await response.json()
      if (data.success) setComments(data.comments || [])
    } catch (error) { console.error('Error fetching comments:', error) }
    finally { setLoadingComments(false) }
  }, [])

  const openCommentsModal = useCallback((assignment) => {
    setSelectedAssignment(assignment)
    setShowCommentsModal(true)
    fetchComments(assignment.id)
  }, [fetchComments])

  // SMART NAVIGATION: Use shared hook for all highlighting and modal effects
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

  const handlePostComment = useCallback(async (e) => {
    e.preventDefault()
    if (!newComment.trim()) return
    try {
      const response = await fetch(`${API_BASE_URL}/api/assignments/${selectedAssignment.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, comment: newComment })
      })
      const data = await response.json()
      if (data.success) {
        setNewComment('')
        fetchComments(selectedAssignment.id)
      }
    } catch (error) { console.error('Error posting comment:', error) }
  }, [newComment, user, selectedAssignment, fetchComments])

  const handleDownloadFile = async (file) => {
    const fileUrl = `${API_BASE_URL}/api/files/${file.id}/download`
    const fileName = file.original_name || file.filename
    const a = document.createElement('a'); a.href = fileUrl; a.download = fileName
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setDownloadToast({ show: true, fileName })
    setTimeout(() => setDownloadToast({ show: false, fileName: '' }), 3000)
  }

  const handleDownloadFolder = async (folderFiles, folderName) => {
    const fileIds = folderFiles.map(f => f.id).join(',')
    const fileUrl = `${API_BASE_URL}/api/files/folder/zip?fileIds=${fileIds}&folderName=${encodeURIComponent(folderName)}`
    const fileName = `${folderName}.zip`
    const a = document.createElement('a'); a.href = fileUrl; a.download = fileName
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setDownloadToast({ show: true, fileName })
    setTimeout(() => setDownloadToast({ show: false, fileName: '' }), 3000)
  }

  const handleOpenFile = (path, id) => {
    window.open(`${API_BASE_URL}${path}`, '_blank')
  }

  const handleApproveFile = async (file, assignmentId) => {
    try {
      setSuccess('Approving file...')
      const response = await fetch(`${API_BASE_URL}/api/files/${file.id}/admin-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'approve', 
          adminId: user.id, 
          adminUsername: user.username,
          adminRole: user.role,
          team: file.user_team || 'all'
        })
      })
      const data = await response.json()
      if (data.success) {
        setSuccess('File approved successfully')
        fetchAssignments(true) // Refresh list
      } else {
        setError(data.message || 'Failed to approve file')
      }
    } catch (err) {
      console.error('Error approving file:', err)
      setError('Failed to approve file')
    }
  }

  const handleRejectFile = async (file, assignmentId) => {
    // For rejection, we might want a prompt for comments
    const reason = window.prompt('Enter rejection reason:')
    if (reason === null) return // Canceled

    try {
      setSuccess('Rejecting file...')
      const response = await fetch(`${API_BASE_URL}/api/files/${file.id}/admin-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'reject', 
          comments: reason,
          adminId: user.id, 
          adminUsername: user.username,
          adminRole: user.role,
          team: file.user_team || 'all'
        })
      })
      const data = await response.json()
      if (data.success) {
        setSuccess('File rejected')
        fetchAssignments(true) // Refresh list
      } else {
        setError(data.message || 'Failed to reject file')
      }
    } catch (err) {
      console.error('Error rejecting file:', err)
      setError('Failed to reject file')
    }
  }

  const handleArchiveTask = async (assignment) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/assignments/${assignment.id}/archive`, {
        method: 'PATCH'
      })
      const data = await response.json()
      if (data.success) {
        setSuccess(data.message)
        fetchAssignments(true)
      }
    } catch (err) { console.error('Archive failed', err) }
  }

  const handleMarkDoneTask = async (assignment) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/assignments/${assignment.id}/mark-done`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          teamLeaderId: user.id, 
          teamLeaderUsername: user.username,
          team: assignment.team 
        })
      })
      const data = await response.json()
      if (data.success) {
        setSuccess('Task marked as completed')
        fetchAssignments(true)
      }
    } catch (err) { console.error('Mark done failed', err) }
  }

  const handleUpdateAssignment = async (id, updatedData) => {
    setIsUpdating(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/assignments/${id}/update-members`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updatedData,
          teamLeaderId: user.id,
          teamLeaderUsername: user.username,
          team: assignmentToEdit.team // Keep original team
        })
      })
      const data = await response.json()
      if (data.success) {
        setSuccess('Assignment updated successfully')
        setShowEditModal(false)
        fetchAssignments(true)
      } else {
        setError(data.message || 'Update failed')
      }
    } catch (err) {
      console.error('Update failed', err)
      setError('Update failed')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteAssignment = async () => {
    if (!assignmentToDelete) return
    setIsDeleting(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/assignments/${assignmentToDelete.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (data.success) {
        setAssignments(prev => prev.filter(a => a.id !== assignmentToDelete.id))
        setShowDeleteModal(false)
        setAssignmentToDelete(null)
        setSuccess('Assignment deleted successfully')
      }
    } catch (error) { console.error('Error deleting assignment:', error) }
    finally { setIsDeleting(false) }
  }

  // Utilities
  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?'
  const formatDate = (date) => date ? new Date(date).toLocaleDateString() : 'No date'
  const formatDateTime = (date) => date ? new Date(date).toLocaleString() : 'No date'
  const formatDaysLeft = (date) => {
    if (!date) return ''
    const diff = Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return `${Math.abs(diff)} days overdue`
    if (diff === 0) return 'Due today'
    return `${diff} days left`
  }
  const groupFilesByFolder = (files) => {
    const folders = {}; const individualFiles = []
    files.forEach(f => {
      if (f.folder_name) {
        if (!folders[f.folder_name]) folders[f.folder_name] = []
        folders[f.folder_name].push(f)
      } else individualFiles.push(f)
    })
    return { folders, individualFiles }
  }

  return (
    <div className="task-management-container">
      {error && <AlertMessage type="error" message={error} onClose={clearMessages} />}
      {success && <AlertMessage type="success" message={success} onClose={clearMessages} />}

      <div className="admin-header">
        <div className="header-title">
          <h1>Task Management</h1>
          <p className="header-subtitle">Review and manage assignments across all teams</p>
        </div>
      </div>

      <TaskFilters 
        filters={filters} 
        setFilters={setFilters} 
        teams={teams} 
        onReset={handleResetFilters} 
      />

      <div className="task-feed">
        {loading ? (
          <div className="feed-container"><TaskSkeleton /></div>
        ) : assignments.length === 0 ? (
          <div className="empty-feed"><h3>No assignments found</h3><p>Try adjusting your filters.</p></div>
        ) : (
          <div className="feed-container">
            {assignments.map(assignment => (
              <TaskCard
                key={assignment.id}
                assignment={assignment}
                getInitials={getInitials}
                formatDate={formatDate}
                formatDateTime={formatDateTime}
                formatDaysLeft={formatDaysLeft}
                groupFilesByFolder={groupFilesByFolder}
                handleDownloadFile={handleDownloadFile}
                handleDownloadFolder={handleDownloadFolder}
                handleOpenFile={handleOpenFile}
                openCommentsModal={openCommentsModal}
                setShowDeleteModal={setShowDeleteModal}
                setAssignmentToDelete={setAssignmentToDelete}
                showMenuForAssignment={showMenuForAssignment}
                setShowMenuForAssignment={setShowMenuForAssignment}
                onApproveFile={handleApproveFile}
                onRejectFile={handleRejectFile}
                onArchiveTask={handleArchiveTask}
                onMarkDoneTask={handleMarkDoneTask}
                onEditTask={(a) => { setAssignmentToEdit(a); setShowEditModal(true); }}
              />
            ))}
            {hasMore && <div ref={loadMoreRef} className="load-more-trigger">{loadingMore && 'Loading more...'}</div>}
          </div>
        )}
      </div>

      <EditAssignmentModal 
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        assignment={assignmentToEdit}
        teamMembers={allUsers}
        onUpdate={handleUpdateAssignment}
        isProcessing={isUpdating}
      />

      <TaskModals
        showCommentsModal={showCommentsModal}
        closeCommentsModal={() => setShowCommentsModal(false)}
        selectedAssignment={selectedAssignment}
        comments={comments}
        loadingComments={loadingComments}
        newComment={newComment}
        setNewComment={setNewComment}
        handlePostComment={handlePostComment}
        showDeleteModal={showDeleteModal}
        handleCloseDeleteModal={() => setShowDeleteModal(false)}
        handleDeleteAssignment={handleDeleteAssignment}
        assignmentToDelete={assignmentToDelete}
        isDeleting={isDeleting}
        downloadToast={downloadToast}
        setDownloadToast={setDownloadToast}
        user={user}
      />
    </div>
  )
}

export default withErrorBoundary(TaskManagement, { componentName: 'Task Management' })
