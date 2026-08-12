import { useState, useEffect, useMemo, startTransition } from 'react';
import { apiFetch } from '@/config/api';
import './css/DashboardTab.css';
import { LoadingCards } from '../common/InlineSkeletonLoader';
import { UserPerformanceCard } from '../shared';


const DashboardTab = ({ user, files, setActiveTab, onOpenFile, onNavigateToTasks }) => {
  const [assignments, setAssignments] = useState([]);
  const [teamTasks, setTeamTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [performanceLoading, setPerformanceLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (isMounted) {
        await fetchDashboardData();
      }
    };

    loadData();

    // Poll every 5 minutes for lightweight updates (assignments + team tasks only).
    // Performance score is expensive (calls calculateAllUserPerformance) — skip on silent refresh.
    const refreshInterval = setInterval(() => {
      if (isMounted) {
        fetchDashboardData(true);
      }
    }, 300000); // 5 minutes

    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
    };
  }, [user.id, user.team]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      // Phase 1: Single lightweight quickstats call — 4 COUNT queries batched server-side.
      // Returns task counts, file counts, team count, and 3 recent notifications.
      // Replaces the previous 2 heavy calls (full assignment rows + attachments + members).
      const quickStats = await apiFetch(`/api/dashboard/user-quickstats/${user.id}`);

      const applyCore = () => {
        if (quickStats.success) {
          // Build a flat synthetic assignment array for the dashboard stat cards.
          // Shape: { user_status, _overdue? } — same keys the useMemo selectors filter on.
          // Note: overdue is a SUBSET of pending, so we build:
          //   N_submitted submitted items
          //   (pending - overdue) non-overdue pending items
          //   overdue overdue pending items
          // Total = submitted + pending (not submitted + pending + overdue, which would double-count).
          const { submitted, pending, overdue } = quickStats.tasks;
          const nonOverduePending = Math.max(0, pending - overdue);
          setAssignments([
            ...Array.from({ length: submitted }, () => ({ user_status: 'submitted' })),
            ...Array.from({ length: nonOverduePending }, () => ({ user_status: 'pending' })),
            ...Array.from({ length: overdue }, () => ({ user_status: 'pending', _overdue: true }))
          ]);
          setTeamTasks(Array.from({ length: quickStats.team.totalTasks }, (_, i) => ({ id: i, recent_submissions: [] })));
          setNotifications(quickStats.recentNotifications || []);
          // Pre-populate file counts so the Files stat card shows numbers immediately
          // (before UserDashboard’s files prop arrives from its own fetch)
          if (quickStats.files) setQuickFileStats(quickStats.files);
        }
      };

      if (silent) startTransition(applyCore);
      else applyCore();

      // Clear skeleton as soon as core data is ready
      if (!silent) setLoading(false);

      // Phase 2: Load performance in the background (expensive, non-blocking)
      if (!silent) {
        setPerformanceLoading(true);
        apiFetch(`/api/dashboard/user-performance/${user.id}`)
          .then((performanceData) => {
            startTransition(() => {
              if (performanceData?.success) setPerformance(performanceData.performance);
            });
          })
          .catch(err => console.error('Error fetching performance:', err))
          .finally(() => setPerformanceLoading(false));
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      if (!silent) setLoading(false);
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark notification as read
    try {
      await apiFetch(`/api/notifications/${notification.id}/read`, {
        method: 'PUT'
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }

    // Navigate based on notification type
    if (notification.type === 'comment' && notification.assignment_id) {
      sessionStorage.setItem('scrollToAssignment', notification.assignment_id);
      sessionStorage.setItem('highlightCommentBy', notification.action_by_username);
      if (onNavigateToTasks) {
        onNavigateToTasks(notification.assignment_id);
      } else {
        setActiveTab('tasks');
      }
    } else if (notification.type === 'assignment') {
      if (onNavigateToTasks) {
        onNavigateToTasks();
      } else {
        setActiveTab('tasks');
      }
    } else if (notification.file_id) {
      if (onOpenFile) {
        onOpenFile(notification.file_id);
      } else {
        setActiveTab('my-files');
      }
    }
  };

  const myTasksStats = useMemo(() => ({
    total: assignments.filter(a => a.user_status !== undefined).length,
    pending: assignments.filter(a => a.user_status !== 'submitted').length,
    submitted: assignments.filter(a => a.user_status === 'submitted').length,
    overdue: assignments.filter(a => a._overdue === true).length
  }), [assignments]);

  // filesStats reads from the files prop (fetched by UserDashboard) OR quickstats counts
  // as fallback so the card shows correct numbers immediately on first paint.
  const [quickFileStats, setQuickFileStats] = useState(null);

  const filesStats = useMemo(() => {
    if (files.length > 0 || !quickFileStats) {
      return {
        total: files.length,
        pending: files.filter(f => f.current_stage?.includes('pending')).length,
        approved: files.filter(f => f.status === 'final_approved').length,
        rejected: files.filter(f => f.status?.includes('rejected') || f.current_stage?.includes('rejected')).length
      };
    }
    return quickFileStats;
  }, [files, quickFileStats]);

  const teamStats = useMemo(() => ({
    totalTasks: teamTasks.length,
    totalSubmissions: 0 // not loaded on dashboard — full data available in Team tab
  }), [teamTasks]);

  const notificationStats = useMemo(() => ({
    unread: notifications.filter(n => !n.is_read).length,
    recent: notifications.slice(0, 3)
  }), [notifications]);

  // Fallback stats for performance component
  const fallbackStats = useMemo(() => {
    const taskTotal = myTasksStats.total;
    const taskSubmitted = myTasksStats.submitted;
    const taskCompletionRate = taskTotal > 0 ? Math.round((taskSubmitted / taskTotal) * 100) : 0;
    
    const fileTotal = filesStats.total;
    const fileApproved = filesStats.approved;
    const fileRejected = filesStats.rejected;
    const fileApprovalRate = fileTotal > 0 ? Math.round((fileApproved / fileTotal) * 100) : 0;
    const fileRejectionRate = fileTotal > 0 ? Math.round((fileRejected / fileTotal) * 100) : 0;
    
    const overdue = myTasksStats.overdue;
    const onTimeCount = taskTotal - overdue;
    const onTimeRate = taskTotal > 0 ? Math.round((onTimeCount / taskTotal) * 100) : 100;
    
    const overallScore = Math.max(0, Math.round((taskCompletionRate * 0.4) + (onTimeRate * 0.3) + (fileApprovalRate * 0.3)));
    
    return {
      taskTotal, taskSubmitted, taskCompletionRate,
      fileTotal, fileApproved, fileRejected, fileApprovalRate, fileRejectionRate,
      overdue, onTimeCount, onTimeRate, overallScore
    };
  }, [myTasksStats, filesStats]);

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
            <div className="stat-card-detail">
              <span className="pending-count">{myTasksStats.pending} pending</span> · <span className="submitted-count">{myTasksStats.submitted} submitted</span>
            </div>
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
            <div className="stat-card-detail">
              <span className="pending-count">{filesStats.pending} pending</span> · <span className="approved-count">{filesStats.approved} approved</span> · <span className="rejected-count">{filesStats.rejected} rejected</span>
            </div>
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
            <div className="stat-card-detail">{teamStats.totalTasks} tasks in your team</div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-main-grid">
        {/* Performance Analytics Shared Component */}
        <UserPerformanceCard 
          user={user} 
          performanceData={performance} 
          fallbackStats={fallbackStats}
          isLoading={performanceLoading}
        />

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
                  <div
                    key={notification.id}
                    className={`notification-item-modern ${!notification.is_read ? 'unread' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                    style={{ cursor: 'pointer' }}
                  >
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
