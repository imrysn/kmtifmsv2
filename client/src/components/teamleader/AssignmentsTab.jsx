import assignmentIcon from '../../assets/Icon-3.svg'
import { useState } from 'react'

const AssignmentsTab = ({
  isLoadingAssignments,
  assignments,
  formatDate,
  fetchAssignmentDetails,
  deleteAssignment,
  setShowCreateAssignmentModal
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
    } else {
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
      <div className="tl-page-header">
        <div className="tl-page-icon">
          <img src={assignmentIcon} alt="" width="20" height="20" />
        </div>
        <h1>Tasks</h1>
        <button className="tl-btn success" onClick={() => setShowCreateAssignmentModal(true)} style={{marginLeft: 'auto'}}>
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
        <div className="tl-table-container">
          <div className="tl-table-header">
            <div className="tl-table-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 5H7C6.46957 5 5.96086 5.21071 5.58579 5.58579C5.21071 5.96086 5 6.46957 5 7V19C5 19.5304 5.21071 20.0391 5.58579 20.4142C5.96086 20.7893 6.46957 21 7 21H17C17.5304 21 18.0391 20.7893 18.4142 20.4142C18.7893 20.0391 19 19.5304 19 19V7C19 6.46957 18.7893 5.96086 18.4142 5.58579C18.0391 5.21071 17.5304 5 17 5H15M9 5C9 5.53043 9.21071 6.03914 9.58579 6.41421C9.96086 6.78929 10.4696 7 11 7H13C13.5304 7 14.0391 6.78929 14.4142 6.41421C14.7893 6.03914 15 5.53043 15 5M9 5C9 4.46957 9.21071 3.96086 9.58579 3.58579C9.96086 3.21071 10.4696 3 11 3H13C13.5304 3 14.0391 3.21071 14.4142 3.58579C14.7893 3.96086 15 4.46957 15 5M12 12H15M12 16H15M9 12H9.01M9 16H9.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2>All Assignments ({assignments.length})</h2>
          </div>

          <table className="tl-table">
            <thead>
              <tr>
                <th>TITLE</th>
                <th>DESCRIPTION</th>
                <th>DUE DATE</th>
                <th>FILE TYPE</th>
                <th>ASSIGNED TO</th>
                <th>SUBMISSIONS</th>
                <th>CREATED</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <tr key={assignment.id} onClick={() => fetchAssignmentDetails(assignment.id)} style={{cursor: 'pointer'}}>
                  <td><strong>{assignment.title}</strong></td>
                  <td>{assignment.description ? (assignment.description.length > 50 ? assignment.description.substring(0, 50) + '...' : assignment.description) : 'No description'}</td>
                  <td>
                    {(assignment.due_date || assignment.dueDate) ? (
                      <span className={`tl-due-date ${new Date(assignment.due_date || assignment.dueDate) < new Date() ? 'overdue' : ''}`}>
                        {formatDate(assignment.due_date || assignment.dueDate)}
                      </span>
                    ) : 'No due date'}
                  </td>
                  <td>{assignment.file_type_required || assignment.fileTypeRequired || 'Any'}</td>
                  <td>
                    {renderAssignedTo(assignment)}
                  </td>
                  <td>
                    {assignment.submission_count || assignment.submissionCount || 0}
                  </td>
                  <td className="date">{formatDate(assignment.created_at || assignment.createdAt)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button 
                      className="tl-btn danger" 
                      onClick={() => deleteAssignment(assignment.id, assignment.title)}
                      style={{padding: '4px 8px', fontSize: '12px'}}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tl-empty">
          <div className="tl-empty-icon">📋</div>
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

export default AssignmentsTab
