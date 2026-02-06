import { useState, useEffect, useRef } from 'react'
import { API_BASE_URL } from '@/config/api'
import './css/AssignmentsTab.css'
import { CardSkeleton } from '../common/InlineSkeletonLoader'
import { ConfirmationModal, CommentsModal, FileIcon, FileOpenModal } from '../shared'
import { useSmartNavigation } from '../shared/SmartNavigation'
import '../shared/SmartNavigation/SmartNavigation.css'

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
  handleEditAssignment
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

  // Handle clicking outside to close menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMenuForAssignment && !event.target.closest('.tl-assignment-card-menu')) {
        setShowMenuForAssignment(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenuForAssignment])

  // Fetch comment counts for all assignments
  useEffect(() => {
    assignments.forEach(assignment => {
      fetchCommentCount(assignment.id)
    })
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
                id={`assignment-card-${assignment.id}`}
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
                  <h3 className="tl-assignment-title">{assignment.title}</h3>
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
                {assignment.attachments && assignment.attachments.length > 0 && (
                  <div className="tl-assignment-attachment-section">
                    <div className="tl-assignment-tl-attached-file">
                      <div className="tl-assignment-tl-file-label">
                        📎 Attached Files ({assignment.attachments.length})
                      </div>
                      {assignment.attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="tl-assignment-tl-file-item"
                          onClick={() => {
                            setFileToOpen(attachment)
                            setShowOpenFileConfirmation(true)
                          }}
                        >
                          <FileIcon
                            fileType={attachment.original_name.split('.').pop()}
                            size="small"
                            className="tl-assignment-file-icon"
                          />
                          <div className="tl-assignment-file-details">
                            <div className="tl-assignment-file-name">
                              {attachment.original_name}
                            </div>
                            <div className="tl-assignment-file-meta">
                              <span>
                                by <span className="tl-assignment-file-submitter">
                                  {assignment.team_leader_fullname || assignment.teamLeaderUsername || 'Team Leader'}
                                </span>
                              </span>
                              <span>{formatFileSize(attachment.file_size)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="tl-assignment-attachment-section">
                  {assignment.recent_submissions && assignment.recent_submissions.length > 0 ? (
                    <div className="tl-assignment-attached-file">
                      <div className="tl-assignment-file-label">
                        📎 Submitted Files ({assignment.recent_submissions.length})
                      </div>
                      {(expandedAttachments[assignment.id]
                        ? assignment.recent_submissions
                        : assignment.recent_submissions.slice(0, 5)
                      ).map((submission) => (
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
                      {assignment.recent_submissions.length > 5 && (
                        <button
                          className="tl-attachment-toggle-btn"
                          onClick={() => toggleAttachments(assignment.id)}
                        >
                          {expandedAttachments[assignment.id]
                            ? 'See less'
                            : `See more (${assignment.recent_submissions.length - 5} more)`}
                        </button>
                      )}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedMembers.map((member) => (
                  <div key={member.id} style={{
                    padding: '12px',
                    background: 'var(--background-primary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--primary-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}>
                      {(member.fullName || member.username).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                        {member.fullName || member.username}
                      </div>
                      {member.fullName && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
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

              window.open(fileUrl, '_blank', 'nullable,noreferrer');
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
