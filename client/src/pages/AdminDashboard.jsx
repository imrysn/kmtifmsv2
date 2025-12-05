import { useState, useEffect, useRef, Suspense } from 'react'
import anime from 'animejs'
import '../css/AdminDashboard.css'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { getSidebarIcon } from '../components/admin/FileIcon'

// Import admin tab components
import {
  DashboardOverview,
  UserManagement,
  ActivityLogs,
  FileApproval,
  FileManagement,
  Settings,
  TaskManagement,
  Notifications,
  ToastNotification
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

  const sidebarRef = useRef(null)
  const mainContentRef = useRef(null)

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

  // Fetch users for dashboard overview and settings
  useEffect(() => {
    fetchUsers()
    fetchNotifications()
    // Poll for notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 10000)
    return () => clearInterval(interval)
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/users')
      const data = await response.json()
      if (data.success) {
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/notifications/user/${user.id}`)
      const data = await response.json()
      if (data.success) {
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  const handleLogout = () => {
    onLogout()
  }

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const handleTabChange = (tabName, data = null) => {
    setActiveTab(tabName)
    setContextData(data)
    clearMessages()
  }

  const handleNotificationNavigation = (tabName, contextData) => {
    console.log('🔔 Admin Navigation triggered:', { tabName, contextData });
    
    // Close sidebar if open (for mobile view)
    if (sidebarOpen) {
      setSidebarOpen(false);
    }
    
    // Navigate to the tab with context data
    setActiveTab(tabName);
    setContextData(contextData);
    clearMessages();
    
    // Special handling for different navigation types
    if (contextData) {
      // Scroll to top of content area
      const contentArea = document.querySelector('.content-area');
      if (contentArea) {
        contentArea.scrollTop = 0;
      }
      
      // Log the navigation context for debugging
      if (contextData.action === 'reset-password') {
        console.log('🔑 Password reset context:', contextData);
      }
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const closeSidebar = () => {
    setSidebarOpen(false)
  }

  const renderActiveTab = () => {
    const commonProps = {
      clearMessages,
      error,
      success,
      setError,
      setSuccess
    }

    switch (activeTab) {
      case 'dashboard':
        return <DashboardOverview user={user} users={users} />
      case 'users':
        return <UserManagement {...commonProps} user={user} contextData={contextData} />
      case 'activity-logs':
        return <ActivityLogs {...commonProps} />
      case 'file-approval':
        return <FileApproval {...commonProps} contextFileId={contextData} />
      case 'file-management':
        return <FileManagement {...commonProps} contextFileId={contextData} />
      case 'tasks':
        return <TaskManagement {...commonProps} user={user} contextAssignmentId={contextData} />
      case 'notifications':
        return <Notifications user={user} onNavigate={handleNotificationNavigation} />
      case 'settings':
        return <Settings {...commonProps} users={users} user={user} />
      default:
        return <DashboardOverview user={user} users={users} />
    }
  }

  const getInitials = (name) => {
    if (!name) return 'A'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
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

      {/* Sidebar */}
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
            onClick={() => {
              handleTabChange('dashboard')
              closeSidebar()
            }}
          >
            <span className="nav-icon">{getSidebarIcon('dashboard')}</span>
            <span className="nav-label">Dashboard</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => {
              handleTabChange('notifications')
              closeSidebar()
            }}
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
            className={`nav-item ${activeTab === 'file-management' ? 'active' : ''}`}
            onClick={() => {
              handleTabChange('file-management')
              closeSidebar()
            }}
          >
            <span className="nav-icon">{getSidebarIcon('files')}</span>
            <span className="nav-label">Files</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => {
              handleTabChange('users')
              closeSidebar()
            }}
          >
            <span className="nav-icon">{getSidebarIcon('users')}</span>
            <span className="nav-label">Users</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'activity-logs' ? 'active' : ''}`}
            onClick={() => {
              handleTabChange('activity-logs')
              closeSidebar()
            }}
          >
            <span className="nav-icon">{getSidebarIcon('activityLogs')}</span>
            <span className="nav-label">Activity Logs</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'file-approval' ? 'active' : ''}`}
            onClick={() => {
              handleTabChange('file-approval')
              closeSidebar()
            }}
          >
            <span className="nav-icon">{getSidebarIcon('fileApproval')}</span>
            <span className="nav-label">File Approval</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => {
              handleTabChange('tasks')
              closeSidebar()
            }}
          >
            <span className="nav-icon">{getSidebarIcon('tasks')}</span>
            <span className="nav-label">Tasks</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => {
              handleTabChange('settings')
              closeSidebar()
            }}
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

      {/* Main Content */}
      <div className="admin-main-content" ref={mainContentRef}>

        {/* Content Area */}
        <div className="content-area">
          {renderActiveTab()}
        </div>
      </div>

      {/* Toast Notifications */}
      <ToastNotification 
        notifications={notifications}
        onNavigate={handleNotificationNavigation}
      />
      </div>
    </Suspense>
  )
}

export default AdminDashboard
