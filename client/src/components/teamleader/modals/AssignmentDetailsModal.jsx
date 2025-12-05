import { useState, useEffect } from 'react'
import './css/AssignmentDetailsModal.css'
import FileIcon from '../../admin/FileIcon'

const AssignmentDetailsModal = ({
  showAssignmentDetailsModal,
  setShowAssignmentDetailsModal,
  selectedAssignment,
  setSelectedAssignment,
  assignmentSubmissions,
  setAssignmentSubmissions,
  formatDate,
  formatDateTime,
  formatFileSize,
  teamLeaderId,
  teamLeaderUsername
}) => {
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const [reviewComment, setReviewComment] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [submissionComments, setSubmissionComments] = useState([])
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  
  // Assignment comments state
  const [assignmentComments, setAssignmentComments] = useState([])
  const [newAssignmentComment, setNewAssignmentComment] = useState('')
  const [isPostingComment, setIsPostingComment] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [isPostingReply, setIsPostingReply] = useState(false)

  // Extract file extension helper
  const getFileExtension = (filename, fileType) => {
    if (filename) {
      const parts = filename.split('.')
      if (parts.length > 1) {
        return parts[parts.length - 1].toLowerCase()
      }
    }
    if (fileType) {
      return fileType.replace(/^\./, '').toLowerCase()
    }
    return ''
  }

  // Fetch comments when a submission is selected
  useEffect(() => {
    if (selectedSubmission) {
      fetchSubmissionComments(selectedSubmission.id)
    } else {
      setSubmissionComments([])
    }
  }, [selectedSubmission])

  // Fetch assignment comments when modal opens
  useEffect(() => {
    if (showAssignmentDetailsModal && selectedAssignment) {
      fetchAssignmentComments()
    }
  }, [showAssignmentDetailsModal, selectedAssignment])

  const fetchSubmissionComments = async (fileId) => {
    setIsLoadingComments(true)
    try {
      const response = await fetch(`http://localhost:3001/api/files/${fileId}/comments`)
      const data = await response.json()
      
      if (data.success) {
        setSubmissionComments(data.comments || [])
      } else {
        setSubmissionComments([])
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
      setSubmissionComments([])
    } finally {
      setIsLoadingComments(false)
    }
  }

  const fetchAssignmentComments = async () => {
    if (!selectedAssignment) return
    
    try {
      const response = await fetch(`http://localhost:3001/api/assignments/${selectedAssignment.id}/comments`)
      const data = await response.json()
      
      if (data.success) {
        setAssignmentComments(data.comments || [])
      }
    } catch (error) {
      console.error('Error fetching assignment comments:', error)
      setAssignmentComments([])
    }
  }

  const postAssignmentComment = async () => {
    const commentText = newAssignmentComment.trim()
    if (!commentText || !selectedAssignment) return

    setIsPostingComment(true)
    
    try {
      const response = await fetch(`http://localhost:3001/api/assignments/${selectedAssignment.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: teamLeaderId,
          username: teamLeaderUsername,
          comment: commentText
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setNewAssignmentComment('')
        fetchAssignmentComments()
      } else {
        alert('Failed to post comment')
      }
    } catch (error) {
      console.error('Error posting comment:', error)
      alert('Failed to post comment')
    } finally {
      setIsPostingComment(false)
    }
  }

  const postReply = async (commentId) => {
    const replyTextValue = replyText.trim()
    if (!replyTextValue || !selectedAssignment) return

    setIsPostingReply(true)
    
    try {
      const response = await fetch(`http://localhost:3001/api/assignments/${selectedAssignment.id}/comments/${commentId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: teamLeaderId,
          username: teamLeaderUsername,
          reply: replyTextValue
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setReplyText('')
        setReplyingTo(null)
        fetchAssignmentComments()
      } else {
        alert('Failed to post reply')
      }
    } catch (error) {
      console.error('Error posting reply:', error)
      alert('Failed to post reply')
    } finally {
      setIsPostingReply(false)
    }
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
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getInitials = (name) => {
    if (!name) return '?'
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

  if (!showAssignmentDetailsModal || !selectedAssignment) return null

  const handleClose = () => {
    setShowAssignmentDetailsModal(false)
    setSelectedAssignment(null)
    setAssignmentSubmissions([])
    setSelectedSubmission(null)
  }

  const handleCloseSubmissionModal = () => {
    setSelectedSubmission(null)
    setReviewComment('')
  }

  const handleShowMembers = (e) => {
    e.stopPropagation()
    setShowMembersModal(true)
  }

  const handleApproveSubmission = async () => {
    if (!selectedSubmission) return

    setIsProcessing(true)
    try {
      const response = await fetch(`http://localhost:3001/api/files/${selectedSubmission.id}/team-leader-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'approve',
          comments: reviewComment.trim() || null,
          teamLeaderId,
          teamLeaderUsername,
          teamLeaderRole: 'TEAM_LEADER',
          team: selectedAssignment.team
        })
      })

      const data = await response.json()

      if (data.success) {
        setAssignmentSubmissions(prev =>
          prev.map(sub =>
            sub.id === selectedSubmission.id
              ? { ...sub, status: 'team_leader_approved', review_status: 'approved' }
              : sub
          )
        )
        handleCloseSubmissionModal()
        await fetchSubmissionComments(selectedSubmission.id)
      } else {
        alert(data.message || 'Failed to approve submission')
      }
    } catch (error) {
      console.error('Error approving submission:', error)
      alert('Failed to approve submission')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRejectSubmission = async () => {
    if (!selectedSubmission) return
    
    if (!reviewComment.trim()) {
      alert('Please provide a reason for rejection')
      return
    }

    setIsProcessing(true)
    try {
      const response = await fetch(`http://localhost:3001/api/files/${selectedSubmission.id}/team-leader-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'reject',
          comments: reviewComment.trim(),
          teamLeaderId,
          teamLeaderUsername,
          teamLeaderRole: 'TEAM_LEADER',
          team: selectedAssignment.team
        })
      })

      const data = await response.json()

      if (data.success) {
        setAssignmentSubmissions(prev =>
          prev.map(sub =>
            sub.id === selectedSubmission.id
              ? { ...sub, status: 'rejected_by_team_leader', review_status: 'rejected' }
              : sub
          )
        )
        handleCloseSubmissionModal()
        await fetchSubmissionComments(selectedSubmission.id)
      } else {
        alert(data.message || 'Failed to reject submission')
      }
    } catch (error) {
      console.error('Error rejecting submission:', error)
      alert('Failed to reject submission')
    } finally {
      setIsProcessing(false)
    }
  }

  const addComment = async () => {
    if (!selectedSubmission || !reviewComment.trim()) return

    setIsProcessing(true)
    try {
      const response = await fetch(`http://localhost:3001/api/files/${selectedSubmission.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: reviewComment.trim(),
          userId: teamLeaderId,
          username: teamLeaderUsername,
          userRole: 'TEAM_LEADER'
        })
      })

      const data = await response.json()

      if (data.success) {
        setReviewComment('')
        await fetchSubmissionComments(selectedSubmission.id)
      } else {
        alert(data.message || 'Failed to add comment')
      }
    } catch (error) {
      console.error('Error adding comment:', error)
      alert('Failed to add comment')
    } finally {
      setIsProcessing(false)
    }
  }

  const renderAssignedTo = () => {
    const assignedTo = selectedAssignment.assigned_to || selectedAssignment.assignedTo
    
    if (assignedTo === 'all') {
      return 'All Members'
    }
    
    const members = selectedAssignment.assigned_member_details || []
    const memberCount = members.length
    
    if (memberCount === 0) {
      return 'Specific Members'
    } else if (memberCount === 1) {
      return members[0].fullName || members[0].username
    } else {
      return (
        <span 
          onClick={handleShowMembers}
          style={{ 
            color: 'var(--primary-color)', 
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          {memberCount} Members (Click to view)
        </span>
      )
    }
  }

  const getStatusDisplayName = (status) => {
    switch (status) {
      case 'uploaded':
      case 'submitted':
        return 'Pending Team Leader'
      case 'team_leader_approved':
        return 'Pending Admin'
      case 'final_approved':
        return 'Approved'
      case 'rejected_by_team_leader':
        return 'Rejected by Team Leader'
      case 'rejected_by_admin':
        return 'Rejected by Admin'
      default:
        return 'Pending Review'
    }
  }

  const mapFileStatus = (status) => {
    switch (status) {
      case 'uploaded':
      case 'submitted':
      case 'team_leader_approved':
        return 'pending'
      case 'final_approved':
        return 'approved'
      case 'rejected_by_team_leader':
      case 'rejected_by_admin':
        return 'rejected'
      default:
        return 'pending'
    }
  }

  // Only show submission modal if one is selected
  if (selectedSubmission) {
    return (
      <div className="modal-overlay" onClick={handleCloseSubmissionModal}>
        <div className="modal file-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>File Details</h3>
            <button onClick={handleCloseSubmissionModal} className="modal-close">×</button>
          </div>
          
          <div className="modal-body">
            {/* File Details Section */}
            <div className="file-details-section">
              <h4 className="section-title">File Details</h4>
              <div className="file-details-grid">
                <div className="detail-item">
                  <span className="detail-label">FILE NAME:</span>
                  <span className="detail-value">{selectedSubmission.original_name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">FILE TYPE:</span>
                  <span className="detail-value">{selectedSubmission.file_type}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">FILE SIZE:</span>
                  <span className="detail-value">{formatFileSize(selectedSubmission.file_size)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">SUBMITTED BY:</span>
                  <span className="detail-value">{selectedSubmission.fullName || selectedSubmission.username}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">TEAM:</span>
                  <span className="detail-value team-badge-inline">
                    {selectedAssignment.team || 'IT Dept'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">UPLOAD DATE:</span>
                  <span className="detail-value">{formatDateTime(selectedSubmission.submitted_at)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">STATUS:</span>
                  <span className={`detail-value status-badge status-${mapFileStatus(selectedSubmission.status)}`}>
                    {getStatusDisplayName(selectedSubmission.status)}
                  </span>
                </div>
              </div>
            </div>

            {/* Description Section */}
            {selectedSubmission.description && (
              <div className="description-section">
                <h4 className="section-title">Description</h4>
                <div className="description-box">
                  <p className="description-text">{selectedSubmission.description}</p>
                </div>
              </div>
            )}

            {/* Comments Section */}
            <div className="comments-section">
              <h4 className="section-title">Comments & History</h4>
              {isLoadingComments ? (
                <div className="loading-comments">
                  <div className="spinner-small"></div>
                  <span>Loading comments...</span>
                </div>
              ) : submissionComments && submissionComments.length > 0 ? (
                <div className="comments-list">
                  {submissionComments.map((comment, index) => {
                    const username = comment.reviewer_username || comment.username || 'Unknown User'
                    const role = comment.reviewer_role || comment.role || 'USER'
                    const timestamp = comment.reviewed_at || comment.created_at || new Date().toISOString()
                    const commentText = comment.comments || comment.comment || ''
                    const action = comment.action || ''

                    return (
                      <div key={comment.id || index} className="comment-item">
                        <div className="comment-header">
                          <span className="comment-author">{username}</span>
                          <span className="comment-role">{role}</span>
                          <span className="comment-date">
                            {new Date(timestamp).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <div className="comment-body">
                          {action && (
                            <span className={`comment-action ${action.toLowerCase()}`}>
                              {action.toUpperCase()}
                            </span>
                          )}
                          {commentText && <p className="comment-text">{commentText}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="no-comments">No comments yet</div>
              )}
            </div>

            {/* Add Comment Section */}
            <div className="add-comment-section">
              <h4 className="section-title">Add Comment</h4>
              <div className="comment-input-container">
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Add a comment for the student..."
                  className="comment-textarea"
                  rows="3"
                />
                <button
                  className="btn btn-primary comment-btn"
                  onClick={addComment}
                  disabled={isProcessing || !reviewComment.trim()}
                >
                  {isProcessing ? 'Adding...' : 'Add Comment'}
                </button>
              </div>
              <p className="help-text">Press Enter to submit or Shift+Enter for new line.</p>
            </div>

            {/* Actions Section */}
            <div className="actions-section">
              <div className="action-buttons-large">
                <button
                  type="button"
                  onClick={handleApproveSubmission}
                  className="btn btn-success-large"
                  disabled={isProcessing || selectedSubmission.status === 'final_approved' || selectedSubmission.status === 'rejected_by_team_leader' || selectedSubmission.status === 'rejected_by_admin'}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M16.875 5L7.5 14.375L3.125 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Approve
                </button>
                <button
                  type="button"
                  onClick={handleRejectSubmission}
                  className="btn btn-danger-large"
                  disabled={isProcessing || selectedSubmission.status === 'final_approved' || selectedSubmission.status === 'rejected_by_team_leader' || selectedSubmission.status === 'rejected_by_admin'}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => window.open(`http://localhost:3001${selectedSubmission.file_path}`, '_blank')}
                  className="btn btn-secondary-large"
                  disabled={isProcessing}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M15 10.8333V15.8333C15 16.2754 14.8244 16.6993 14.5118 17.0118C14.1993 17.3244 13.7754 17.5 13.3333 17.5H4.16667C3.72464 17.5 3.30072 17.3244 2.98816 17.0118C2.67559 16.6993 2.5 16.2754 2.5 15.8333V6.66667C2.5 6.22464 2.67559 5.80072 2.98816 5.48816C3.30072 5.17559 3.72464 5 4.16667 5H9.16667M12.5 2.5H17.5M17.5 2.5V7.5M17.5 2.5L8.33333 11.6667" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Open
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Main assignment modal showing list of submissions
  return (
    <>
      <div className="modal-overlay" onClick={handleClose}>
        <div className="assignment-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Assignment: {selectedAssignment.title}</h3>
            <button onClick={handleClose} className="modal-close">×</button>
          </div>

          <div className="modal-body">
            {/* Assignment Details Section */}
            <div className="file-details-section">
              <h4 className="section-title">Assignment Details</h4>
              <div className="file-details-grid">
                <div className="detail-item">
                  <span className="detail-label">TITLE:</span>
                  <span className="detail-value">{selectedAssignment.title}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">DUE DATE:</span>
                  <span className="detail-value">
                    {(selectedAssignment.due_date || selectedAssignment.dueDate) 
                      ? formatDate(selectedAssignment.due_date || selectedAssignment.dueDate) 
                      : 'No due date'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">FILE TYPE REQUIRED:</span>
                  <span className="detail-value">
                    {selectedAssignment.file_type_required || selectedAssignment.fileTypeRequired || 'Any'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">MAX FILE SIZE:</span>
                  <span className="detail-value">
                    {formatFileSize(selectedAssignment.max_file_size || selectedAssignment.maxFileSize || 10485760)}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">CREATED:</span>
                  <span className="detail-value">
                    {formatDate(selectedAssignment.created_at || selectedAssignment.createdAt)}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">ASSIGNED TO:</span>
                  <span className="detail-value">{renderAssignedTo()}</span>
                </div>
              </div>
            </div>

            {/* Description Section */}
            <div className="description-section">
              <h4 className="section-title">Description</h4>
              <div className="description-box">
                <p className="description-text">{selectedAssignment.description || 'No description provided'}</p>
              </div>
            </div>

            {/* Assignment Comments Section */}
            <div className="comments-section">
              <h4 className="section-title">Task Comments ({assignmentComments.length})</h4>
              {assignmentComments.length > 0 ? (
                <div className="comments-list" style={{ marginBottom: '20px' }}>
                  {assignmentComments.map((comment) => (
                    <div key={comment.id} style={{
                      marginBottom: '16px',
                      borderLeft: '3px solid var(--primary-color)',
                      paddingLeft: '12px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '8px'
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
                          fontSize: '14px',
                          flexShrink: 0
                        }}>
                          {getInitials(comment.username)}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>
                            {comment.username}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {formatRelativeTime(comment.created_at)}
                          </div>
                        </div>
                      </div>
                      <div style={{
                        backgroundColor: 'var(--background-primary)',
                        padding: '12px',
                        borderRadius: '8px',
                        marginBottom: '8px'
                      }}>
                        {comment.comment}
                      </div>
                      
                      {/* Replies */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div style={{ marginLeft: '40px', marginTop: '12px' }}>
                          {comment.replies.map((reply) => (
                            <div key={reply.id} style={{
                              marginBottom: '12px',
                              paddingLeft: '12px',
                              borderLeft: '2px solid var(--border-color)'
                            }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '6px'
                              }}>
                                <div style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  background: 'var(--primary-color)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'white',
                                  fontWeight: '600',
                                  fontSize: '11px',
                                  flexShrink: 0
                                }}>
                                  {getInitials(reply.username)}
                                </div>
                                <div>
                                  <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-primary)' }}>
                                    {reply.username}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                    {formatRelativeTime(reply.created_at)}
                                  </div>
                                </div>
                              </div>
                              <div style={{
                                backgroundColor: 'var(--background-primary)',
                                padding: '8px 10px',
                                borderRadius: '6px',
                                fontSize: '13px'
                              }}>
                                {reply.reply}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply Button and Input */}
                      <div style={{ marginTop: '8px', marginLeft: '40px' }}>
                        {replyingTo === comment.id ? (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <input
                              type="text"
                              placeholder="Write a reply..."
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault()
                                  postReply(comment.id)
                                }
                              }}
                              style={{
                                flex: 1,
                                padding: '8px 12px',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                fontSize: '13px'
                              }}
                              disabled={isPostingReply}
                              autoFocus
                            />
                            <button
                              onClick={() => postReply(comment.id)}
                              disabled={!replyText.trim() || isPostingReply}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: 'var(--primary-color)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: '600'
                              }}
                            >
                              {isPostingReply ? 'Posting...' : 'Send'}
                            </button>
                            <button
                              onClick={() => {
                                setReplyingTo(null)
                                setReplyText('')
                              }}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: 'var(--background-primary)',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '13px'
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setReplyingTo(comment.id)}
                            style={{
                              padding: '4px 12px',
                              backgroundColor: 'transparent',
                              color: 'var(--primary-color)',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                          >
                            Reply
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '20px',
                  color: 'var(--text-secondary)',
                  fontSize: '14px'
                }}>
                  No comments yet
                </div>
              )}

              {/* Add Comment Input */}
              <div style={{
                display: 'flex',
                gap: '8px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border-color)'
              }}>
                <input
                  type="text"
                  placeholder="Add a comment..."
                  value={newAssignmentComment}
                  onChange={(e) => setNewAssignmentComment(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      postAssignmentComment()
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                  disabled={isPostingComment}
                />
                <button
                  onClick={postAssignmentComment}
                  disabled={!newAssignmentComment.trim() || isPostingComment}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'var(--primary-color)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  {isPostingComment ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>

            {/* Submissions Table Section */}
            <div className="submissions-section">
              <h4 className="section-title">Submissions ({assignmentSubmissions.length})</h4>
              {assignmentSubmissions.length > 0 ? (
                <div className="submissions-table-container">
                  <table className="submissions-table">
                    <thead>
                      <tr>
                        <th>Filename</th>
                        <th>Submitted By</th>
                        <th>Submitted Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignmentSubmissions.map((submission) => {
                        const fileExtension = getFileExtension(submission.original_name, submission.file_type)
                        return (
                          <tr 
                            key={submission.id} 
                            className="submission-row"
                            onClick={() => setSelectedSubmission(submission)}
                          >
                            <td>
                              <div className="file-cell">
                                <div className="file-icon">
                                  <FileIcon
                                    fileType={fileExtension}
                                    isFolder={false}
                                    altText={`Icon for ${submission.original_name}`}
                                    size="medium"
                                  />
                                </div>
                                <div className="file-details">
                                  <span className="file-name">{submission.original_name}</span>
                                  <span className="file-size">{formatFileSize(submission.file_size)}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="user-cell">
                                <span className="user-name">{submission.fullName || submission.username}</span>
                              </div>
                            </td>
                            <td>
                              <div className="datetime-cell">
                                <div className="date">{new Date(submission.submitted_at).toLocaleDateString()}</div>
                                <div className="time">{new Date(submission.submitted_at).toLocaleTimeString()}</div>
                              </div>
                            </td>
                            <td>
                              <span className={`status-badge status-${mapFileStatus(submission.status)}`}>
                                {getStatusDisplayName(submission.status)}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{marginBottom: '16px', opacity: 0.3}}>
                    <path d="M24 16H13.3333C11.4924 16 10 17.4924 10 19.3333V50.6667C10 52.5076 11.4924 54 13.3333 54H50.6667C52.5076 54 54 52.5076 54 50.6667V19.3333C54 17.4924 52.5076 16 50.6667 16H40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M40 10H24V22H40V10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M32 32V42M32 42L37 37M32 42L27 37" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <h3>No submissions yet</h3>
                  <p>Submissions from assigned members will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Members Modal */}
      {showMembersModal && selectedAssignment.assigned_member_details && (
        <div className="modal-overlay" onClick={() => setShowMembersModal(false)} style={{ zIndex: 1001 }}>
          <div className="modal members-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Assigned Members ({selectedAssignment.assigned_member_details.length})</h3>
              <button onClick={() => setShowMembersModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="members-list">
                {selectedAssignment.assigned_member_details.map((member) => (
                  <div key={member.id} className="member-item">
                    <div className="member-avatar">
                      {(member.fullName || member.username).charAt(0).toUpperCase()}
                    </div>
                    <div className="member-details">
                      <div className="member-name">{member.fullName || member.username}</div>
                      {member.fullName && (
                        <div className="member-username">@{member.username}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default AssignmentDetailsModal
