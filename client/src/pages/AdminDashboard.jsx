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
  TaskManagement
} from '../components/admin'

const AdminDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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

  const handleLogout = () => {
    onLogout()
  }

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const handleTabChange = (tabName) => {
    setActiveTab(tabName)
    clearMessages()
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
        return <UserManagement {...commonProps} user={user} />
      case 'activity-logs':
        return <ActivityLogs {...commonProps} />
      case 'file-approval':
        return <FileApproval {...commonProps} />
      case 'file-management':
        return <FileManagement {...commonProps} />
      case 'tasks':
        return <TaskManagement {...commonProps} user={user} />
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
      {/* Sidebar */}
      <div className="admin-sidebar" ref={sidebarRef}>
        <div className="sidebar-header">
          <div className="admin-info">
            <div className="admin-name">{user.fullName || 'Admin User'}</div>
            <div className="admin-role">{user.role || 'Administrator'}</div>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleTabChange('dashboard')}
          >
            <span className="nav-icon">{getSidebarIcon('dashboard')}</span>
            <span className="nav-label">Dashboard</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'file-management' ? 'active' : ''}`}
            onClick={() => handleTabChange('file-management')}
          >
            <span className="nav-icon">{getSidebarIcon('files')}</span>
            <span className="nav-label">Files</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => handleTabChange('users')}
          >
            <span className="nav-icon">{getSidebarIcon('users')}</span>
            <span className="nav-label">Users</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'activity-logs' ? 'active' : ''}`}
            onClick={() => handleTabChange('activity-logs')}
          >
            <span className="nav-icon">{getSidebarIcon('activityLogs')}</span>
            <span className="nav-label">Activity Logs</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'file-approval' ? 'active' : ''}`}
            onClick={() => handleTabChange('file-approval')}
          >
            <span className="nav-icon">{getSidebarIcon('fileApproval')}</span>
            <span className="nav-label">File Approval</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => handleTabChange('tasks')}
          >
            <span className="nav-icon">{getSidebarIcon('tasks')}</span>
            <span className="nav-label">Tasks</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => handleTabChange('settings')}
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
      </div>
    </Suspense>
  )
}

export default AdminDashboard