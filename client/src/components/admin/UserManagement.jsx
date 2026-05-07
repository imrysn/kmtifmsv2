import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { apiFetch } from '@/config/api'
import './UserManagement.css'
import { AlertMessage, ConfirmationModal, FormModal } from './modals'
import { UserPerformanceCard } from '../shared'

import { SkeletonLoader } from '../common/SkeletonLoader'
import { useAuth, useNetwork } from '../../contexts'
import { usePagination } from '../../hooks'
import { withErrorBoundary } from '../common'

/**
 * Normalise a role string from the DB into a stable CSS class name.
 * Handles both "TEAM_LEADER" (underscore) variants.
 *   "ADMIN"       → "admin"
 *   "USER"        → "user"
 *   "TEAM_LEADER" → "team-leader"
 */
const roleToClass = (role = '') =>
  role.toLowerCase().replace(/[\s_]+/g, '-')

/**
 * Normalise a role value for display.
 * Converts DB underscore format to space format for consistent UI labels.
 *   "TEAM_LEADER" → "TEAM LEADER"
 */
const roleToLabel = (role = '') =>
  role.replace(/_/g, ' ')

// Memoized row component to prevent inline function re-renders
const MemberPerfRow = React.memo(({ user, score, performanceData, onScoreLoad }) => {
  const isStar = score > 100;
  const isExcellent = score >= 85 && score <= 100;

  const handleLoad = useCallback((data) => {
    onScoreLoad(user.id, data);
  }, [user.id, onScoreLoad]);

  return (
    <div className={`member-perf-wrapper ${isStar ? 'card-star' : isExcellent ? 'card-excellent' : ''}`} style={{
      background: '#ffffff',
      border: (isStar || isExcellent) ? 'none' : '1px solid #f1f5f9',
      borderRadius: '16px',
      padding: '16px',
      boxShadow: (isStar || isExcellent) ? 'none' : '0 2px 10px rgba(0,0,0,0.02)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {isStar && (
        <div className="perf-star-badge">
          <span>TOP</span>
        </div>
      )}
      {isExcellent && (
        <div className="perf-star-badge badge-excellent">
          <span>PRO</span>
        </div>
      )}

      <div className="member-perf-header" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
        paddingLeft: '4px'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          background: isStar ? 'rgba(99, 102, 241, 0.1)' : isExcellent ? 'rgba(16, 185, 129, 0.1)' : '#f1f5f9',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: '800',
          color: isStar ? '#6366f1' : isExcellent ? '#10b981' : '#475569',
          fontSize: '13px',
          border: isStar ? '1px solid rgba(99, 102, 241, 0.2)' : isExcellent ? '1px solid rgba(16, 185, 129, 0.2)' : 'none'
        }}>
          {user.fullName.substring(0, 2).toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <h3 style={{
            fontSize: '15px',
            fontWeight: '800',
            color: '#0f172a',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>{user.fullName}</h3>
          <span style={{ fontSize: '12px', color: '#64748b' }}>{user.email}</span>
        </div>
      </div>
      <UserPerformanceCard
        user={user}
        isCollapsible={true}
        performanceData={performanceData}
        onPerformanceLoad={handleLoad}
      />
    </div>
  );
});

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
  const [showPerformanceModal, setShowPerformanceModal] = useState(false)
  const [userToDelete, setUserToDelete] = useState(null)
  const [viewMode, setViewMode] = useState('performance') // 'performance' by default
  const [sortBy, setSortBy] = useState('performance-desc') // 'performance-desc' by default
  const [memberScores, setMemberScores] = useState({})
  const [bulkPerformance, setBulkPerformance] = useState({})
  const [isBulkLoading, setIsBulkLoading] = useState(false)

  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    role: 'USER',
    team: ''
  })

  // Track performance scores to determine framing (Star/Excellent)
  const handleScoreLoad = useCallback((userId, data) => {
    setMemberScores(prev => {
      if (prev[userId] === data.overallScore) return prev;
      return { ...prev, [userId]: data.overallScore };
    });
  }, []);

  const fetchBulkPerformance = useCallback(async () => {
    // Only fetch if not already loading
    setIsBulkLoading(true);
    try {
      const data = await apiFetch('/api/dashboard/bulk-performance');
      if (data.success) {
        setBulkPerformance(data.performanceMap || {});
        // Pre-fill member scores for instant elite framing
        const scores = {};
        Object.entries(data.performanceMap).forEach(([id, perf]) => {
          scores[id] = perf.overallScore;
        });
        setMemberScores(scores);
      }
    } catch (error) {
      console.error('Error fetching bulk performance:', error);
    } finally {
      setIsBulkLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'performance' || sortBy.includes('performance')) {
      fetchBulkPerformance();
    }
  }, [viewMode, sortBy, fetchBulkPerformance]);

  // Memoized filtered and sorted users for better performance
  const filteredUsers = useMemo(() => {
    let filtered = [...users]

    // Filter by search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(u =>
        u.fullName.toLowerCase().includes(query) ||
        u.username.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.role.toLowerCase().includes(query) ||
        roleToLabel(u.role).toLowerCase().includes(query) ||
        (u.team && u.team.toLowerCase().includes(query))
      )
    }

    // Advanced sorting logic
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'performance-desc': {
          const scoreA = bulkPerformance[a.id]?.overallScore || 0;
          const scoreB = bulkPerformance[b.id]?.overallScore || 0;
          return scoreB - scoreA;
        }
        case 'performance-asc': {
          const scoreA = bulkPerformance[a.id]?.overallScore || 0;
          const scoreB = bulkPerformance[b.id]?.overallScore || 0;
          return scoreA - scoreB;
        }
        case 'name-asc':
          return a.fullName.localeCompare(b.fullName);
        case 'date-desc': {
          const dateA = new Date(a.created_at || 0);
          const dateB = new Date(b.created_at || 0);
          return dateB - dateA;
        }
        case 'date-asc':
        default: {
          const dateA = new Date(a.created_at || 0);
          const dateB = new Date(b.created_at || 0);
          return dateA - dateB;
        }
      }
    })
  }, [searchQuery, users, sortBy, bulkPerformance])

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
      const data = await apiFetch(`/api/users`)
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
      const data = await apiFetch(`/api/teams`)
      if (data.success) {
        setTeams(data.teams || [])
      }
    } catch (error) {
      console.error('Error fetching teams:', error)
    } finally {
      setTeamsLoading(false)
    }
  }, [])

  // Network check removed - using NetworkContext

  // Fetch users and teams ONCE on mount
  useEffect(() => {
    fetchUsers()
    fetchTeams()
  }, [fetchUsers, fetchTeams])

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
  }, [contextData, users, setSuccess, setError]);

  const handleAddUser = useCallback(async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const data = await apiFetch(`/api/users`, {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          adminId: authUser.id,
          adminUsername: authUser.username,
          adminRole: authUser.role,
          adminTeam: authUser.team
        })
      })
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
      const data = await apiFetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
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
      const data = await apiFetch(`/api/users/${selectedUser.id}/password`, {
        method: 'PUT',
        body: JSON.stringify({
          password: formData.password,
          adminId: authUser.id,
          adminUsername: authUser.username,
          adminRole: authUser.role,
          adminTeam: authUser.team
        })
      })
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
      const data = await apiFetch(`/api/users/${userToDelete.id}`, {
        method: 'DELETE',
        body: JSON.stringify({
          adminId: authUser.id,
          adminUsername: authUser.username,
          adminRole: authUser.role,
          adminTeam: authUser.team
        })
      })
      if (data.success) {
        setError(`User ${userToDelete.fullName} deleted successfully`)
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

  const openPerformanceModal = useCallback((user) => {
    setSelectedUser(user)
    setShowPerformanceModal(true)
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

        <div className="action-buttons" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="sort-section" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
                color: '#0f172a',
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}
              className="sort-select"
            >
              <option value="performance-desc">Top Performer</option>
              <option value="performance-asc">Low Performer</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="date-desc">Newest Members</option>
              <option value="date-asc">Oldest Members</option>
            </select>
          </div>

          <div className="view-mode-toggle" style={{
            display: 'flex',
            background: '#f1f5f9',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0'
          }}>
            <button
              onClick={() => setViewMode('performance')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: viewMode === 'performance' ? '#ffffff' : 'transparent',
                color: viewMode === 'performance' ? '#0f172a' : '#64748b',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: viewMode === 'performance' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z" />
              </svg>
              Performance
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: viewMode === 'list' ? '#ffffff' : 'transparent',
                color: viewMode === 'list' ? '#0f172a' : '#64748b',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: viewMode === 'list' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              User List
            </button>
          </div>
          <button
            className="btn btn-primary"
            onClick={openAddModal}
            style={{ borderRadius: '10px' }}
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
        {(isLoading && users.length === 0) ? (
          <div className="skeleton-container">
            <SkeletonLoader type="table" rows={9} />
          </div>
        ) : viewMode === 'performance' ? (
          <div className="performance-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '20px',
            marginTop: '20px'
          }}>
            {paginatedUsers.filter(u => u.role !== 'ADMIN').map(u => (
              <MemberPerfRow
                key={u.id}
                user={u}
                score={memberScores[u.id] || 0}
                performanceData={bulkPerformance[u.id]}
                onScoreLoad={handleScoreLoad}
              />
            ))}
          </div>
        ) : (
          /* Standard List Table View */
          <>
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
                    // Normalise role → CSS class (handles both "TEAM LEADER" and "TEAM_LEADER")
                    const roleClass = roleToClass(userData.role)
                    // Normalise role → display label (always use space format)
                    const roleLabel = roleToLabel(userData.role)
                    return (
                      <tr key={userData.id} className="user-row" data-user-id={userData.id}>
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
                            {roleLabel}
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
          </>
        )}

        {/* Pagination Controls - Applied to BOTH views */}
        {!isLoading && totalPages > 1 && (
          <div className="pagination-container">
            <div className="pagination-info">
              Showing {startIndex + 1} to {endIndex} of {filteredUsers.length} users
            </div>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                onClick={prevPage}
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
                      onClick={() => goToPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>

              <button
                className="pagination-btn"
                onClick={nextPage}
                disabled={currentPage === totalPages}
                title="Next Page"
              >
                ›
              </button>
            </div>
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
                <option value="TEAM_LEADER">Team Leader</option>
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
                <option value="TEAM_LEADER">Team Leader</option>
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
          itemInfo={{
            name: userToDelete.fullName,
            details: `${userToDelete.email} • ${roleToLabel(userToDelete.role)}`
          }}
        >
          <p className="warning-text">
            This action cannot be undone. The user account and all associated data will be permanently removed from the system.
          </p>
        </ConfirmationModal>
      )}

      {/* User Performance Modal */}
      {showPerformanceModal && selectedUser && (
        <FormModal
          isOpen={showPerformanceModal}
          onClose={() => setShowPerformanceModal(false)}
          title={`Performance: ${selectedUser.fullName}`}
          showSubmit={false}
          size="large"
        >
          <UserPerformanceCard user={selectedUser} />
        </FormModal>
      )}


    </div>
  )
}

export default withErrorBoundary(UserManagement, {
  componentName: 'User Management'
})
