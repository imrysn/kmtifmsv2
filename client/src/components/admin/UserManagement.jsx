import { useState, useEffect, useMemo, useCallback } from 'react'
import { API_BASE_URL } from '@/config/api'
import './UserManagement.css'
import { SkeletonLoader } from '../common/SkeletonLoader'
import { useAuth, useNetwork } from '../../contexts'
import { usePagination } from '../../hooks'
import { withErrorBoundary } from '../common'

// Sub-components
import UserFilters from './subcomponents/UserFilters'
import UserTable from './subcomponents/UserTable'
import UserModals from './subcomponents/UserModals'

const UserManagement = ({ clearMessages, error, success, setError, setSuccess, user, contextData }) => {
  const { user: authUser } = useAuth()
  const { isConnected } = useNetwork()

  const [users, setUsers] = useState([])
  const [teams, setTeams] = useState([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
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
    team: ''
  })

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

  // Use pagination hook
  const {
    currentPage,
    totalPages,
    paginatedItems: paginatedUsers,
    startIndex,
    endIndex,
    goToPage,
    nextPage,
    prevPage,
    resetPagination
  } = usePagination(filteredUsers, 9)

  // Memoized active teams
  const activeTeams = useMemo(() =>
    teams.filter(team => team.is_active),
    [teams]
  )

  // Fetch functions with proper dependencies
  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/users`)
      const data = await response.json()
      if (data.success) {
        setUsers(data.users)
        resetPagination() // Reset to first page when users are refetched
      } else {
        setError('Failed to fetch users')
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      setError('Failed to connect to server')
    } finally {
      setIsLoading(false)
    }
  }, [setError, resetPagination])

  const fetchTeams = useCallback(async () => {
    setTeamsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/teams`)
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

  // Fetch users and teams ONCE on mount
  useEffect(() => {
    fetchUsers()
    fetchTeams()
  }, [fetchUsers, fetchTeams])

  const openPasswordModal = useCallback((user) => {
    setError('')
    setSuccess('')
    setSelectedUser(user)
    setFormData(prev => ({ ...prev, password: '' }))
    setShowPasswordModal(true)
  }, [setError, setSuccess])

  // Handle context data from notifications (e.g., password reset request)
  useEffect(() => {
    if (contextData && contextData.action === 'reset-password' && contextData.userId) {
      console.log('Opening password reset modal for user:', contextData);

      // Find the user by ID
      const targetUser = users.find(u => u.id === contextData.userId);

      if (targetUser) {
        // Open password reset modal for this user
        openPasswordModal(targetUser);

        // Optionally show a success message
        setSuccess(`Password reset request from ${contextData.username || targetUser.username}`);

        // Scroll to the user in the list if possible
        setTimeout(() => {
          const userRow = document.querySelector(`[data-user-id="${contextData.userId}"]`);
          if (userRow) {
            userRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            userRow.classList.add('highlight-user');
            setTimeout(() => userRow.classList.remove('highlight-user'), 2000);
          }
        }, 300);
      } else {
        setError('User not found. They may have been deleted.');
      }
    }
  }, [contextData, users, setSuccess, setError, openPasswordModal]);

  const handleAddUser = useCallback(async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          adminId: authUser.id,
          adminUsername: authUser.username,
          adminRole: authUser.role,
          adminTeam: authUser.team
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
  }, [formData, authUser, setError, setSuccess, fetchUsers])

  const handleEditUser = useCallback(async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          username: formData.username,
          email: formData.email,
          role: formData.role,
          team: formData.team,
          adminId: authUser.id,
          adminUsername: authUser.username,
          adminRole: authUser.role,
          adminTeam: authUser.team
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
  }, [formData, selectedUser, authUser, setError, setSuccess, fetchUsers])

  const handleResetPassword = useCallback(async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${selectedUser.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: formData.password,
          adminId: authUser.id,
          adminUsername: authUser.username,
          adminRole: authUser.role,
          adminTeam: authUser.team
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
  }, [formData.password, selectedUser, authUser, setError, setSuccess])

  const handleDeleteUser = useCallback(async () => {
    if (!userToDelete) return

    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: authUser.id,
          adminUsername: authUser.username,
          adminRole: authUser.role,
          adminTeam: authUser.team
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
  }, [userToDelete, authUser, setError, setSuccess, fetchUsers])

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
    resetPagination() // Reset to first page when search changes
  }, [resetPagination])

  // Show skeleton loader when network is not available
  if (!isConnected) {
    return <SkeletonLoader type="table" />
  }

  return (
    <div className={`users-management ${isLoading ? 'loading-cursor' : ''}`}>
      <UserFilters
        searchQuery={searchQuery}
        handleSearchChange={handleSearchChange}
        openAddModal={openAddModal}
      />

      <UserTable
        paginatedUsers={paginatedUsers}
        isLoading={isLoading}
        filteredUsers={filteredUsers}
        startIndex={startIndex}
        endIndex={endIndex}
        currentPage={currentPage}
        totalPages={totalPages}
        prevPage={prevPage}
        nextPage={nextPage}
        goToPage={goToPage}
        openPasswordModal={openPasswordModal}
        openEditModal={openEditModal}
        openUserDeleteModal={openUserDeleteModal}
      />

      <UserModals
        error={error}
        success={success}
        clearMessages={clearMessages}
        showAddModal={showAddModal}
        setShowAddModal={setShowAddModal}
        handleAddUser={handleAddUser}
        formData={formData}
        handleFormChange={handleFormChange}
        isLoading={isLoading}
        activeTeams={activeTeams}
        teamsLoading={teamsLoading}
        showEditModal={showEditModal}
        setShowEditModal={setShowEditModal}
        handleEditUser={handleEditUser}
        selectedUser={selectedUser}
        showPasswordModal={showPasswordModal}
        setShowPasswordModal={setShowPasswordModal}
        handleResetPassword={handleResetPassword}
        showUserDeleteModal={showUserDeleteModal}
        setShowUserDeleteModal={setShowUserDeleteModal}
        handleDeleteUser={handleDeleteUser}
        userToDelete={userToDelete}
      />
    </div>
  )
}

export default withErrorBoundary(UserManagement, {
  componentName: 'User Management'
})
