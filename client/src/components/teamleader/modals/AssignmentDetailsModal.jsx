import { useState } from 'react'

const AssignmentDetailsModal = ({
  showAssignmentDetailsModal,
  setShowAssignmentDetailsModal,
  selectedAssignment,
  setSelectedAssignment,
  assignmentSubmissions,
  setAssignmentSubmissions,
  formatDate,
  formatDateTime,
  formatFileSize
}) => {
  const [showMembersModal, setShowMembersModal] = useState(false)

  if (!showAssignmentDetailsModal || !selectedAssignment) return null

  const handleClose = () => {
    setShowAssignmentDetailsModal(false)
    setSelectedAssignment(null)
    setAssignmentSubmissions([])
  }

  const handleShowMembers = (e) => {
    e.stopPropagation()
    setShowMembersModal(true)
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
            color: '#4f39f6', 
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          {memberCount} Members (Click to view)
        </span>
      )
    }
  }

  return (
    <div className="tl-modal-overlay" onClick={handleClose}>
      <div className="tl-modal-large" onClick={e => e.stopPropagation()}>
        <div className="tl-modal-header">
          <h3>Assignment: {selectedAssignment.title}</h3>
          <button onClick={handleClose}>×</button>
        </div>

        <div className="tl-modal-body-large">
          {/* Assignment Details Section */}
          <div className="tl-modal-section">
            <h4 className="tl-section-title">Assignment Details</h4>
            <div className="tl-assignment-details-container">
              {/* Left Column - Basic Details */}
              <div className="tl-assignment-details-left">
                <div className="tl-detail-card">
                  <div className="tl-detail-label">TITLE</div>
                  <div className="tl-detail-value">{selectedAssignment.title}</div>
                </div>
                
                <div className="tl-detail-card">
                  <div className="tl-detail-label">DUE DATE</div>
                  <div className="tl-detail-value">
                    {(selectedAssignment.due_date || selectedAssignment.dueDate) ? formatDate(selectedAssignment.due_date || selectedAssignment.dueDate) : 'No due date'}
                  </div>
                </div>
                
                <div className="tl-detail-card">
                  <div className="tl-detail-label">FILE TYPE REQUIRED</div>
                  <div className="tl-detail-value">{selectedAssignment.file_type_required || selectedAssignment.fileTypeRequired || 'Any'}</div>
                </div>
                
                <div className="tl-detail-card">
                  <div className="tl-detail-label">MAX FILE SIZE</div>
                  <div className="tl-detail-value">
                    {formatFileSize(selectedAssignment.max_file_size || selectedAssignment.maxFileSize || 10485760)}
                  </div>
                </div>
                
                <div className="tl-detail-card">
                  <div className="tl-detail-label">CREATED</div>
                  <div className="tl-detail-value">{formatDate(selectedAssignment.created_at || selectedAssignment.createdAt)}</div>
                </div>
                
                <div className="tl-detail-card">
                  <div className="tl-detail-label">ASSIGNED TO</div>
                  <div className="tl-detail-value">{renderAssignedTo()}</div>
                </div>
              </div>

              {/* Right Column - Description */}
              <div className="tl-assignment-details-right">
                <div className="tl-detail-card tl-detail-card-full">
                  <div className="tl-detail-label">DESCRIPTION</div>
                  <p className="tl-description-text">{selectedAssignment.description || 'No description provided'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Submissions Section */}
          <div className="tl-modal-section">
            <h4 className="tl-section-title">Submissions ({assignmentSubmissions.length})</h4>

            {assignmentSubmissions.length > 0 ? (
              <div className="tl-submissions-list">
                <table className="tl-submissions-table">
                  <thead>
                    <tr>
                      <th>SUBMITTED BY</th>
                      <th>FILE NAME</th>
                      <th>FILE TYPE</th>
                      <th>SIZE</th>
                      <th>SUBMITTED</th>
                      <th>STATUS</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignmentSubmissions.map((submission) => (
                      <tr key={submission.id}>
                        <td>
                          <strong>{submission.fullName || submission.username}</strong>
                        </td>
                        <td>
                          <div className="tl-file-name-cell">
                            <strong>{submission.original_name}</strong>
                          </div>
                        </td>
                        <td>
                          <div className="tl-file-type-badge">
                            {submission.file_type?.split(' ')[0]?.slice(0, 3).toUpperCase() || 'FILE'}
                          </div>
                        </td>
                        <td>{formatFileSize(submission.file_size)}</td>
                        <td>{formatDateTime(submission.submitted_at)}</td>
                        <td>
                          <span className="tl-status-badge pending-approved">
                            {submission.status?.toUpperCase() || 'SUBMITTED'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="tl-btn-view-file"
                            onClick={() => window.open(`http://localhost:3001${submission.file_path}`, '_blank')}
                            title="Open file"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M12 8.66667V12.6667C12 13.0203 11.8595 13.3594 11.6095 13.6095C11.3594 13.8595 11.0203 14 10.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V5.33333C2 4.97971 2.14048 4.64057 2.39052 4.39052C2.64057 4.14048 2.97971 4 3.33333 4H7.33333M10 2H14M14 2V6M14 2L6.66667 9.33333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="tl-no-submissions">
                <div className="tl-empty-icon">📄</div>
                <p>No submissions yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Members Modal */}
      {showMembersModal && selectedAssignment.assigned_member_details && (
        <div className="tl-modal-overlay" onClick={() => setShowMembersModal(false)} style={{ zIndex: 1001 }}>
          <div className="tl-modal" onClick={e => e.stopPropagation()}>
            <div className="tl-modal-header">
              <h3>Assigned Members ({selectedAssignment.assigned_member_details.length})</h3>
              <button onClick={() => setShowMembersModal(false)}>×</button>
            </div>
            <div className="tl-modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedAssignment.assigned_member_details.map((member) => (
                  <div key={member.id} style={{
                    padding: '12px',
                    background: '#F9FAFB',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#4f39f6',
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
                      <div style={{ fontWeight: '500', color: '#101828' }}>
                        {member.fullName || member.username}
                      </div>
                      {member.fullName && (
                        <div style={{ fontSize: '12px', color: '#6a7282' }}>
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

export default AssignmentDetailsModal
