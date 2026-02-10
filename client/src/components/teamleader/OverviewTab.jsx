import overviewIcon from '../../assets/Icon-7.svg'
import { LoadingTable, LoadingCards } from '../common/InlineSkeletonLoader'

const OverviewTab = ({
  pendingFiles,
  teamMembers,
  calculateApprovalRate,
  submittedFiles = [],
  assignments = [],
  notifications = [],
  notificationCounts = { overdue: 0, urgent: 0, pending: 0 },
  analyticsData = null,
  activeTab,
  setActiveTab,
  onNavigateToTask,
  isLoading = false
}) => {
  // Show skeleton loading if data is loading
  if (isLoading) {
    return (
      <div className="tl-content">
        {/* Page Header Skeleton */}
        <div className="tl-dashboard-header">
          <h1>Dashboard</h1>
          <p>Comprehensive overview of team activities and performance</p>
        </div>

        {/* Quick Actions Skeleton */}
        <div className="tl-dashboard-actions">
          <LoadingCards count={4} />
        </div>

        {/* Main Dashboard Grid Skeleton */}
        <div className="tl-dashboard-grid">
          <LoadingCards count={6} />
        </div>
      </div>
    )
  }

  // Calculate dashboard metrics
  const calculateFilesStats = () => {
    const total = submittedFiles.length
    const approved = submittedFiles.filter(f => f.status === 'approved' || f.status === 'final_approved').length
    const rejected = submittedFiles.filter(f => f.status === 'rejected' || f.status === 'rejected_by_team_leader' || f.status === 'rejected_by_admin').length
    const pending = total - approved - rejected
    return { total, approved, rejected, pending }
  }

  const calculateAssignmentsStats = () => {
    const activeAssignments = assignments.filter(a => a.status === 'active').length
    const totalSubmissions = assignments.reduce((sum, a) => sum + (a.submission_count || 0), 0)
    const upcomingDue = assignments.filter(a => {
      if (!a.due_date) return false
      const dueDate = new Date(a.due_date)
      const now = new Date()
      const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24))
      return daysUntilDue >= 0 && daysUntilDue <= 7
    }).length
    return { activeAssignments, totalSubmissions, upcomingDue }
  }

  // Get tasks with nearest due dates
  const getNearestDueTasks = () => {
    const now = new Date()

    // Filter active assignments with due dates
    const tasksWithDueDates = assignments.filter(a => a.status === 'active' && a.due_date)

    // Filter active assignments without due dates
    const tasksWithoutDueDates = assignments
      .filter(a => a.status === 'active' && !a.due_date)
      .map(task => ({ ...task, daysUntilDue: null, dueDate: null }))

    // Sort by due date (nearest first) and calculate days until due
    const sortedTasks = tasksWithDueDates
      .map(task => {
        const dueDate = new Date(task.due_date)
        const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24))
        return { ...task, daysUntilDue, dueDate }
      })
      .sort((a, b) => a.dueDate - b.dueDate)

    // Categorize tasks
    const overdueTasks = sortedTasks.filter(t => t.daysUntilDue < 0)
    const dueTodayTasks = sortedTasks.filter(t => t.daysUntilDue === 0)
    const upcomingTasks = sortedTasks.filter(t => t.daysUntilDue > 0 && t.daysUntilDue <= 7)
    const futureTasks = sortedTasks.filter(t => t.daysUntilDue > 7)

    // Return all tasks prioritized by urgency (nearest deadline first), then tasks without deadlines
    return [...overdueTasks, ...dueTodayTasks, ...upcomingTasks, ...futureTasks, ...tasksWithoutDueDates]
  }

  const fileStats = calculateFilesStats()
  const assignmentStats = calculateAssignmentsStats()
  const nearestDueTasks = getNearestDueTasks()

  return (
    <div className="tl-content">
      {/* Page Header */}
      <div className="tl-dashboard-header">
        <h1>Dashboard</h1>
        <p>Comprehensive overview of team activities and performance</p>
      </div>



      {/* Main Dashboard Grid */}
      <div className="tl-dashboard-grid">
        {/* File Collection */}
        <div className="tl-dashboard-card">
          <div className="tl-card-header">
            <h3>File Collection</h3>
            <div className="tl-card-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
          </div>
          <div className="tl-card-stats">
            <div className="tl-stat-item">
              <span className="tl-stat-value">{fileStats.total}</span>
              <span className="tl-stat-label">Total Submissions</span>
            </div>
            <div className="tl-stat-item">
              <span className="tl-stat-value green">{fileStats.approved}</span>
              <span className="tl-stat-label">Approved</span>
            </div>
            <div className="tl-stat-item">
              <span className="tl-stat-value orange">{fileStats.pending}</span>
              <span className="tl-stat-label">Pending</span>
            </div>
            <div className="tl-stat-item">
              <span className="tl-stat-value red">{fileStats.rejected}</span>
              <span className="tl-stat-label">Rejected</span>
            </div>
          </div>
        </div>

        {/* Task Overview */}
        <div className="tl-dashboard-card">
          <div className="tl-card-header">
            <h3>Tasks</h3>
            <div className="tl-card-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
          </div>
          <div className="tl-card-stats">
            <div className="tl-stat-item">
              <span className="tl-stat-value">{assignmentStats.activeAssignments}</span>
              <span className="tl-stat-label">Active Tasks</span>
            </div>
            <div className="tl-stat-item">
              <span className="tl-stat-value">{assignmentStats.totalSubmissions}</span>
              <span className="tl-stat-label">Total Submissions</span>
            </div>
            <div className="tl-stat-item">
              <span className="tl-stat-value warning">{assignmentStats.upcomingDue}</span>
              <span className="tl-stat-label">Due This Week</span>
            </div>
          </div>
        </div>

        {/* Team Management */}
        <div className="tl-dashboard-card">
          <div className="tl-card-header">
            <h3>Team Management</h3>
            <div className="tl-card-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className="tl-card-stats">
            <div className="tl-stat-item">
              <span className="tl-stat-value">{teamMembers.length}</span>
              <span className="tl-stat-label">Total Members</span>
            </div>
            <div className="tl-stat-item">
              <span className="tl-stat-value">{calculateApprovalRate()}%</span>
              <span className="tl-stat-label">Approval Rate</span>
            </div>
            <div className="tl-stat-item">
              <span className="tl-stat-value">{pendingFiles.length}</span>
              <span className="tl-stat-label">Files Pending</span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="tl-dashboard-card tall">
          <div className="tl-card-header">
            <h3>Recent Activity</h3>
            <div className="tl-card-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12,6 12,12 16,14" />
              </svg>
            </div>
          </div>
          <div className="tl-activity-list">
            {submittedFiles.slice(0, 5).map((file, index) => (
              <div key={file.id} className="tl-activity-item">
                <div className="tl-activity-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className="tl-activity-content">
                  <div className="tl-activity-title">{file.original_name}</div>
                  <div className="tl-activity-meta">
                    {file.assignment_title ? `Assignment: ${file.assignment_title}` : 'Direct upload'} •
                    {file.username || file.fullName} •
                    {new Date(file.submitted_at || file.uploaded_at).toLocaleDateString()}
                  </div>
                </div>
                <span className={`status-badge status-${file.status === 'approved' || file.status === 'final_approved' ? 'approved' :
                  file.status === 'rejected' || file.status === 'rejected_by_team_leader' || file.status === 'rejected_by_admin' ? 'rejected' :
                    'pending'
                  }`}>
                  {
                    file.status === 'approved' || file.status === 'final_approved' ? 'Approved' :
                      file.status === 'rejected' || file.status === 'rejected_by_team_leader' || file.status === 'rejected_by_admin' ? 'Rejected' :
                        file.status === 'team_leader_approved' ? 'Pending Admin' :
                          'Pending Team Leader'
                  }
                </span>
              </div>
            ))}
            {submittedFiles.length === 0 && (
              <div className="tl-activity-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12,6 12,12 16,14" />
                </svg>
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </div>

        {/* Priority Items */}
        <div className="tl-dashboard-card tall">
          <div className="tl-card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h3 style={{ flex: 1, paddingLeft: 'var(--spacing-md)' }}>Upcoming Tasks</h3>
            <h3 style={{ flex: 1, paddingLeft: 'var(--spacing-md)' }}>Overdues</h3>
          </div>
          <div className="tl-priority-grid">
            {/* Upcoming Tasks Column */}
            <div className="tl-priority-list">
              {nearestDueTasks.filter(task => task.daysUntilDue >= 0).length > 0 ? (
                nearestDueTasks
                  .filter(task => task.daysUntilDue >= 0)
                  .map((task) => {
                    const isDueToday = task.daysUntilDue === 0
                    const isDueSoon = task.daysUntilDue > 0 && task.daysUntilDue <= 7

                    return (
                      <div
                        key={task.id}
                        className={`tl-priority-item ${isDueToday ? 'urgent' :
                          isDueSoon ? 'due-soon' : ''
                          }`}
                        onClick={() => onNavigateToTask && onNavigateToTask(task.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="tl-priority-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12,6 12,12 16,14" />
                          </svg>
                        </div>
                        <div className="tl-priority-content">
                          <span className="tl-priority-label">{task.title}</span>
                        </div>
                        <span className="tl-priority-count">
                          {task.daysUntilDue === null ? 'No deadline' : (isDueToday ? 'Due today' : `${task.daysUntilDue}d left`)}
                        </span>
                      </div>
                    )
                  })
              ) : (
                <div className="tl-priority-empty">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                  <p>No upcoming tasks</p>
                </div>
              )}
            </div>

            {/* Overdues Column */}
            <div className="tl-priority-list">
              {nearestDueTasks.filter(task => task.daysUntilDue < 0).length > 0 ? (
                nearestDueTasks
                  .filter(task => task.daysUntilDue < 0)
                  .map((task) => (
                    <div
                      key={task.id}
                      className="tl-priority-item overdue"
                      onClick={() => onNavigateToTask && onNavigateToTask(task.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="tl-priority-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12" y2="16" />
                        </svg>
                      </div>
                      <div className="tl-priority-content">
                        <span className="tl-priority-label">{task.title}</span>
                      </div>
                      <span className="tl-priority-count">
                        {Math.abs(task.daysUntilDue)}d overdue
                      </span>
                    </div>
                  ))
              ) : (
                <div className="tl-priority-empty">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                  <p>No overdue tasks</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OverviewTab
