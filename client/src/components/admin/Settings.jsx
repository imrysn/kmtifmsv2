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
    system: {
      siteName: 'KMTIFMSV2 Admin',
      siteDescription: 'Enterprise User Management System',
      maintenanceMode: false,
      debugMode: false
    },
    security: {
      sessionTimeout: 30,
      passwordMinLength: 6,
      maxLoginAttempts: 5,
      requireTwoFactor: false
    },
    notifications: {
      emailNotifications: true,
      loginAlerts: true,
      userRegistrationAlerts: false,
      systemAlerts: true
    },
    backup: {
      autoBackup: true,
      backupFrequency: 'daily',
      retentionDays: 30
    },
    fileManagement: {
      rootDirectory: '/home/admin/files',
      allowedExtensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.jpg', '.png', '.zip'],
      maxFileSize: '100MB',
      showHiddenFiles: false
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

  const handleSaveSettings = async () => {
    setIsLoading(true)
    try {
      // Here you would typically save to your backend
      // const response = await fetch('/api/settings', { method: 'PUT', ... })
      
      // For now, we'll just simulate a successful save
      await new Promise(resolve => setTimeout(resolve, 1000))
      setSuccess('Settings saved successfully')
    } catch (error) {
      setError('Failed to save settings')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportDatabase = () => {
    setSuccess('Database export initiated')
    // Simulate database export
  }

  const handleResetDatabase = () => {
    if (confirm('Are you sure you want to reset the database? This will remove all data and cannot be undone.')) {
      setSuccess('Database reset initiated')
      // Here you would call your reset script
    }
  }

  // Team Management Functions
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
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newTeam.name,
          leaderId: newTeam.leaderId,
          leaderUsername: newTeam.leaderUsername
        })
      })
      const data = await response.json()
      if (data.success) {
        setSuccess('Team created successfully')
        setNewTeam({
          name: '',
          leaderId: '',
          leaderUsername: ''
        })
        fetchTeams() // Refresh teams list
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
        headers: {
          'Content-Type': 'application/json'
        },
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
        fetchTeams() // Refresh teams list
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
      const response = await fetch(`http://localhost:3001/api/teams/${teamId}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.success) {
        setSuccess(`Team '${teamName}' deleted successfully`)
        fetchTeams() // Refresh teams list
      } else {
        setError(data.message || 'Failed to delete team')
      }
    } catch (error) {
      setError('Failed to delete team')
    } finally {
      setIsLoading(false)
    }
  }

  const startEditingTeam = (team) => {
    setEditingTeam({ ...team })
  }

  const cancelEditingTeam = () => {
    setEditingTeam(null)
  }

  const getTeamLeaderOptions = () => {
    return users?.filter(user => 
      user.role === 'TEAM_LEADER' || user.role === 'ADMIN'
    ) || []
  }

  return (
    <div className="settings-section">
      <div className="page-header">
        <h1>System Settings</h1>
        <p>Configure system preferences, security, and administrative options</p>
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
      
      <div className="settings-grid">
        {/* System Settings */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3>System Configuration</h3>
          </div>
          <div className="settings-card-body">
            <div className="form-group">
              <label>Site Name</label>
              <input
                type="text"
                value={settings.system.siteName}
                onChange={(e) => handleSettingsChange('system', 'siteName', e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Site Description</label>
              <textarea
                value={settings.system.siteDescription}
                onChange={(e) => handleSettingsChange('system', 'siteDescription', e.target.value)}
                className="form-textarea"
                rows="3"
              />
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.system.maintenanceMode}
                  onChange={(e) => handleSettingsChange('system', 'maintenanceMode', e.target.checked)}
                  className="form-checkbox"
                />
                <span>Maintenance Mode</span>
              </label>
              <p className="help-text">Enable maintenance mode to prevent user access</p>
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.system.debugMode}
                  onChange={(e) => handleSettingsChange('system', 'debugMode', e.target.checked)}
                  className="form-checkbox"
                />
                <span>Debug Mode</span>
              </label>
              <p className="help-text">Enable detailed logging and error reporting</p>
            </div>
          </div>
        </div>
        
        {/* Security Settings */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3>Security & Authentication</h3>
          </div>
          <div className="settings-card-body">
            <div className="form-group">
              <label>Session Timeout (minutes)</label>
              <input
                type="number"
                value={settings.security.sessionTimeout}
                onChange={(e) => handleSettingsChange('security', 'sessionTimeout', parseInt(e.target.value))}
                min="5"
                max="1440"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Minimum Password Length</label>
              <input
                type="number"
                value={settings.security.passwordMinLength}
                onChange={(e) => handleSettingsChange('security', 'passwordMinLength', parseInt(e.target.value))}
                min="4"
                max="50"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Max Login Attempts</label>
              <input
                type="number"
                value={settings.security.maxLoginAttempts}
                onChange={(e) => handleSettingsChange('security', 'maxLoginAttempts', parseInt(e.target.value))}
                min="1"
                max="20"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.security.requireTwoFactor}
                  onChange={(e) => handleSettingsChange('security', 'requireTwoFactor', e.target.checked)}
                  className="form-checkbox"
                />
                <span>Require Two-Factor Authentication</span>
              </label>
              <p className="help-text">Require 2FA for all admin accounts</p>
            </div>
          </div>
        </div>
        
        {/* Notifications */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3>Notifications</h3>
          </div>
          <div className="settings-card-body">
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.notifications.emailNotifications}
                  onChange={(e) => handleSettingsChange('notifications', 'emailNotifications', e.target.checked)}
                  className="form-checkbox"
                />
                <span>Email Notifications</span>
              </label>
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.notifications.loginAlerts}
                  onChange={(e) => handleSettingsChange('notifications', 'loginAlerts', e.target.checked)}
                  className="form-checkbox"
                />
                <span>Login Alerts</span>
              </label>
              <p className="help-text">Notify on suspicious login activities</p>
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.notifications.userRegistrationAlerts}
                  onChange={(e) => handleSettingsChange('notifications', 'userRegistrationAlerts', e.target.checked)}
                  className="form-checkbox"
                />
                <span>User Registration Alerts</span>
              </label>
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.notifications.systemAlerts}
                  onChange={(e) => handleSettingsChange('notifications', 'systemAlerts', e.target.checked)}
                  className="form-checkbox"
                />
                <span>System Alerts</span>
              </label>
              <p className="help-text">Notify on system errors and warnings</p>
            </div>
          </div>
        </div>
        
        {/* Backup Settings */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3>Backup & Maintenance</h3>
          </div>
          <div className="settings-card-body">
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.backup.autoBackup}
                  onChange={(e) => handleSettingsChange('backup', 'autoBackup', e.target.checked)}
                  className="form-checkbox"
                />
                <span>Automatic Backups</span>
              </label>
            </div>
            <div className="form-group">
              <label>Backup Frequency</label>
              <select
                value={settings.backup.backupFrequency}
                onChange={(e) => handleSettingsChange('backup', 'backupFrequency', e.target.value)}
                className="form-select"
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="form-group">
              <label>Retention Period (days)</label>
              <input
                type="number"
                value={settings.backup.retentionDays}
                onChange={(e) => handleSettingsChange('backup', 'retentionDays', parseInt(e.target.value))}
                min="1"
                max="365"
                className="form-input"
              />
            </div>
            <div className="backup-actions">
              <button 
                className="btn btn-secondary"
                onClick={handleExportDatabase}
              >
                Export Database
              </button>
              <button 
                className="btn btn-danger"
                onClick={handleResetDatabase}
              >
                Reset Database
              </button>
            </div>
          </div>
        </div>
        
        {/* System Information */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3>System Information</h3>
          </div>
          <div className="settings-card-body">
            <div className="system-info">
              <div className="info-row">
                <span className="info-label">Application Version:</span>
                <span className="info-value">v2.0.0</span>
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
            </div>
          </div>
        </div>
        
        {/* Application Settings */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3>Application Settings</h3>
          </div>
          <div className="settings-card-body">
            <div className="form-group">
              <label>Theme Preference</label>
              <select className="form-select">
                <option value="auto">Auto (System)</option>
                <option value="light">Light Mode</option>
                <option value="dark">Dark Mode</option>
              </select>
            </div>
            <div className="form-group">
              <label>Date Format</label>
              <select className="form-select">
                <option value="US">MM/DD/YYYY</option>
                <option value="EU">DD/MM/YYYY</option>
                <option value="ISO">YYYY-MM-DD</option>
              </select>
            </div>
            <div className="form-group">
              <label>Time Zone</label>
              <select className="form-select">
                <option value="UTC">UTC</option>
                <option value="local">Local Time</option>
                <option value="PST">Pacific Time</option>
                <option value="EST">Eastern Time</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* File Management Settings */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3>File Management</h3>
          </div>
          <div className="settings-card-body">
            <div className="form-group">
              <label>Root Directory Path</label>
              <input
                type="text"
                value={settings.fileManagement.rootDirectory}
                onChange={(e) => handleSettingsChange('fileManagement', 'rootDirectory', e.target.value)}
                placeholder="/home/admin/files"
                className="form-input"
              />
              <p className="help-text">Base directory for file management system</p>
            </div>
            <div className="form-group">
              <label>Maximum File Size</label>
              <select
                value={settings.fileManagement.maxFileSize}
                onChange={(e) => handleSettingsChange('fileManagement', 'maxFileSize', e.target.value)}
                className="form-select"
              >
                <option value="10MB">10 MB</option>
                <option value="50MB">50 MB</option>
                <option value="100MB">100 MB</option>
                <option value="500MB">500 MB</option>
                <option value="1GB">1 GB</option>
              </select>
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.fileManagement.showHiddenFiles}
                  onChange={(e) => handleSettingsChange('fileManagement', 'showHiddenFiles', e.target.checked)}
                  className="form-checkbox"
                />
                <span>Show Hidden Files</span>
              </label>
              <p className="help-text">Display files starting with dot (.)</p>
            </div>
            <div className="form-group">
              <label>Allowed File Extensions</label>
              <textarea
                value={settings.fileManagement.allowedExtensions.join(', ')}
                onChange={(e) => {
                  const extensions = e.target.value.split(',').map(ext => ext.trim()).filter(ext => ext)
                  handleSettingsChange('fileManagement', 'allowedExtensions', extensions)
                }}
                placeholder=".pdf, .doc, .docx, .jpg, .png"
                className="form-textarea"
                rows="2"
              />
              <p className="help-text">Comma-separated list of allowed file extensions</p>
            </div>
          </div>
        </div>
        
        {/* Team Management */}
        <div className="settings-card team-management-card">
          <div className="settings-card-header">
            <h3>Team Management</h3>
          </div>
          <div className="settings-card-body">
            {/* Create New Team */}
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
            
            {/* Teams List */}
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
                        // Edit mode
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
                        // View mode
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
      </div>
      
      {/* Save Settings Action */}
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
