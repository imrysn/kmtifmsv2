import { useState, useEffect } from 'react'
import './Settings.css'

const Settings = ({ clearMessages, error, success, setError, setSuccess, users }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [teams, setTeams] = useState([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [newTeam, setNewTeam] = useState({
    name: '',
    leaderId: '',
    leaderUsername: ''
  })
  const [editingTeam, setEditingTeam] = useState(null)
  const [settings, setSettings] = useState({
    fileManagement: {
      rootDirectory: '/home/admin/files'
    },
    general: {
      timezone: 'UTC',
      dateFormat: 'ISO',
      language: 'en-US'
    }
  })

  const handleSettingsChange = (category, field, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }))
  }

  const handleSaveFileManagementSettings = async () => {
    setIsLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500))
      setSuccess('File management settings saved successfully')
    } catch (error) {
      setError('Failed to save file management settings')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    setIsLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      setSuccess('Settings saved successfully')
    } catch (error) {
      setError('Failed to save settings')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTeams()
  }, [])

  const fetchTeams = async () => {
    setTeamsLoading(true)
    try {
      const response = await fetch('http://localhost:3001/api/teams')
      const data = await response.json()
      if (data.success) {
        setTeams(data.teams || [])
      } else {
        setError('Failed to fetch teams')
      }
    } catch (error) {
      setError('Failed to fetch teams')
    } finally {
      setTeamsLoading(false)
    }
  }

  const handleCreateTeam = async () => {
    if (!newTeam.name.trim()) {
      setError('Team name is required')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('http://localhost:3001/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTeam.name,
          leaderId: newTeam.leaderId,
          leaderUsername: newTeam.leaderUsername
        })
      })
      const data = await response.json()
      if (data.success) {
        setSuccess('Team created successfully')
        setNewTeam({ name: '', leaderId: '', leaderUsername: '' })
        fetchTeams()
      } else {
        setError(data.message || 'Failed to create team')
      }
    } catch (error) {
      setError('Failed to create team')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateTeam = async () => {
    if (!editingTeam || !editingTeam.name.trim()) {
      setError('Team name is required')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`http://localhost:3001/api/teams/${editingTeam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingTeam.name,
          leaderId: editingTeam.leader_id,
          leaderUsername: editingTeam.leader_username,
          isActive: editingTeam.is_active
        })
      })
      const data = await response.json()
      if (data.success) {
        setSuccess('Team updated successfully')
        setEditingTeam(null)
        fetchTeams()
      } else {
        setError(data.message || 'Failed to update team')
      }
    } catch (error) {
      setError('Failed to update team')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteTeam = async (teamId, teamName) => {
    if (!confirm(`Are you sure you want to delete team '${teamName}'? This action cannot be undone.`)) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`http://localhost:3001/api/teams/${teamId}`, { method: 'DELETE' })
      const data = await response.json()
      if (data.success) {
        setSuccess(`Team '${teamName}' deleted successfully`)
        fetchTeams()
      } else {
        setError(data.message || 'Failed to delete team')
      }
    } catch (error) {
      setError('Failed to delete team')
    } finally {
      setIsLoading(false)
    }
  }

  const startEditingTeam = (team) => setEditingTeam({ ...team })
  const cancelEditingTeam = () => setEditingTeam(null)

  const getTeamLeaderOptions = () => {
    return users?.filter(user => user.role === 'TEAM_LEADER' || user.role === 'ADMIN') || []
  }

  return (
    <div className="settings-section">
      <div className="page-header">
        <h1>System Settings</h1>
        <p>Configure file management, teams, and system information</p>
      </div>
      
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
      
      <div className="settings-grid">
        
        <div className="settings-card">
          <div className="settings-card-header">
            <h3>File Management</h3>
          </div>
          <div className="settings-card-body">
            <div className="form-group">
              <label>Root Directory Path</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={settings.fileManagement.rootDirectory}
                  onChange={(e) => handleSettingsChange('fileManagement', 'rootDirectory', e.target.value)}
                  placeholder="/home/admin/files"
                  className="form-input"
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleSaveFileManagementSettings}
                  disabled={isLoading}
                >
                  Save
                </button>
              </div>
              <p className="help-text">Base directory for file management system</p>
            </div>
          </div>
        </div>
        
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
                  <label>Team Leader</label>
                  <select
                    value={newTeam.leaderId}
                    onChange={(e) => {
                      const selectedUser = getTeamLeaderOptions().find(u => u.id == e.target.value)
                      setNewTeam(prev => ({ 
                        ...prev, 
                        leaderId: e.target.value,
                        leaderUsername: selectedUser ? selectedUser.username : ''
                      }))
                    }}
                    className="form-select"
                  >
                    <option value="">No Team Leader</option>
                    {getTeamLeaderOptions().map(user => (
                      <option key={user.id} value={user.id}>
                        {user.fullName} ({user.username}) - {user.role}
                      </option>
                    ))}
                  </select>
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
                <div className="teams-grid">
                  {teams.map(team => (
                    <div key={team.id} className="team-item">
                      {editingTeam && editingTeam.id === team.id ? (
                        <div className="team-edit-form">
                          <div className="form-group">
                            <input
                              type="text"
                              value={editingTeam.name}
                              onChange={(e) => setEditingTeam(prev => ({ ...prev, name: e.target.value }))}
                              className="form-input"
                              placeholder="Team name"
                            />
                          </div>
                          <div className="form-group">
                            <select
                              value={editingTeam.leader_id || ''}
                              onChange={(e) => {
                                const selectedUser = getTeamLeaderOptions().find(u => u.id == e.target.value)
                                setEditingTeam(prev => ({ 
                                  ...prev, 
                                  leader_id: e.target.value,
                                  leader_username: selectedUser ? selectedUser.username : ''
                                }))
                              }}
                              className="form-select"
                            >
                              <option value="">No Team Leader</option>
                              {getTeamLeaderOptions().map(user => (
                                <option key={user.id} value={user.id}>
                                  {user.fullName} ({user.username})
                                </option>
                              ))}
                            </select>
                          </div>
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
                        </div>
                      ) : (
                        <>
                          <div className="team-header">
                            <div className="team-info">
                              <h5>{team.name}</h5>
                              <p className="team-leader">
                                Leader: {team.leader_username ? 
                                  `${team.leader_username}` : 
                                  'No leader assigned'
                                }
                              </p>
                              <p className="team-status">
                                Status: <span className={`status ${team.is_active ? 'active' : 'inactive'}`}>
                                  {team.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </p>
                            </div>
                          </div>
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
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-card-header">
            <h3>General Settings</h3>
          </div>
          <div className="settings-card-body">
            <div className="form-group">
              <label>Default Timezone</label>
              <select
                value={settings.general.timezone}
                onChange={(e) => handleSettingsChange('general', 'timezone', e.target.value)}
                className="form-select"
              >
                <option value="UTC">UTC</option>
                <option value="local">Local Time</option>
                <option value="PST">Pacific Time</option>
                <option value="EST">Eastern Time</option>
              </select>
            </div>
            <div className="form-group">
              <label>Date Format</label>
              <select
                value={settings.general.dateFormat}
                onChange={(e) => handleSettingsChange('general', 'dateFormat', e.target.value)}
                className="form-select"
              >
                <option value="US">MM/DD/YYYY</option>
                <option value="EU">DD/MM/YYYY</option>
                <option value="ISO">YYYY-MM-DD</option>
              </select>
            </div>
            <div className="form-group">
              <label>Language</label>
              <select
                value={settings.general.language}
                onChange={(e) => handleSettingsChange('general', 'language', e.target.value)}
                className="form-select"
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="es-ES">Spanish</option>
                <option value="fr-FR">French</option>
              </select>
            </div>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-card-header">
            <h3>System Information</h3>
          </div>
          <div className="settings-card-body">
            <div className="system-info">
              <div className="info-row">
                <span className="info-label">Application Version:</span>
                <span className="info-value">v2.1.0</span>
              </div>
              <div className="info-row">
                <span className="info-label">Database Version:</span>
                <span className="info-value">SQLite 3.45.0</span>
              </div>
              <div className="info-row">
                <span className="info-label">Node.js Version:</span>
                <span className="info-value">{typeof process !== 'undefined' ? process.version : 'v20.x.x'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Uptime:</span>
                <span className="info-value">2 days, 14 hours</span>
              </div>
              <div className="info-row">
                <span className="info-label">Total Users:</span>
                <span className="info-value">{users?.length || 0}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Active Sessions:</span>
                <span className="info-value">5</span>
              </div>
              <div className="info-row">
                <span className="info-label">Server OS:</span>
                <span className="info-value">Linux Ubuntu 22.04</span>
              </div>
              <div className="info-row">
                <span className="info-label">License Status:</span>
                <span className="info-value status active">Valid</span>
              </div>
            </div>
          </div>
        </div>
        
      </div>
      
      <div className="settings-actions">
        <button 
          className="btn btn-primary btn-large"
          onClick={handleSaveSettings}
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save All Settings'}
        </button>
      </div>
    </div>
  )
}

export default Settings