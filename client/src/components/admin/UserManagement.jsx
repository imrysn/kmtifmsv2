import { useState, useEffect, useMemo, useCallback } from 'react'
import './UserManagement.css'
import { AlertMessage, ConfirmationModal, FormModal } from './modals'
import { SkeletonLoader } from '../common/SkeletonLoader'
import ErrorBoundary from '../ErrorBoundary'

const UserManagement = ({ clearMessages, error, success, setError, setSuccess, user }) => {
  const [users, setUsers] = useState([])
  const [teams, setTeams] = useState([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [networkAvailable, setNetworkAvailable] = useState(true)
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
    team: ''
  })

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 9

  // Memoized filtered and sorted users for better performance
  const filteredUsers = useMemo(() => {
    let filtered = users
    
    // Filter by search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase()
      filtered = users.filter(u =>
        u.fullName.toLowerCase().includes(query) ||
        u.username.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.role.toLowerCase().includes(query) ||
        (u.team && u.team.toLowerCase().includes(query))
      )
    }
    
    // Sort by created_at (oldest first)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.created_at || 0)
      const dateB = new Date(b.created_at || 0)
      return dateA - dateB // Ascending order (oldest first)
    })
  }, [searchQuery, users])

  // Pagination calculations
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredUsers.slice(startIndex, endIndex)
  }, [filteredUsers, currentPage, itemsPerPage])

  // Memoized active teams
  const activeTeams = useMemo(() => 
    teams.filter(team => team.is_active),
    [teams]
  )

  // Fetch functions with proper dependencies
  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('http://localhost:3001/api/users')
      const data = await response.json()
      if (data.success) {
        setUsers(data.users)
        setCurrentPage(1) // Reset to first page when users are refetched
      } else {
        setError('Failed to fetch users')
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      setError('Failed to connect to server')
    } finally {
      setIsLoading(false)
    }
  }, [setError])

  const fetchTeams = useCallback(async () => {
    setTeamsLoading(true)
    try {
      const response = await fetch('http://localhost:3001/api/teams')
      const data = await response.json()
      if (data.success) {
        setTeams(data.teams || [])
      }
    } catch (error) {
      console.error('Error fetching teams:', error)
    } finally {
      setTeamsLoading(false)
    }
  }, [])

  // Check network availability on mount only
  useEffect(() => {
    const checkNetwork = async () => {
      try {
        await fetch('http://localhost:3001/api/health')
        setNetworkAvailable(true)
      } catch {
        setNetworkAvailable(false)
      }
    }

    checkNetwork()
    const interval = setInterval(checkNetwork, 30000)
    return () => clearInterval(interval)
  }, [])

  // Fetch users and teams ONCE on mount
  useEffect(() => {
    fetchUsers()
    fetchTeams()
  }, [fetchUsers, fetchTeams])

  const handleAddUser = useCallback(async (e) => {
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
          team: '' 
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
  }, [formData, user, setError, setSuccess, fetchUsers])

  const handleEditUser = useCallback(async (e) => {
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
  }, [formData, selectedUser, user, setError, setSuccess, fetchUsers])

  const handleResetPassword = useCallback(async (e) => {
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
        setFormData(prev => ({ ...prev, password: '' }))
      } else {
        setError(data.message)
      }
    } catch (error) {
      setError('Failed to reset password')
    } finally {
      setIsLoading(false)
    }
  }, [formData.password, selectedUser, user, setError, setSuccess])

  const handleDeleteUser = useCallback(async () => {
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
  }, [userToDelete, user, setError, setSuccess, fetchUsers])

  const openEditModal = useCallback((user) => {
    setError('')
    setSuccess('')
    setSelectedUser(user)
    setFormData({
      fullName: user.fullName || '',
      username: user.username || '',
      email: user.email || '',
      password: '',
      role: user.role || 'USER',
      team: user.team || ''
    })
    setShowEditModal(true)
  }, [setError, setSuccess])

  const openPasswordModal = useCallback((user) => {
    setError('')
    setSuccess('')
    setSelectedUser(user)
    setFormData(prev => ({ ...prev, password: '' }))
    setShowPasswordModal(true)
  }, [setError, setSuccess])

  const openUserDeleteModal = useCallback((user) => {
    setUserToDelete(user)
    setShowUserDeleteModal(true)
  }, [])

  const openAddModal = useCallback(() => {
    setError('')
    setSuccess('')
    setSelectedUser(null)
    setFormData({ 
      fullName: '', 
      username: '', 
      email: '', 
      password: '', 
      role: 'USER', 
      team: '' 
    })
    setShowAddModal(true)
  }, [setError, setSuccess])

  const handleFormChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleSearchChange = useCallback((e) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1) // Reset to first page when search changes
  }, [])

  // Pagination handlers
  const handlePageChange = useCallback((page) => {
    setCurrentPage(page)
  }, [])

  const handlePrevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(1, prev - 1))
  }, [])

  const handleNextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1))
  }, [])

  // Show skeleton loader when network is not available
  if (!networkAvailable) {
    return <SkeletonLoader type="table" />
  }

  return (
    <div className={`users-management ${isLoading ? 'loading-cursor' : ''}`}>
      
      {/* Action Bar */}
      <div className="action-bar">
        <div className="search-section">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search users by name, email, role, or team..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="search-input"
            />
          </div>
        </div>
        
        <div className="action-buttons">
          <button 
            className="btn btn-primary"
            onClick={openAddModal}
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
                {paginatedUsers.map((userData) => {
                  const roleClass = userData.role.toLowerCase().replace(' ', '-')
                  return (
                    <tr key={userData.id} className="user-row">
                      <td>
                        <div className="user-cell">
                          <span className="user-name">
                            {userData.fullName}
                          </span>
                        </div>
                      </td>
                      <td>{userData.username}</td>
                      <td className="email-cell">{userData.email}</td>
                      <td>
                        <div className="password-cell">
                          <span className="password-hidden">••••••••</span>
                          <button
                            className="password-reset-btn"
                            onClick={() => openPasswordModal(userData)}
                            title="Reset Password"
                          >
                            Reset
                          </button>
                        </div>
                      </td>
                      <td>
                        <span className={`role-badge ${roleClass}`}>
                          {userData.role}
                        </span>
                      </td>
                      <td>
                        <span className="team-badge">
                          {userData.team || '—'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="action-btn edit-btn"
                            onClick={() => openEditModal(userData)}
                            title="Edit User"
                          >
                            Edit
                          </button>
                          <button
                            className="action-btn delete-btn"
                            onClick={() => openUserDeleteModal(userData)}
                            title="Delete User"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
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

        {/* Pagination Controls */}
        {!isLoading && totalPages > 1 && (
          <div className="pagination-container">
            <div className="pagination-info">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length} users
            </div>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                title="Previous Page"
              >
                ‹
              </button>

              <div className="pagination-numbers">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }

                  return (
                    <button
                      key={pageNum}
                      className={`pagination-number ${currentPage === pageNum ? 'active' : ''}`}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>

              <button
                className="pagination-btn"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                title="Next Page"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
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
                onChange={e => handleFormChange('fullName', e.target.value)}
                required
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Username *</label>
              <input
                type="text"
                value={formData.username}
                onChange={e => handleFormChange('username', e.target.value)}
                required
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => handleFormChange('email', e.target.value)}
                required
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Password *</label>
              <input
                type="password"
                value={formData.password}
                onChange={e => handleFormChange('password', e.target.value)}
                required
                minLength="6"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Role *</label>
              <select
                value={formData.role}
                onChange={e => handleFormChange('role', e.target.value)}
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
                onChange={e => handleFormChange('team', e.target.value)}
                className="form-select"
                disabled={teamsLoading}
              >
                <option value="">Select Team</option>
                {activeTeams.map(team => (
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
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <FormModal
          isOpen={showEditModal}
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
                onChange={e => handleFormChange('fullName', e.target.value)}
                required
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Username *</label>
              <input
                type="text"
                value={formData.username}
                onChange={e => handleFormChange('username', e.target.value)}
                required
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => handleFormChange('email', e.target.value)}
                required
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Role *</label>
              <select
                value={formData.role}
                onChange={e => handleFormChange('role', e.target.value)}
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
                onChange={e => handleFormChange('team', e.target.value)}
                className="form-select"
                disabled={teamsLoading}
              >
                <option value="">Select Team</option>
                {activeTeams.map(team => (
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
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && selectedUser && (
        <FormModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
          onSubmit={handleResetPassword}
          title="Reset Password"
          submitText="Reset Password"
          isLoading={isLoading}
          size="small"
        >
          <div className="form-group">
            <label>User: <strong>{selectedUser.fullName} ({selectedUser.username})</strong></label>
          </div>
          <div className="form-group">
            <label>New Password *</label>
            <input
              type="password"
              value={formData.password}
              onChange={e => handleFormChange('password', e.target.value)}
              required
              minLength="6"
              placeholder="Enter new password"
              className="form-input"
            />
          </div>
        </FormModal>
      )}

      {/* User Delete Confirmation Modal */}
      {showUserDeleteModal && userToDelete && (
        <ConfirmationModal
          isOpen={showUserDeleteModal}
          onClose={() => setShowUserDeleteModal(false)}
          onConfirm={handleDeleteUser}
          title="Delete User"
          message="Are you sure you want to delete this user?"
          confirmText="Delete User"
          variant="danger"
          isLoading={isLoading}
        >
          <p className="confirmation-description">
            <strong>{userToDelete.fullName}</strong>
          </p>
          <p className="confirmation-description" style={{ marginTop: '0.5rem' }}>
            This action cannot be undone. The user account and all associated data will be permanently removed from the system.
          </p>
        </ConfirmationModal>
      )}

    </div>
  )
}

// Wrap component with ErrorBoundary
const UserManagementWithErrorBoundary = (props) => (
  <ErrorBoundary>
    <UserManagement {...props} />
  </ErrorBoundary>
)

export default UserManagementWithErrorBoundary
