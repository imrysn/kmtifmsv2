import { useState } from 'react'
import './css/AssignmentsTab.css'

const AssignmentsTab = ({
  isLoadingAssignments,
  assignments,
  formatDate,
  fetchAssignmentDetails,
  deleteAssignment,
  setShowCreateAssignmentModal,
  openReviewModal
}) => {
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState([])

  const handleShowMembers = (members, e) => {
    e.stopPropagation()
    setSelectedMembers(members)
    setShowMembersModal(true)
  }

  const renderAssignedTo = (assignment) => {
    const assignedTo = assignment.assigned_to || assignment.assignedTo
    
    if (assignedTo === 'all') {
      return <span className="tl-badge">All Members</span>
    }
    
    const members = assignment.assigned_member_details || []
    const memberCount = members.length
    
    if (memberCount === 0) {
      return <span className="tl-badge">0 Members</span>
    } else if (memberCount === 1) {
      return <span className="tl-badge">{members[0].fullName || members[0].username}</span>
    } else if (memberCount <= 3) {
      // Show names inline for 2-3 members
      const names = members.map(m => m.fullName || m.username).join(', ')
      return <span className="tl-badge">{names}</span>
    } else {
      // Show count and make it clickable for 4+ members
      return (
        <span 
          className="tl-badge clickable" 
          onClick={(e) => handleShowMembers(members, e)}
          style={{ cursor: 'pointer' }}
        >
          {memberCount} Members
        </span>
      )
    }
  }

  return (
    <div className="tl-content">
      {/* Page Header - EXACT Admin Match */}
      <div className="tl-page-header" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <div>
          <h1>Assignments ({assignments.length})</h1>
          <p>Manage team assignments and submissions</p>
        </div>
        <button className="tl-btn success" onClick={() => setShowCreateAssignmentModal(true)}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Create Assignment
        </button>
      </div>

      {isLoadingAssignments ? (
        <div className="tl-loading">
          <div className="tl-spinner"></div>
          <p>Loading assignments...</p>
        </div>
      ) : assignments.length > 0 ? (
        <div className="tl-assignments-container">
          <div className="tl-assignments-grid">
            {assignments.map((assignment) => {
              const getInitials = (name) => {
                if (!name) return 'TL';
                if (name.includes('.')) {
                  const parts = name.split('.');
                  if (parts.length >= 2) {
                    return (parts[0][0] + parts[1][0]).toUpperCase();
                  }
                }
                const parts = name.split(' ');
                if (parts.length >= 2) {
                  return (parts[0][0] + parts[1][0]).toUpperCase();
                }
                return name.substring(0, 2).toUpperCase();
              };

              const formatDateTime = (dateString) => {
                const date = new Date(dateString);
                return date.toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                }) + ' at ' + date.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                });
              };

              const isOverdue = new Date(assignment.due_date || assignment.dueDate) < new Date();

              return (
                <div 
                  key={assignment.id} 
                  className="tl-assignment-card"
                  onClick={() => fetchAssignmentDetails(assignment.id)}
                >
                  {/* Post Header */}
                  <div className="tl-post-header">
                    <div className="tl-post-author">
                      <div className="tl-author-avatar">
                        {getInitials(assignment.team_leader_username || 'Team Leader')}
                      </div>
                      <div className="tl-author-info">
                        <div className="tl-author-name">{assignment.team_leader_username || 'Team Leader'}</div>
                        <div className="tl-post-timestamp">{formatDateTime(assignment.created_at || assignment.createdAt)}</div>
                      </div>
                    </div>
                    <span className="tl-badge" style={{
                      background: 'var(--status-approved)', 
                      color: 'var(--status-approved-text)',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}>
                      {assignment.submission_count || assignment.submissionCount || 0} Submissions
                    </span>
                  </div>

                  {/* Post Content */}
                  <div className="tl-post-content">
                    <h3 className="tl-post-title">{assignment.title}</h3>
                    {assignment.description ? (
                      <p className="tl-post-description">{assignment.description}</p>
                    ) : (
                      <p className="tl-post-description" style={{color: 'var(--text-tertiary)', fontStyle: 'italic'}}>
                        No description
                      </p>
                    )}

                    <div className="tl-post-details">
                      {/* Left Side - Assignment Info */}
                      <div className="tl-assignment-info">
                        <div className="tl-detail-item">
                          <svg className="tl-detail-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                          </svg>
                          <span className="tl-detail-text">
                            Due: {(assignment.due_date || assignment.dueDate) ? (
                              <>
                                {formatDate(assignment.due_date || assignment.dueDate)}
                                {isOverdue && <span style={{color: 'var(--status-rejected)', fontWeight: '600'}}> (Overdue)</span>}
                              </>
                            ) : (
                              'No due date'
                            )}
                          </span>
                        </div>
                        <div className="tl-detail-item">
                          <svg className="tl-detail-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                          </svg>
                          <span className="tl-detail-text">
                            File Type: <span className="tl-badge" style={{background: '#E0E7FF', color: 'var(--primary-color)', marginLeft: '4px'}}>
                              {assignment.file_type_required || assignment.fileTypeRequired || 'Any'}
                            </span>
                          </span>
                        </div>
                        <div className="tl-detail-item">
                          <svg className="tl-detail-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                          </svg>
                          <span className="tl-detail-text">
                            Assigned To: {renderAssignedTo(assignment)}
                          </span>
                        </div>
                      </div>

                      {/* Right Side - Submitted Files */}
                      <div className="tl-submitted-files">
                        <div className="tl-files-header">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                          </svg>
                          <span>Submitted Files</span>
                        </div>
                        {assignment.recent_submissions && assignment.recent_submissions.length > 0 ? (
                          <>
                            {assignment.recent_submissions.slice(0, 2).map((submission) => (
                              <div 
                                key={submission.id}
                                className="tl-submission-item"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (openReviewModal && submission.id) {
                                    // Open file detail modal for review
                                    openReviewModal(submission, null);
                                  }
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color: 'var(--primary-color)', flexShrink: '0'}}>
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                  <polyline points="14 2 14 8 20 8"></polyline>
                                </svg>
                                <div className="tl-submission-info">
                                  <div className="tl-submission-name">
                                    {submission.original_name || submission.file_name}
                                  </div>
                                  <div className="tl-submission-meta">
                                    by {submission.username || 'Unknown'}
                                  </div>
                                </div>
                                <span className="tl-submission-status" style={{
                                  background: submission.status === 'approved' ? 'var(--status-approved)' : 
                                             submission.status === 'rejected' ? 'var(--status-rejected)' :
                                             submission.status === 'pending_tl' ? '#FEF3C7' : '#E0E7FF',
                                  color: submission.status === 'approved' ? 'var(--status-approved-text)' : 
                                         submission.status === 'rejected' ? 'var(--status-rejected-text)' :
                                         submission.status === 'pending_tl' ? '#92400E' : 'var(--primary-color)'
                                }}>
                                  {submission.status === 'pending_tl' ? 'PENDING' :
                                   submission.status === 'approved' ? '✓' :
                                   submission.status === 'rejected' ? '✗' : 'NEW'}
                                </span>
                              </div>
                            ))}
                            {(assignment.submission_count || 0) > 2 && (
                              <div className="tl-more-submissions">
                                +{(assignment.submission_count || 0) - 2} more
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="tl-no-submissions">
                            No submissions yet
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Post Footer */}
                  <div className="tl-post-footer" onClick={(e) => e.stopPropagation()}>
                    <button 
                      className="tl-btn danger tl-delete-btn" 
                      onClick={() => deleteAssignment(assignment.id, assignment.title)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="tl-empty">
          <h3>No assignments yet</h3>
          <p>Create an assignment to get started.</p>
          <button className="tl-btn success" onClick={() => setShowCreateAssignmentModal(true)} style={{marginTop: '20px'}}>
            Create Your First Assignment
          </button>
        </div>
      )}

      {/* Members Modal */}
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
    </div>
  )
}

export default AssignmentsTab
