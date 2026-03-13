import { LoadingTable } from '../common/InlineSkeletonLoader'
import { useState, useMemo } from 'react'

const TeamManagementTab = ({
  isLoadingTeam,
  teamMembers,
  fetchMemberFiles
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState('name-asc')

  const uniqueTeams = useMemo(() => {
    const teams = new Set(teamMembers.map(m => m.team).filter(Boolean))
    return Array.from(teams).sort()
  }, [teamMembers])

  const [teamFilter, setTeamFilter] = useState('all')

  const filteredMembers = useMemo(() => {
    let result = [...teamMembers]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(m =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.team || '').toLowerCase().includes(q)
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter(m => m.status?.toLowerCase() === statusFilter)
    }

    if (teamFilter !== 'all') {
      result = result.filter(m => m.team === teamFilter)
    }

    result.sort((a, b) => {
      switch (sortOrder) {
        case 'name-asc':  return (a.name || '').localeCompare(b.name || '')
        case 'name-desc': return (b.name || '').localeCompare(a.name || '')
        case 'files-desc': return (b.files || 0) - (a.files || 0)
        case 'files-asc':  return (a.files || 0) - (b.files || 0)
        case 'joined-desc': return new Date(b.joined || 0) - new Date(a.joined || 0)
        case 'joined-asc':  return new Date(a.joined || 0) - new Date(b.joined || 0)
        default: return 0
      }
    })

    return result
  }, [teamMembers, searchQuery, statusFilter, teamFilter, sortOrder])

  return (
    <div className="tl-content">
      {/* Page Header - EXACT Admin Match */}
      <div className="tl-page-header">
        <h1>Team Management</h1>
        <p>Manage your team members and their activity</p>
      </div>

      {isLoadingTeam ? (
        <div className="tl-table-container">
          <div className="tl-table-header">
            <h2>Team Members</h2>
          </div>
          <LoadingTable rows={6} columns={6} />
        </div>
      ) : teamMembers.length > 0 ? (
        <div className="tl-table-container">
          <div className="tl-table-header">
            <h2>Team Members ({filteredMembers.length}{filteredMembers.length !== teamMembers.length ? ` of ${teamMembers.length}` : ''})</h2>
          </div>

          {/* Search + Filter + Sort Controls */}
          <div className="file-controls">
            <div className="file-search">
              <input
                type="text"
                placeholder="Search by name, email, or team..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="file-filters">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="form-select">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="form-select">
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                <option value="files-desc">Most Files</option>
                <option value="files-asc">Least Files</option>
                <option value="joined-desc">Latest Joined</option>
                <option value="joined-asc">Earliest Joined</option>
              </select>
              {uniqueTeams.length > 1 && (
                <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="form-select">
                  <option value="all">All Teams</option>
                  {uniqueTeams.map(team => <option key={team} value={team}>{team}</option>)}
                </select>
              )}
            </div>
          </div>

          <table className="tl-table tl-team-members-table">
            <thead>
              <tr>
                <th>NAME</th>
                <th>EMAIL</th>
                <th>TEAM</th>
                <th>JOINED</th>
                <th>FILES</th>
                <th>STATUS</th>
                <th style={{textAlign: 'center'}}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => (
                <tr key={member.id}>
                  <td>
                    <strong>{member.name}</strong>
                  </td>
                  <td style={{color: 'var(--text-secondary)'}}>{member.email}</td>
                  <td>
                    <span style={{ background: '#f0f4ff', color: '#3b5bdb', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
                      {member.team || '—'}
                    </span>
                  </td>
                  <td style={{color: 'var(--text-secondary)'}}>{member.joined}</td>
                  <td>
                    <span className="tl-badge" style={{background: '#E0E7FF', color: 'var(--primary-color)'}}>
                      {member.files} files
                    </span>
                  </td>
                  <td>
                    <span className={`tl-badge ${member.status.toLowerCase()}`}>
                      {member.status}
                    </span>
                  </td>
                  <td style={{textAlign: 'center'}}>
                    <button 
                      className="tl-btn secondary"
                      onClick={() => fetchMemberFiles(member.id, member.name)}
                      title="View member files"
                      style={{padding: '0.5rem 1rem', fontSize: '14px'}}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M9 5H7C6.46957 5 5.96086 5.21071 5.58579 5.58579C5.21071 5.96086 5 6.46957 5 7V19C5 19.5304 5.21071 20.0391 5.58579 20.4142C5.96086 20.7893 6.46957 21 7 21H17C17.5304 21 18.0391 20.7893 18.4142 20.4142C18.7893 20.0391 19 19.5304 19 19V7C19 6.46957 18.7893 5.96086 18.4142 5.58579C18.0391 5.21071 17.5304 5 17 5H15M9 5C9 5.53043 9.21071 6.03914 9.58579 6.41421C9.96086 6.78929 10.4696 7 11 7H13C13.5304 7 14.0391 6.78929 14.4142 6.41421C14.7893 6.03914 15 5.53043 15 5M9 5C9 4.46957 9.21071 3.96086 9.58579 3.58579C9.96086 3.21071 10.4696 3 11 3H13C13.5304 3 14.0391 3.21071 14.4142 3.58579C14.7893 3.96086 15 4.46957 15 5M12 12H15M12 16H15M9 12H9.01M9 16H9.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      View Files
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tl-empty">
          <h3>No team members</h3>
          <p>Your team currently has no members.</p>
        </div>
      )}

      {/* No results after filtering */}
      {!isLoadingTeam && teamMembers.length > 0 && filteredMembers.length === 0 && (
        <div className="tl-empty" style={{marginTop: '1rem'}}>
          <h3>No results found</h3>
          <p>Try adjusting your search or filters.</p>
        </div>
      )}
    </div>
  )
}

export default TeamManagementTab
