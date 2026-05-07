import { useState, useEffect, useRef, Suspense, memo, useCallback } from 'react'
import { apiFetch, API_BASE_URL } from '@/config/api'
import anime from 'animejs'
import '../css/AdminDashboard.css'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { getSidebarIcon } from '../components/shared/FileIcon'
import { AuthProvider, NetworkProvider } from '../contexts'
import { ToastNotification } from '../components/shared'
import useStore from '../store/useStore'

// Sync unread count to Electron taskbar badge + icon flash
const syncElectronBadge = (count) => {
  if (!window.electron) return
  if (typeof window.electron.setBadge === 'function') window.electron.setBadge(count)
  if (typeof window.electron.flashFrame === 'function') window.electron.flashFrame(count > 0)
}

// Import admin tab components
import {
  DashboardOverview,
  UserManagement,
  ActivityLogs,
  FileApproval,
  Settings,
  TaskManagement,
  Notifications
} from '../components/admin'

// Memoized sidebar so state changes in the main dashboard don't re-render it
const AdminSidebar = memo(({ sidebarRef, activeTab, sidebarOpen, unreadCount, user, handleTabChange, closeSidebar, handleLogout }) => (
  <div className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`} ref={sidebarRef}>
    <div className="sidebar-header">
      <div className="admin-info">
        <div className="admin-name">{user.fullName || 'Admin User'}</div>
        <div className="admin-role">{user.role || 'Administrator'}</div>
      </div>
    </div>

    <nav className="sidebar-nav">
      <button
        className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => { handleTabChange('dashboard'); closeSidebar() }}
      >
        <span className="nav-icon">{getSidebarIcon('dashboard')}</span>
        <span className="nav-label">Dashboard</span>
      </button>
      <button
        className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
        onClick={() => { handleTabChange('notifications'); closeSidebar() }}
      >
        <span className="nav-icon nav-icon-with-badge">
          {getSidebarIcon('notifications')}
          {unreadCount > 0 && (
            <span className="sidebar-notification-badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </span>
        <span className="nav-label">Notifications</span>
      </button>
      <button
        className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
        onClick={() => { handleTabChange('users'); closeSidebar() }}
      >
        <span className="nav-icon">{getSidebarIcon('users')}</span>
        <span className="nav-label">Users</span>
      </button>
      <button
        className={`nav-item ${activeTab === 'activity-logs' ? 'active' : ''}`}
        onClick={() => { handleTabChange('activity-logs'); closeSidebar() }}
      >
        <span className="nav-icon">{getSidebarIcon('activityLogs')}</span>
        <span className="nav-label">Activity Logs</span>
      </button>
      <button
        className={`nav-item ${activeTab === 'file-approval' ? 'active' : ''}`}
        onClick={() => { handleTabChange('file-approval'); closeSidebar() }}
      >
        <span className="nav-icon">{getSidebarIcon('fileApproval')}</span>
        <span className="nav-label">File Approval</span>
      </button>
      <button
        className={`nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
        onClick={() => { handleTabChange('tasks'); closeSidebar() }}
      >
        <span className="nav-icon">{getSidebarIcon('tasks')}</span>
        <span className="nav-label">Tasks</span>
      </button>
      <button
        className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
        onClick={() => { handleTabChange('settings'); closeSidebar() }}
      >
        <span className="nav-icon">{getSidebarIcon('settings')}</span>
        <span className="nav-label">Settings</span>
      </button>
    </nav>

    <div className="sidebar-footer">
      <button onClick={handleLogout} className="logout-btn">
        <span className="nav-icon">{getSidebarIcon('logout')}</span>
        <span className="logout-btn-text">Logout</span>
      </button>
    </div>
  </div>
))
AdminSidebar.displayName = 'AdminSidebar'

const AdminDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [contextData, setContextData] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Smart Navigation State
  const [highlightedFileId, setHighlightedFileId] = useState(null)
  const [highlightedAssignmentId, setHighlightedAssignmentId] = useState(null)
  const [notificationCommentContext, setNotificationCommentContext] = useState(null)

  const sidebarRef = useRef(null)
  const mainContentRef = useRef(null)
  const lastNotifFetch = useRef(0) // debounce guard for SSE pings

  // Initial animations on component mount only
  useEffect(() => {
    anime({
      targets: sidebarRef.current,
      opacity: [0, 1],
      duration: 300,
      easing: 'easeOutCubic'
    })

    anime({
      targets: mainContentRef.current,
      opacity: [0, 1],
      duration: 300,
      delay: 100,
      easing: 'easeOutCubic'
    })
  }, [])

  const fetchUsers = async () => {
    try {
      const data = await apiFetch(`/api/users`)
      if (data.success) {
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/notifications/user/${user.id}?page=1&limit=20`)
      if (data.success) {
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }, [user.id])

  // Fetch users for dashboard overview and settings
  useEffect(() => {
    fetchUsers()
    fetchNotifications()
    // Fallback poll every 60s (SSE handles real-time; this is just a safety net)
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // SSE — instant badge update when a new notification arrives
  useEffect(() => {
    if (!user?.id) return
    const { token } = useStore.getState()
    let es
    let reconnectTimer
    const connect = () => {
      const url = `${API_BASE_URL}/api/notifications/user/${user.id}/stream${token ? `?token=${token}` : ''}`
      es = new EventSource(url)
      es.onmessage = (event) => {
        if (event.data === 'ping') {
          // Debounce: ignore pings that arrive within 5s of the last fetch
          const now = Date.now()
          if (now - lastNotifFetch.current < 5000) return
          lastNotifFetch.current = now
          fetchNotifications()
        }
      }
      es.onerror = () => {
        es.close()
        reconnectTimer = setTimeout(connect, 5000)
      }
    }
    connect()
    return () => {
      if (es) es.close()
      clearTimeout(reconnectTimer)
    }
  }, [user?.id, fetchNotifications])

  // Sync unread badge + flash to Electron taskbar whenever count changes
  useEffect(() => {
    syncElectronBadge(unreadCount)
  }, [unreadCount])

  const handleLogout = useCallback(() => {
    onLogout()
  }, [onLogout])

  const clearMessages = useCallback(() => {
    setError('')
    setSuccess('')
  }, [])

  const handleTabChange = useCallback((tabName, data = null) => {
    setActiveTab(tabName)
    setContextData(data)
    setError('')
    setSuccess('')
  }, [])

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev)
  }, [])

  const handleNotificationNavigation = useCallback((tabName, context) => {
    console.log('🔔 Admin Navigation triggered:', { tabName, context });

    setSidebarOpen(false);
    setActiveTab(tabName);
    setError('')
    setSuccess('')

    if (context && typeof context === 'object') {
      if (context.fileId) {
        setHighlightedFileId(context.fileId);
      }
      if (context.assignmentId) {
        setHighlightedAssignmentId(context.assignmentId);
        if (context.shouldOpenComments) {
          setNotificationCommentContext({
            assignmentId: context.assignmentId,
            expandAllReplies: context.expandAllReplies || false
          });
        }
      }
      setContextData(context);

      const contentArea = document.querySelector('.content-area');
      if (contentArea) contentArea.scrollTop = 0;
    } else {
      setContextData(context);
    }
  }, [])

  const commonProps = {
    clearMessages,
    error,
    success,
    setError,
    setSuccess
  }

  return (
    <AuthProvider initialUser={user}>
      <NetworkProvider>
          <Suspense fallback={<SkeletonLoader type="admin" />}>
            <div className="minimal-admin-dashboard">
              {/* Burger Menu Button */}
              <button
                className={`burger-menu-btn ${sidebarOpen ? 'active' : ''}`}
                onClick={toggleSidebar}
                aria-label="Toggle sidebar menu"
              >
                <div className="burger-menu-icon">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </button>

              {/* Sidebar Overlay */}
              <div
                className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
                onClick={closeSidebar}
              ></div>

              {/* Memoized Sidebar */}
              <AdminSidebar
                sidebarRef={sidebarRef}
                activeTab={activeTab}
                sidebarOpen={sidebarOpen}
                unreadCount={unreadCount}
                user={user}
                handleTabChange={handleTabChange}
                closeSidebar={closeSidebar}
                handleLogout={handleLogout}
              />
              {/* Main Content */}
              <div className="admin-main-content" ref={mainContentRef}>

                {/* Content Area */}
                <div className="content-area">
                  {activeTab === 'dashboard' && <DashboardOverview />}
                  {activeTab === 'users' && <UserManagement {...commonProps} user={user} contextData={contextData} />}
                  {activeTab === 'activity-logs' && <ActivityLogs {...commonProps} />}
                  {activeTab === 'file-approval' && <FileApproval
                    {...commonProps}
                    contextFileId={contextData}
                    highlightedFileId={highlightedFileId}
                    onClearFileHighlight={() => setHighlightedFileId(null)}
                  />}
                  {activeTab === 'tasks' && <TaskManagement
                    {...commonProps}
                    user={user}
                    contextAssignmentId={contextData}
                    highlightedAssignmentId={highlightedAssignmentId}
                    highlightedFileId={highlightedFileId}
                    notificationCommentContext={notificationCommentContext}
                    onClearHighlight={() => setHighlightedAssignmentId(null)}
                    onClearFileHighlight={() => setHighlightedFileId(null)}
                    onClearNotificationContext={() => setNotificationCommentContext(null)}
                  />}
                  {activeTab === 'notifications' && <Notifications user={user} onNavigate={handleNotificationNavigation} onRead={() => setUnreadCount(0)} />}
                  {activeTab === 'settings' && <Settings {...commonProps} users={users} user={user} />}
                  {activeTab !== 'dashboard' && activeTab !== 'users' && activeTab !== 'activity-logs' && activeTab !== 'file-approval' && activeTab !== 'tasks' && activeTab !== 'notifications' && activeTab !== 'settings' && <DashboardOverview />}
                </div>
              </div>
            </div>
          </Suspense>
        </NetworkProvider>
      </AuthProvider>
    )
}

export default AdminDashboard
