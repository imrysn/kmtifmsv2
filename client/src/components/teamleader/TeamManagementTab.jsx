import { LoadingTable } from '../common/InlineSkeletonLoader'
import { useState, useMemo, useCallback, useEffect, memo } from 'react'
import { apiFetch } from '@/config/api'
import UserPerformanceCard from '../shared/UserPerformanceCard'
import PerformanceDemo from '../shared/PerformanceDemo'
import './css/TeamManagementTab.css'

const MemberCard = memo(({ member, bulkPerformance, memberScores, handleScoreLoad }) => {
  const score = memberScores[member.id] || 0;
  const isStar = score > 100;
  const isExcellent = score >= 85 && score <= 100;

  // Stable callback for this specific member
  const onPerformanceLoad = useCallback((data) => {
    handleScoreLoad(member.id, data);
  }, [handleScoreLoad, member.id]);

  return (
    <div className={`member-perf-wrapper ${isStar ? 'card-star' : isExcellent ? 'card-excellent' : ''}`}>
      {isStar && (
        <div className="perf-star-badge">
          <span>TOP</span>
        </div>
      )}
      {isExcellent && (
        <div className="perf-star-badge badge-excellent">
          <span>PRO</span>
        </div>
      )}

      <div className="member-perf-header">
        <div className="member-avatar-placeholder">
          {member.name.substring(0, 2).toUpperCase()}
        </div>
        <div className="member-info">
          <h3>{member.name}</h3>
          <span className="member-email">{member.email}</span>
        </div>
      </div>
      <UserPerformanceCard
        user={member}
        isCollapsible={true}
        performanceData={bulkPerformance[member.id]}
        onPerformanceLoad={onPerformanceLoad}
      />
    </div>
  );
});
MemberCard.displayName = 'MemberCard';

const TeamManagementTab = ({
  isLoadingTeam,
  teamMembers,
  fetchMemberFiles
}) => {

  const [viewMode, setViewMode] = useState('performance') // 'table' or 'performance'
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState('name-asc')
  const [memberScores, setMemberScores] = useState({})
  const [bulkPerformance, setBulkPerformance] = useState({})
  const [isBulkLoading, setIsBulkLoading] = useState(false)
  const [teamFilter, setTeamFilter] = useState('all')

  // Track performance scores to determine framing (Star/Excellent)
  const handleScoreLoad = useCallback((userId, data) => {
    setMemberScores(prev => {
      if (prev[userId] === data.overallScore) return prev;
      return { ...prev, [userId]: data.overallScore };
    });
  }, []);

  const fetchBulkPerformance = useCallback(async () => {
    if (Object.keys(bulkPerformance).length > 0) return;
    setIsBulkLoading(true);
    try {
      const data = await apiFetch('/api/dashboard/bulk-performance');
      if (data.success) {
        setBulkPerformance(data.performanceMap || {});
        const scores = {};
        Object.entries(data.performanceMap).forEach(([id, perf]) => {
          scores[id] = perf.overallScore;
        });
        setMemberScores(scores);
      }
    } catch (error) {
      console.error('Error fetching bulk performance:', error);
    } finally {
      setIsBulkLoading(false);
    }
  }, [bulkPerformance]);

  useEffect(() => {
    if (viewMode === 'performance') {
      fetchBulkPerformance();
    }
  }, [viewMode, fetchBulkPerformance]);

  const uniqueTeams = useMemo(() => {
    const teams = new Set(teamMembers.map(m => m.team).filter(Boolean))
    return Array.from(teams).sort()
  }, [teamMembers])

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
        case 'name-asc': return (a.name || '').localeCompare(b.name || '')
        case 'name-desc': return (b.name || '').localeCompare(a.name || '')
        case 'files-desc': return (b.files || 0) - (a.files || 0)
        case 'files-asc': return (a.files || 0) - (b.files || 0)
        case 'joined-desc': return new Date(b.joined || 0) - new Date(a.joined || 0)
        case 'joined-asc': return new Date(a.joined || 0) - new Date(b.joined || 0)
        default: return 0
      }
    })

    return result
  }, [teamMembers, searchQuery, statusFilter, teamFilter, sortOrder])

  return (
    <div className="tl-content">
      {/* DEMO SECTION */}
      <div className="visual-tier-demo-container">
        <div className="demo-header">
          <span className="demo-preview-tag">Preview</span>
          <h2 className="demo-title">Visual Tier Demo</h2>
        </div>
        <PerformanceDemo />
      </div>

      <div className="team-management-controls">
        <div className="view-toggle-group">
          <button
            className={`view-toggle-btn ${viewMode === 'performance' ? 'active' : ''}`}
            onClick={() => setViewMode('performance')}
          >
            Performance View
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
          >
            Directory View
          </button>
        </div>

        <div className="filter-group">
          <div className="search-input-wrapper">
            <svg className="search-icon-sm" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="filter-select"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
          >
            <option value="all">All Teams</option>
            {uniqueTeams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <select
            className="filter-select"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="files-desc">Most Files</option>
            <option value="files-asc">Least Files</option>
            <option value="joined-desc">Newest Joined</option>
            <option value="joined-asc">Oldest Joined</option>
          </select>
        </div>
      </div>

      {isLoadingTeam ? (
        <LoadingTable />
      ) : viewMode === 'performance' ? (
        <div className="performance-grid">
          {filteredMembers.map(member => (
            <MemberCard
              key={member.id}
              member={member}
              bulkPerformance={bulkPerformance}
              memberScores={memberScores}
              handleScoreLoad={handleScoreLoad}
            />
          ))}
        </div>
      ) : (
        <div className="team-members-table-container">
          <table className="members-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Team</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Files</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map(member => (
                <tr key={member.id}>
                  <td>
                    <div className="member-name-cell">
                      <div className="member-avatar-sm">
                        {member.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: '700', color: '#0f172a' }}>{member.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="tl-badge-team">{member.team}</span>
                  </td>
                  <td>
                    <span className={`status-badge status-${member.status?.toLowerCase() || 'active'}`}>
                      {member.status || 'Active'}
                    </span>
                  </td>
                  <td>{member.joined}</td>
                  <td>
                    <span style={{ fontWeight: '700', color: '#0f172a' }}>{member.files || 0}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="view-files-btn"
                      onClick={() => fetchMemberFiles(member.id, member.name)}
                    >
                      View Files
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default memo(TeamManagementTab)
