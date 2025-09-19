import { useState, useEffect } from 'react'
import './UserManagement.css'

const UserManagement = ({ clearMessages, error, success, setError, setSuccess }) => {
  const [users, setUsers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredUsers, setFilteredUsers] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showUserDeleteModal, setShowUserDeleteModal] = useState(false)
  const [userToDelete, setUserToDelete] = useState(null)
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    role: 'USER',
    team: 'General'
  })

  // Fetch users on component mount
  useEffect(() => {
    fetchUsers()
  }, [])

  // Filter users when search query or users change
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

  const handleDeleteUser = async () => {
    if (!userToDelete) return
    
    setIsLoading(true)
    try {
      const response = await fetch(`http://localhost:3001/api/users/${userToDelete.id}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      if (data.success) {
        setSuccess(`User ${userToDelete.fullName} deleted successfully`)
        setShowUserDeleteModal(false)
        setUserToDelete(null)
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
    setError('')
    setSuccess('')
    setSelectedUser(user)
    setFormData({
      fullName: user.fullName || '',
      username: user.username || '',
      email: user.email || '',
      password: '',
      role: user.role || 'USER',
      team: user.team || 'General'
    })
    setShowEditModal(true)
  }

  const openPasswordModal = (user) => {
    setError('')
    setSuccess('')
    setSelectedUser(user)
    setFormData({ ...formData, password: '' })
    setShowPasswordModal(true)
  }

  const openUserDeleteModal = (user) => {
    setUserToDelete(user)
    setShowUserDeleteModal(true)
  }

  return (
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
              setError('')
              setSuccess('')
              setSelectedUser(null)
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
                          onClick={() => openUserDeleteModal(user)}
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

      {/* Add User Modal */}
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

      {/* User Delete Confirmation Modal */}
      {showUserDeleteModal && userToDelete && (
        <div className="modal-overlay" onClick={() => setShowUserDeleteModal(false)}>
          <div className="modal delete-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete User</h3>
              <button onClick={() => setShowUserDeleteModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="delete-warning">
                <div className="warning-icon">⚠️</div>
                <div className="warning-content">
                  <h4>Are you sure you want to delete this user?</h4>
                  <p className="file-info">
                    <strong>{userToDelete.fullName}</strong>
                    <br />
                    Username: <strong>{userToDelete.username}</strong>
                    <br />
                    Email: <strong>{userToDelete.email}</strong>
                    <br />
                    Role: <strong>{userToDelete.role}</strong> | Team: <strong>{userToDelete.team}</strong>
                  </p>
                  <p className="warning-text">
                    This action cannot be undone. The user account and all associated data will be permanently removed from the system.
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <div className="delete-actions">
                <button 
                  type="button" 
                  onClick={() => setShowUserDeleteModal(false)} 
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleDeleteUser}
                  className="btn btn-danger" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Deleting...' : 'Delete User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserManagement
