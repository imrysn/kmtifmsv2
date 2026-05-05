import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '@/config/api'
import './UserManagement.css' // Reuse consistent admin styling
import { AlertMessage, ConfirmationModal } from './modals'
import { useNetwork } from '../../contexts'
import { withErrorBoundary } from '../common'

// Sub-components
import TeamSettings from './subcomponents/TeamSettings'

const TeamManagement = ({ clearMessages, error, success, setError, setSuccess, users }) => {
  const { isConnected } = useNetwork()
  const [isLoading, setIsLoading] = useState(false)
  const [teams, setTeams] = useState([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  
  const [newTeam, setNewTeam] = useState({
    name: '',
    leaderIds: []
  })
  const [editingTeam, setEditingTeam] = useState(null)
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, teamId: null, teamName: '' })

  const fetchTeams = useCallback(async () => {
    setTeamsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/teams`)
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
  }, [setError])

  useEffect(() => {
    if (isConnected) {
      fetchTeams()
    }
  }, [isConnected, fetchTeams])

  const handleCreateTeam = useCallback(async () => {
    if (!newTeam.name.trim()) {
      setError('Team name is required')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTeam.name,
          leaderIds: newTeam.leaderIds
        })
      })
      const data = await response.json()
      if (data.success) {
        setSuccess('Team created successfully')
        setNewTeam({ name: '', leaderIds: [] })
        fetchTeams()
      } else {
        setError(data.message || 'Failed to create team')
      }
    } catch (error) {
      setError('Failed to create team')
    } finally {
      setIsLoading(false)
    }
  }, [newTeam, fetchTeams, setError, setSuccess])

  const handleUpdateTeam = useCallback(async () => {
    if (!editingTeam || !editingTeam.name.trim()) {
      setError('Team name is required')
      return
    }

    setIsLoading(true)
    try {
      const payload = {
        name: editingTeam.name,
        leaderIds: editingTeam.leaderIds || [],
        isActive: editingTeam.is_active
      }
      const response = await fetch(`${API_BASE_URL}/api/teams/${editingTeam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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
  }, [editingTeam, fetchTeams, setError, setSuccess])

  const handleDeleteTeam = useCallback((teamId, teamName) => {
    setDeleteModal({ isOpen: true, teamId, teamName })
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    const { teamId, teamName } = deleteModal

    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/teams/${teamId}`, { method: 'DELETE' })
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
  }, [deleteModal, fetchTeams, setError, setSuccess])

  const closeDeleteModal = useCallback(() => {
    setDeleteModal({ isOpen: false, teamId: null, teamName: '' })
  }, [])

  const startEditingTeam = useCallback((team) => {
    const leaderIds = team.leaders ? team.leaders.map(l => l.user_id) : []
    setEditingTeam({ ...team, leaderIds })
  }, [])

  const cancelEditingTeam = useCallback(() => setEditingTeam(null), [])

  const getTeamLeaderOptions = useCallback(() => {
    return users?.filter(user => user.role === 'TEAM LEADER' || user.role === 'ADMIN') || []
  }, [users])

  return (
    <div className={`team-management-section ${isLoading ? 'loading-cursor' : ''}`}>
      {error && <AlertMessage type="error" message={error} onClose={clearMessages} />}
      {success && <AlertMessage type="success" message={success} onClose={clearMessages} />}

      <div className="admin-header">
        <div className="header-title">
          <h1>Team Management</h1>
          <p className="header-subtitle">Create and organize departments and project teams</p>
        </div>
      </div>

      <div className="settings-grid">
        <TeamSettings
          teams={teams}
          teamsLoading={teamsLoading}
          newTeam={newTeam}
          setNewTeam={setNewTeam}
          handleCreateTeam={handleCreateTeam}
          isLoading={isLoading}
          editingTeam={editingTeam}
          setEditingTeam={setEditingTeam}
          handleUpdateTeam={handleUpdateTeam}
          cancelEditingTeam={cancelEditingTeam}
          startEditingTeam={startEditingTeam}
          handleDeleteTeam={handleDeleteTeam}
          getTeamLeaderOptions={getTeamLeaderOptions}
        />
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

export default withErrorBoundary(TeamManagement, {
  componentName: 'Team Management'
})
