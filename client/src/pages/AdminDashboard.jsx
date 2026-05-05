import { useState, useEffect, useRef, Suspense, memo, useCallback } from 'react'
import { API_BASE_URL } from '@/config/api'
import anime from 'animejs'
import '../css/AdminDashboard.css'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { getSidebarIcon } from '../components/shared/FileIcon'
import { AuthProvider, NetworkProvider } from '../contexts'
import { ToastNotification } from '../components/shared'

// Import admin tab components
import {
  DashboardOverview,
  UserManagement,
  ActivityLogs,
  FileApproval,
  Settings,
  TaskManagement,
  TeamManagement,
  Notifications
} from '../components/admin'

// Memoized sidebar for performance and pixel-perfect fidelity
const AdminSidebar = memo(({ sidebarRef, activeTab, sidebarOpen, unreadCount, user, handleTabChange, closeSidebar, handleLogout }) => (
  <div className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`} ref={sidebarRef}>
    <div className="sidebar-header-fidelity">
      <div className="sidebar-logo-fidelity">
        <div className="logo-box">K</div>
        <div className="logo-text">KMTI - FMS</div>
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
            <span className="notification-badge-fidelity">{unreadCount}</span>
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
        className={`nav-item ${activeTab === 'teams' ? 'active' : ''}`}
        onClick={() => { handleTabChange('teams'); closeSidebar() }}
      >
        <span className="nav-icon">{getSidebarIcon('teams')}</span>
        <span className="nav-label">Teams</span>
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

    <div className="sidebar-footer-fidelity">
      <button onClick={handleLogout} className="logout-btn-fidelity">
        <span className="nav-icon">{getSidebarIcon('logout')}</span>
        <span className="nav-label">Logout</span>
      </button>
    </div>
  </div>
))

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState(null)
  
  const sidebarRef = useRef(null)

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    setLoading(false)
  }, [])

  const handleTabChange = (tab) => setActiveTab(tab)
  const closeSidebar = () => { if (window.innerWidth < 1024) setSidebarOpen(false) }
  const handleLogout = () => {
    localStorage.removeItem('user')
    window.location.href = '/login'
  }

  if (loading) return <SkeletonLoader />

  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Admin Overview'
      case 'notifications': return 'System Notifications'
      case 'users': return 'User Management'
      case 'teams': return 'Team Management'
      case 'activity-logs': return 'Activity Logs'
      case 'file-approval': return 'File Approval'
      case 'tasks': return 'Task Management'
      case 'settings': return 'System Settings'
      default: return 'Admin Dashboard'
    }
  }

  const getTabSubtitle = () => {
    switch (activeTab) {
      case 'tasks': return 'Review and manage assignments across all teams'
      case 'teams': return 'Manage engineering teams and assignments'
      case 'file-approval': return 'Review and approve pending student submissions'
      default: return 'Review and manage system-wide operations'
    }
  }

  return (
    <div className="minimal-admin-dashboard">
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

      <main className="admin-main-content">
        <header className="main-header-fidelity">
          <div className="header-left">
            <button className="mobile-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div className="header-titles">
              <h1>{getTabTitle()}</h1>
              <p>{getTabSubtitle()}</p>
            </div>
          </div>
          
          <div className="header-right">
            <div className="admin-profile-fidelity">
              <div className="admin-name-plate">
                <span className="admin-fullname">{user?.fullName || 'Erik Benjamin Adan'}</span>
                <span className="admin-role-label">System Administrator</span>
              </div>
              <div className="admin-avatar-plate">
                {user?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'EA'}
              </div>
            </div>
          </div>
        </header>

        <section className="content-area-fidelity">
          <Suspense fallback={<SkeletonLoader />}>
            {activeTab === 'dashboard' && <DashboardOverview user={user} />}
            {activeTab === 'notifications' && <Notifications user={user} />}
            {activeTab === 'users' && <UserManagement user={user} />}
            {activeTab === 'teams' && <TeamManagement user={user} />}
            {activeTab === 'activity-logs' && <ActivityLogs user={user} />}
            {activeTab === 'file-approval' && <FileApproval user={user} />}
            {activeTab === 'tasks' && <TaskManagement user={user} />}
            {activeTab === 'settings' && <Settings user={user} />}
          </Suspense>
        </section>
      </main>

      {notification && (
        <ToastNotification 
          message={notification.message} 
          type={notification.type} 
          onClose={() => setNotification(null)} 
        />
      )}
    </div>
  )
}

export default AdminDashboard
