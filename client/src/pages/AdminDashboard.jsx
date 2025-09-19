import { useState, useEffect, useRef } from 'react'
import anime from 'animejs'
import '../css/AdminDashboard.css'

// Import admin tab components
import {
  DashboardOverview,
  UserManagement,
  ActivityLogs,
  FileApproval,
  FileManagement,
  Settings
} from '../components/admin'

const AdminDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const sidebarRef = useRef(null)
  const mainContentRef = useRef(null)
  const navItemsRef = useRef([])

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

  // Mouse tracking effect
  useEffect(() => {
    const handleMouseMove = (e) => {
      const navItems = navItemsRef.current.filter(item => item !== null)
      navItems.forEach(item => {
        const rect = item.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        item.style.setProperty('--mouse-x', `${x}px`)
        item.style.setProperty('--mouse-y', `${y}px`)
      })
    }

    document.addEventListener('mousemove', handleMouseMove)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
    }
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
        return <UserManagement {...commonProps} />
      case 'activity-logs':
        return <ActivityLogs {...commonProps} />
      case 'file-approval':
        return <FileApproval {...commonProps} />
      case 'file-management':
        return <FileManagement {...commonProps} />
      case 'settings':
        return <Settings {...commonProps} users={users} />
      default:
        return <DashboardOverview user={user} users={users} />
    }
  }

  const setNavItemRef = (index) => (el) => {
    if (el) {
      navItemsRef.current[index] = el
    }
  }

  return (
    <div className="minimal-admin-dashboard">
      {/* Sidebar */}
      <div className="admin-sidebar" ref={sidebarRef}>
        <div className="sidebar-header">
          <div className="admin-avatar">A</div>
          <h2>Admin Center</h2>
          <div className="admin-info">
            <div className="admin-name">{user.fullName || ''}</div>
            <div className="admin-role">{user.role}</div>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleTabChange('dashboard')}
            ref={setNavItemRef(0)}
          >
            <span className="nav-label">Dashboard</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'file-management' ? 'active' : ''}`}
            onClick={() => handleTabChange('file-management')}
            ref={setNavItemRef(1)}
          >
            <span className="nav-label">File Management</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => handleTabChange('users')}
            ref={setNavItemRef(2)}
          >
            <span className="nav-label">User Management</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'activity-logs' ? 'active' : ''}`}
            onClick={() => handleTabChange('activity-logs')}
            ref={setNavItemRef(3)}
          >
            <span className="nav-label">Activity Logs</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'file-approval' ? 'active' : ''}`}
            onClick={() => handleTabChange('file-approval')}
            ref={setNavItemRef(4)}
          >
            <span className="nav-label">File Approval</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => handleTabChange('settings')}
            ref={setNavItemRef(5)}
          >
            <span className="nav-label">Settings</span>
          </button>
        </nav>
        
        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-btn" ref={setNavItemRef(6)}>
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="admin-main-content" ref={mainContentRef}>
        {renderActiveTab()}
      </div>
    </div>
  )
}

export default AdminDashboard