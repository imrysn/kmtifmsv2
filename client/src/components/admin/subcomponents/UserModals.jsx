import React from 'react'
import './UserModals.css'
import { AlertMessage, ConfirmationModal, FormModal } from '../modals'

const UserModals = ({
  error,
  success,
  clearMessages,
  showAddModal,
  setShowAddModal,
  handleAddUser,
  formData,
  handleFormChange,
  isLoading,
  activeTeams,
  teamsLoading,
  showEditModal,
  setShowEditModal,
  handleEditUser,
  selectedUser,
  showPasswordModal,
  setShowPasswordModal,
  handleResetPassword,
  showUserDeleteModal,
  setShowUserDeleteModal,
  handleDeleteUser,
  userToDelete
}) => {
  return (
    <>
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
          itemInfo={{
            name: userToDelete.fullName,
            details: `${userToDelete.email} • ${userToDelete.role}`
          }}
        >
          <p className="warning-text">
            This action cannot be undone. The user account and all associated data will be permanently removed from the system.
          </p>
        </ConfirmationModal>
      )}
    </>
  )
}

export default React.memo(UserModals)
