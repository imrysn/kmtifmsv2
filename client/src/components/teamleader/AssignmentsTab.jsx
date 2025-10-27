import assignmentIcon from '../../assets/Icon-3.svg'

const AssignmentsTab = ({
  isLoadingAssignments,
  assignments,
  formatDate,
  fetchAssignmentDetails,
  deleteAssignment,
  setShowCreateAssignmentModal
}) => {
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
                    <span className="tl-badge">{(assignment.assigned_to || assignment.assignedTo) === 'all' ? 'All Members' : `${(assignment.assigned_members || assignment.assignedMembers)?.length || 0} Members`}</span>
                  </td>
                  <td>
                    <span style={{backgroundColor: '#dbeafe', color: '#1e40af', padding: '4px 12px', borderRadius: '12px', fontWeight: '600'}}>
                      {assignment.submission_count || assignment.submissionCount || 0}
                    </span>
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
    </div>
  )
}

export default AssignmentsTab
