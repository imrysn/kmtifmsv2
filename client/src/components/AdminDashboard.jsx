import { useState, useEffect } from 'react'
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
    <div className="admin-dashboard">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>👨‍💼 Admin Panel</h2>
          <div className="user-info">
            <p className="user-name">{user.fullName || 'Administrator'}</p>
            <p className="user-role">{user.role}</p>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => { 
              setActiveTab('dashboard'); 
              clearMessages(); 
            }}
          >
            <span className="nav-icon">📊</span>
            Dashboard
          </button>
          <button 
            className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => { 
              setActiveTab('users'); 
              clearMessages(); 
            }}
          >
            <span className="nav-icon">👥</span>
            User Management
          </button>
          <button 
            className={`nav-item ${activeTab === 'activity-logs' ? 'active' : ''}`}
            onClick={() => { 
              setActiveTab('activity-logs'); 
              clearMessages(); 
            }}
          >
            <span className="nav-icon">📋</span>
            Activity Logs
          </button>
        </nav>
        
        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-btn">
            <span className="nav-icon">🚪</span>
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="dashboard-tab">
            <div className="page-header">
              <h1>Dashboard Overview</h1>
              <p>Welcome back, {user.fullName || 'Administrator'}!</p>
            </div>
            
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-info">
                  <h3>{users.length}</h3>
                  <p>Total Users</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">👨‍💼</div>
                <div className="stat-info">
                  <h3>{users.filter(u => u.role === 'ADMIN').length}</h3>
                  <p>Admins</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">👨‍👥</div>
                <div className="stat-info">
                  <h3>{users.filter(u => u.role === 'TEAM LEADER').length}</h3>
                  <p>Team Leaders</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">👤</div>
                <div className="stat-info">
                  <h3>{users.filter(u => u.role === 'USER').length}</h3>
                  <p>Users</p>
                </div>
              </div>
            </div>
            
            <div className="welcome-section">
              <h2>System Administration</h2>
              <p>Use the sidebar navigation to access different administrative functions:</p>
              <ul>
                <li><strong>User Management:</strong> Create, edit, and manage user accounts</li>
                <li><strong>Role Assignment:</strong> Assign appropriate roles to users</li>
                <li><strong>Password Management:</strong> Reset user passwords when needed</li>
              </ul>
            </div>
          </div>
        )}

        {/* User Management Tab */}
        {activeTab === 'users' && (
          <div className="users-tab">
            <div className="page-header">
              <h1>User Management</h1>
              <p>Manage system users, roles, and permissions</p>
            </div>
            
            {/* Action Bar */}
            <div className="action-bar">
              <div className="search-container">
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
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
                  + Add User
                </button>
              </div>
            </div>
            
            {/* Messages */}
            {error && (
              <div className="alert alert-error">
                {error}
                <button onClick={clearMessages} className="alert-close">×</button>
              </div>
            )}
            
            {success && (
              <div className="alert alert-success">
                {success}
                <button onClick={clearMessages} className="alert-close">×</button>
              </div>
            )}
            
            {/* Users Table */}
            <div className="table-container">
              {isLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading users...</p>
                </div>
              ) : (
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Full Name</th>
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
                      <tr key={user.id}>
                        <td>{user.fullName}</td>
                        <td>{user.username}</td>
                        <td>{user.email}</td>
                        <td>
                          <span className="password-hidden">••••••••</span>
                          <button 
                            className="btn-link"
                            onClick={() => openPasswordModal(user)}
                            title="Reset Password"
                          >
                            🔄
                          </button>
                        </td>
                        <td>
                          <span className={`role-badge ${user.role.toLowerCase().replace(' ', '-')}`}>
                            {user.role}
                          </span>
                        </td>
                        <td>{user.team}</td>
                        <td>
                          <div className="action-buttons">
                            <button 
                              className="btn btn-sm btn-secondary"
                              onClick={() => openEditModal(user)}
                              title="Edit User"
                            >
                              ✏️
                            </button>
                            <button 
                              className="btn btn-sm btn-danger"
                              onClick={() => handleDeleteUser(user.id, user.fullName)}
                              title="Delete User"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              
              {!isLoading && filteredUsers.length === 0 && (
                <div className="empty-state">
                  <p>No users found matching your search.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Activity Logs Tab */}
        {activeTab === 'activity-logs' && (
          <div className="activity-logs-tab">
            <div className="page-header">
              <h1>Activity Logs</h1>
              <p>Monitor system activities and user actions</p>
            </div>
            
            {/* Action Bar */}
            <div className="action-bar">
              <div className="search-container">
                <input
                  type="text"
                  placeholder="Search activity logs..."
                  value={logsSearchQuery}
                  onChange={(e) => setLogsSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
              
              <div className="action-buttons">
                <button 
                  className="btn btn-secondary"
                  onClick={clearLogFilters}
                  disabled={logsSearchQuery === ''}
                >
                  Clear Filtered
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={exportLogs}
                  disabled={filteredLogs.length === 0}
                >
                  📊 Export Logs
                </button>
              </div>
            </div>
            
            {/* Messages */}
            {error && (
              <div className="alert alert-error">
                {error}
                <button onClick={clearMessages} className="alert-close">×</button>
              </div>
            )}
            
            {success && (
              <div className="alert alert-success">
                {success}
                <button onClick={clearMessages} className="alert-close">×</button>
              </div>
            )}
            
            {/* Activity Logs Table */}
            <div className="table-container">
              {isLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading activity logs...</p>
                </div>
              ) : (
                <table className="activity-logs-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Team</th>
                      <th>Date & Time</th>
                      <th>Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{log.username}</td>
                        <td>
                          <span className={`role-badge ${log.role.toLowerCase().replace(' ', '-')}`}>
                            {log.role}
                          </span>
                        </td>
                        <td>{log.team}</td>
                        <td>
                          <div className="datetime-column">
                            <div className="date">{new Date(log.timestamp).toLocaleDateString()}</div>
                            <div className="time">{new Date(log.timestamp).toLocaleTimeString()}</div>
                          </div>
                        </td>
                        <td>
                          <div className="activity-description">{log.activity}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              
              {!isLoading && filteredLogs.length === 0 && (
                <div className="empty-state">
                  <p>No activity logs found matching your search.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New User</h3>
              <button onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddUser}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={e => setFormData({...formData, fullName: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Username *</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    required
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
                  />
                </div>
                <div className="form-group">
                  <label>Role *</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value})}
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
                  />
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
              <button onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <form onSubmit={handleEditUser}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={e => setFormData({...formData, fullName: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Username *</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Role *</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value})}
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
                  />
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
              <button onClick={() => setShowPasswordModal(false)}>×</button>
            </div>
            <form onSubmit={handleResetPassword}>
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
                />
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