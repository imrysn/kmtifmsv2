# Adding Assignments Tab to Team Leader Dashboard

## Step 1: Run Database Setup
```bash
cd C:\Users\hamster\Documents\kmtifmsv2
node database/setup-assignment-system.js
```

## Step 2: Add Assignment Icon

Create/use an assignment icon SVG file at:
`client/src/assets/Icon-Assignments.svg`

Or use the clipboard/checklist icon from your existing icons.

## Step 3: Import Icon in TeamLeaderDashboard-Enhanced.jsx

Add this import at the top:
```javascript
import assignmentsIcon from '../assets/Icon-2.svg' // Or your assignments icon
```

## Step 4: Add Assignments Navigation Button

In the sidebar navigation section, add after Team Management button:

```jsx
<button 
  className={`tl-nav-item ${activeTab === 'assignments' ? 'active' : ''}`}
  onClick={() => { setActiveTab('assignments'); clearMessages(); setSidebarOpen(false); }}
>
  <img src={assignmentsIcon} alt="" className="tl-nav-icon" width="20" height="20" />
  <span>Assignments</span>
</button>
```

## Step 5: Add State Variables

Add these state variables after the existing state declarations:

```javascript
// Assignment states
const [assignments, setAssignments] = useState([])
const [isLoadingAssignments, setIsLoadingAssignments] = useState(false)
const [showCreateAssignmentModal, setShowCreateAssignmentModal] = useState(false)
const [showAssignmentDetailsModal, setShowAssignmentDetailsModal] = useState(false)
const [selectedAssignment, setSelectedAssignment] = useState(null)
const [assignmentSubmissions, setAssignmentSubmissions] = useState([])

// Assignment form
const [assignmentForm, setAssignmentForm] = useState({
  title: '',
  description: '',
  dueDate: '',
  fileTypeRequired: '',
  assignedTo: 'all',
  maxFileSize: 10485760,
  assignedMembers: []
})
```

## Step 6: Add Fetch Functions

```javascript
// Fetch assignments
const fetchAssignments = async () => {
  setIsLoadingAssignments(true)
  try {
    const response = await fetch(`http://localhost:3001/api/assignments/team-leader/${user.id}`)
    const data = await response.json()
    if (data.success) {
      setAssignments(data.assignments || [])
    }
  } catch (error) {
    console.error('Error fetching assignments:', error)
    setError('Failed to load assignments')
  } finally {
    setIsLoadingAssignments(false)
  }
}

// Fetch assignment details
const fetchAssignmentDetails = async (assignmentId) => {
  setIsLoading(true)
  try {
    const response = await fetch(`http://localhost:3001/api/assignments/${assignmentId}/details`)
    const data = await response.json()
    if (data.success) {
      setSelectedAssignment(data.assignment)
      setAssignmentSubmissions(data.submissions || [])
      setShowAssignmentDetailsModal(true)
    }
  } catch (error) {
    console.error('Error fetching assignment details:', error)
    setError('Failed to load assignment details')
  } finally {
    setIsLoading(false)
  }
}

// Create assignment
const createAssignment = async () => {
  if (!assignmentForm.title.trim()) {
    setError('Please enter assignment title')
    return
  }

  setIsProcessing(true)
  try {
    const response = await fetch('http://localhost:3001/api/assignments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...assignmentForm,
        teamLeaderId: user.id,
        teamLeaderUsername: user.username,
        team: user.team
      })
    })

    const data = await response.json()
    if (data.success) {
      setSuccess(`Assignment created! ${data.membersAssigned} members assigned.`)
      setShowCreateAssignmentModal(false)
      setAssignmentForm({
        title: '',
        description: '',
        dueDate: '',
        fileTypeRequired: '',
        assignedTo: 'all',
        maxFileSize: 10485760,
        assignedMembers: []
      })
      fetchAssignments()
    } else {
      setError(data.message || 'Failed to create assignment')
    }
  } catch (error) {
    console.error('Error creating assignment:', error)
    setError('Failed to create assignment')
  } finally {
    setIsProcessing(false)
  }
}

// Delete assignment
const deleteAssignment = async (assignmentId, title) => {
  if (!confirm(`Are you sure you want to delete "${title}"?`)) return

  try {
    const response = await fetch(`http://localhost:3001/api/assignments/${assignmentId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamLeaderUsername: user.username,
        team: user.team
      })
    })

    const data = await response.json()
    if (data.success) {
      setSuccess('Assignment deleted successfully')
      fetchAssignments()
    } else {
      setError('Failed to delete assignment')
    }
  } catch (error) {
    console.error('Error deleting assignment:', error)
    setError('Failed to delete assignment')
  }
}
```

## Step 7: Update useEffect

Add to your existing useEffect that fetches data:

```javascript
useEffect(() => {
  fetchPendingFiles()
  fetchTeamMembers()
  fetchNotifications()
  if (activeTab === 'analytics') {
    fetchAnalytics()
  }
  if (activeTab === 'assignments') {
    fetchAssignments()
  }
}, [user.team, activeTab])
```

## Step 8: Add Assignments Tab Content

Add this section after the Analytics tab section (before the modals):

```jsx
{/* Assignments Tab */}
{activeTab === 'assignments' && (
  <div className="tl-content">
    <div className="tl-page-header">
      <div className="tl-page-icon">
        <img src={assignmentsIcon} alt="" width="20" height="20" />
      </div>
      <h1>Assignments</h1>
      <button 
        className="tl-btn success" 
        onClick={() => setShowCreateAssignmentModal(true)}
        style={{marginLeft: 'auto'}}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        Create Assignment
      </button>
    </div>

    {error && <div className="tl-alert error">{error}<button onClick={clearMessages}>×</button></div>}
    {success && <div className="tl-alert success">{success}<button onClick={clearMessages}>×</button></div>}

    {isLoadingAssignments ? (
      <div className="tl-loading">
        <div className="tl-spinner"></div>
        <p>Loading assignments...</p>
      </div>
    ) : assignments.length > 0 ? (
      <div className="tl-assignments-grid">
        {assignments.map((assignment) => (
          <div key={assignment.id} className="tl-assignment-card">
            <div className="tl-assignment-header">
              <h3>{assignment.title}</h3>
              <div className="tl-assignment-actions">
                <button 
                  className="tl-btn-mini secondary" 
                  onClick={() => fetchAssignmentDetails(assignment.id)}
                  title="View details"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 3.33334C4.66667 3.33334 1.82 5.07334 0.666672 8.00001C1.82 10.9267 4.66667 12.6667 8 12.6667C11.3333 12.6667 14.18 10.9267 15.3333 8.00001C14.18 5.07334 11.3333 3.33334 8 3.33334ZM8 11C6.16 11 4.66667 9.50667 4.66667 7.66667C4.66667 5.82667 6.16 4.33334 8 4.33334C9.84 4.33334 11.3333 5.82667 11.3333 7.66667C11.3333 9.50667 9.84 11 8 11ZM8 5.66667C6.89333 5.66667 6 6.56 6 7.66667C6 8.77334 6.89333 9.66667 8 9.66667C9.10667 9.66667 10 8.77334 10 7.66667C10 6.56 9.10667 5.66667 8 5.66667Z" fill="currentColor"/>
                  </svg>
                </button>
                <button 
                  className="tl-btn-mini danger" 
                  onClick={() => deleteAssignment(assignment.id, assignment.title)}
                  title="Delete"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4H14M12.6667 4V13.3333C12.6667 14 12 14.6667 11.3333 14.6667H4.66667C4 14.6667 3.33333 14 3.33333 13.3333V4M5.33333 4V2.66667C5.33333 2 6 1.33333 6.66667 1.33333H9.33333C10 1.33333 10.6667 2 10.6667 2.66667V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <p className="tl-assignment-description">
              {assignment.description || 'No description'}
            </p>
            
            <div className="tl-assignment-meta">
              {assignment.due_date && (
                <div className="tl-assignment-due">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 5.33V8L10 10M14 8C14 11.31 11.31 14 8 14C4.69 14 2 11.31 2 8C2 4.69 4.69 2 8 2C11.31 2 14 4.69 14 8Z" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  Due: {new Date(assignment.due_date).toLocaleDateString()}
                </div>
              )}
              {assignment.file_type_required && (
                <div className="tl-assignment-type">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M9 2H4C3.46957 2 2.96086 2.21071 2.58579 2.58579C2.21071 2.96086 2 3.46957 2 4V12C2 12.5304 2.21071 13.0391 2.58579 13.4142C2.96086 13.7893 3.46957 14 4 14H12C12.5304 14 13.0391 13.7893 13.4142 13.4142C13.7893 13.0391 14 12.5304 14 12V7L9 2Z" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  {assignment.file_type_required}
                </div>
              )}
            </div>
            
            <div className="tl-assignment-stats">
              <div className="tl-stat-item">
                <span className="tl-stat-label">Assigned:</span>
                <span className="tl-stat-value">{assignment.total_members || 0}</span>
              </div>
              <div className="tl-stat-item success">
                <span className="tl-stat-label">Submitted:</span>
                <span className="tl-stat-value">{assignment.submitted_count || 0}</span>
              </div>
              <div className="tl-stat-item warning">
                <span className="tl-stat-label">Pending:</span>
                <span className="tl-stat-value">{assignment.pending_count || 0}</span>
              </div>
            </div>
            
            <button 
              className="tl-btn secondary" 
              onClick={() => fetchAssignmentDetails(assignment.id)}
              style={{width: '100%', marginTop: '12px'}}
            >
              View Submissions
            </button>
          </div>
        ))}
      </div>
    ) : (
      <div className="tl-empty">
        <div className="tl-empty-icon">📝</div>
        <h3>No assignments yet</h3>
        <p>Create your first assignment to get started!</p>
        <button 
          className="tl-btn success" 
          onClick={() => setShowCreateAssignmentModal(true)}
          style={{marginTop: '16px'}}
        >
          Create Assignment
        </button>
      </div>
    )}
  </div>
)}
```

## Step 9: Add Create Assignment Modal

Add before the closing `</div>` of the component (after other modals):

```jsx
{/* Create Assignment Modal */}
{showCreateAssignmentModal && (
  <div className="tl-modal-overlay" onClick={() => setShowCreateAssignmentModal(false)}>
    <div className="tl-modal" onClick={e => e.stopPropagation()}>
      <div className="tl-modal-header">
        <h3>Create Assignment</h3>
        <button onClick={() => setShowCreateAssignmentModal(false)}>×</button>
      </div>
      <div className="tl-modal-body">
        <div className="tl-form-group">
          <label>Title *</label>
          <input
            type="text"
            value={assignmentForm.title}
            onChange={(e) => setAssignmentForm({...assignmentForm, title: e.target.value})}
            placeholder="Assignment title"
            required
          />
        </div>
        <div className="tl-form-group">
          <label>Description</label>
          <textarea
            value={assignmentForm.description}
            onChange={(e) => setAssignmentForm({...assignmentForm, description: e.target.value})}
            placeholder="Assignment instructions..."
            rows="4"
          />
        </div>
        <div className="tl-form-group">
          <label>Due Date</label>
          <input
            type="datetime-local"
            value={assignmentForm.dueDate}
            onChange={(e) => setAssignmentForm({...assignmentForm, dueDate: e.target.value})}
          />
        </div>
        <div className="tl-form-group">
          <label>Required File Type</label>
          <input
            type="text"
            value={assignmentForm.fileTypeRequired}
            onChange={(e) => setAssignmentForm({...assignmentForm, fileTypeRequired: e.target.value})}
            placeholder="e.g., PDF Document"
          />
        </div>
        <div className="tl-form-group">
          <label>Max File Size (MB)</label>
          <input
            type="number"
            value={assignmentForm.maxFileSize / 1048576}
            onChange={(e) => setAssignmentForm({...assignmentForm, maxFileSize: parseInt(e.target.value) * 1048576})}
            min="1"
            max="100"
          />
        </div>
        <div className="tl-form-group">
          <label>Assign To</label>
          <select
            value={assignmentForm.assignedTo}
            onChange={(e) => setAssignmentForm({...assignmentForm, assignedTo: e.target.value})}
          >
            <option value="all">All Team Members</option>
            <option value="specific">Specific Members</option>
          </select>
        </div>
        {assignmentForm.assignedTo === 'specific' && (
          <div className="tl-form-group">
            <label>Select Members</label>
            <select
              multiple
              value={assignmentForm.assignedMembers}
              onChange={(e) => setAssignmentForm({
                ...assignmentForm,
                assignedMembers: Array.from(e.target.selectedOptions, option => parseInt(option.value))
              })}
              style={{height: '120px'}}
            >
              {teamMembers.map(member => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
            <small>Hold Ctrl/Cmd to select multiple</small>
          </div>
        )}
      </div>
      <div className="tl-modal-footer">
        <button className="tl-btn secondary" onClick={() => setShowCreateAssignmentModal(false)}>Cancel</button>
        <button className="tl-btn success" onClick={createAssignment} disabled={isProcessing}>
          {isProcessing ? 'Creating...' : 'Create Assignment'}
        </button>
      </div>
    </div>
  </div>
)}

{/* Assignment Details Modal */}
{showAssignmentDetailsModal && selectedAssignment && (
  <div className="tl-modal-overlay" onClick={() => { setShowAssignmentDetailsModal(false); setSelectedAssignment(null); setAssignmentSubmissions([]); }}>
    <div className="tl-modal-large" onClick={e => e.stopPropagation()}>
      <div className="tl-modal-header">
        <h3>{selectedAssignment.title}</h3>
        <button onClick={() => { setShowAssignmentDetailsModal(false); setSelectedAssignment(null); setAssignmentSubmissions([]); }}>×</button>
      </div>
      <div className="tl-modal-body-large">
        <div className="tl-modal-section">
          <h4 className="tl-section-title">Assignment Details</h4>
          <p>{selectedAssignment.description || 'No description'}</p>
          {selectedAssignment.due_date && (
            <p><strong>Due:</strong> {new Date(selectedAssignment.due_date).toLocaleString()}</p>
          )}
          {selectedAssignment.file_type_required && (
            <p><strong>Required:</strong> {selectedAssignment.file_type_required}</p>
          )}
        </div>

        <div className="tl-modal-section">
          <h4 className="tl-section-title">Submissions</h4>
          {assignmentSubmissions.length > 0 ? (
            <table className="tl-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Submitted At</th>
                  <th>File</th>
                </tr>
              </thead>
              <tbody>
                {assignmentSubmissions.map(submission => (
                  <tr key={submission.id}>
                    <td>{submission.fullName || submission.username}</td>
                    <td>
                      <span className={`tl-badge ${submission.status === 'submitted' ? 'active' : 'pending'}`}>
                        {submission.status}
                      </span>
                    </td>
                    <td>{submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : '-'}</td>
                    <td>
                      {submission.file_name ? (
                        <a href={`http://localhost:3001/uploads/${submission.file_name}`} target="_blank" rel="noopener noreferrer" className="tl-file-link">
                          {submission.file_name}
                        </a>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No submissions yet</p>
          )}
        </div>
      </div>
    </div>
  </div>
)}
```

## Step 10: Add CSS Styles

Add to `TeamLeaderDashboard.css`:

```css
/* Assignments Grid */
.tl-assignments-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.tl-assignment-card {
  background: white;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s;
}

