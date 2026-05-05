import React from 'react'
import './UserFilters.css'

const UserFilters = ({ searchQuery, handleSearchChange, openAddModal }) => {
  return (
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
  )
}

export default React.memo(UserFilters)
