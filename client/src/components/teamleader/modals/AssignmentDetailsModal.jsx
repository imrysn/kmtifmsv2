import { useState } from 'react'

// File icon component based on file type
const FileIcon = ({ fileName, fileType }) => {
  const getFileIcon = () => {
    const ext = fileName?.split('.').pop()?.toLowerCase() || ''
    const type = fileType?.toLowerCase() || ''
    
    // Document files
    if (ext === 'pdf' || type.includes('pdf')) {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 2V8H20" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M10 13H14" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M10 17H14" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    }
    
    // Word documents
    if (ext === 'doc' || ext === 'docx' || type.includes('word')) {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 2V8H20" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 13H8" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 17H8" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M10 9H8" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    }
    
    // Excel files
    if (ext === 'xls' || ext === 'xlsx' || type.includes('excel') || type.includes('spreadsheet')) {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 2V8H20" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8 13H16" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8 17H16" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 13V17" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    }
    
    // PowerPoint files
    if (ext === 'ppt' || ext === 'pptx' || type.includes('powerpoint') || type.includes('presentation')) {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 2V8H20" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="8" y="11" width="8" height="6" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    }
    
    // Image files
    if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'svg' || type.includes('image')) {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="#8B5CF6" strokeWidth="2"/>
          <circle cx="8.5" cy="8.5" r="1.5" fill="#8B5CF6"/>
          <path d="M21 15L16 10L5 21" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    }
    
    // Video files
    if (ext === 'mp4' || ext === 'avi' || ext === 'mov' || ext === 'wmv' || type.includes('video')) {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M22.54 6.42L18 9.42V14.58L22.54 17.58C22.78 17.72 23.04 17.62 23.18 17.38C23.22 17.3 23.24 17.22 23.24 17.14V6.86C23.24 6.58 23.02 6.36 22.74 6.36C22.66 6.36 22.58 6.38 22.5 6.42H22.54Z" stroke="#EC4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 7H3C1.89543 7 1 7.89543 1 9V15C1 16.1046 1.89543 17 3 17H16C17.1046 17 18 16.1046 18 15V9C18 7.89543 17.1046 7 16 7Z" stroke="#EC4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    }
    
    // Archive files
    if (ext === 'zip' || ext === 'rar' || ext === '7z' || type.includes('zip') || type.includes('archive')) {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 2V8H20" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 11V17M10 13H14" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    }
    
    // Default file icon
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M14 2V8H20" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  
  return <div style={{ display: 'flex', alignItems: 'center' }}>{getFileIcon()}</div>
}

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
                    </tr>
                  </thead>
                  <tbody>
                    {assignmentSubmissions.map((submission) => (
                      <tr key={submission.id}>
                        <td>
                          <strong>{submission.fullName || submission.username}</strong>
                        </td>
                        <td>
                          <div className="tl-file-name-cell" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(`http://localhost:3001${submission.file_path}`, '_blank')
                            }}
                            title="Click to open file"
                          >
                            <FileIcon fileName={submission.original_name} fileType={submission.file_type} />
                            <strong style={{ textDecoration: 'underline', color: '#4f39f6' }}>{submission.original_name}</strong>
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
