import React from 'react'
import './UserTable.css'

const UserTable = ({
  paginatedUsers,
  isLoading,
  filteredUsers,
  startIndex,
  endIndex,
  currentPage,
  totalPages,
  prevPage,
  nextPage,
  goToPage,
  openPasswordModal,
  openEditModal,
  openUserDeleteModal
}) => {
  if (isLoading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading users...</p>
      </div>
    )
  }

  if (filteredUsers.length === 0) {
    return (
      <div className="empty-state">
        <h3>No users found</h3>
        <p>No users match your current search criteria.</p>
      </div>
    )
  }

  return (
    <div className="table-section">
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

      {totalPages > 1 && (
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
    </div>
  )
}

export default React.memo(UserTable)
