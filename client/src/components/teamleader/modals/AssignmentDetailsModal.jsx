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
  if (!showAssignmentDetailsModal || !selectedAssignment) return null

  const handleClose = () => {
    setShowAssignmentDetailsModal(false)
    setSelectedAssignment(null)
    setAssignmentSubmissions([])
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
                  <div className="tl-detail-value">{(selectedAssignment.assigned_to || selectedAssignment.assignedTo) === 'all' ? 'All Members' : 'Specific Members'}</div>
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
                              <path d="M14.5 8C14.5 11.5899 11.5899 14.5 8 14.5C4.41015 14.5 1.5 11.5899 1.5 8C1.5 4.41015 4.41015 1.5 8 1.5C11.5899 1.5 14.5 4.41015 14.5 8Z" stroke="currentColor" strokeWidth="1.5"/>
                              <path d="M6.5 4.5L11.5 8L6.5 11.5V4.5Z" fill="currentColor"/>
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
    </div>
  )
}

export default AssignmentDetailsModal
