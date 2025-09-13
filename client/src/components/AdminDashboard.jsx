import { useState, useEffect, useRef } from 'react'
import anime from 'animejs'
import './AdminDashboard.css'

const AdminDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [users, setUsers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredUsers, setFilteredUsers] = useState([])
  const [activityLogs, setActivityLogs] = useState([])
  const [filteredLogs, setFilteredLogs] = useState([])
  const [logsSearchQuery, setLogsSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    role: 'USER',
    team: 'General'
  })
  const [settings, setSettings] = useState({
    system: {
      siteName: 'KMTIFMSV2 Admin',
      siteDescription: 'Enterprise User Management System',
      maintenanceMode: false,
      debugMode: false
    },
    security: {
      sessionTimeout: 30,
      passwordMinLength: 6,
      maxLoginAttempts: 5,
      requireTwoFactor: false
    },
    notifications: {
      emailNotifications: true,
      loginAlerts: true,
      userRegistrationAlerts: false,
      systemAlerts: true
    },
    backup: {
      autoBackup: true,
      backupFrequency: 'daily',
      retentionDays: 30
    }
  })

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
  }, []) // Only run on component mount

  // Handle tab changes and fetch data when needed
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers()
    } else if (activeTab === 'activity-logs') {
      fetchActivityLogs()
    }
  }, [activeTab])

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users)
    } else {
      const filtered = users.filter(u => 
        u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.team.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredUsers(filtered)
    }
  }, [searchQuery, users])

  useEffect(() => {
    if (logsSearchQuery.trim() === '') {
      setFilteredLogs(activityLogs)
    } else {
      const filtered = activityLogs.filter(log => 
        log.username.toLowerCase().includes(logsSearchQuery.toLowerCase()) ||
        log.role.toLowerCase().includes(logsSearchQuery.toLowerCase()) ||
        log.team.toLowerCase().includes(logsSearchQuery.toLowerCase()) ||
        log.activity.toLowerCase().includes(logsSearchQuery.toLowerCase())
      )
      setFilteredLogs(filtered)
    }
  }, [logsSearchQuery, activityLogs])

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('http://localhost:3001/api/users')
      const data = await response.json()
      if (data.success) {
        setUsers(data.users)
        setFilteredUsers(data.users)
      } else {
        setError('Failed to fetch users')
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      setError('Failed to connect to server')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchActivityLogs = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('http://localhost:3001/api/activity-logs')
      const data = await response.json()
      if (data.success) {
        setActivityLogs(data.logs)
        setFilteredLogs(data.logs)
      } else {
        setError('Failed to fetch activity logs')
      }
    } catch (error) {
      console.error('Error fetching activity logs:', error)
      setError('Failed to connect to server')
    } finally {
      setIsLoading(false)
    }
  }

  const exportLogs = () => {
    const csvContent = [
      ['Username', 'Role', 'Team', 'Date & Time', 'Activity'],
      ...filteredLogs.map(log => [
        log.username,
        log.role,
        log.team,
        new Date(log.timestamp).toLocaleString(),
        log.activity
      ])
    ].map(row => row.join(',')).join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    setSuccess('Activity logs exported successfully')
  }

  const clearLogFilters = () => {
    setLogsSearchQuery('')
    setFilteredLogs(activityLogs)
    setSuccess('Filters cleared')
  }

  const handleAddUser = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch('http://localhost:3001/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      const data = await response.json()
      if (data.success) {
        setSuccess('User created successfully')
        setShowAddModal(false)
        setFormData({ 
          fullName: '', 
          username: '', 
          email: '', 
          password: '', 
          role: 'USER', 
          team: 'General' 
        })
        fetchUsers()
      } else {
        setError(data.message)
      }
    } catch (error) {
      setError('Failed to create user')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditUser = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch(`http://localhost:3001/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          username: formData.username,
          email: formData.email,
          role: formData.role,
          team: formData.team
        })
      })
      
      const data = await response.json()
      if (data.success) {
        setSuccess('User updated successfully')
        setShowEditModal(false)
        setSelectedUser(null)
        fetchUsers()
      } else {
        setError(data.message)
      }
    } catch (error) {
      setError('Failed to update user')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch(`http://localhost:3001/api/users/${selectedUser.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: formData.password })
      })
      
      const data = await response.json()
      if (data.success) {
        setSuccess('Password reset successfully')
        setShowPasswordModal(false)
        setSelectedUser(null)
        setFormData({ ...formData, password: '' })
      } else {
        setError(data.message)
      }
    } catch (error) {
      setError('Failed to reset password')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to delete ${userName}? This action cannot be undone.`)) {
      return
    }
    
    setIsLoading(true)
    try {
      const response = await fetch(`http://localhost:3001/api/users/${userId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      if (data.success) {
        setSuccess(data.message)
        fetchUsers()
      } else {
        setError(data.message)
      }
    } catch (error) {
      setError('Failed to delete user')
    } finally {
      setIsLoading(false)
    }
  }

  const openEditModal = (user) => {
    setSelectedUser(user)
    setFormData({
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      team: user.team
    })
    setShowEditModal(true)
  }

  const openPasswordModal = (user) => {
    setSelectedUser(user)
    setFormData({ ...formData, password: '' })
    setShowPasswordModal(true)
  }

  const handleLogout = () => {
    onLogout()
  }

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const handleSettingsChange = (category, field, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }))
  }

  const handleSaveSettings = async () => {
    setIsLoading(true)
    try {
      // Here you would typically save to your backend
      // const response = await fetch('/api/settings', { method: 'PUT', ... })
      
      // For now, we'll just simulate a successful save
      await new Promise(resolve => setTimeout(resolve, 1000))
      setSuccess('Settings saved successfully')
    } catch (error) {
      setError('Failed to save settings')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportDatabase = () => {
    setSuccess('Database export initiated')
    // Simulate database export
  }

  const handleResetDatabase = () => {
    if (confirm('Are you sure you want to reset the database? This will remove all data and cannot be undone.')) {
      setSuccess('Database reset initiated')
      // Here you would call your reset script
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
            <div className="admin-name">{user.fullName || 'Administrator'}</div>
            <div className="admin-role">{user.role}</div>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={(e) => { 
              e.preventDefault()
              setActiveTab('dashboard')
              clearMessages()
            }}
          >
            <span className="nav-label">Dashboard</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={(e) => { 
              e.preventDefault()
              setActiveTab('users')
              clearMessages()
            }}
          >
            <span className="nav-label">User Management</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'activity-logs' ? 'active' : ''}`}
            onClick={(e) => { 
              e.preventDefault()
              setActiveTab('activity-logs')
              clearMessages()
            }}
          >
            <span className="nav-label">Activity Logs</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={(e) => { 
              e.preventDefault()
              setActiveTab('settings')
              clearMessages()
            }}
          >
            <span className="nav-label">Settings</span>
          </button>
        </nav>
        
        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="admin-main-content" ref={mainContentRef}>
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="dashboard-overview">
            <div className="page-header">
              <h1>System Overview</h1>
              <p>Welcome back, {user.fullName || 'Administrator'}! Here's your system status.</p>
            </div>
            
            <div className="stats-section">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon users-icon">U</div>
                  <div className="stat-info">
                    <div className="stat-number">{users.length}</div>
                    <div className="stat-label">Total Users</div>
                    <div className="stat-change positive">+2 this week</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon admins-icon">A</div>
                  <div className="stat-info">
                    <div className="stat-number">{users.filter(u => u.role === 'ADMIN').length}</div>
                    <div className="stat-label">Administrators</div>
                    <div className="stat-change neutral">No change</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon leaders-icon">L</div>
                  <div className="stat-info">
                    <div className="stat-number">{users.filter(u => u.role === 'TEAM LEADER').length}</div>
                    <div className="stat-label">Team Leaders</div>
                    <div className="stat-change positive">+1 this month</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon users-only-icon">M</div>
                  <div className="stat-info">
                    <div className="stat-number">{users.filter(u => u.role === 'USER').length}</div>
                    <div className="stat-label">Regular Users</div>
                    <div className="stat-change positive">+1 this week</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="admin-features-section">
              <div className="features-header">
                <h2>Administration Features</h2>
                <p>Comprehensive system management tools</p>
              </div>
              
              <div className="admin-features-grid">
                <div className="admin-feature-card">
                  <div className="feature-header">
                    <div className="feature-icon">UM</div>
                    <h3>User Management</h3>
                  </div>
                  <p>Create, edit, and manage user accounts with role-based permissions and team assignments.</p>
                  <ul>
                    <li>CRUD operations for all users</li>
                    <li>Role assignment and permissions</li>
                    <li>Team organization</li>
                    <li>Password management</li>
                  </ul>
                </div>
                
                <div className="admin-feature-card">
                  <div className="feature-header">
                    <div className="feature-icon">SA</div>
                    <h3>Security & Access</h3>
                  </div>
                  <p>Monitor system access, manage authentication, and maintain security protocols.</p>
                  <ul>
                    <li>Access control management</li>
                    <li>Login monitoring</li>
                    <li>Security audit trails</li>
                    <li>Permission management</li>
                  </ul>
                </div>
                
                <div className="admin-feature-card">
                  <div className="feature-header">
                    <div className="feature-icon">AR</div>
                    <h3>Analytics & Reports</h3>
                  </div>
                  <p>Generate comprehensive reports and analyze system usage patterns and trends.</p>
                  <ul>
                    <li>User activity reports</li>
                    <li>System usage analytics</li>
                    <li>Performance metrics</li>
                    <li>Export capabilities</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User Management Tab */}
        {activeTab === 'users' && (
          <div className="users-management">
            <div className="page-header">
              <h1>User Management</h1>
              <p>Manage system users, roles, and permissions</p>
            </div>
            
            {/* Action Bar */}
            <div className="action-bar">
              <div className="search-section">
                <div className="search-container">
                  <input
                    type="text"
                    placeholder="Search users by name, email, role, or team..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                  />
                </div>
              </div>
              
              <div className="action-buttons">
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    setFormData({ 
                      fullName: '', 
                      username: '', 
                      email: '', 
                      password: '', 
                      role: 'USER', 
                      team: 'General' 
                    })
                    setShowAddModal(true)
                  }}
                >
                  Add User
                </button>
              </div>
            </div>
            
            {/* Messages */}
            {error && (
              <div className="alert alert-error">
                <span className="alert-message">{error}</span>
                <button onClick={clearMessages} className="alert-close">×</button>
              </div>
            )}
            
            {success && (
              <div className="alert alert-success">
                <span className="alert-message">{success}</span>
                <button onClick={clearMessages} className="alert-close">×</button>
              </div>
            )}
            
            {/* Users Table */}
            <div className="table-section">
              {isLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading users...</p>
                </div>
              ) : (
                <div className="users-table-container">
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Password</th>
                        <th>Role</th>
                        <th>Team</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="user-row">
                          <td>
                            <div className="user-cell">
                              <div className="user-avatar">{user.fullName.charAt(0).toUpperCase()}</div>
                              <span className="user-name">{user.fullName}</span>
                            </div>
                          </td>
                          <td>{user.username}</td>
                          <td className="email-cell">{user.email}</td>
                          <td>
                            <div className="password-cell">
                              <span className="password-hidden">••••••••</span>
                              <button 
                                className="password-reset-btn"
                                onClick={() => openPasswordModal(user)}
                                title="Reset Password"
                              >
                                Reset
                              </button>
                            </div>
                          </td>
                          <td>
                            <span className={`role-badge ${user.role.toLowerCase().replace(' ', '-')}`}>
                              {user.role}
                            </span>
                          </td>
                          <td>
                            <span className="team-badge">{user.team}</span>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button 
                                className="action-btn edit-btn"
                                onClick={() => openEditModal(user)}
                                title="Edit User"
                              >
                                Edit
                              </button>
                              <button 
                                className="action-btn delete-btn"
                                onClick={() => handleDeleteUser(user.id, user.fullName)}
                                title="Delete User"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {!isLoading && filteredUsers.length === 0 && (
                <div className="empty-state">
                  <h3>No users found</h3>
                  <p>No users match your current search criteria.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Activity Logs Tab */}
        {activeTab === 'activity-logs' && (
          <div className="activity-logs-section">
            <div className="page-header">
              <h1>Activity Logs</h1>
              <p>Monitor system activities and user actions</p>
            </div>
            
            {/* Action Bar */}
            <div className="action-bar">
              <div className="search-section">
                <div className="search-container">
                  <input
                    type="text"
                    placeholder="Search activity logs..."
                    value={logsSearchQuery}
                    onChange={(e) => setLogsSearchQuery(e.target.value)}
                    className="search-input"
                  />
                </div>
              </div>
              
              <div className="action-buttons">
                <button 
                  className="btn btn-secondary"
                  onClick={clearLogFilters}
                  disabled={logsSearchQuery === ''}
                >
                  Clear Filters
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={exportLogs}
                  disabled={filteredLogs.length === 0}
                >
                  Export Logs
                </button>
              </div>
            </div>
            
            {/* Messages */}
            {error && (
              <div className="alert alert-error">
                <span className="alert-message">{error}</span>
                <button onClick={clearMessages} className="alert-close">×</button>
              </div>
            )}
            
            {success && (
              <div className="alert alert-success">
                <span className="alert-message">{success}</span>
                <button onClick={clearMessages} className="alert-close">×</button>
              </div>
            )}
            
            {/* Activity Logs Table */}
            <div className="table-section">
              {isLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading activity logs...</p>
                </div>
              ) : (
                <div className="logs-table-container">
                  <table className="activity-logs-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Role</th>
                        <th>Team</th>
                        <th>Date & Time</th>
                        <th>Activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log) => (
                        <tr key={log.id} className="log-row">
                          <td>
                            <div className="user-cell">
                              <div className="user-avatar">{log.username.charAt(0).toUpperCase()}</div>
                              <span className="user-name">{log.username}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`role-badge ${log.role.toLowerCase().replace(' ', '-')}`}>
                              {log.role}
                            </span>
                          </td>
                          <td>
                            <span className="team-badge">{log.team}</span>
                          </td>
                          <td>
                            <div className="datetime-cell">
                              <div className="date">{new Date(log.timestamp).toLocaleDateString()}</div>
                              <div className="time">{new Date(log.timestamp).toLocaleTimeString()}</div>
                            </div>
                          </td>
                          <td>
                            <div className="activity-cell">{log.activity}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {!isLoading && filteredLogs.length === 0 && (
                <div className="empty-state">
                  <h3>No activity logs found</h3>
                  <p>No activity logs match your current search criteria.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="settings-section">
            <div className="page-header">
              <h1>System Settings</h1>
              <p>Configure system preferences, security, and administrative options</p>
            </div>
            
            {/* Messages */}
            {error && (
              <div className="alert alert-error">
                <span className="alert-message">{error}</span>
                <button onClick={clearMessages} className="alert-close">×</button>
              </div>
            )}
            
            {success && (
              <div className="alert alert-success">
                <span className="alert-message">{success}</span>
                <button onClick={clearMessages} className="alert-close">×</button>
              </div>
            )}
            
            <div className="settings-grid">
              {/* System Settings */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-icon system-icon">SY</div>
                  <h3>System Configuration</h3>
                </div>
                <div className="settings-card-body">
                  <div className="form-group">
                    <label>Site Name</label>
                    <input
                      type="text"
                      value={settings.system.siteName}
                      onChange={(e) => handleSettingsChange('system', 'siteName', e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Site Description</label>
                    <textarea
                      value={settings.system.siteDescription}
                      onChange={(e) => handleSettingsChange('system', 'siteDescription', e.target.value)}
                      className="form-textarea"
                      rows="3"
                    />
                  </div>
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings.system.maintenanceMode}
                        onChange={(e) => handleSettingsChange('system', 'maintenanceMode', e.target.checked)}
                        className="form-checkbox"
                      />
                      <span>Maintenance Mode</span>
                    </label>
                    <p className="help-text">Enable maintenance mode to prevent user access</p>
                  </div>
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings.system.debugMode}
                        onChange={(e) => handleSettingsChange('system', 'debugMode', e.target.checked)}
                        className="form-checkbox"
                      />
                      <span>Debug Mode</span>
                    </label>
                    <p className="help-text">Enable detailed logging and error reporting</p>
                  </div>
                </div>
              </div>
              
              {/* Security Settings */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-icon security-icon">SE</div>
                  <h3>Security & Authentication</h3>
                </div>
                <div className="settings-card-body">
                  <div className="form-group">
                    <label>Session Timeout (minutes)</label>
                    <input
                      type="number"
                      value={settings.security.sessionTimeout}
                      onChange={(e) => handleSettingsChange('security', 'sessionTimeout', parseInt(e.target.value))}
                      min="5"
                      max="1440"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Minimum Password Length</label>
                    <input
                      type="number"
                      value={settings.security.passwordMinLength}
                      onChange={(e) => handleSettingsChange('security', 'passwordMinLength', parseInt(e.target.value))}
                      min="4"
                      max="50"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Max Login Attempts</label>
                    <input
                      type="number"
                      value={settings.security.maxLoginAttempts}
                      onChange={(e) => handleSettingsChange('security', 'maxLoginAttempts', parseInt(e.target.value))}
                      min="1"
                      max="20"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings.security.requireTwoFactor}
                        onChange={(e) => handleSettingsChange('security', 'requireTwoFactor', e.target.checked)}
                        className="form-checkbox"
                      />
                      <span>Require Two-Factor Authentication</span>
                    </label>
                    <p className="help-text">Require 2FA for all admin accounts</p>
                  </div>
                </div>
              </div>
              
              {/* Notifications */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-icon notifications-icon">NO</div>
                  <h3>Notifications</h3>
                </div>
                <div className="settings-card-body">
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings.notifications.emailNotifications}
                        onChange={(e) => handleSettingsChange('notifications', 'emailNotifications', e.target.checked)}
                        className="form-checkbox"
                      />
                      <span>Email Notifications</span>
                    </label>
                  </div>
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings.notifications.loginAlerts}
                        onChange={(e) => handleSettingsChange('notifications', 'loginAlerts', e.target.checked)}
                        className="form-checkbox"
                      />
                      <span>Login Alerts</span>
                    </label>
                    <p className="help-text">Notify on suspicious login activities</p>
                  </div>
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings.notifications.userRegistrationAlerts}
                        onChange={(e) => handleSettingsChange('notifications', 'userRegistrationAlerts', e.target.checked)}
                        className="form-checkbox"
                      />
                      <span>User Registration Alerts</span>
                    </label>
                  </div>
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings.notifications.systemAlerts}
                        onChange={(e) => handleSettingsChange('notifications', 'systemAlerts', e.target.checked)}
                        className="form-checkbox"
                      />
                      <span>System Alerts</span>
                    </label>
                    <p className="help-text">Notify on system errors and warnings</p>
                  </div>
                </div>
              </div>
              
              {/* Backup Settings */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-icon backup-icon">BA</div>
                  <h3>Backup & Maintenance</h3>
                </div>
                <div className="settings-card-body">
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings.backup.autoBackup}
                        onChange={(e) => handleSettingsChange('backup', 'autoBackup', e.target.checked)}
                        className="form-checkbox"
                      />
                      <span>Automatic Backups</span>
                    </label>
                  </div>
                  <div className="form-group">
                    <label>Backup Frequency</label>
                    <select
                      value={settings.backup.backupFrequency}
                      onChange={(e) => handleSettingsChange('backup', 'backupFrequency', e.target.value)}
                      className="form-select"
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Retention Period (days)</label>
                    <input
                      type="number"
                      value={settings.backup.retentionDays}
                      onChange={(e) => handleSettingsChange('backup', 'retentionDays', parseInt(e.target.value))}
                      min="1"
                      max="365"
                      className="form-input"
                    />
                  </div>
                  <div className="backup-actions">
                    <button 
                      className="btn btn-secondary"
                      onClick={handleExportDatabase}
                    >
                      Export Database
                    </button>
                    <button 
                      className="btn btn-danger"
                      onClick={handleResetDatabase}
                    >
                      Reset Database
                    </button>
                  </div>
                </div>
              </div>
              
              {/* System Information */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-icon info-icon">IN</div>
                  <h3>System Information</h3>
                </div>
                <div className="settings-card-body">
                  <div className="system-info">
                    <div className="info-row">
                      <span className="info-label">Application Version:</span>
                      <span className="info-value">v2.0.0</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Database Version:</span>
                      <span className="info-value">SQLite 3.45.0</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Node.js Version:</span>
                      <span className="info-value">{typeof process !== 'undefined' ? process.version : 'v20.x.x'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Uptime:</span>
                      <span className="info-value">2 days, 14 hours</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Total Users:</span>
                      <span className="info-value">{users.length}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Active Sessions:</span>
                      <span className="info-value">5</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Application Settings */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-icon app-icon">AP</div>
                  <h3>Application Settings</h3>
                </div>
                <div className="settings-card-body">
                  <div className="form-group">
                    <label>Theme Preference</label>
                    <select className="form-select">
                      <option value="auto">Auto (System)</option>
                      <option value="light">Light Mode</option>
                      <option value="dark">Dark Mode</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Date Format</label>
                    <select className="form-select">
                      <option value="US">MM/DD/YYYY</option>
                      <option value="EU">DD/MM/YYYY</option>
                      <option value="ISO">YYYY-MM-DD</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Time Zone</label>
                    <select className="form-select">
                      <option value="UTC">UTC</option>
                      <option value="local">Local Time</option>
                      <option value="PST">Pacific Time</option>
                      <option value="EST">Eastern Time</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Save Settings Action */}
            <div className="settings-actions">
              <button 
                className="btn btn-primary btn-large"
                onClick={handleSaveSettings}
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : 'Save All Settings'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New User</h3>
              <button onClick={() => setShowAddModal(false)} className="modal-close">×</button>
            </div>
            <form onSubmit={handleAddUser}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={e => setFormData({...formData, fullName: e.target.value})}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Username *</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={e => setFormData({...formData, username: e.target.value})}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Password *</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      required
                      minLength="6"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Role *</label>
                    <select
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value})}
                      className="form-select"
                    >
                      <option value="USER">User</option>
                      <option value="TEAM LEADER">Team Leader</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Team</label>
                    <input
                      type="text"
                      value={formData.team}
                      onChange={e => setFormData({...formData, team: e.target.value})}
                      placeholder="General"
                      className="form-input"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)} 
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit User</h3>
              <button onClick={() => setShowEditModal(false)} className="modal-close">×</button>
            </div>
            <form onSubmit={handleEditUser}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={e => setFormData({...formData, fullName: e.target.value})}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Username *</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={e => setFormData({...formData, username: e.target.value})}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Role *</label>
                    <select
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value})}
                      className="form-select"
                    >
                      <option value="USER">User</option>
                      <option value="TEAM LEADER">Team Leader</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Team</label>
                    <input
                      type="text"
                      value={formData.team}
                      onChange={e => setFormData({...formData, team: e.target.value})}
                      placeholder="General"
                      className="form-input"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={() => setShowEditModal(false)} 
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Updating...' : 'Update User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reset Password</h3>
              <button onClick={() => setShowPasswordModal(false)} className="modal-close">×</button>
            </div>
            <form onSubmit={handleResetPassword}>
              <div className="modal-body">
                <div className="form-group">
                  <label>User: <strong>{selectedUser.fullName} ({selectedUser.username})</strong></label>
                </div>
                <div className="form-group">
                  <label>New Password *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    required
                    minLength="6"
                    placeholder="Enter new password"
                    className="form-input"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={() => setShowPasswordModal(false)} 
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard