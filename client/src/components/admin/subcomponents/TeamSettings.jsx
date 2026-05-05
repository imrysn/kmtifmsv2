import React from 'react'
import './TeamSettings.css'
import MultiSelectDropdown from '../../common/MultiSelectDropdown'

const TeamSettings = ({
  teams,
  teamsLoading,
  newTeam,
  setNewTeam,
  handleCreateTeam,
  isLoading,
  editingTeam,
  setEditingTeam,
  handleUpdateTeam,
  cancelEditingTeam,
  startEditingTeam,
  handleDeleteTeam,
  getTeamLeaderOptions
}) => {
  return (
    <div className="settings-card team-management-card">
      <div className="settings-card-header">
        <h3>Team Management</h3>
      </div>
      <div className="settings-card-body">
        <div className="team-section">
          <h4>Create New Team</h4>
          <div className="team-form">
            <div className="form-group">
              <label>Team Name</label>
              <input
                type="text"
                value={newTeam.name}
                onChange={(e) => setNewTeam(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter team name"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Team Leaders</label>
              <MultiSelectDropdown
                options={getTeamLeaderOptions().map(user => ({
                  id: user.id,
                  name: `${user.fullName} (${user.username})`
                }))}
                selectedIds={newTeam.leaderIds}
                onChange={(selectedIds) => setNewTeam(prev => ({ ...prev, leaderIds: selectedIds }))}
                placeholder="Select team leaders"
                displayKey="name"
                valueKey="id"
              />
              {newTeam.leaderIds.length > 0 && (
                <p className="help-text">{newTeam.leaderIds.length} leader(s) selected</p>
              )}
            </div>
            <button
              className="btn btn-primary"
              id='create-team-btn'
              onClick={handleCreateTeam}
              disabled={isLoading || !newTeam.name.trim()}
            >
              {isLoading ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </div>

        <div className="team-section">
          <h4>Existing Teams ({teams.length})</h4>
          {teamsLoading ? (
            <div className="loading-state">Loading teams...</div>
          ) : teams.length === 0 ? (
            <div className="empty-state">No teams found</div>
          ) : (
            <div className="table-container">
              <table className="teams-table">
                <thead>
                  <tr>
                    <th>Team Name</th>
                    <th>Leader</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map(team => (
                    <tr key={team.id}>
                      {editingTeam && editingTeam.id === team.id ? (
                        <>
                          <td>
                            <input
                              type="text"
                              value={editingTeam.name}
                              onChange={(e) => setEditingTeam(prev => ({ ...prev, name: e.target.value }))}
                              className="form-input"
                            />
                          </td>
                          <td>
                            <MultiSelectDropdown
                              options={getTeamLeaderOptions().map(user => ({
                                id: user.id,
                                name: user.username
                              }))}
                              selectedIds={editingTeam.leaderIds || []}
                              onChange={(selectedIds) => setEditingTeam(prev => ({ ...prev, leaderIds: selectedIds }))}
                              placeholder="Select leaders"
                              displayKey="name"
                              valueKey="id"
                            />
                          </td>
                          <td>
                            <select
                              value={editingTeam.is_active}
                              onChange={(e) => setEditingTeam(prev => ({ ...prev, is_active: e.target.value === 'true' }))}
                              className="form-select"
                            >
                              <option value="true">Active</option>
                              <option value="false">Inactive</option>
                            </select>
                          </td>
                          <td>
                            <div className="team-actions">
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={handleUpdateTeam}
                                disabled={isLoading}
                              >
                                {isLoading ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={cancelEditingTeam}
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{team.name}</td>
                          <td>
                            {team.leaders && team.leaders.length > 0
                              ? team.leaders.map(l => l.username).join(', ')
                              : 'No leader assigned'}
                          </td>
                          <td>
                            <span className={`status ${team.is_active ? 'active' : 'inactive'}`}>
                              {team.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <div className="team-actions">
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => startEditingTeam(team)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteTeam(team.id, team.name)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default React.memo(TeamSettings)
