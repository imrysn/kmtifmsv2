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