import React, { useState, useEffect, useRef, useCallback } from 'react'
import { apiFetch, API_BASE_URL } from '@/config/api'
import './css/AssignmentsTab.css'
import './modals/css/AssignmentDetailsModal.css'
import { CardSkeleton } from '../common/InlineSkeletonLoader'
import { ConfirmationModal, CommentsModal, FileIcon, FileOpenModal, FileViewersButton, PremiumTaskCard, PremiumModal, RoleBadge, StatusBadge, TeamBadge } from '../shared'
import { useSmartNavigation } from '../shared/SmartNavigation'
import '../shared/SmartNavigation/SmartNavigation.css'
import SuccessModal from '../user/SuccessModal'
import { formatDate, formatDateTime, formatFileSize, groupFilesByFolder, getInitials } from '../../utils/ui-helpers';
import { openFile, downloadFile, downloadFolder } from '../../utils/file-actions';

const AssignmentsTab = ({
  isLoadingAssignments,
  assignments,
  formatDate,
  deleteAssignment,
  setShowCreateAssignmentModal,
  openReviewModal,
  user,
  notificationCommentContext,
  onClearNotificationContext,
  highlightedAssignmentId,
  onClearHighlight,
  highlightedFileId,
  onClearFileHighlight,
  markAssignmentAsDone,
  handleEditAssignment,
  onRefreshAssignments
}) => {
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState([])

  // Shared modal state - simplified to work like admin/user
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [comments, setComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [visibleReplies, setVisibleReplies] = useState({})

  const [showMenuForAssignment, setShowMenuForAssignment] = useState(null)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [assignmentToDelete, setAssignmentToDelete] = useState(null)
  const [expandedAttachments, setExpandedAttachments] = useState({})
  const [commentCounts, setCommentCounts] = useState({}) // Track comment counts per assignment
  const [openedFileIds, setOpenedFileIds] = useState(new Set())
  const [openedFilesStorageReady, setOpenedFilesStorageReady] = useState(false)

  // Load from persistent storage on mount
  useEffect(() => {
    ;(async () => {
      try {
        let stored = null
        if (window.electron?.appStorage) {
          stored = await window.electron.appStorage.get('kmti_opened_files_teamleader')
        }
        if (!stored) stored = localStorage.getItem('kmti_opened_files_teamleader')
        if (stored) setOpenedFileIds(new Set(JSON.parse(stored)))
      } catch {}
      setOpenedFilesStorageReady(true)
    })()
  }, [])

  // Save to persistent storage whenever it changes (only after initial load)
  useEffect(() => {
    if (!openedFilesStorageReady) return
    const data = JSON.stringify([...openedFileIds])
    if (window.electron?.appStorage) {
      window.electron.appStorage.set('kmti_opened_files_teamleader', data)
    }
    try { localStorage.setItem('kmti_opened_files_teamleader', data) } catch {}
  }, [openedFileIds, openedFilesStorageReady])
  const [expandedAssignmentFolders, setExpandedAssignmentFolders] = useState({}) // Track which folders are expanded in assignments
  const [openFolderMenuId, setOpenFolderMenuId] = useState(null) // Track which folder's 3-dot menu is open
  const [folderReviewModal, setFolderReviewModal] = useState(null) // { folderName, folderFiles, assignmentId }
  const [folderReviewComment, setFolderReviewComment] = useState('')
  const [isFolderProcessing, setIsFolderProcessing] = useState(false)

  // Remove attachment confirmation modal
  const [removeAttachmentModal, setRemoveAttachmentModal] = useState({ isOpen: false, attachmentId: null, attachmentName: '', assignmentId: null })

  // Download success toast
  const [downloadToast, setDownloadToast] = useState({ show: false, fileName: '' })

  const triggerDownloadToast = (fileName) => {
    setDownloadToast({ show: true, fileName })
    setTimeout(() => setDownloadToast({ show: false, fileName: '' }), 3500)
  }

  // Helpers moved to shared/utils/ui-helpers.js and file-actions.js

  // Remove entire folder via dedicated folder-delete endpoint
  const handleRemoveAttachmentFolder = async (assignmentId, folderFiles) => {
    setOpenFolderMenuId(null)
    if (!folderFiles || folderFiles.length === 0) return
    const folderName = folderFiles[0].folder_name
    try {
      const data = await apiFetch(
        `/api/assignments/${assignmentId}/attachments/folder/${encodeURIComponent(folderName)}`,
        { method: 'DELETE' }
      )
      if (data.success) {
        setToast({ isOpen: true, title: 'Removed', message: 'Folder removed successfully', type: 'error' })
        if (onRefreshAssignments) onRefreshAssignments()
      } else {
        setToast({ isOpen: true, title: 'Error', message: data.message || 'Failed to remove folder', type: 'error' })
      }
    } catch (err) {
      console.error('Error removing folder:', err)
      setToast({ isOpen: true, title: 'Error', message: 'Failed to remove folder', type: 'error' })
    }
  }

  // Toast notification
  const [toast, setToast] = useState({ isOpen: false, title: '', message: '', type: 'error' })

  // Handle clicking outside to close menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMenuForAssignment && !event.target.closest('.tl-assignment-card-menu')) {
        setShowMenuForAssignment(null)
      }
      if (openFolderMenuId && !event.target.closest('.tl-folder-menu-wrapper')) {
        setOpenFolderMenuId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenuForAssignment])

  // Seed comment counts from pre-loaded assignment data to avoid redundant API calls.
  // fetchCommentCount is still called after posting to keep counts fresh.
  useEffect(() => {
    const initial = {}
    assignments.forEach(assignment => {
      // Use server-provided comment_count if available, otherwise fetch
      if (assignment.comment_count !== undefined) {
        initial[assignment.id] = assignment.comment_count
      } else {
        fetchCommentCount(assignment.id)
      }
    })
    setCommentCounts(prev => ({ ...prev, ...initial }))
  }, [assignments])

  const fetchCommentCount = async (assignmentId) => {
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments`)

      if (data.success) {
        // Count only top-level comments (not replies) to match Admin/User
        const totalComments = (data.comments || []).length
        setCommentCounts(prev => ({
          ...prev,
          [assignmentId]: totalComments
        }))
      }
    } catch (error) {
      console.error('Error fetching comment count:', error)
    }
  }

  const fetchComments = async (assignmentId) => {
    setLoadingComments(true)
    try {
      console.log(`🔍 Fetching comments for assignment ${assignmentId}`)
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments`)

      console.log(`💬 Comments response for ${assignmentId}:`, data)

      if (data.success) {
        console.log(`✅ Setting ${data.comments?.length || 0} comments for assignment ${assignmentId}`)
        setComments(data.comments || [])
      } else {
        console.log(`❌ Failed to fetch comments for assignment ${assignmentId}`)
        setComments([])
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
      setComments([])
    } finally {
      setLoadingComments(false)
    }
  }

  const postComment = async (e) => {
    e.preventDefault()
    const commentText = newComment.trim()
    if (!commentText || !selectedAssignment) return

    try {
      const data = await apiFetch(`/api/assignments/${selectedAssignment.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          username: user.username || user.fullName,
          comment: commentText
        })
      })

      if (data.success) {
        setNewComment('')
        fetchComments(selectedAssignment.id)
        fetchCommentCount(selectedAssignment.id) // Update count after posting
      }
    } catch (error) {
      console.error('Error posting comment:', error)
    }
  }

  const postReply = async (e, commentId, replyTextArg, onSuccess) => {
    e.preventDefault()
    const replyTextValue = (replyTextArg ?? replyText).trim()
    if (!replyTextValue || !selectedAssignment) return

    try {
      const data = await apiFetch(`/api/assignments/${selectedAssignment.id}/comments/${commentId}/reply`, {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          username: user.username || user.fullName,
          reply: replyTextValue
        })
      })

      if (data.success) {
        setReplyText('')
        setReplyingTo(null)
        if (onSuccess) onSuccess()
        fetchComments(selectedAssignment.id)
        fetchCommentCount(selectedAssignment.id) // Update count after posting reply
      }
    } catch (error) {
      console.error('Error posting reply:', error)
    }
  }

  const toggleRepliesVisibility = (commentId) => {
    setVisibleReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }))
  }

  const openCommentsModal = (assignment) => {
    setSelectedAssignment(assignment)
    setShowCommentsModal(true)
    fetchComments(assignment.id)
  }

  const closeCommentsModal = () => {
    setShowCommentsModal(false)
    setSelectedAssignment(null)
    setComments([])
    setNewComment('')
    setReplyingTo(null)
    setReplyText('')
    setVisibleReplies({})
  }

  const deleteComment = async (commentId) => {
    try {
      await apiFetch(`/api/assignments/comments/${commentId}`, { method: 'DELETE' })
      if (selectedAssignment) {
        fetchComments(selectedAssignment.id)
        fetchCommentCount(selectedAssignment.id)
      }
    } catch (err) {
      console.error('Error deleting comment:', err)
    }
  }

  const editComment = async (commentId, newText) => {
    try {
      await apiFetch(`/api/assignments/comments/${commentId}`, {
        method: 'PUT',
        body: JSON.stringify({ comment: newText })
      })
      if (selectedAssignment) fetchComments(selectedAssignment.id)
    } catch (err) {
      console.error('Error editing comment:', err)
    }
  }

  const deleteReply = async (replyId) => {
    try {
      await apiFetch(`/api/assignments/comments/${replyId}`, { method: 'DELETE' })
      if (selectedAssignment) {
        fetchComments(selectedAssignment.id)
        fetchCommentCount(selectedAssignment.id)
      }
    } catch (err) {
      console.error('Error deleting reply:', err)
    }
  }

  const editReply = async (replyId, newText) => {
    try {
      await apiFetch(`/api/assignments/comments/${replyId}`, {
        method: 'PUT',
        body: JSON.stringify({ comment: newText })
      })
      if (selectedAssignment) fetchComments(selectedAssignment.id)
    } catch (err) {
      console.error('Error editing reply:', err)
    }
  }

  // SMART NAVIGATION: Use shared hook for all highlighting and modal effects
  // IMPORTANT: Must be called AFTER openCommentsModal is defined
  useSmartNavigation({
    role: 'teamleader',
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

  const toggleAttachments = (assignmentId) => {
    setExpandedAttachments(prev => ({
      ...prev,
      [assignmentId]: !prev[assignmentId]
    }))
  }

  const openFolderInExplorer = useCallback(async (file) => {
    if (!file) return;
    try {
      const pathData = await apiFetch(`/api/files/${file.id}/path`);
      if (!pathData.success) throw new Error('Failed to get file path');
      const filePath = pathData.filePath;
      if (window.electron && typeof window.electron.openFolderInExplorer === 'function') {
        const result = await window.electron.openFolderInExplorer(filePath);
        if (!result.success) throw new Error(result.error || 'Failed to open folder path');
      } else {
        console.warn('Open folder path is only available in Electron app');
      }
    } catch (error) {
      console.error('Error opening folder path:', error);
    }
  }, []);

  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now - date) / 1000)

    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w ago`

    return formatDate(dateString)
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

  const getStatusColor = (dueDate) => {
    if (!dueDate) return '#95a5a6'
    const date = new Date(dueDate)
    const now = new Date()
    const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return '#e74c3c'
    if (diffDays <= 2) return '#f39c12'
    return '#27ae60'
  }

  const handleShowMembers = (members, e) => {
    e.stopPropagation()
    setSelectedMembers(members)
    setShowMembersModal(true)
  }

  const renderAssignedTo = (assignment) => {
    const assignedTo = assignment.assigned_to || assignment.assignedTo

    if (assignedTo === 'all') {
      return (
        <span className="tl-assignment-assigned-user">All team members</span>
      )
    }

    const members = assignment.assigned_member_details || []
    const memberCount = members.length

    if (memberCount === 0) {
      return <span className="tl-assignment-assigned-user">No members assigned</span>
    } else if (memberCount === 1) {
      return (
        <span className="tl-assignment-assigned-user">
          {members[0].fullName || members[0].username}
        </span>
      )
    } else if (memberCount <= 4) {
      const names = members.map(m => m.fullName || m.username).join(', ')
      return (
        <span className="tl-assignment-assigned-user">{names}</span>
      )
    } else {
      const displayedMembers = members.slice(0, 4)
      const remainingMembers = members.slice(4)
      const displayedNames = displayedMembers.map(m => m.fullName || m.username).join(', ')
      const remainingNames = remainingMembers.map(m => m.fullName || m.username).join(', ')

      return (
        <span className="tl-assignment-assigned-user">
          {displayedNames}
          <span className="tl-assignment-more-members" data-tooltip={remainingNames}>
            {' '}+{remainingMembers.length} more
          </span>
        </span>
      )
    }
  }

  const getInitials = (name) => {
    if (!name) return 'TL'
    if (name.includes('.')) {
      const parts = name.split('.')
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase()
      }
    }
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  // Helper function to group files by folder
  const groupFilesByFolder = useCallback((files) => {
    const folders = {}
    const individualFiles = []

    files.forEach(file => {
      if (file.folder_name) {
        // File is part of a folder
        if (!folders[file.folder_name]) {
          folders[file.folder_name] = []
        }
        folders[file.folder_name].push(file)
      } else {
        // Individual file
        individualFiles.push(file)
      }
    })

    return { folders, individualFiles }
  }, [])

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (isLoadingAssignments) {
    return (
      <div className="tl-content">
        <div className="tl-assignments-feed">
          <div className="tl-page-header">
            <div>
              <h1>Tasks</h1>
              <p>Manage team tasks and submissions</p>
            </div>
            <button className="tl-btn success" onClick={() => setShowCreateAssignmentModal(true)}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Create Task
            </button>
          </div>

          <div className="tl-assignments-feed-container">
            {[1, 2, 3, 4].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="tl-content">
      <div className="tl-assignments-feed">
        <div className="tl-page-header">
          <div>
            <h1>Tasks</h1>
            <p>Manage team tasks and submissions</p>
          </div>
          <button className="tl-btn success" onClick={() => setShowCreateAssignmentModal(true)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Create Task
          </button>
        </div>

        {assignments.length === 0 ? (
          <div className="tl-empty-state">
            <div className="tl-empty-state-icon">📋</div>
            <h3>No tasks yet</h3>
            <p>Create your first task to get started</p>
            <button className="tl-btn success" onClick={() => setShowCreateAssignmentModal(true)}>
              Create Task
            </button>
          </div>
        ) : (
          <div className="tl-assignments-feed-container">
            {assignments.map((assignment) => (
              <PremiumTaskCard
                key={assignment.id}
                task={{
                  ...assignment,
                  comment_count: commentCounts[assignment.id] !== undefined ? commentCounts[assignment.id] : assignment.comment_count
                }}
                role="teamleader"
                onCommentClick={openCommentsModal}
                onActionClick={(action, t) => {
                  if (action === 'delete') {
                    setAssignmentToDelete({ id: t.id, title: t.title });
                    setShowDeleteConfirmation(true);
                  }
                  if (action === 'edit') handleEditAssignment(t);
                  if (action === 'refresh') onRefreshAssignments?.();
                }}
                onPrimaryClick={(action, t) => {
                  if (action === 'done') markAssignmentAsDone(t.id, t.title);
                }}
                onFileClick={(file) => { 
                  setOpenedFileIds(prev => new Set([...prev, file.id])); 
                }}
                onFileDelete={(file) => setRemoveAttachmentModal({ isOpen: true, attachmentId: file.id, attachmentName: file.original_name, assignmentId: assignment.id })}
                onOpenPath={openFolderInExplorer}
                openedFileIds={openedFileIds}
                className="tl-task-card-margin"
              />
            ))}
          </div>
        )}
      </div>

      <CommentsModal
        isOpen={showCommentsModal}
        onClose={closeCommentsModal}
        assignment={selectedAssignment}
        comments={comments}
        loadingComments={loadingComments}
        newComment={newComment}
        setNewComment={setNewComment}
        onPostComment={postComment}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
        replyText={replyText}
        setReplyText={setReplyText}
        onPostReply={postReply}
        onDeleteComment={deleteComment}
        onEditComment={editComment}
        onDeleteReply={deleteReply}
        onEditReply={editReply}
        visibleReplies={visibleReplies}
        toggleRepliesVisibility={toggleRepliesVisibility}
        getInitials={getInitials}
        formatTimeAgo={formatRelativeTime}
        user={user}
      />

      {showMembersModal && (
        <div className="tl-modal-overlay" onClick={() => setShowMembersModal(false)}>
          <div className="tl-modal" onClick={e => e.stopPropagation()}>
            <div className="tl-modal-header">
              <h3>Assigned Members ({selectedMembers.length})</h3>
              <button onClick={() => setShowMembersModal(false)}>×</button>
            </div>
            <div className="tl-modal-body">
              <div className="tl-modal-members-list">
                {selectedMembers.map((member) => (
                  <div key={member.id} className="tl-modal-member-item">
                    <div className="tl-modal-member-avatar">
                      {(member.fullName || member.username).charAt(0).toUpperCase()}
                    </div>
                    <div className="tl-member-info">
                      <div className="tl-member-name">
                        {member.fullName || member.username}
                      </div>
                      {member.fullName && (
                        <div className="tl-member-username">
                          @{member.username}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        onClose={() => {
          setShowDeleteConfirmation(false)
          setAssignmentToDelete(null)
        }}
        onConfirm={() => {
          if (assignmentToDelete) {
            deleteAssignment(assignmentToDelete.id, assignmentToDelete.title)
          }
          setShowDeleteConfirmation(false)
          setAssignmentToDelete(null)
        }}
        title="Delete Task"
        message={`Are you sure you want to delete "${assignmentToDelete?.title}"?`}
        description="This action cannot be undone. All submissions and comments associated with this task will be permanently deleted."
        confirmText="Delete Task"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Folder Review Modal */}
      {folderReviewModal && (
        <div className="modal-overlay" onClick={() => { if (!isFolderProcessing) setFolderReviewModal(null) }}>
          <div className="file-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Folder Details</h3>
              <button className="modal-close" onClick={() => setFolderReviewModal(null)} disabled={isFolderProcessing}>×</button>
            </div>
            <div className="modal-body">
              <div className="file-details-section">
                <h4 className="section-title">Folder Details</h4>
                <div className="file-details-grid">
                  <div className="detail-item">
                    <span className="detail-label">FOLDER NAME:</span>
                    <span className="detail-value">📁 {folderReviewModal.folderName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">TOTAL FILES:</span>
                    <span className="detail-value">{folderReviewModal.folderFiles.length} files</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">SUBMITTED BY:</span>
                    <span className="detail-value">{folderReviewModal.folderFiles[0]?.fullName || folderReviewModal.folderFiles[0]?.username || 'Unknown'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">UPLOAD DATE:</span>
                    <span className="detail-value">{folderReviewModal.folderFiles[0]?.uploaded_at ? new Date(folderReviewModal.folderFiles[0].uploaded_at).toLocaleString() : 'Unknown'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">TEAM:</span>
                    <span className="detail-value">
                      <TeamBadge team={folderReviewModal.folderFiles[0]?.user_team || folderReviewModal.folderFiles[0]?.team} size="sm" />
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">STATUS:</span>
                    <span className="detail-value">
                      {(() => {
                        const files = folderReviewModal.folderFiles
                        const approved = files.filter(f => f.status === 'final_approved').length
                        const tlApproved = files.filter(f => f.status === 'team_leader_approved').length
                        const rejected = files.filter(f => f.status === 'rejected_by_team_leader' || f.status === 'rejected_by_admin').length
                        
                        let status = 'uploaded';
                        if (approved === files.length) status = 'final_approved';
                        else if (rejected === files.length) status = 'rejected';
                        else if (tlApproved + approved === files.length) status = 'team_leader_approved';
                        
                        return <StatusBadge status={status} size="sm" />;
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="comments-section">
                <h4 className="section-title">Comments (Optional)</h4>
                <textarea
                  className="comment-textarea"
                  value={folderReviewComment}
                  onChange={e => setFolderReviewComment(e.target.value)}
                  placeholder="Add optional comments or rejection reason..."
                  rows="4"
                  disabled={isFolderProcessing}
                />
              </div>

              <div className="actions-section">
                <div className="action-buttons-large">
                  <button
                    className="btn btn-success-large"
                    disabled={isFolderProcessing}
                    onClick={async () => {
                      const approvable = folderReviewModal.folderFiles.filter(f =>
                        f.status === 'uploaded' || f.current_stage === 'pending_team_leader'
                      )
                      if (approvable.length === 0) {
                        alert('No files are pending team leader approval.')
                        return
                      }
                      setIsFolderProcessing(true)
                      try {
                        const data = await apiFetch(`/api/files/bulk-action`, {
                          method: 'POST',
                          body: JSON.stringify({
                            fileIds: approvable.map(f => f.id),
                            action: 'approve',
                            comments: folderReviewComment.trim(),
                            reviewerId: user.id,
                            reviewerUsername: user.username,
                            reviewerRole: user.role,
                            team: user.team
                          })
                        })
                        console.log('Bulk approve response:', JSON.stringify(data, null, 2))
                        if (data.success) {
                          if (data.results?.failed?.length > 0) {
                            alert(`⚠️ ${data.results.failed.length} file(s) could not be approved:\n${data.results.failed.map(f => `${f.fileName}: ${f.reason}`).join('\n')}`)
                          }
                          setFolderReviewModal(null)
                          if (onRefreshAssignments) onRefreshAssignments()
                        } else {
                          alert('Failed to approve: ' + (data.message || 'Unknown error'))
                        }
                      } catch (err) {
                        alert('Failed to approve folder: ' + err.message)
                      } finally {
                        setIsFolderProcessing(false)
                      }
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M16.875 5L7.5 14.375L3.125 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {isFolderProcessing ? 'Processing...' : 'Approve All'}
                  </button>
                  <button
                    className="btn btn-danger-large"
                    disabled={isFolderProcessing}
                    onClick={async () => {
                      const rejectable = folderReviewModal.folderFiles.filter(f =>
                        f.status === 'uploaded' || f.current_stage === 'pending_team_leader'
                      )
                      if (rejectable.length === 0) {
                        alert('No files are pending team leader approval.')
                        return
                      }
                      setIsFolderProcessing(true)
                      try {
                        const data = await apiFetch(`/api/files/bulk-action`, {
                          method: 'POST',
                          body: JSON.stringify({
                            fileIds: rejectable.map(f => f.id),
                            action: 'reject',
                            comments: folderReviewComment.trim(),
                            reviewerId: user.id,
                            reviewerUsername: user.username,
                            reviewerRole: user.role,
                            team: user.team
                          })
                        })
                        if (data.success) {
                          setFolderReviewModal(null)
                          if (onRefreshAssignments) onRefreshAssignments()
                        } else {
                          alert('Failed to reject: ' + (data.message || 'Unknown error'))
                        }
                      } catch (err) {
                        alert('Failed to reject folder.')
                      } finally {
                        setIsFolderProcessing(false)
                      }
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {isFolderProcessing ? 'Processing...' : 'Reject All'}
                  </button>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove Attachment Confirmation Modal */}
      {removeAttachmentModal.isOpen && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}
          onClick={() => setRemoveAttachmentModal({ isOpen: false, attachmentId: null, attachmentName: '', assignmentId: null })}
        >
          <div
            style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', maxWidth: '480px', width: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, color: '#dc2626', fontSize: '1.25rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚠️</span> Delete File
              </h3>
              <button
                onClick={() => setRemoveAttachmentModal({ isOpen: false, attachmentId: null, attachmentName: '', assignmentId: null })}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
              >×</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <p style={{ fontSize: '15px', color: '#374151', marginBottom: '16px', lineHeight: 1.6 }}>
                Are you sure you want to permanently delete this file?
              </p>
              <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>📄</span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#991b1b' }}>{removeAttachmentModal.attachmentName}</span>
              </div>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                This action will permanently delete the file from the database and storage. This cannot be undone.
              </p>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setRemoveAttachmentModal({ isOpen: false, attachmentId: null, attachmentName: '', assignmentId: null })}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: '#fff', color: '#374151', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const { attachmentId, assignmentId, attachmentName } = removeAttachmentModal
                  setRemoveAttachmentModal({ isOpen: false, attachmentId: null, attachmentName: '', assignmentId: null })
                  try {
                    const data = await apiFetch(`/api/assignments/${assignmentId}/attachments/${attachmentId}`, { method: 'DELETE' })
                    if (data.success) {
                      setToast({ isOpen: true, title: 'Removed', message: 'File removed successfully', type: 'error' })
                      if (onRefreshAssignments) onRefreshAssignments()
                    }
                  } catch (err) { console.error('Failed to delete attachment:', err) }
                }}
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#dc2626', color: '#fff', fontSize: '14px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
              >
                <span>🗑️</span> Delete File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <SuccessModal
        isOpen={toast.isOpen}
        onClose={() => setToast({ isOpen: false, title: '', message: '', type: 'error' })}
        title={toast.title}
        message={toast.message}
        type={toast.type}
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
            animation: 'tlSlideInRight 0.25s ease',
          }}
        >
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: '#dcfce7', border: '2px solid #86efac',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0, marginTop: '1px'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"/>
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
                animation: 'tlShrinkBar 3.5s linear forwards'
              }} />
            </div>
          </div>
          <button
            onClick={() => setDownloadToast({ show: false, fileName: '' })}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#9ca3af', fontSize: '20px', lineHeight: 1,
              padding: '0', flexShrink: 0, borderRadius: '4px',
              marginTop: '-2px'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#374151'}
            onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
          >×</button>
        </div>
      )}

      <style>{`
        @keyframes tlSlideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes tlShrinkBar {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>

    </div>
  )
}

export default AssignmentsTab
