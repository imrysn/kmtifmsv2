import { useState, useEffect } from 'react';
import './css/DashboardTab.css';
import './css/DashboardTab-NoAnimation.css';
import './css/DashboardTab-Analytics.css';

const DashboardTab = ({ user, files, setActiveTab }) => {
  const [assignments, setAssignments] = useState([]);
  const [teamTasks, setTeamTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [user.id, user.team]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch user assignments (My Tasks)
      const assignmentsResponse = await fetch(`http://localhost:3001/api/assignments/user/${user.id}`);
      const assignmentsData = await assignmentsResponse.json();
      if (assignmentsData.success) {
        setAssignments(assignmentsData.assignments || []);
      }

      // Fetch team tasks
      const teamTasksResponse = await fetch(`http://localhost:3001/api/assignments/team/${user.team}/all-tasks?limit=5`);
      const teamTasksData = await teamTasksResponse.json();
      if (teamTasksData.success) {
        setTeamTasks(teamTasksData.assignments || []);
      }

      // Fetch notifications
      const notificationsResponse = await fetch(`http://localhost:3001/api/notifications/user/${user.id}`);
      const notificationsData = await notificationsResponse.json();
      if (notificationsData.success) {
        setNotifications(notificationsData.notifications || []);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const myTasksStats = {
    total: assignments.length,
    pending: assignments.filter(a => a.user_status !== 'submitted').length,
    submitted: assignments.filter(a => a.user_status === 'submitted').length,
    overdue: assignments.filter(a => {
      if (!a.due_date) return false;
      return new Date(a.due_date) < new Date() && a.user_status !== 'submitted';
    }).length
  };

  const filesStats = {
    total: files.length,
    pending: files.filter(f => f.current_stage.includes('pending')).length,
    approved: files.filter(f => f.status === 'final_approved').length,
    rejected: files.filter(f => f.status.includes('rejected')).length
  };

  const teamStats = {
    totalTasks: teamTasks.length,
    totalSubmissions: teamTasks.reduce((sum, task) => 
      sum + (task.recent_submissions ? task.recent_submissions.length : 0), 0
    ),
    recentActivity: teamTasks.slice(0, 3)
  };

  const notificationStats = {
    total: notifications.length,
    unread: notifications.filter(n => !n.is_read).length,
    recent: notifications.slice(0, 5)
  };

  // Calculate performance analytics
  const performanceAnalytics = {
    // Task completion rate
    taskCompletionRate: myTasksStats.total > 0 
      ? Math.round((myTasksStats.submitted / myTasksStats.total) * 100)
      : 0,
    
    // File approval rate
    fileApprovalRate: filesStats.total > 0
      ? Math.round((filesStats.approved / filesStats.total) * 100)
      : 0,
    
    // On-time submission rate
    onTimeRate: myTasksStats.total > 0
      ? Math.round(((myTasksStats.total - myTasksStats.overdue) / myTasksStats.total) * 100)
      : 100,
    
    // Overall productivity score (weighted average)
    productivityScore: (() => {
      const taskWeight = 0.4;
      const fileWeight = 0.3;
      const timeWeight = 0.3;
      
      const taskScore = myTasksStats.total > 0 
        ? (myTasksStats.submitted / myTasksStats.total) * 100
        : 0;
      const fileScore = filesStats.total > 0
        ? (filesStats.approved / filesStats.total) * 100
        : 0;
      const timeScore = myTasksStats.total > 0
        ? ((myTasksStats.total - myTasksStats.overdue) / myTasksStats.total) * 100
        : 100;
      
      return Math.round((taskScore * taskWeight) + (fileScore * fileWeight) + (timeScore * timeWeight));
    })(),
    
    // Activity metrics
    totalActivities: myTasksStats.submitted + filesStats.total,
    recentActivity: assignments.filter(a => {
      const submittedDate = new Date(a.updated_at);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return submittedDate >= weekAgo;
    }).length
  };

  // Get performance rating
  const getPerformanceRating = (score) => {
    if (score >= 90) return { label: 'Excellent', color: '#10b981', emoji: '🌟' };
    if (score >= 75) return { label: 'Good', color: '#3b82f6', emoji: '👍' };
    if (score >= 60) return { label: 'Average', color: '#f59e0b', emoji: '📊' };
    return { label: 'Needs Improvement', color: '#ef4444', emoji: '📈' };
  };

  const performanceRating = getPerformanceRating(performanceAnalytics.productivityScore);

  if (loading) {
    return (
      <div className="user-dashboard-component dashboard-grid dashboard-no-animation">
        {/* Welcome Card Skeleton */}
        <div className="dashboard-card welcome-card skeleton-card">
          <div className="skeleton-header">
            <div className="skeleton-line skeleton-title"></div>
            <div className="skeleton-line skeleton-subtitle"></div>
          </div>
          <div className="skeleton-user-info">
            <div className="skeleton-avatar"></div>
            <div className="skeleton-user-details">
              <div className="skeleton-line skeleton-short"></div>
              <div className="skeleton-line skeleton-short"></div>
              <div className="skeleton-line skeleton-short"></div>
              <div className="skeleton-line skeleton-short"></div>
            </div>
          </div>
        </div>

        {/* Quick Stats Skeleton */}
        <div className="dashboard-card stats-grid-card skeleton-card">
          <div className="skeleton-header">
            <div className="skeleton-line skeleton-title"></div>
            <div className="skeleton-line skeleton-subtitle"></div>
          </div>
          <div className="skeleton-stats-grid">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton-stat-card">
                <div className="skeleton-stat-icon"></div>
                <div className="skeleton-stat-content">
                  <div className="skeleton-line skeleton-tiny"></div>
                  <div className="skeleton-line skeleton-medium"></div>
                  <div className="skeleton-line skeleton-short"></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tasks Overview Skeleton */}
        <div className="dashboard-card skeleton-card">
          <div className="skeleton-header">
            <div className="skeleton-line skeleton-medium"></div>
          </div>
          <div className="skeleton-list">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton-list-item">
                <div className="skeleton-line skeleton-long"></div>
                <div className="skeleton-line skeleton-short"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Team Activity Skeleton */}
        <div className="dashboard-card skeleton-card">
          <div className="skeleton-header">
            <div className="skeleton-line skeleton-medium"></div>
          </div>
          <div className="skeleton-list">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton-list-item">
                <div className="skeleton-circle"></div>
                <div className="skeleton-line skeleton-long"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Notifications Skeleton */}
        <div className="dashboard-card skeleton-card">
          <div className="skeleton-header">
            <div className="skeleton-line skeleton-medium"></div>
          </div>
          <div className="skeleton-list">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton-list-item">
                <div className="skeleton-circle"></div>
                <div className="skeleton-content">
                  <div className="skeleton-line skeleton-medium"></div>
                  <div className="skeleton-line skeleton-long"></div>
                  <div className="skeleton-line skeleton-tiny"></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Workflow Skeleton */}
        <div className="dashboard-card skeleton-card">
          <div className="skeleton-header">
            <div className="skeleton-line skeleton-medium"></div>
          </div>
          <div className="skeleton-workflow">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton-workflow-step">
                <div className="skeleton-circle skeleton-small"></div>
                <div className="skeleton-content">
                  <div className="skeleton-line skeleton-short"></div>
                  <div className="skeleton-line skeleton-long"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="user-dashboard-component dashboard-grid dashboard-no-animation">
      {/* Welcome Card */}
      <div className="dashboard-card welcome-card">
        <div className="welcome-header-gradient">
          <div className="welcome-header-content">
            <div className="user-avatar-with-indicator">
              <div className="user-avatar-circle">
                {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="online-indicator"></div>
            </div>
            <div className="welcome-text">
              <h2>Welcome Back, {user.fullName?.split(' ')[0] || user.username}!</h2>
              <p className="welcome-subtitle">Here's what's happening with your workspace</p>
            </div>
          </div>
        </div>
        
        {user && (
          <div className="user-info-grid">
            <div className="user-info-row">
              <div className="user-info-field">
                <span className="field-label">FULL NAME</span>
                <div className="field-value-wrapper">
                  <div className="field-icon user-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </div>
                  <span className="field-value">{user.fullName}</span>
                </div>
              </div>
              <div className="user-info-field">
                <span className="field-label">EMAIL</span>
                <div className="field-value-wrapper">
                  <div className="field-icon email-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                    </svg>
                  </div>
                  <span className="field-value">{user.email}</span>
                </div>
              </div>
            </div>
            <div className="user-info-row">
              <div className="user-info-field">
                <span className="field-label">TEAM</span>
                <div className="field-value-wrapper">
                  <div className="field-icon team-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7"></rect>
                      <rect x="14" y="3" width="7" height="7"></rect>
                      <rect x="14" y="14" width="7" height="7"></rect>
                      <rect x="3" y="14" width="7" height="7"></rect>
                    </svg>
                  </div>
                  <span className="field-value team-value">{user.team}</span>
                </div>
              </div>
              <div className="user-info-field">
                <span className="field-label">ROLE</span>
                <div className="field-value-wrapper">
                  <div className="field-icon role-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                  </div>
                  <span className="field-value role-value">{user.role.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats Grid */}
      <div className="dashboard-card stats-grid-card">
        <div className="card-header">
          <h3>📊 Quick Statistics</h3>
          <p className="card-subtitle">Your workspace at a glance</p>
        </div>

        <div className="quick-stats-grid">
          {/* My Tasks Stats */}
          <div className="stat-card" onClick={() => setActiveTab('tasks')}>
            <div className="stat-icon tasks-icon">✓</div>
            <div className="stat-content">
              <div className="stat-label">My Tasks</div>
              <div className="stat-value">{myTasksStats.total}</div>
              <div className="stat-breakdown">
                <span className="stat-item pending">{myTasksStats.pending} pending</span>
                <span className="stat-divider">•</span>
                <span className="stat-item submitted">{myTasksStats.submitted} submitted</span>
                {myTasksStats.overdue > 0 && (
                  <>
                    <span className="stat-divider">•</span>
                    <span className="stat-item overdue">{myTasksStats.overdue} overdue</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Files Stats */}
          <div className="stat-card" onClick={() => setActiveTab('my-files')}>
            <div className="stat-icon files-icon">📄</div>
            <div className="stat-content">
              <div className="stat-label">My Files</div>
              <div className="stat-value">{filesStats.total}</div>
              <div className="stat-breakdown">
                <span className="stat-item pending">{filesStats.pending} pending</span>
                <span className="stat-divider">•</span>
                <span className="stat-item approved">{filesStats.approved} approved</span>
                {filesStats.rejected > 0 && (
                  <>
                    <span className="stat-divider">•</span>
                    <span className="stat-item rejected">{filesStats.rejected} rejected</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Team Activity Stats */}
          <div className="stat-card" onClick={() => setActiveTab('team-files')}>
            <div className="stat-icon team-icon">👥</div>
            <div className="stat-content">
              <div className="stat-label">Team Activity</div>
              <div className="stat-value">{teamStats.totalTasks}</div>
              <div className="stat-breakdown">
                <span className="stat-item">{teamStats.totalTasks} tasks</span>
                <span className="stat-divider">•</span>
                <span className="stat-item">{teamStats.totalSubmissions} submissions</span>
              </div>
            </div>
          </div>

          {/* Notifications Stats */}
          <div className="stat-card" onClick={() => setActiveTab('notification')}>
            <div className="stat-icon notifications-icon">🔔</div>
            <div className="stat-content">
              <div className="stat-label">Notifications</div>
              <div className="stat-value">{notificationStats.total}</div>
              <div className="stat-breakdown">
                {notificationStats.unread > 0 ? (
                  <span className="stat-item unread">{notificationStats.unread} unread</span>
                ) : (
                  <span className="stat-item">All caught up!</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* My Tasks Overview */}
      <div className="dashboard-card tasks-overview-card">
        <div className="card-header">
          <h3>✓ My Tasks Overview</h3>
          <button className="view-all-btn" onClick={() => setActiveTab('tasks')}>
            View All →
          </button>
        </div>

        {assignments.length > 0 ? (
          <div className="tasks-preview-list">
            {assignments.slice(0, 3).map(assignment => {
              const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date();
              const isSubmitted = assignment.user_status === 'submitted';
              
              return (
                <div key={assignment.id} className="task-preview-item">
                  <div className="task-preview-content">
                    <div className="task-preview-title">{assignment.title}</div>
                    <div className="task-preview-meta">
                      {assignment.due_date && (
                        <span className={`task-due-date ${isOverdue && !isSubmitted ? 'overdue' : ''}`}>
                          Due: {new Date(assignment.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="task-preview-status">
                    {isSubmitted ? (
                      <span className="status-badge submitted">✓ Submitted</span>
                    ) : isOverdue ? (
                      <span className="status-badge overdue">⚠ Overdue</span>
                    ) : (
                      <span className="status-badge pending">⏳ Pending</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">✓</div>
            <p>No tasks assigned yet</p>
          </div>
        )}
      </div>

      {/* Recent Team Activity */}
      <div className="dashboard-card team-activity-card">
        <div className="card-header">
          <h3>👥 Recent Team Activity</h3>
          <button className="view-all-btn" onClick={() => setActiveTab('team-files')}>
            View All →
          </button>
        </div>

        {teamStats.recentActivity.length > 0 ? (
          <div className="activity-preview-list">
            {teamStats.recentActivity.map(task => (
              <div key={task.id} className="activity-preview-item">
                <div className="activity-icon">📋</div>
                <div className="activity-content">
                  <div className="activity-title">{task.title}</div>
                  <div className="activity-meta">
                    {task.recent_submissions && task.recent_submissions.length > 0 ? (
                      <span className="activity-submissions">
                        {task.recent_submissions.length} submission{task.recent_submissions.length !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="activity-no-submissions">No submissions yet</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <p>No team activity yet</p>
          </div>
        )}
      </div>

      {/* Recent Notifications */}
      <div className="dashboard-card notifications-preview-card">
        <div className="card-header">
          <h3>🔔 Recent Notifications</h3>
          <button className="view-all-btn" onClick={() => setActiveTab('notification')}>
            View All →
          </button>
        </div>

        {notificationStats.recent.length > 0 ? (
          <div className="notifications-preview-list">
            {notificationStats.recent.map(notification => {
              // Determine icon type class
              let iconClass = 'notification-icon';
              if (notification.type === 'assignment') iconClass += ' assignment-icon';
              else if (notification.type === 'comment') iconClass += ' comment-icon';
              else if (notification.type === 'file') iconClass += ' file-icon';
              else iconClass += ' bell-icon';
              
              return (
                <div 
                  key={notification.id} 
                  className={`notification-preview-item ${!notification.is_read ? 'unread' : ''}`}
                >
                  <div className={iconClass}>
                    {notification.type === 'comment' ? '💬' : 
                     notification.type === 'assignment' ? '✓' : 
                     notification.type === 'file' ? '📄' : '🔔'}
                  </div>
                  <div className="notification-content">
                    <div className="notification-title">{notification.title}</div>
                    <div className="notification-message">{notification.message}</div>
                    <div className="notification-time">
                      {new Date(notification.created_at).toLocaleDateString()} at{' '}
                      {new Date(notification.created_at).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                  {!notification.is_read && <div className="unread-indicator"></div>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🔔</div>
            <p>No notifications yet</p>
          </div>
        )}
      </div>

      {/* Performance Analytics */}
      <div className="dashboard-card analytics-card">
        <div className="card-header">
          <h3>📊 Performance Analytics</h3>
          <p className="card-subtitle">Track your productivity and performance</p>
        </div>

        <div className="analytics-content">
          {/* Overall Performance Score */}
          <div className="performance-score-section">
            <div className="score-circle-container">
              <div className="score-circle" style={{ background: `conic-gradient(${performanceRating.color} ${performanceAnalytics.productivityScore * 3.6}deg, #e5e7eb ${performanceAnalytics.productivityScore * 3.6}deg)` }}>
                <div className="score-inner">
                  <div className="score-value">{performanceAnalytics.productivityScore}</div>
                  <div className="score-label">Score</div>
                </div>
              </div>
            </div>
            <div className="score-details">
              <div className="performance-rating" style={{ color: performanceRating.color }}>
                <span className="rating-emoji">{performanceRating.emoji}</span>
                <span className="rating-label">{performanceRating.label}</span>
              </div>
              <div className="score-description">
                Your overall productivity based on task completion, file approvals, and timeliness
              </div>
            </div>
          </div>

          {/* Performance Metrics Grid */}
          <div className="performance-metrics-grid">
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-icon">✓</span>
                <span className="metric-title">Task Completion</span>
              </div>
              <div className="metric-value-bar">
                <div className="metric-bar">
                  <div className="metric-fill" style={{ width: `${performanceAnalytics.taskCompletionRate}%`, backgroundColor: '#3b82f6' }}></div>
                </div>
                <span className="metric-percentage">{performanceAnalytics.taskCompletionRate}%</span>
              </div>
              <div className="metric-details">
                {myTasksStats.submitted} of {myTasksStats.total} tasks completed
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-icon">📄</span>
                <span className="metric-title">File Approval Rate</span>
              </div>
              <div className="metric-value-bar">
                <div className="metric-bar">
                  <div className="metric-fill" style={{ width: `${performanceAnalytics.fileApprovalRate}%`, backgroundColor: '#10b981' }}></div>
                </div>
                <span className="metric-percentage">{performanceAnalytics.fileApprovalRate}%</span>
              </div>
              <div className="metric-details">
                {filesStats.approved} of {filesStats.total} files approved
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-icon">⏱️</span>
                <span className="metric-title">On-Time Delivery</span>
              </div>
              <div className="metric-value-bar">
                <div className="metric-bar">
                  <div className="metric-fill" style={{ width: `${performanceAnalytics.onTimeRate}%`, backgroundColor: '#f59e0b' }}></div>
                </div>
                <span className="metric-percentage">{performanceAnalytics.onTimeRate}%</span>
              </div>
              <div className="metric-details">
                {myTasksStats.total - myTasksStats.overdue} of {myTasksStats.total} on time
              </div>
            </div>
          </div>

          {/* Activity Summary */}
          <div className="activity-summary">
            <div className="summary-card">
              <div className="summary-icon">📈</div>
              <div className="summary-content">
                <div className="summary-value">{performanceAnalytics.totalActivities}</div>
                <div className="summary-label">Total Activities</div>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon">🔥</div>
              <div className="summary-content">
                <div className="summary-value">{performanceAnalytics.recentActivity}</div>
                <div className="summary-label">This Week</div>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon">⚠️</div>
              <div className="summary-content">
                <div className="summary-value">{myTasksStats.overdue}</div>
                <div className="summary-label">Overdue Tasks</div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default DashboardTab;
