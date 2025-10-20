import { useState, useEffect } from 'react'
import './UserManagement.css'
import { AlertMessage, ConfirmationModal, FormModal } from './modals'
import ErrorBoundary from '../ErrorBoundary'

const UserManagement = ({ clearMessages, error, success, setError, setSuccess, user }) => {
  const [users, setUsers] = useState([])
  const [teams, setTeams] = useState([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredUsers, setFilteredUsers] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showUserDeleteModal, setShowUserDeleteModal] = useState(false)
  const [userToDelete, setUserToDelete] = useState(null)
  const [showUserDetailsModal, setShowUserDetailsModal] = useState(false)
  const [userDetails, setUserDetails] = useState({
    user: null,
    files: [],
    pendingFiles: [],
    isLoadingDetails: false
  })
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
    fetchTeams()
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

  const fetchTeams = async () => {
    setTeamsLoading(true)
    try {
      const response = await fetch('http://localhost:3001/api/teams')
      const data = await response.json()
      if (data.success) {
        setTeams(data.teams || [])
      } else {
        console.error('Failed to fetch teams')
      }
    } catch (error) {
      console.error('Error fetching teams:', error)
    } finally {
      setTeamsLoading(false)
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
        body: JSON.stringify({
          ...formData,
          adminId: user.id,
          adminUsername: user.username,
          adminRole: user.role,
          adminTeam: user.team
        })
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
          team: formData.team,
          adminId: user.id,
          adminUsername: user.username,
          adminRole: user.role,
          adminTeam: user.team
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
        body: JSON.stringify({ 
          password: formData.password,
          adminId: user.id,
          adminUsername: user.username,
          adminRole: user.role,
          adminTeam: user.team
        })
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
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: user.id,
          adminUsername: user.username,
          adminRole: user.role,
          adminTeam: user.team
        })
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

  const fetchUserDetails = async (userId) => {
    setUserDetails(prev => ({ ...prev, isLoadingDetails: true }))
    
    try {
      // Fetch user files
      const filesResponse = await fetch(`http://localhost:3001/api/files/user/${userId}`)
      const filesData = await filesResponse.json()
      
      // Fetch pending files (files with status != 'APPROVED')
      const pendingResponse = await fetch(`http://localhost:3001/api/files/user/${userId}/pending`)
      const pendingData = await pendingResponse.json()
      
      setUserDetails(prev => ({
        ...prev,
        files: filesData.success ? filesData.files : [],
        pendingFiles: pendingData.success ? pendingData.files : [],
        isLoadingDetails: false
      }))
    } catch (error) {
      console.error('Error fetching user details:', error)
      setUserDetails(prev => ({
        ...prev,
        files: [],
        pendingFiles: [],
        isLoadingDetails: false
      }))
    }
  }

  const openUserDetailsModal = async (user) => {
    setError('')
    setSuccess('')
    setUserDetails({
      user: user,
      files: [],
      pendingFiles: [],
      isLoadingDetails: true
    })
    setShowUserDetailsModal(true)
    
    // Fetch user details
    await fetchUserDetails(user.id)
  }

  return (
    <div className="users-management">
      
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
        <AlertMessage 
          type="error" 
          message={error} 
          onClose={clearMessages}
        />
      )}
      
      {success && (
        <AlertMessage 
          type="success" 
          message={success} 
          onClose={clearMessages}
        />
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
                        <span 
                          className="user-name clickable" 
                          onClick={() => openUserDetailsModal(user)}
                          title="View user details, files, and pending files"
                        >
                          {user.fullName}
                        </span>
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
                      <span className="team-badge">
                        {user.team}
                      </span>
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
      <FormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddUser}
        title="Add New User"
        submitText="Create User"
        isLoading={isLoading}
        size="medium"
      >
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
                    <select
                      value={formData.team}
                      onChange={e => setFormData({...formData, team: e.target.value})}
                      className="form-select"
                      disabled={teamsLoading}
                    >
                      <option value="General">General</option>
                      {teams.filter(team => team.is_active).map(team => (
                        <option key={team.id} value={team.name}>
                          {team.name}
                          {team.leader_username && ` (Led by ${team.leader_username})`}
                        </option>
                      ))}
                    </select>
                    {teamsLoading && <p className="help-text">Loading teams...</p>}
                  </div>
                </div>
      </FormModal>

      {/* Edit User Modal */}
      <FormModal
        isOpen={showEditModal && selectedUser}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleEditUser}
        title="Edit User"
        submitText="Update User"
        isLoading={isLoading}
        size="medium"
      >
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
                    <select
                      value={formData.team}
                      onChange={e => setFormData({...formData, team: e.target.value})}
                      className="form-select"
                      disabled={teamsLoading}
                    >
                      <option value="General">General</option>
                      {teams.filter(team => team.is_active).map(team => (
                        <option key={team.id} value={team.name}>
                          {team.name}
                          {team.leader_username && ` (Led by ${team.leader_username})`}
                        </option>
                      ))}
                    </select>
                    {teamsLoading && <p className="help-text">Loading teams...</p>}
                  </div>
                </div>
      </FormModal>

      {/* Reset Password Modal */}
      <FormModal
        isOpen={showPasswordModal && selectedUser}
        onClose={() => setShowPasswordModal(false)}
        onSubmit={handleResetPassword}
        title="Reset Password"
        submitText="Reset Password"
        isLoading={isLoading}
        size="small"
      >
        {selectedUser && (
          <>
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
          </>
        )}
      </FormModal>

      {/* User Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showUserDeleteModal && userToDelete}
        onClose={() => setShowUserDeleteModal(false)}
        onConfirm={handleDeleteUser}
        title="Delete User"
        message="Are you sure you want to delete this user?"
        confirmText="Delete User"
        variant="danger"
        isLoading={isLoading}
      >
        {userToDelete && (
          <>
            <p className="confirmation-description">
              <strong>{userToDelete.fullName}</strong>
            </p>
            <p className="confirmation-description" style={{ marginTop: '0.5rem' }}>
              This action cannot be undone. The user account and all associated data will be permanently removed from the system.
            </p>
          </>
        )}
      </ConfirmationModal>

      {/* User Details Modal */}
      {showUserDetailsModal && userDetails.user && (
        <div className="modal-overlay">
          <div className="modal user-details-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>User Details</h3>
              <button onClick={() => setShowUserDetailsModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="user-details-content">
                {/* User Information */}
                <div className="user-info-section">
                  <div className="section-header">
                    <div className="user-header">
                      <div className="user-avatar-large">
                        {userDetails.user.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="user-info">
                        <h4 className="user-full-name">{userDetails.user.fullName}</h4>
                        <p className="user-subtitle">{userDetails.user.username} • {userDetails.user.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="user-details-grid">
                    <div className="detail-item">
                      <label>Role</label>
                      <span className={`role-badge ${userDetails.user.role.toLowerCase().replace(' ', '-')}`}>
                        {userDetails.user.role}
                      </span>
                    </div>
                    <div className="detail-item">
                      <label>Team</label>
                      <span className="team-badge">
                        {userDetails.user.team}
                      </span>
                    </div>
                    <div className="detail-item">
                      <label>Account Status</label>
                      <span className="status-badge active">Active</span>
                    </div>
                  </div>
                </div>

                {/* Files Section */}
                <div className="files-section">
                  <div className="section-header">
                    <h5>All Files ({userDetails.isLoadingDetails ? '...' : userDetails.files.length})</h5>
                  </div>
                  <div className="files-list">
                    {userDetails.isLoadingDetails ? (
                      <div className="loading-files">
                        <div className="spinner-small"></div>
                        <span>Loading files...</span>
                      </div>
                    ) : userDetails.files.length > 0 ? (
                      userDetails.files.map((file) => (
                        <div key={file.id} className="file-item">
                          <div className="file-info">
                            <div className="file-name">{file.filename}</div>
                            <div className="file-meta">
                              <span className="file-size">{formatFileSize(file.size)}</span>
                              <span className="file-date">{formatDate(file.uploadedAt)}</span>
                              <span className={`status-badge ${file.status.toLowerCase()}`}>
                                {file.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-files">
                        <p>No files uploaded yet</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pending Files Section */}
                <div className="pending-files-section">
                  <div className="section-header">
                    <h5>Pending Files ({userDetails.isLoadingDetails ? '...' : userDetails.pendingFiles.length})</h5>
                  </div>
                  <div className="files-list">
                    {userDetails.isLoadingDetails ? (
                      <div className="loading-files">
                        <div className="spinner-small"></div>
                        <span>Loading pending files...</span>
                      </div>
                    ) : userDetails.pendingFiles.length > 0 ? (
                      userDetails.pendingFiles.map((file) => (
                        <div key={file.id} className="file-item pending">
                          <div className="file-info">
                            <div className="file-name">{file.filename}</div>
                            <div className="file-meta">
                              <span className="file-size">{formatFileSize(file.size)}</span>
                              <span className="file-date">{formatDate(file.uploadedAt)}</span>
                              <span className={`status-badge ${file.status.toLowerCase()}`}>
                                {file.status}
                              </span>
                            </div>
                          </div>
                          {file.comments && file.comments.length > 0 && (
                            <div className="file-comments">
                              <div className="comments-label">Latest Comment:</div>
                              <div className="comment-text">{file.comments[file.comments.length - 1].comment}</div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="empty-files">
                        <p>No pending files</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                onClick={() => setShowUserDetailsModal(false)} 
                className="btn btn-secondary"
              >
                Close
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setShowUserDetailsModal(false)
                  openEditModal(userDetails.user)
                }}
                className="btn btn-primary"
              >
                Edit User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Utility functions for formatting
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Wrap component with ErrorBoundary
const UserManagementWithErrorBoundary = (props) => (
  <ErrorBoundary>
    <UserManagement {...props} />
  </ErrorBoundary>
)

export default UserManagementWithErrorBoundary
