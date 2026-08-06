import { useState, useEffect, useRef, Suspense, memo, useCallback, startTransition } from 'react'
import { apiFetch, API_BASE_URL } from '@/config/api'
import anime from 'animejs'
import '../css/AdminDashboard.css'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { getSidebarIcon } from '../components/shared/FileIcon'
import { AuthProvider, NetworkProvider } from '../contexts'
import { ToastNotification } from '../components/shared'
import OnlineMembersPanel from '../components/shared/OnlineMembersPanel'
import Avatar from '../components/shared/Avatar'
import ThemeToggle from '../components/shared/ThemeToggle'
import BroadcastAlert from '../components/shared/BroadcastAlert'
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
import { BroadcastModal } from '../components/admin/modals'

// Memoized sidebar so state changes in the main dashboard don't re-render it
const AdminSidebar = memo(({ sidebarRef, activeTab, sidebarOpen, unreadCount, unreadBroadcastCount, setUnreadBroadcastCount, user, handleTabChange, closeSidebar, handleLogout, setShowBroadcastModal }) => (
  <div className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`} ref={sidebarRef}>
    <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <Avatar user={user} size="md" editable />
      <div className="admin-info" style={{ flex: 1, minWidth: 0 }}>
        <div className="admin-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.fullName || 'Admin User'}</div>
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
      <button 
        type="button" 
        className="nav-item" 
        onClick={() => {
          setShowBroadcastModal(true);
        }} 
        style={{ marginBottom: '8px', width: '100%', border: '1px solid var(--border-color)', background: 'transparent' }} 
        aria-label="Send Broadcast"
      >
        <span className="nav-icon" style={{ position: 'relative' }}>
          <svg width="22" height="22" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <path d="M 75.8,20.4 86.4,12.7 89.2,21.5 Z" fill="#64748b"/>
            <path d="M 85.1,38.9 97.4,32.3 98.4,41.9 Z" fill="#64748b"/>
            <path d="M 86.6,56.8 98.9,56.1 97.1,65.3 Z" fill="#64748b"/>
            <path d="M 78.5,72.4 88.0,79.5 81.3,86.6 Z" fill="#64748b"/>
            <path d="M 33.1,69.5 41.5,89.2 C 43.1,93.0 48.0,91.2 46.5,87.6 L 39.5,71.1 Z" fill="#cbd5e1"/>
            <path d="M 23.3,46.9 C 10.1,51.8 11.4,70.9 25.1,73.1 L 34.0,70.0 L 29.5,45.0 Z" fill="#dc2626"/>
            <path d="M 26.5,45.5 C 38.0,38.0 49.5,25.0 59.8,27.5 C 70.1,30.0 73.1,65.0 63.8,70.5 C 54.5,76.0 42.0,70.0 31.5,71.0 Z" fill="#e2e8f0"/>
            <ellipse cx="61.5" cy="49" rx="11" ry="24" fill="#64748b" transform="rotate(-12 61.5 49)"/>
            <ellipse cx="60" cy="49" rx="5" ry="12" fill="#ffffff" transform="rotate(-12 60 49)"/>
          </svg>
          {unreadBroadcastCount > 0 && (
            <span className="sidebar-notification-badge">
              {unreadBroadcastCount > 99 ? '99+' : unreadBroadcastCount}
            </span>
          )}
        </span>
        <span className="nav-label">Broadcast</span>
      </button>
      <ThemeToggle />
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
  const [visitedTabs, setVisitedTabs] = useState(new Set(['dashboard']))
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadBroadcastCount, setUnreadBroadcastCount] = useState(0)
  const [contextData, setContextData] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [activeBroadcast, setActiveBroadcast] = useState(null)
  const [broadcastQueue, setBroadcastQueue] = useState([])
  const [debugSseData, setDebugSseData] = useState('No SSE received yet')

  // On mount, fetch offline broadcasts
  useEffect(() => {
    if (!user?.id) return;
    const fetchOfflineBroadcasts = async () => {
      try {
        const data = await apiFetch(`/api/notifications/user/${user.id}/unread-broadcasts`);
        if (data.success && data.broadcasts?.length > 0) {
          const formatted = data.broadcasts.map(b => ({
            id: b.id,
            title: b.title,
            message: b.message,
            senderId: b.action_by_id,
            senderName: b.action_by_username
          }));
          setBroadcastQueue(prev => [...prev, ...formatted]);
        }
      } catch (err) {
        console.error('Error fetching unread broadcasts:', err);
      }
    };
    fetchOfflineBroadcasts();
  }, [user?.id]);

  useEffect(() => {
    if (!activeBroadcast && broadcastQueue.length > 0) {
      setActiveBroadcast(broadcastQueue[0]);
      setBroadcastQueue(prev => prev.slice(1));
    }
  }, [activeBroadcast, broadcastQueue]);

  // Smart Navigation State
  const [highlightedFileId, setHighlightedFileId] = useState(null)
  const [highlightedAssignmentId, setHighlightedAssignmentId] = useState(null)
  const [notificationCommentContext, setNotificationCommentContext] = useState(null)

  const sidebarRef = useRef(null)
  const mainContentRef = useRef(null)
  const lastNotifFetch = useRef(0) // debounce guard for SSE pings
  const seenBroadcasts = useRef(new Set()) // deduplicate broadcast events from SSE

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
      const [data, broadcastData] = await Promise.all([
        apiFetch(`/api/notifications/user/${user.id}?page=1&limit=20`),
        apiFetch(`/api/notifications/user/${user.id}?limit=1&type=broadcast_reply&unreadOnly=true`)
      ]);

      if (data.success) {
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
      
      if (broadcastData.success) {
        setUnreadBroadcastCount(broadcastData.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }, [user.id])

  // Fetch users for dashboard overview and settings
  useEffect(() => {
    fetchUsers()
    fetchNotifications()
    // Fallback poll every 5 minutes (SSE handles real-time; this is just a safety net)
    const interval = setInterval(fetchNotifications, 300000)
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
        console.log('SSE Event received:', event.data);
        if (event.data === 'ping') {
          // Debounce: ignore pings that arrive within 5s of the last fetch
          const now = Date.now()
          if (now - lastNotifFetch.current < 5000) return
          lastNotifFetch.current = now
          fetchNotifications()
        } else {
          try {
            const data = JSON.parse(event.data);
            setDebugSseData(event.data); // UPDATE DEBUG STATE
            if (data.type === 'broadcast') {
              if (seenBroadcasts.current.has(data.id)) return;
              seenBroadcasts.current.add(data.id);
              setUnreadBroadcastCount(prev => prev + 1); // Optimistically increment
              setBroadcastQueue(prev => [...prev, {
                id: data.id,
                title: data.title, 
                message: data.message,
                senderId: data.senderId,
                senderName: data.senderName
              }]);
              
              // Also fetch notifications to update the broadcast reply badge
              fetchNotifications();
            }
          } catch(e) {
            console.error('SSE Parse Error:', e);
          }
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

  const handleTabChange = useCallback((tab, data = null) => {
    startTransition(() => {
      setActiveTab(tab)
      setContextData(data)
      setVisitedTabs(prev => {
        const newSet = new Set(prev)
        newSet.add(tab)
        return newSet
      })
      setError('')
      setSuccess('')
    })
  }, [])

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev)
  }, [])

  const handleNotificationsRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

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
                unreadBroadcastCount={unreadBroadcastCount}
                setUnreadBroadcastCount={setUnreadBroadcastCount}
                user={user}
                handleTabChange={handleTabChange}
                closeSidebar={closeSidebar}
                handleLogout={handleLogout}
                setShowBroadcastModal={setShowBroadcastModal}
              />
              {/* Main Content */}
              <div className="admin-main-content" ref={mainContentRef}>

                {/* Online Members Panel — top right */}
                <div style={{ position: 'fixed', top: '16px', right: '24px', zIndex: 1000 }}>
                  <OnlineMembersPanel user={user} />
                </div>

                {/* Content Area */}
                <div className="content-area">
                  <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none', height: '100%' }}>
                    {visitedTabs.has('dashboard') && <DashboardOverview />}
                  </div>
                  <div style={{ display: activeTab === 'users' ? 'block' : 'none', height: '100%' }}>
                    {visitedTabs.has('users') && <UserManagement {...commonProps} user={user} contextData={contextData} />}
                  </div>
                  <div style={{ display: activeTab === 'activity-logs' ? 'block' : 'none', height: '100%' }}>
                    {visitedTabs.has('activity-logs') && <ActivityLogs {...commonProps} isActive={activeTab === 'activity-logs'} />}
                  </div>
                  <div style={{ display: activeTab === 'file-approval' ? 'block' : 'none', height: '100%' }}>
                    {visitedTabs.has('file-approval') && <FileApproval
                      {...commonProps}
                      contextFileId={contextData}
                      highlightedFileId={highlightedFileId}
                      onClearFileHighlight={() => setHighlightedFileId(null)}
                    />}
                  </div>
                  <div style={{ display: activeTab === 'tasks' ? 'block' : 'none', height: '100%' }}>
                    {visitedTabs.has('tasks') && <TaskManagement
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
                  </div>
                  <div style={{ display: activeTab === 'notifications' ? 'block' : 'none', height: '100%' }}>
                    {visitedTabs.has('notifications') && <Notifications user={user} onNavigate={handleNotificationNavigation} onRead={handleNotificationsRead} />}
                  </div>
                  <div style={{ display: activeTab === 'settings' ? 'block' : 'none', height: '100%' }}>
                    {visitedTabs.has('settings') && <Settings {...commonProps} users={users} user={user} />}
                  </div>
                </div>
              </div>

              {showBroadcastModal && (
                <BroadcastModal
                  isOpen={showBroadcastModal}
                  onClose={() => setShowBroadcastModal(false)}
                  onReplyRead={(clearAll) => {
          if (clearAll) {
            setUnreadBroadcastCount(0);
          } else {
            setUnreadBroadcastCount(prev => Math.max(0, prev - 1));
          }
        }}
                  onSuccess={(count) => {
                    window.toastContainer?.addToast({
                      type: 'success',
                      title: 'Broadcast Sent',
                      message: `Broadcast message sent to ${count} active users.`,
                      duration: 5000
                    });
                  }}
                />
              )}
              {activeBroadcast && (
                <BroadcastAlert 
                  broadcast={activeBroadcast} 
                  remainingCount={broadcastQueue.length}
                  onClose={() => {
                    if (activeBroadcast?.id) {
                      apiFetch(`/api/notifications/${activeBroadcast.id}/read`, { method: 'PUT' }).catch(console.error);
                    }
                    setActiveBroadcast(null);
                  }} 
                />
              )}
            </div>
          </Suspense>
      </NetworkProvider>
    </AuthProvider>
  )
}

export default AdminDashboard
