import React, { useState, useEffect, useRef, useCallback } from 'react'
import { API_BASE_URL } from '@/config/api'
import './css/AssignmentsTab.css'
import './modals/css/AssignmentDetailsModal.css'
import { CardSkeleton } from '../common/InlineSkeletonLoader'
import { ConfirmationModal, CommentsModal, FileIcon, FileOpenModal } from '../shared'
import { useSmartNavigation } from '../shared/SmartNavigation'
import '../shared/SmartNavigation/SmartNavigation.css'
import SuccessModal from '../user/SuccessModal'

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
  const [showOpenFileConfirmation, setShowOpenFileConfirmation] = useState(false)
  const [fileToOpen, setFileToOpen] = useState(null)
  const [expandedAssignmentFolders, setExpandedAssignmentFolders] = useState({}) // Track which folders are expanded in assignments
  const [openFolderMenuId, setOpenFolderMenuId] = useState(null) // Track which folder's 3-dot menu is open
  const [folderReviewModal, setFolderReviewModal] = useState(null) // { folderName, folderFiles, assignmentId }
  const [folderReviewComment, setFolderReviewComment] = useState('')
  const [isFolderProcessing, setIsFolderProcessing] = useState(false)

  // Remove attachment confirmation modal
  const [removeAttachmentModal, setRemoveAttachmentModal] = useState({ isOpen: false, attachmentId: null, attachmentName: '', assignmentId: null })

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
      const response = await fetch(`${API_BASE_URL}/api/assignments/${assignmentId}/comments`)
      const data = await response.json()

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
      const response = await fetch(`${API_BASE_URL}/api/assignments/${assignmentId}/comments`)
      const data = await response.json()

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
      const response = await fetch(`${API_BASE_URL}/api/assignments/${selectedAssignment.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          username: user.username || user.fullName,
          comment: commentText
        })
      })

      const data = await response.json()

      if (data.success) {
        setNewComment('')
        fetchComments(selectedAssignment.id)
        fetchCommentCount(selectedAssignment.id) // Update count after posting
      }
    } catch (error) {
      console.error('Error posting comment:', error)
    }
  }

  const postReply = async (e, commentId) => {
    e.preventDefault()
    const replyTextValue = replyText.trim()
    if (!replyTextValue || !selectedAssignment) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/assignments/${selectedAssignment.id}/comments/${commentId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          username: user.username || user.fullName,
          reply: replyTextValue
        })
      })

      const data = await response.json()

      if (data.success) {
        setReplyText('')
        setReplyingTo(null)
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
              <div
                key={assignment.id}
                id={`tl-assignment-${assignment.id}`}
                className="tl-assignment-card"
              >
                <div className="tl-assignment-card-header">
                  <div className="tl-assignment-header-left">
                    <div className="tl-assignment-avatar">
                      {getInitials(assignment.team_leader_username || 'TL')}
                    </div>
                    <div className="tl-assignment-header-info">
                      <div className="tl-assignment-team-leader-info">
                        <span className="tl-assignment-team-leader-name">
                          {assignment.team_leader_fullname || assignment.team_leader_full_name || user.fullName || assignment.team_leader_username || 'KMTI Team Leader'}
                        </span>
                        <span className="tl-assignments-role-badge team-leader">TEAM LEADER</span>
                        <span className="tl-assignment-assigned-to-text"> assigned to</span>
                        <span className="tl-assignment-assigned-user-wrapper">
                          {renderAssignedTo(assignment)}
                        </span>
                      </div>
                      <div className="tl-assignment-created">
                        {formatDateTime(assignment.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="tl-assignment-header-right">
                    {assignment.status === 'completed' ? (
                      <div className="tl-assignment-status-badge completed">
                        ✓ Completed
                      </div>
                    ) : (
                      (assignment.due_date || assignment.dueDate) && (
                        <div className="tl-assignment-due-date">
                          Due {formatDate(assignment.due_date || assignment.dueDate)}
                          <span
                            className="tl-assignment-days-left"
                            style={{ color: getStatusColor(assignment.due_date || assignment.dueDate) }}
                          >
                            {' '}({formatDaysLeft(assignment.due_date || assignment.dueDate)})
                          </span>
                        </div>
                      )
                    )}
                    <div className="tl-assignment-card-menu">
                      <button
                        className="tl-assignment-menu-btn"
                        onClick={() => setShowMenuForAssignment(showMenuForAssignment === assignment.id ? null : assignment.id)}
                        title="More options"
                      >
                        ⋮
                      </button>
                      {showMenuForAssignment === assignment.id && (
                        <div className="tl-assignment-menu-dropdown">
                          <button
                            className="tl-assignment-menu-item"
                            onClick={() => {
                              markAssignmentAsDone(assignment.id, assignment.title)
                              setShowMenuForAssignment(null)
                            }}
                            disabled={assignment.status === 'completed'}
                          >
                            {assignment.status === 'completed' ? '✓ Marked as Done' : 'Mark as Done'}
                          </button>
                          <button
                            className="tl-assignment-menu-item"
                            onClick={() => {
                              handleEditAssignment(assignment)
                              setShowMenuForAssignment(null)
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="tl-assignment-menu-item tl-assignment-delete-menu-item"
                            onClick={() => {
                              setAssignmentToDelete({ id: assignment.id, title: assignment.title })
                              setShowDeleteConfirmation(true)
                              setShowMenuForAssignment(null)
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="tl-assignment-task-title-section">
                  <div className="tl-assignment-title-with-team">
                    <h3 className="tl-assignment-title">{assignment.title}</h3>
                    {assignment.team && (
                      <span className="tl-assignment-team-badge" data-team={assignment.team}>
                        {assignment.team}
                      </span>
                    )}
                  </div>
                </div>

                {assignment.description ? (
                  <div className="tl-assignment-task-description-section">
                    <p className="tl-assignment-description">{assignment.description}</p>
                  </div>
                ) : (
                  <div className="tl-assignment-task-description-section">
                    <p className="tl-assignment-no-description">No description</p>
                  </div>
                )}

                {/* Attachments Section */}
                {assignment.attachments && assignment.attachments.length > 0 && (() => {
                  // Group attachments by folder_name
                  const attFolders = {}
                  const attIndividual = []
                  assignment.attachments.forEach(att => {
                    if (att.folder_name) {
                      if (!attFolders[att.folder_name]) attFolders[att.folder_name] = []
                      attFolders[att.folder_name].push(att)
                    } else {
                      attIndividual.push(att)
                    }
                  })
                  const tlName = assignment.team_leader_fullname || assignment.teamLeaderUsername || 'Team Leader'
                  return (
                    <div className="tl-assignment-attachment-section">
                      <div className="tl-assignment-tl-attached-file">
                        <div className="tl-assignment-tl-file-label">
                          📎 Attached Files ({assignment.attachments.length})
                        </div>

                        {/* Folder attachments */}
                        {Object.entries(attFolders).map(([folderName, files]) => {
                          const isExpanded = expandedAttachments[`attfolder-${assignment.id}-${folderName}`]
                          return (
                            <React.Fragment key={`attfolder-${folderName}`}>
                              <div
                                className="tl-assignment-tl-file-item"
                                style={{ cursor: 'pointer', backgroundColor: isExpanded ? '#BFDBFE' : '#DBEAFE', position: 'relative' }}
                                onClick={() => setExpandedAttachments(prev => ({ ...prev, [`attfolder-${assignment.id}-${folderName}`]: !prev[`attfolder-${assignment.id}-${folderName}`] }))}
                              >
                                <div style={{ fontSize: '28px' }}>{isExpanded ? '📂' : '📁'}</div>
                                <div className="tl-assignment-file-details">
                                  <div className="tl-assignment-file-name" style={{ fontWeight: '600' }}>{folderName}</div>
                                  <div className="tl-assignment-file-meta">
                                    <span>by <span className="tl-assignment-file-submitter">{tlName}</span></span>
                                    <span>{files.length} files</span>
                                  </div>
                                </div>
                              </div>
                              {isExpanded && files.map(att => (
                                <div
                                  key={att.id}
                                  className="tl-assignment-tl-file-item"
                                  style={{ position: 'relative', paddingLeft: '28px', backgroundColor: '#f0f9ff' }}
                                  onClick={() => { setFileToOpen(att); setShowOpenFileConfirmation(true) }}
                                >
                                  <FileIcon fileType={att.original_name.split('.').pop()} size="small" className="tl-assignment-file-icon" />
                                  <div className="tl-assignment-file-details">
                                    <div className="tl-assignment-file-name">
                                    {att.relative_path && att.relative_path !== att.original_name ? att.relative_path : att.original_name}
                                  </div>
                                    <div className="tl-assignment-file-meta"><span>{formatFileSize(att.file_size)}</span></div>
                                  </div>
                                  <button onClick={(e) => { e.stopPropagation(); setRemoveAttachmentModal({ isOpen: true, attachmentId: att.id, attachmentName: att.original_name, assignmentId: assignment.id }) }} title="Remove" style={{ position:'absolute', right:'8px', top:'50%', transform:'translateY(-50%)', background:'transparent', border:'none', cursor:'pointer', color:'#9ca3af', fontSize:'18px', width:'28px', height:'28px', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'6px' }} onMouseEnter={e=>{e.currentTarget.style.backgroundColor='#fee2e2';e.currentTarget.style.color='#dc2626'}} onMouseLeave={e=>{e.currentTarget.style.backgroundColor='transparent';e.currentTarget.style.color='#9ca3af'}}>×</button>
                                </div>
                              ))}
                            </React.Fragment>
                          )
                        })}

                        {/* Individual file attachments */}
                        {attIndividual.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="tl-assignment-tl-file-item"
                            style={{ position: 'relative' }}
                            onClick={() => { setFileToOpen(attachment); setShowOpenFileConfirmation(true) }}
                          >
                            <FileIcon fileType={attachment.original_name.split('.').pop()} size="small" className="tl-assignment-file-icon" />
                            <div className="tl-assignment-file-details">
                              <div className="tl-assignment-file-name">
                                {attachment.relative_path && attachment.relative_path !== attachment.original_name ? attachment.relative_path : attachment.original_name}
                              </div>
                              <div className="tl-assignment-file-meta">
                                <span>by <span className="tl-assignment-file-submitter">{tlName}</span></span>
                                <span>{formatFileSize(attachment.file_size)}</span>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setRemoveAttachmentModal({ isOpen: true, attachmentId: attachment.id, attachmentName: attachment.original_name, assignmentId: assignment.id })
                              }}
                              title="Remove attachment"
                              style={{ position:'absolute', right:'8px', top:'50%', transform:'translateY(-50%)', background:'transparent', border:'none', cursor:'pointer', color:'#9ca3af', fontSize:'18px', lineHeight:1, width:'28px', height:'28px', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'6px', transition:'all 0.2s' }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; e.currentTarget.style.color = '#dc2626' }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9ca3af' }}
                            >×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                <div className="tl-assignment-attachment-section">
                  {assignment.recent_submissions && assignment.recent_submissions.length > 0 ? (
                    <div className="tl-assignment-attached-file">
                      <div className="tl-assignment-file-label">
                        📎 Submitted Files ({assignment.recent_submissions.length})
                      </div>
                      {(() => {
                        // Group all files first, then paginate by top-level items (folder = 1 item)
                        const { folders: allFolders, individualFiles: allIndividualFiles } = groupFilesByFolder(assignment.recent_submissions)
                        const allTopLevelItems = [
                          ...Object.keys(allFolders).map(name => ({ type: 'folder', name })),
                          ...allIndividualFiles.map(f => ({ type: 'file', file: f }))
                        ]
                        const totalTopLevel = allTopLevelItems.length
                        const visibleItems = expandedAttachments[assignment.id]
                          ? allTopLevelItems
                          : allTopLevelItems.slice(0, 5)
                        const visibleFolderNames = new Set(visibleItems.filter(i => i.type === 'folder').map(i => i.name))
                        const visibleIndividualFiles = visibleItems.filter(i => i.type === 'file').map(i => i.file)
                        const folders = Object.fromEntries(Object.entries(allFolders).filter(([k]) => visibleFolderNames.has(k)))
                        const individualFiles = visibleIndividualFiles
                        
                        return (
                          <>
                            {/* Render Folders */}
                            {Object.keys(folders).map((folderName) => {
                              const folderFiles = folders[folderName]
                              const isExpanded = expandedAssignmentFolders[`${assignment.id}-${folderName}`]
                              
                              return (
                                <React.Fragment key={`folder-${folderName}`}>
                                  {/* Folder Header */}
                                  <div
                                    className="tl-assignment-file-item tl-folder-item"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setExpandedAssignmentFolders(prev => ({
                                        ...prev,
                                        [`${assignment.id}-${folderName}`]: !prev[`${assignment.id}-${folderName}`]
                                      }))
                                    }}
                                    style={{ cursor: 'pointer', backgroundColor: isExpanded ? '#BFDBFE' : '#DBEAFE', position: 'relative' }}
                                  >
                                    <div style={{ fontSize: '32px' }}>
                                      {isExpanded ? '📂' : '📁'}
                                    </div>
                                    <div className="tl-assignment-file-details">
                                      <div className="tl-assignment-file-name" style={{ fontWeight: '600' }}>
                                        {folderName}
                                      </div>
                                      <div className="tl-assignment-file-meta">
                                        <span>
                                          by <span className="tl-assignment-file-submitter">
                                            {folderFiles[0].fullName || folderFiles[0].username || 'Unknown'}
                                          </span>
                                        </span>
                                        <span>{folderFiles.length} files</span>
                                        {(() => {
                                          const total = folderFiles.length
                                          const approved = folderFiles.filter(f => f.status === 'final_approved').length
                                          const tlApproved = folderFiles.filter(f => f.status === 'team_leader_approved').length
                                          const rejected = folderFiles.filter(f => f.status === 'rejected_by_team_leader' || f.status === 'rejected_by_admin').length
                                          const pending = folderFiles.filter(f => f.status === 'uploaded' || !f.status).length
                                          const badges = []

                                          // All approved
                                          if (approved === total) return <span style={{ background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>✓ All Approved</span>

                                          // All rejected
                                          if (rejected === total) return <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>✗ All Rejected</span>

                                          // Build composite badges
                                          // Pending Admin badge: files waiting for admin (team_leader_approved or final_approved)
                                          const pendingAdmin = tlApproved
                                          const pendingTeam = pending

                                          if (pendingAdmin > 0 || (approved > 0 && pending === 0 && rejected === 0)) {
                                            badges.push(<span key="pa" style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', marginRight: '4px' }}>Pending Admin</span>)
                                          }
                                          if (pendingTeam > 0) {
                                            badges.push(<span key="pt" style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', marginRight: '4px' }}>Pending Team</span>)
                                          }
                                          if (rejected > 0) {
                                            badges.push(<span key="rj" style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', marginRight: '4px' }}>{rejected} Rejected</span>)
                                          }
                                          if (approved > 0 && approved < total) {
                                            badges.push(<span key="ap" style={{ background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>{approved} Approved</span>)
                                          }

                                          return badges.length > 0 ? <>{badges}</> : <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>Pending Review</span>
                                        })()}
                                      </div>
                                    </div>
                                    {/* 3-dot menu */}
                                    <div
                                      className="tl-folder-menu-wrapper"
                                      style={{ marginLeft: 'auto', position: 'relative' }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        className="tl-assignment-menu-btn"
                                        style={{ fontSize: '13px', padding: '2px 6px', letterSpacing: '1px' }}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          const menuId = `${assignment.id}-${folderName}`
                                          setOpenFolderMenuId(prev => prev === menuId ? null : menuId)
                                        }}
                                        title="More options"
                                      >
                                        •••
                                      </button>
                                      {openFolderMenuId === `${assignment.id}-${folderName}` && (
                                        <div className="tl-assignment-menu-dropdown" style={{ right: 0, left: 'auto', minWidth: '180px', whiteSpace: 'nowrap' }}>
                                          <button
                                            className="tl-assignment-menu-item"
                                            style={{ fontWeight: '600' }}
                                            onClick={async (e) => {
                                              e.stopPropagation()
                                              setOpenFolderMenuId(null)
                                              if (!window.electron || !window.electron.openFolderInExplorer) {
                                                alert('Open Folder Path is only available in the desktop app.')
                                                return
                                              }
                                              const firstFile = folderFiles[0]
                                              try {
                                                const response = await fetch(`${API_BASE_URL}/api/files/${firstFile.id}/path`)
                                                const data = await response.json()
                                                if (data.success && data.filePath) {
                                                  const result = await window.electron.openFolderInExplorer(data.filePath)
                                                  if (!result.success) {
                                                    alert('Could not open folder: ' + (result.error || 'Unknown error'))
                                                  }
                                                } else {
                                                  alert('Could not retrieve folder path.')
                                                }
                                              } catch (err) {
                                                console.error('Error opening folder:', err)
                                                alert('Failed to open folder path.')
                                              }
                                            }}
                                          >
                                            📂 Open Folder Path
                                          </button>
                                          <button
                                            className="tl-assignment-menu-item"
                                            style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setOpenFolderMenuId(null)
                                              setFolderReviewComment('')
                                              setFolderReviewModal({ folderName, folderFiles })
                                            }}
                                          >
                                            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                                              <path d="M10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2Z" fill="#16a34a" opacity="0.15"/>
                                              <path d="M10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2Z" stroke="#16a34a" strokeWidth="1.5"/>
                                              <path d="M6.5 10L9 12.5L13.5 7.5" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                            <span style={{ color: '#16a34a' }}>Approve</span>
                                            <span style={{ color: '#9ca3af' }}> / </span>
                                            <span style={{ color: '#dc2626' }}>Reject Folder</span>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Folder Contents */}
                                  {isExpanded && folderFiles.map((file) => (
                                    <div
                                      key={file.id}
                                      data-file-id={file.id}
                                      className="tl-assignment-file-item tl-folder-file-item"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (openReviewModal && file.id) {
                                          openReviewModal(file, null)
                                        }
                                      }}
                                      style={{ marginLeft: '40px', backgroundColor: '#fafafa' }}
                                    >
                                      <FileIcon
                                        fileType={(file.original_name || file.file_name).split('.').pop()}
                                        size="small"
                                        className="tl-assignment-file-icon"
                                      />
                                      <div className="tl-assignment-file-details">
                                        <div className="tl-assignment-file-name">
                                          {file.relative_path || file.original_name || file.file_name}
                                        </div>
                                        <div className="tl-assignment-file-meta">
                                          <span>
                                            by <span className="tl-assignment-file-submitter">
                                              {file.fullName || file.username || 'Unknown'}
                                            </span>
                                          </span>
                                          {file.tag && (
                                            <span className="tl-assignment-file-tag">
                                              🏷️ {file.tag}
                                            </span>
                                          )}
                                          {file.description && (
                                            <span className="tl-assignment-file-description">
                                              {file.description}
                                            </span>
                                          )}
                                          <span className={`tl-assignment-file-status ${file.status === 'uploaded' ? 'uploaded' :
                                            file.status === 'team_leader_approved' ? 'team-leader-approved' :
                                              file.status === 'final_approved' ? 'final-approved' :
                                                file.status === 'rejected_by_team_leader' || file.status === 'rejected_by_admin' ? 'rejected' :
                                                  'uploaded'
                                            }`}>
                                            {file.status === 'uploaded' ? 'NEW' :
                                              file.status === 'team_leader_approved' ? 'PENDING ADMIN' :
                                                file.status === 'final_approved' ? '✓ APPROVED' :
                                                  file.status === 'rejected_by_team_leader' ? '✗ REJECTED' :
                                                    file.status === 'rejected_by_admin' ? '✗ REJECTED' :
                                                      'PENDING'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </React.Fragment>
                              )
                            })}
                            
                            {/* Render Individual Files */}
                            {individualFiles.map((submission) => (
                        <div
                          key={submission.id}
                          data-file-id={submission.id}
                          className="tl-assignment-file-item"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (openReviewModal && submission.id) {
                              openReviewModal(submission, null)
                            }
                          }}
                        >
                          <FileIcon
                            fileType={(submission.original_name || submission.file_name).split('.').pop()}
                            size="small"
                            className="tl-assignment-file-icon"
                          />
                          <div className="tl-assignment-file-details">
                            <div className="tl-assignment-file-name">
                              {submission.original_name || submission.file_name}
                            </div>
                            <div className="tl-assignment-file-meta">
                              <span>
                                by <span className="tl-assignment-file-submitter">
                                  {submission.fullName || submission.username || 'Unknown'}
                                </span>
                              </span>
                              {submission.tag && (
                                <span className="tl-assignment-file-tag">
                                  🏷️ {submission.tag}
                                </span>
                              )}
                              {submission.description && (
                                <span className="tl-assignment-file-description">
                                  {submission.description}
                                </span>
                              )}
                              <span className={`tl-assignment-file-status ${submission.status === 'uploaded' ? 'uploaded' :
                                submission.status === 'team_leader_approved' ? 'team-leader-approved' :
                                  submission.status === 'final_approved' ? 'final-approved' :
                                    submission.status === 'rejected_by_team_leader' || submission.status === 'rejected_by_admin' ? 'rejected' :
                                      'uploaded'
                                }`}>
                                {submission.status === 'uploaded' ? 'NEW' :
                                  submission.status === 'team_leader_approved' ? 'PENDING ADMIN' :
                                    submission.status === 'final_approved' ? '✓ APPROVED' :
                                      submission.status === 'rejected_by_team_leader' ? '✗ REJECTED' :
                                        submission.status === 'rejected_by_admin' ? '✗ REJECTED' :
                                          'PENDING'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                            {totalTopLevel > 5 && (
                              <button
                                className="tl-attachment-toggle-btn"
                                onClick={() => toggleAttachments(assignment.id)}
                              >
                                {expandedAttachments[assignment.id]
                                  ? 'See less'
                                  : `See more (${totalTopLevel - 5} more)`}
                              </button>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  ) : (
                    <div className="tl-assignment-no-attachment">
                      <span className="tl-assignment-no-attachment-icon">ℹ️</span>
                      <div className="tl-assignment-no-attachment-text">
                        <strong>No submissions yet.</strong>
                        Waiting for team members to submit files.
                      </div>
                    </div>
                  )}
                </div>

                <div className="tl-assignment-comments-section">
                  <button
                    className="tl-assignment-comments-text"
                    onClick={() => openCommentsModal(assignment)}
                  >
                    Comments ({commentCounts[assignment.id] || 0})
                  </button>
                </div>
              </div>
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
                    <span className="detail-value team-badge-inline">{folderReviewModal.folderFiles[0]?.user_team || folderReviewModal.folderFiles[0]?.team || 'Unknown'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">STATUS:</span>
                    <span className="detail-value">
                      {(() => {
                        const files = folderReviewModal.folderFiles
                        const approved = files.filter(f => f.status === 'final_approved').length
                        const tlApproved = files.filter(f => f.status === 'team_leader_approved').length
                        const rejected = files.filter(f => f.status === 'rejected_by_team_leader' || f.status === 'rejected_by_admin').length
                        if (approved === files.length) return <span className="status-badge status-approved">All Approved</span>
                        if (rejected === files.length) return <span className="status-badge status-rejected">All Rejected</span>
                        if (tlApproved + approved === files.length) return <span className="status-badge status-pending">Pending Admin</span>
                        return <span className="status-badge status-pending">Pending Team Leader</span>
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
                        const response = await fetch(`${API_BASE_URL}/api/files/bulk-action`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
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
                        const data = await response.json()
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
                        const response = await fetch(`${API_BASE_URL}/api/files/bulk-action`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
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
                        const data = await response.json()
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
                    const res = await fetch(`${API_BASE_URL}/api/assignments/${assignmentId}/attachments/${attachmentId}`, { method: 'DELETE' })
                    const data = await res.json()
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
            // Check if running in Electron and has capability to open files locally
            if (window.electron && window.electron.openFileInApp) {
              // Get the absolute file path from server
              const response = await fetch(`${API_BASE_URL}/api/files/${fileToOpen.id}/path`);
              const data = await response.json();

              if (data.success && data.filePath) {
                const result = await window.electron.openFileInApp(data.filePath);

                if (!result.success) {
                  alert('Failed to open file locally: ' + (result.error || 'Unknown error'));
                }
              } else {
                alert('Could not retrieve file path');
              }
            } else {
              // Web fallback: Open file in new tab/download
              // Use public_network_url if available for approved files, otherwise construct from file_path
              let fileUrl = fileToOpen.file_path;
              if (fileToOpen.status === 'final_approved' && fileToOpen.public_network_url) {
                // If it's a full URL, use it directly, otherwise treat as path
                if (fileToOpen.public_network_url.startsWith('http')) {
                  fileUrl = fileToOpen.public_network_url;
                } else {
                  // Correctly handle network paths if needed, but for web usually we serve via API
                  // If we are on web, we likely want to serve it via the server's static files or viewer
                  fileUrl = `${API_BASE_URL}${fileToOpen.file_path}`;
                }
              } else {
                // Ensure we have the base URL
                fileUrl = `${API_BASE_URL}${fileToOpen.file_path}`;
              }

              window.open(fileUrl, '_blank', 'noopener,noreferrer');
            }
          } catch (error) {
            console.error('Error opening file:', error);
            alert('Failed to open file. Please try again.');
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

export default AssignmentsTab