.tl-assignment-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.tl-assignment-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 12px;
}

.tl-assignment-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #101828;
  margin: 0;
  flex: 1;
}

.tl-assignment-actions {
  display: flex;
  gap: 8px;
}

.tl-assignment-description {
  color: #6a7282;
  font-size: 14px;
  margin: 0 0 16px 0;
  line-height: 1.5;
}

.tl-assignment-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #E5E7EB;
}

.tl-assignment-due,
.tl-assignment-type {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #6a7282;
}

.tl-assignment-stats {
  display: flex;
  justify-content: space-around;
  padding: 12px 0;
  background: #F9FAFB;
  border-radius: 8px;
  margin-bottom: 12px;
}

.tl-stat-item {
  text-align: center;
}

.tl-stat-item .tl-stat-label {
  display: block;
  font-size: 12px;
  color: #6a7282;
  margin-bottom: 4px;
}

.tl-stat-item .tl-stat-value {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: #101828;
}

.tl-stat-item.success .tl-stat-value {
  color: #10B981;
}

.tl-stat-item.warning .tl-stat-value {
  color: #F59E0B;
}

.tl-file-link {
  color: #4f39f6;
  text-decoration: none;
}

.tl-file-link:hover {
  text-decoration: underline;
}
```

## Done!

After following these steps:
1. Run the database setup
2. Restart your server
3. Refresh the client
4. You should see the "Assignments" tab in the Team Leader dashboard

The system will work like Google Classroom - team leaders can create assignments and track submissions!
