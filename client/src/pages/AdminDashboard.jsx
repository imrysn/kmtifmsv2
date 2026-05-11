import { useState, useEffect, useRef, Suspense, memo, useCallback, useMemo } from 'react'
import { apiFetch, API_BASE_URL } from '@/config/api'
import anime from 'animejs'
import '../css/AdminDashboard.css'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { getSidebarIcon } from '../components/shared/FileIcon'
import { AuthProvider, NetworkProvider } from '../contexts'
import { ToastNotification, Sidebar, TopBar } from '../components/shared'
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

  const adminNavItems = useMemo(() => [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'notifications', label: 'Notifications', icon: 'notifications', badge: unreadCount },
    { id: 'users', label: 'Users', icon: 'users' },
    { id: 'activity-logs', label: 'Activity Logs', icon: 'activityLogs' },
    { id: 'file-approval', label: 'File Approval', icon: 'fileApproval' },
    { id: 'tasks', label: 'Tasks', icon: 'tasks' },
    { id: 'settings', label: 'Settings', icon: 'settings' }
  ], [unreadCount]);

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
              <div className="admin-layout">
                <Sidebar
                  user={user}
                  items={adminNavItems}
                  activeTab={activeTab}
                  onTabChange={handleTabChange}
                  onLogout={handleLogout}
                  isOpen={sidebarOpen}
                  onClose={() => setSidebarOpen(false)}
                  brandLabel="Admin Portal"
                />

                <div 
                  className="admin-main-content" 
                  ref={mainContentRef}
                  style={{ 
                    marginLeft: '80px',
                    width: 'calc(100% - 80px)'
                  }}
                >
                  <TopBar 
                    title={adminNavItems.find(i => i.id === activeTab)?.label || 'Admin'}
                    onMenuClick={toggleSidebar}
                    user={user}
                    onLogout={handleLogout}
                    onSettings={() => setActiveTab('settings')}
                  />

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
