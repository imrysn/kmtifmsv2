import { memo, useCallback, useState, useEffect } from 'react'
import Avatar from '../shared/Avatar'
import { apiFetch } from '@/config/api'
import useStore from '../../store/useStore'
import LoadingSpinner from '../LoadingSpinner'
import ThemeToggle from '../shared/ThemeToggle'

const Sidebar = memo(({ 
  activeTab, 
  setActiveTab, 
  clearMessages, 
  setSidebarOpen, 
  sidebarOpen, 
  onLogout,
  user,
  unreadCount = 0
}) => {
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab)
    clearMessages()
    setSidebarOpen(false)
  }, [setActiveTab, clearMessages, setSidebarOpen])

  const [teams, setTeams] = useState([])
  const [isChangingTeam, setIsChangingTeam] = useState(false)

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const data = await apiFetch('/api/teams')
        if (data.success && data.teams) {
          setTeams(data.teams)
        }
      } catch (err) {
        console.error('Failed to fetch teams', err)
      }
    }
    fetchTeams()
  }, [])

  const handleTeamChange = async (e) => {
    const newTeam = e.target.value
    if (!newTeam || newTeam === user?.team) return
    setIsChangingTeam(true)
    // Safety: always reset the overlay after 10s if reload never fires
    const safetyTimer = setTimeout(() => setIsChangingTeam(false), 10000)
    try {
      const data = await apiFetch('/api/users/profile/team', {
        method: 'PUT',
        body: JSON.stringify({ team: newTeam })
      })
      if (data.success) {
        if (data.token) {
          useStore.getState().setToken(data.token)
        }
        setTimeout(() => {
          useStore.getState().updateUser({ team: data.team || newTeam })
          window.location.reload()
        }, 150)
      } else {
        clearTimeout(safetyTimer)
        setIsChangingTeam(false)
      }
    } catch (err) {
      console.error('Error changing team:', err)
      clearTimeout(safetyTimer)
      setIsChangingTeam(false)
    }
  }

  return (
    <>
      {isChangingTeam && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--background-secondary)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LoadingSpinner message="Loading dashboard..." />
        </div>
      )}
      <aside className={`tl-sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Brand */}
      <div className="tl-brand">
        <div className="tl-brand-avatar">
          <Avatar user={user} size="md" editable />
        </div>
        <div className="tl-brand-name" style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.fullName || user?.username || 'Team Leader'}
          </span>
          <select 
            value={isChangingTeam ? 'loading' : (user?.team || '')} 
            onChange={handleTeamChange}
            disabled={isChangingTeam}
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: '600',
              padding: '3px 8px',
              borderRadius: '20px',
              border: '1.5px solid #6b7280',
              outline: 'none',
              cursor: isChangingTeam ? 'wait' : 'pointer',
              width: '100%',
              maxWidth: '140px'
            }}
          >
            {isChangingTeam ? (
              <option value="loading">Switching Team...</option>
            ) : teams.length > 0 ? (
              teams.map(team => (
                <option key={team.id} value={team.name}>{team.name}</option>
              ))
            ) : user?.team ? (
              <option value={user.team}>{user.team}</option>
            ) : (
              <option value="">Select Team</option>
            )}
          </select>
        </div>
      </div>

      {/* Navigation */}
      <nav className="tl-nav">
        <button
          className={`tl-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => handleTabChange('dashboard')}
        >
          <svg className="tl-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span>Dashboard</span>
        </button>

        <button
          className={`tl-nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => handleTabChange('notifications')}
        >
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg className="tl-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            {unreadCount > 0 && (
              <div style={{
                position: 'absolute',
                top: '-6px',
                right: '-8px',
                backgroundColor: 'var(--danger-color)',
                color: 'white',
                fontSize: '10px',
                fontWeight: '700',
                borderRadius: '50%',
                minWidth: '16px',
                height: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
                lineHeight: 1,
                boxShadow: '0 0 0 2px var(--sidebar-bg)',
                pointerEvents: 'none'
              }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
          </div>
          <span>Notifications</span>
        </button>

        <button
          className={`tl-nav-item ${activeTab === 'file-collection' ? 'active' : ''}`}
          onClick={() => handleTabChange('file-collection')}
        >
          <svg className="tl-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            <line x1="12" y1="11" x2="12" y2="17"></line>
            <line x1="9" y1="14" x2="15" y2="14"></line>
          </svg>
          <span>File Collection</span>
        </button>
        
        <button
          className={`tl-nav-item ${activeTab === 'assignments' ? 'active' : ''}`}
          onClick={() => handleTabChange('assignments')}
        >
          <svg className="tl-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4"></path>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
          <span>Tasks</span>
        </button>

        <button
          className={`tl-nav-item ${activeTab === 'team-management' ? 'active' : ''}`}
          onClick={() => handleTabChange('team-management')}
        >
          <svg className="tl-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span>Team Management</span>
        </button>
      </nav>

      {/* Footer */}
      <div className="tl-sidebar-footer">
        <ThemeToggle variant="tl" />
        <button className="tl-logout-btn" onClick={onLogout}>
          <svg className="tl-logout-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          <span>Logout</span>
        </button>
      </div>
    </aside>
    </>
  )
})

Sidebar.displayName = 'Sidebar'

export default Sidebar
