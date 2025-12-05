import { useState, useEffect } from 'react';
import './css/DashboardTab.css';

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
      const [assignmentsRes, teamTasksRes, notificationsRes] = await Promise.all([
        fetch(`http://localhost:3001/api/assignments/user/${user.id}`),
        fetch(`http://localhost:3001/api/assignments/team/${user.team}/all-tasks?limit=5`),
        fetch(`http://localhost:3001/api/notifications/user/${user.id}`)
      ]);

      const [assignmentsData, teamTasksData, notificationsData] = await Promise.all([
        assignmentsRes.json(),
        teamTasksRes.json(),
        notificationsRes.json()
      ]);

      if (assignmentsData.success) setAssignments(assignmentsData.assignments || []);
      if (teamTasksData.success) setTeamTasks(teamTasksData.assignments || []);
      if (notificationsData.success) setNotifications(notificationsData.notifications || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const taskCompletionRate = myTasksStats.total > 0 
    ? Math.round((myTasksStats.submitted / myTasksStats.total) * 100) : 0;
  
  const fileApprovalRate = filesStats.total > 0
    ? Math.round((filesStats.approved / filesStats.total) * 100) : 0;
  
  const onTimeRate = myTasksStats.total > 0
    ? Math.round(((myTasksStats.total - myTasksStats.overdue) / myTasksStats.total) * 100) : 100;
  
  const productivityScore = (() => {
    const taskScore = myTasksStats.total > 0 ? (myTasksStats.submitted / myTasksStats.total) * 100 : 0;
    const fileScore = filesStats.total > 0 ? (filesStats.approved / filesStats.total) * 100 : 0;
    const timeScore = myTasksStats.total > 0 ? ((myTasksStats.total - myTasksStats.overdue) / myTasksStats.total) * 100 : 100;
    return Math.round((taskScore * 0.4) + (fileScore * 0.3) + (timeScore * 0.3));
  })();

  const getScoreColor = (score) => {
    if (score >= 90) return '#10b981';
    if (score >= 75) return '#3b82f6';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  if (loading) {
    return (
      <div className="user-dashboard-component dashboard-grid">
        <div className="dashboard-card welcome-card skeleton-card">
          <div className="skeleton-header">
            <div className="skeleton-line skeleton-title"></div>
            <div className="skeleton-line skeleton-subtitle"></div>
          </div>
          <div className="skeleton-user-info">
            <div className="skeleton-avatar"></div>
            <div className="skeleton-user-details">
              {[1,2,3,4].map(i => <div key={i} className="skeleton-line skeleton-short"></div>)}
            </div>
          </div>
        </div>
        <div className="skeleton-stats-grid">
          {[1,2,3,4].map(i => (
            <div key={i} className="skeleton-stat-card">
              <div className="skeleton-stat-icon"></div>
              <div className="skeleton-stat-content">
                <div className="skeleton-line skeleton-tiny"></div>
                <div className="skeleton-line skeleton-medium"></div>
              </div>
            </div>
          ))}
        </div>
        {[1,2,3].map(i => (
          <div key={i} className="dashboard-card skeleton-card">
            <div className="skeleton-header"><div className="skeleton-line skeleton-medium"></div></div>
            <div className="skeleton-list">
              {[1,2,3].map(j => (
                <div key={j} className="skeleton-list-item">
                  <div className="skeleton-circle"></div>
                  <div className="skeleton-line skeleton-long"></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="user-dashboard-component dashboard-grid">
      <div className="dashboard-top-row">
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
        </div>

        {/* Performance Analytics */}
        <div className="dashboard-card analytics-card">
          <div className="analytics-header">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
              Performance Analytics
            </h3>
            <p className="analytics-subtitle">Your productivity metrics at a glance</p>
          </div>
          <div className="analytics-grid">
            <div className="analytics-item">
              <div className="analytics-icon score-icon">
                <div className="score-circle-small" style={{ background: `conic-gradient(${getScoreColor(productivityScore)} ${productivityScore * 3.6}deg, #e5e7eb ${productivityScore * 3.6}deg)` }}>
                  <div className="score-value-small">{productivityScore}</div>
                </div>
              </div>
              <div className="analytics-content-item">
                <div className="analytics-label">Overall Score</div>
                <div className="analytics-value">{productivityScore}%</div>
                <div className="analytics-detail"></div>
              </div>
            </div>
            <div className="analytics-item">
              <div className="analytics-icon tasks-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <div className="analytics-content-item">
                <div className="analytics-label">Task Completion</div>
                <div className="analytics-value">{taskCompletionRate}%</div>
                <div className="analytics-detail">{myTasksStats.submitted}/{myTasksStats.total} completed</div>
              </div>
            </div>
            <div className="analytics-item">
              <div className="analytics-icon files-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                  <polyline points="13 2 13 9 20 9"></polyline>
                </svg>
              </div>
              <div className="analytics-content-item">
                <div className="analytics-label">File Approval Rate</div>
                <div className="analytics-value">{fileApprovalRate}%</div>
                <div className="analytics-detail">{filesStats.approved}/{filesStats.total} approved</div>
              </div>
            </div>
            <div className="analytics-item">
              <div className="analytics-icon ontime-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <div className="analytics-content-item">
                <div className="analytics-label">On-Time Delivery</div>
                <div className="analytics-value">{onTimeRate}%</div>
                <div className="analytics-detail">{myTasksStats.total - myTasksStats.overdue}/{myTasksStats.total} on time</div>
              </div>
            </div>
            <div className="analytics-item">
              <div className="analytics-icon overdue-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <div className="analytics-content-item">
                <div className="analytics-label">Overdue Tasks</div>
                <div className="analytics-value">{myTasksStats.overdue}</div>
                <div className="analytics-detail">Tasks awaiting attention</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid - No Container */}
      <div className="quick-stats-grid">
        <div className="stat-card" onClick={() => setActiveTab('tasks')}>
          <div className="stat-icon tasks-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">My Tasks</div>
            <div className="stat-value">{myTasksStats.total}</div>
            <div className="stat-breakdown">
              <span className="stat-item">{myTasksStats.pending} pending</span>
              <span className="stat-divider">•</span>
              <span className="stat-item">{myTasksStats.submitted} submitted</span>
              {myTasksStats.overdue > 0 && (
                <><span className="stat-divider">•</span><span className="stat-item">{myTasksStats.overdue} overdue</span></>
              )}
            </div>
          </div>
        </div>
        <div className="stat-card" onClick={() => setActiveTab('my-files')}>
          <div className="stat-icon files-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
              <polyline points="13 2 13 9 20 9"></polyline>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">My Files</div>
            <div className="stat-value">{filesStats.total}</div>
            <div className="stat-breakdown">
              <span className="stat-item">{filesStats.pending} pending</span>
              <span className="stat-divider">•</span>
              <span className="stat-item">{filesStats.approved} approved</span>
              {filesStats.rejected > 0 && (
                <><span className="stat-divider">•</span><span className="stat-item">{filesStats.rejected} rejected</span></>
              )}
            </div>
          </div>
        </div>
        <div className="stat-card" onClick={() => setActiveTab('team-files')}>
          <div className="stat-icon team-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
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
        <div className="stat-card" onClick={() => setActiveTab('notification')}>
          <div className="stat-icon notifications-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">Notifications</div>
            <div className="stat-value">{notificationStats.total}</div>
            <div className="stat-breakdown">
              {notificationStats.unread > 0 
                ? <span className="stat-item">{notificationStats.unread} unread</span>
                : <span className="stat-item">All caught up!</span>
              }
            </div>
          </div>
        </div>
      </div>

      {/* My Tasks Overview */}
      <div className="dashboard-card tasks-overview-card">
        <div className="card-header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            My Tasks Overview
          </h3>
          <button className="view-all-btn" onClick={() => setActiveTab('tasks')}>View All →</button>
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
                    <span className={`status-badge ${isSubmitted ? 'submitted' : isOverdue ? 'overdue' : 'pending'}`}>
                      {isSubmitted ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', verticalAlign: 'middle' }}>
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                          Submitted
                        </>
                      ) : isOverdue ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', verticalAlign: 'middle' }}>
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                          </svg>
                          Overdue
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', verticalAlign: 'middle' }}>
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                          Pending
                        </>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <p>No tasks assigned yet</p>
          </div>
        )}
      </div>

      {/* Recent Team Activity */}
      <div className="dashboard-card team-activity-card">
        <div className="card-header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Recent Team Activity
          </h3>
          <button className="view-all-btn" onClick={() => setActiveTab('team-files')}>View All →</button>
        </div>
        {teamStats.recentActivity.length > 0 ? (
          <div className="activity-preview-list">
            {teamStats.recentActivity.map(task => (
              <div key={task.id} className="activity-preview-item">
                <div className="activity-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                  </svg>
                </div>
                <div className="activity-content">
                  <div className="activity-title">{task.title}</div>
                  <div className="activity-meta">
                    {task.recent_submissions?.length > 0 
                      ? <span className="activity-submissions">{task.recent_submissions.length} submission{task.recent_submissions.length !== 1 ? 's' : ''}</span>
                      : <span className="activity-no-submissions">No submissions yet</span>
                    }
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <p>No team activity yet</p>
          </div>
        )}
      </div>

      {/* Recent Notifications */}
      <div className="dashboard-card notifications-preview-card">
        <div className="card-header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            Recent Notifications
          </h3>
          <button className="view-all-btn" onClick={() => setActiveTab('notification')}>View All →</button>
        </div>
        {notificationStats.recent.length > 0 ? (
          <div className="notifications-preview-list">
            {notificationStats.recent.map(notification => (
              <div key={notification.id} className={`notification-preview-item ${!notification.is_read ? 'unread' : ''}`}>
                <div className={`notification-icon ${notification.type}-icon`}>
                  {notification.type === 'comment' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                  ) : notification.type === 'assignment' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : notification.type === 'file' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                      <polyline points="13 2 13 9 20 9"></polyline>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                  )}
                </div>
                <div className="notification-content">
                  <div className="notification-title">{notification.title}</div>
                  <div className="notification-message">{notification.message}</div>
                  <div className="notification-time">
                    {new Date(notification.created_at).toLocaleDateString()} at {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {!notification.is_read && <div className="unread-indicator"></div>}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            </div>
            <p>No notifications yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardTab;
