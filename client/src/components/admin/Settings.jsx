import { useState, useEffect } from 'react'
import './Settings.css'
import { AlertMessage, ConfirmationModal } from './modals'
import { SkeletonLoader } from '../common/SkeletonLoader'
import { useAuth, useNetwork } from '../../contexts'
import { withErrorBoundary } from '../common'

const Settings = ({ clearMessages, error, success, setError, setSuccess, users, user }) => {
  const { user: authUser } = useAuth()
  const { isConnected } = useNetwork()
  
  const [isLoading, setIsLoading] = useState(false)
  const [teams, setTeams] = useState([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [newTeam, setNewTeam] = useState({
    name: '',
    leaderId: '',
    leaderUsername: ''
  })
  const [editingTeam, setEditingTeam] = useState(null)
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, teamId: null, teamName: '' })
  const [settings, setSettings] = useState({
    fileManagement: {
      rootDirectory: ''
    },
    general: {
      timezone: 'UTC',
      dateFormat: 'ISO',
      language: 'en-US'
    }
  })
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)

  const handleSettingsChange = (category, field, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }))
  }

  const fetchSettings = async () => {
    setIsLoadingSettings(true)
    try {
      const response = await fetch('http://localhost:3001/api/settings/root_directory')
      const data = await response.json()
      if (data.success && data.setting) {
        setSettings(prev => ({
          ...prev,
          fileManagement: {
            ...prev.fileManagement,
            rootDirectory: data.setting.value || '/home/admin/files'
          }
        }))
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
      setError('Failed to load settings')
    } finally {
      setIsLoadingSettings(false)
    }
  }

  const handleBrowseDirectory = async () => {
    clearMessages()
    try {
      // Check if running in Electron
      console.log('Browse button clicked');
      console.log('window.electron available:', !!window.electron);
      console.log('window.electron.openDirectoryDialog available:', !!(window.electron && window.electron.openDirectoryDialog));
      
      if (window.electron && window.electron.openDirectoryDialog) {
        console.log('Opening Electron directory dialog...');
        const result = await window.electron.openDirectoryDialog()
        console.log('Dialog result:', result);
        
        if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
          const selectedPath = result.filePaths[0]
          console.log('Selected path:', selectedPath);
          setSettings(prev => ({
            ...prev,
            fileManagement: {
              ...prev.fileManagement,
              rootDirectory: selectedPath
            }
          }))
          setSuccess(`Selected directory: ${selectedPath}`)
        } else {
          console.log('Dialog was canceled');
        }
      } else {
        console.warn('Electron API not available');
        setError('Folder browser is only available in the desktop application. Please enter the path manually or run the Electron app.')
      }
    } catch (error) {
      console.error('Error browsing directory:', error)
      setError('Failed to open directory browser: ' + error.message)
    }
  }

  const handleSaveFileManagementSettings = async () => {
    if (!settings.fileManagement.rootDirectory.trim()) {
      setError('Root directory path is required')
      return
    }
    
    setIsLoading(true)
    try {
      const response = await fetch('http://localhost:3001/api/settings/root_directory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: settings.fileManagement.rootDirectory,
          updated_by: user?.username || 'admin'
        })
      })
      const data = await response.json()
      if (data.success) {
        setSuccess('New directory settings saved successfully')
      } else {
        setError(data.message || 'Failed to save file directory settings')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      setError('Failed to save file directory settings')
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

  // Network check removed - using NetworkContext

  useEffect(() => {
    if (isConnected) {
      fetchTeams()
      fetchSettings()
    }
  }, [isConnected])

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

  const handleDeleteTeam = (teamId, teamName) => {
    setDeleteModal({ isOpen: true, teamId, teamName })
  }

  const handleConfirmDelete = async () => {
    const { teamId, teamName } = deleteModal

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
      setDeleteModal({ isOpen: false, teamId: null, teamName: '' })
    }
  }

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, teamId: null, teamName: '' })
  }

  const startEditingTeam = (team) => setEditingTeam({ ...team })
  const cancelEditingTeam = () => setEditingTeam(null)

  const getTeamLeaderOptions = () => {
    return users?.filter(user => user.role === 'TEAM LEADER' || user.role === 'ADMIN') || []
  }

  // Show skeleton loader when network is not available
  if (!isConnected) {
    return <SkeletonLoader type="admin" />
  }

  return (
    <div className={`settings-section ${isLoading ? 'loading-cursor' : ''}`}>
      
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
      
      <div className="settings-grid">
        
        <div className="settings-card">
          <div className="settings-card-header">
            <h3>File Management</h3>
          </div>
          <div className="settings-card-body">
            <div className="form-group">
              <label>Root Directory Path</label>
              <div className="input-with-button">
                <input
                  type="text"
                  value={settings.fileManagement.rootDirectory}
                  onChange={(e) => handleSettingsChange('fileManagement', 'rootDirectory', e.target.value)}
                  placeholder="/home/admin/files"
                  className="form-input"
                  disabled={isLoadingSettings}
                />
                <button
                  className="btn btn-secondary"
                  onClick={handleBrowseDirectory}
                  disabled={isLoading || isLoadingSettings}
                  title="Browse for folder (Desktop app only)"
                >
                  Browse
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveFileManagementSettings}
                  disabled={isLoading || isLoadingSettings}
                >
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
              <p className="help-text">Base directory for files</p>
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
                              <td>{team.leader_username || 'No leader assigned'}</td>
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
                <span className="info-value">MySQL</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={handleConfirmDelete}
        title="Delete Team"
        message="Are you sure you want to delete this team?"
        confirmText="Delete Team"
        variant="danger"
        isLoading={isLoading}
        itemInfo={deleteModal.teamName ? {
          name: deleteModal.teamName,
          details: "All team members will be unassigned"
        } : null}
      >
        <p className="warning-text">
          This action cannot be undone. The team will be permanently removed from the system.
        </p>
      </ConfirmationModal>

    </div>
  )
}

export default withErrorBoundary(Settings, {
  componentName: 'Settings'
})
