import { useState, useEffect } from 'react';
import './css/DashboardTab.css';
import { LoadingCards } from '../common/InlineSkeletonLoader';

const DashboardTab = ({ user, files, setActiveTab }) => {
  const [assignments, setAssignments] = useState([]);
  const [teamTasks, setTeamTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    fetchDashboardData();
    
    // Auto-refresh every 30 seconds for real-time updates (silent)
    const refreshInterval = setInterval(() => {
      fetchDashboardData(true);
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [user.id, user.team]);

  const fetchDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
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
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchDashboardData();
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
    pending: files.filter(f => f.current_stage?.includes('pending')).length,
    approved: files.filter(f => f.status === 'final_approved').length,
    rejected: files.filter(f => f.status?.includes('rejected') || f.current_stage?.includes('rejected')).length
  };

  const teamStats = {
    totalTasks: teamTasks.length,
    totalSubmissions: teamTasks.reduce((sum, task) => 
      sum + (task.recent_submissions ? task.recent_submissions.length : 0), 0
    )
  };

  const notificationStats = {
    unread: notifications.filter(n => !n.is_read).length,
    recent: notifications.slice(0, 3)
  };

  const taskCompletionRate = myTasksStats.total > 0 
    ? Math.round((myTasksStats.submitted / myTasksStats.total) * 100) : 0;
  
  const fileApprovalRate = filesStats.total > 0
    ? Math.round((filesStats.approved / filesStats.total) * 100) : 0;
  
  const fileRejectionRate = filesStats.total > 0
    ? Math.round((filesStats.rejected / filesStats.total) * 100) : 0;
  
  const onTimeRate = myTasksStats.total > 0
    ? Math.round(((myTasksStats.total - myTasksStats.overdue) / myTasksStats.total) * 100) : 100;
  
  const overallScore = (() => {
    const taskScore = myTasksStats.total > 0 ? (myTasksStats.submitted / myTasksStats.total) * 100 : 0;
    const fileScore = filesStats.total > 0 ? (filesStats.approved / filesStats.total) * 100 : 0;
    const rejectionPenalty = filesStats.total > 0 ? (filesStats.rejected / filesStats.total) * 20 : 0;
    const timeScore = myTasksStats.total > 0 ? ((myTasksStats.total - myTasksStats.overdue) / myTasksStats.total) * 100 : 100;
    const rawScore = (taskScore * 0.4) + (fileScore * 0.3) + (timeScore * 0.3);
    return Math.max(0, Math.round(rawScore - rejectionPenalty));
  })();

  if (loading) {
    return (
      <div className="modern-dashboard">
        <div className="dashboard-skeleton">
          {/* Top Stats Skeleton */}
          <div className="top-stats-grid">
            <LoadingCards count={3} />
          </div>

          {/* Main Content Skeleton */}
          <div className="dashboard-main-grid">
            {/* Analytics Card Skeleton */}
            <div className="analytics-card-modern skeleton-card">
              <div className="skeleton-box-inline" style={{ height: '24px', width: '180px', marginBottom: '20px' }} />
              <div className="skeleton-box-inline" style={{ height: '16px', width: '100%', marginBottom: '10px' }} />
              <div className="skeleton-box-inline" style={{ height: '40px', width: '100%', marginBottom: '20px' }} />
              <div className="analytics-metrics-grid">
                <LoadingCards count={4} />
              </div>
            </div>

            {/* Notifications Card Skeleton */}
            <div className="notifications-card-modern skeleton-card">
              <div className="skeleton-box-inline" style={{ height: '24px', width: '140px', marginBottom: '20px' }} />
              <div className="skeleton-box-inline" style={{ height: '60px', width: '100%', marginBottom: '10px' }} />
              <div className="skeleton-box-inline" style={{ height: '60px', width: '100%', marginBottom: '10px' }} />
              <div className="skeleton-box-inline" style={{ height: '60px', width: '100%' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modern-dashboard">
      {/* Top Stats Cards */}
      <div className="top-stats-grid">
        <div className="stat-card-modern" onClick={() => setActiveTab('tasks')}>
          <div className="stat-card-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div className="stat-card-content">
            <div className="stat-card-label">My Tasks</div>
            <div className="stat-card-value">{myTasksStats.total}</div>
            <div className="stat-card-detail"><span className="pending-count">{myTasksStats.pending} pending</span> · <span className="submitted-count">{myTasksStats.submitted} submitted</span></div>
          </div>
        </div>

        <div className="stat-card-modern" onClick={() => setActiveTab('my-files')}>
          <div className="stat-card-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
              <polyline points="13 2 13 9 20 9"></polyline>
            </svg>
          </div>
          <div className="stat-card-content">
            <div className="stat-card-label">My Files</div>
            <div className="stat-card-value">{filesStats.total}</div>
            <div className="stat-card-detail"><span className="pending-count">{filesStats.pending} pending</span> · <span className="approved-count">{filesStats.approved} approved</span> · <span className="rejected-count">{filesStats.rejected} rejected</span></div>
          </div>
        </div>

        <div className="stat-card-modern" onClick={() => setActiveTab('team-files')}>
          <div className="stat-card-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div className="stat-card-content">
            <div className="stat-card-label">Team Activity</div>
            <div className="stat-card-value">{teamStats.totalTasks}</div>
            <div className="stat-card-detail">{teamStats.totalTasks} tasks · {teamStats.totalSubmissions} submissions</div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-main-grid">
        {/* Performance Analytics */}
        <div className="analytics-card-modern">
          <div className="analytics-card-header">
            <h2 className="analytics-card-title">Performance Analytics</h2>
          </div>
          <div className="analytics-content">
            {/* Overall Score - Circular Gauge */}
            <div className="overall-score-section">
              <div className="score-content-wrapper">
                {/* Circular Progress */}
                <div className="circular-progress-container">
                  <svg className="circular-progress-svg" viewBox="0 0 200 200">
                    {/* Background circle */}
                    <circle
                      className="progress-ring-bg"
                      cx="100"
                      cy="100"
                      r="85"
                      fill="none"
                      strokeWidth="18"
                    />
                    {/* Progress circle */}
                    <circle
                      className="progress-ring-fill"
                      cx="100"
                      cy="100"
                      r="85"
                      fill="none"
                      strokeWidth="18"
                      strokeDasharray={`${(overallScore / 100) * 534} 534`}
                      strokeLinecap="round"
                      style={{
                        stroke: overallScore >= 85 ? '#10b981' : 
                                overallScore >= 70 ? '#22c55e' : 
                                overallScore >= 50 ? '#f59e0b' : '#ef4444'
                      }}
                    />
                    {/* Center text */}
                    <text className="score-percentage-text" x="100" y="95" textAnchor="middle">
                      {overallScore}%
                    </text>
                    <text className="score-label-text" x="100" y="118" textAnchor="middle">
                      Performance
                    </text>
                  </svg>
                </div>

                {/* Score Description */}
                <div className="score-description">
                  <div className="score-status">
                    <div className="status-badge" style={{
                      background: overallScore >= 85 ? '#d1fae5' : 
                                  overallScore >= 70 ? '#d1fae5' : 
                                  overallScore >= 50 ? '#fef3c7' : '#fee2e2',
                      color: overallScore >= 85 ? '#065f46' : 
                             overallScore >= 70 ? '#065f46' : 
                             overallScore >= 50 ? '#92400e' : '#991b1b'
                    }}>
                      {overallScore >= 85 ? '🌟 Excellent' : 
                       overallScore >= 70 ? '✅ Good' : 
                       overallScore >= 50 ? '⚠️ Fair' : '📉 Needs Improvement'}
                    </div>
                  </div>
                  <p className="score-message">
                    {overallScore >= 85 ? 'Outstanding work! You\'re exceeding expectations.' :
                     overallScore >= 70 ? 'Great job! Keep up the good momentum.' :
                     overallScore >= 50 ? 'You\'re on track. Focus on completing pending tasks.' :
                     'Let\'s work on improving your completion rate.'}
                  </p>
                  <div className="score-legend-grid">
                    <div className="legend-item">
                      <span className="legend-dot excellent"></span>
                      <span>85-100% Excellent</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-dot good"></span>
                      <span>70-84% Good</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-dot fair"></span>
                      <span>50-69% Fair</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-dot poor"></span>
                      <span>0-49% Poor</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Analytics Grid */}
            <div className="analytics-metrics-grid">
              <div className="analytics-metric">
                <div className="metric-icon task-completion-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <div className="metric-content">
                  <div className="metric-label">Task Completion</div>
                  <div className="metric-value">{taskCompletionRate}%</div>
                  <div className="metric-detail">{myTasksStats.submitted}/{myTasksStats.total} completed</div>
                </div>
              </div>

              <div className="analytics-metric">
                <div className="metric-icon ontime-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </div>
                <div className="metric-content">
                  <div className="metric-label">On-Time Delivery</div>
                  <div className="metric-value">{onTimeRate}%</div>
                  <div className="metric-detail">{myTasksStats.total - myTasksStats.overdue}/{myTasksStats.total} on time</div>
                </div>
              </div>

              <div className="analytics-metric">
                <div className="metric-icon approval-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                  </svg>
                </div>
                <div className="metric-content">
                  <div className="metric-label">File Approval Rate</div>
                  <div className="metric-value">{fileApprovalRate}%</div>
                  <div className="metric-detail">{filesStats.approved}/{filesStats.total} approved</div>
                </div>
              </div>

              <div className="analytics-metric">
                <div className="metric-icon rejection-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                </div>
                <div className="metric-content">
                  <div className="metric-label">File Rejection Rate</div>
                  <div className="metric-value">{fileRejectionRate}%</div>
                  <div className="metric-detail">{filesStats.rejected}/{filesStats.total} rejected</div>
                </div>
              </div>

              <div className="analytics-metric">
                <div className="metric-icon overdue-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                </div>
                <div className="metric-content">
                  <div className="metric-label">Overdue Tasks</div>
                  <div className="metric-value">{myTasksStats.overdue}</div>
                  <div className="metric-detail">Tasks awaiting attention</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="notifications-card-modern">
          <div className="notifications-card-header">
            <h2 className="notifications-card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              Notifications
            </h2>
            <div className="notifications-badge">{notificationStats.unread}</div>
          </div>
          <div className="notifications-content">
            {notificationStats.recent.length > 0 ? (
              <>
                {notificationStats.recent.map(notification => (
                  <div key={notification.id} className={`notification-item-modern ${!notification.is_read ? 'unread' : ''}`}>
                    <div className="notification-text">
                      <div className="notification-title-modern">{notification.title}</div>
                      <div className="notification-time-modern">
                        {(() => {
                          const now = new Date();
                          const notifTime = new Date(notification.created_at);
                          const diffMs = now - notifTime;
                          const diffMins = Math.floor(diffMs / 60000);
                          const diffHours = Math.floor(diffMs / 3600000);
                          
                          if (diffMins < 60) return `${diffMins} minutes ago`;
                          if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
                          return notifTime.toLocaleDateString();
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
                <button className="view-all-notifications-btn" onClick={() => setActiveTab('notification')}>
                  View all notifications
                </button>
              </>
            ) : (
              <div className="empty-notifications">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <p>No notifications</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;
