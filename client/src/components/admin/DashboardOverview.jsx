import './DashboardOverview.css'
import { useEffect, useState } from 'react'

const DashboardOverview = ({ user, users }) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState({
    totalFiles: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    fileTypes: [],
    recentActivity: [],
    approvalRate: 0
  })

  useEffect(() => {
    let mounted = true
    const fetchSummary = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('http://localhost:3001/api/dashboard/summary')
        const data = await res.json()
        if (!mounted) return
        if (data.success) {
          setSummary(data.summary)
        } else {
          setError(data.message || 'Failed to load dashboard data')
        }
      } catch (err) {
        console.error('Error fetching dashboard summary:', err)
        if (!mounted) return
        setError('Unable to connect to server')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchSummary()
    // optionally refresh every minute
    const interval = setInterval(fetchSummary, 60 * 1000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  const pendingCount = summary.pending
  const approvedCount = summary.approved
  const rejectedCount = summary.rejected
  const totalCount = summary.totalFiles
  return (
    <div className="dashboard-overview">
      
      {/* Stats Grid */}
      <div className="stats-section">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Pending Files</span>
            </div>
            <div className="stat-number">{loading ? '—' : pendingCount}</div>
            <div className="stat-change positive">↑ +8.2% from last month</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Approved Files</span>
            </div>
            <div className="stat-number">{loading ? '—' : approvedCount.toLocaleString()}</div>
            <div className="stat-change positive">↑ +12.5% from last month</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Rejected Files</span>
            </div>
            <div className="stat-number">{loading ? '—' : rejectedCount}</div>
            <div className="stat-change negative">↓ -15.1% from last month</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Total Files</span>
            </div>
            <div className="stat-number">{loading ? '—' : totalCount.toLocaleString()}</div>
            <div className="stat-change positive">↑ +6.8% from last month</div>
          </div>
        </div>
      </div>

      {/* Workflow Status Cards */}
      <div className="workflow-grid">
        <div className="workflow-card blue">
          <div className="workflow-title">Awaiting Team Leader</div>
          <div className="workflow-number">{loading ? '—' : summary.recentActivity.filter(a => a.activity && a.activity.toLowerCase().includes('team leader')).length}</div>
          <div className="workflow-subtitle">Files under review</div>
        </div>
        
        <div className="workflow-card yellow">
          <div className="workflow-title">Awaiting Admin</div>
          <div className="workflow-number">{loading ? '—' : summary.recentActivity.filter(a => a.activity && a.activity.toLowerCase().includes('admin')).length}</div>
          <div className="workflow-subtitle">Ready for final approval</div>
        </div>
        
        <div className="workflow-card green">
          <div className="workflow-title">Ready for NAS</div>
          <div className="workflow-number">{loading ? '—' : approvedCount}</div>
          <div className="workflow-subtitle">Approved files to upload</div>
        </div>
      </div>

      {/* Charts and Stats */}
      <div className="charts-section">
        <div className="chart-card">
          <div className="chart-header">
            <h3>File Approval Trends</h3>
          </div>
          <div className="chart-content">
            <svg width="100%" height="300" style={{ background: 'transparent' }}>
              {/* Simple line chart placeholder */}
              <line x1="50" y1="200" x2="150" y2="150" stroke="#10B981" strokeWidth="2" />
              <line x1="150" y1="150" x2="250" y2="120" stroke="#10B981" strokeWidth="2" />
              <line x1="250" y1="120" x2="350" y2="140" stroke="#10B981" strokeWidth="2" />
              <line x1="350" y1="140" x2="450" y2="100" stroke="#10B981" strokeWidth="2" />
              <line x1="450" y1="100" x2="550" y2="80" stroke="#10B981" strokeWidth="2" />
              <line x1="550" y1="80" x2="650" y2="60" stroke="#10B981" strokeWidth="2" />
              
              <line x1="50" y1="220" x2="150" y2="210" stroke="#EF4444" strokeWidth="2" />
              <line x1="150" y1="210" x2="250" y2="215" stroke="#EF4444" strokeWidth="2" />
              <line x1="250" y1="215" x2="350" y2="210" stroke="#EF4444" strokeWidth="2" />
              <line x1="350" y1="210" x2="450" y2="220" stroke="#EF4444" strokeWidth="2" />
              <line x1="450" y1="220" x2="550" y2="215" stroke="#EF4444" strokeWidth="2" />
              <line x1="550" y1="215" x2="650" y2="220" stroke="#EF4444" strokeWidth="2" />
              
              <text x="100" y="280" fontSize="12" fill="#6B7280">Jan</text>
              <text x="200" y="280" fontSize="12" fill="#6B7280">Feb</text>
              <text x="300" y="280" fontSize="12" fill="#6B7280">Mar</text>
              <text x="400" y="280" fontSize="12" fill="#6B7280">Apr</text>
              <text x="500" y="280" fontSize="12" fill="#6B7280">May</text>
              <text x="600" y="280" fontSize="12" fill="#6B7280">Jun</text>
            </svg>
          </div>
        </div>
        
        <div className="chart-card">
          <div className="chart-header">
            <h3>File Types</h3>
          </div>
          <div className="chart-content">
            {/* Simple donut chart placeholder */}
            <svg width="100%" height="300" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="70" fill="none" stroke="#6366F1" strokeWidth="30" strokeDasharray="220 440" />
              <circle cx="100" cy="100" r="70" fill="none" stroke="#10B981" strokeWidth="30" strokeDasharray="110 440" strokeDashoffset="-220" />
              <circle cx="100" cy="100" r="70" fill="none" stroke="#F59E0B" strokeWidth="30" strokeDasharray="66 440" strokeDashoffset="-330" />
              <circle cx="100" cy="100" r="70" fill="none" stroke="#EF4444" strokeWidth="30" strokeDasharray="44 440" strokeDashoffset="-396" />
            </svg>
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {summary.fileTypes.slice(0,4).map((t, i) => (
                  <span key={t.file_type}>
                    <span style={{ color: ['#6366F1','#10B981','#F59E0B','#EF4444'][i] || '#999' }}>■</span>
                    &nbsp;{t.file_type || 'Unknown'} ({t.count}) &nbsp;
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="bottom-section">
        <div className="section-card">
          <div className="section-header">
            <h3>Recent Activity</h3>
          </div>
          <div className="activity-list">
            {loading && <div style={{ padding: '1rem' }}>Loading recent activity…</div>}
            {!loading && summary.recentActivity.length === 0 && <div style={{ padding: '1rem' }}>No recent activity</div>}
            {!loading && summary.recentActivity.map(act => (
              <div className="activity-item" key={act.id}>
                <div className="activity-content">
                  <div className="activity-header">
                    <span className="activity-user">{act.username || act.role || 'System'}</span>
                    <span className={"activity-badge " + (act.activity && act.activity.toLowerCase().includes('approved') ? 'approved' : act.activity && act.activity.toLowerCase().includes('rejected') ? 'rejected' : 'upload')}>{(act.activity || '').split(' ')[0]}</span>
                  </div>
                  <div className="activity-description">{act.activity}</div>
                  <div className="activity-meta">{new Date(act.timestamp).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="section-card">
          <div className="section-header">
            <h3>System Stats</h3>
          </div>
          <div className="stats-list">
            <div className="stats-item">
              <span className="stats-label">Approval Rate</span>
                <span className="stats-value success">{loading ? '—' : `${summary.approvalRate}%`}</span>
            </div>
            <div className="stats-item">
              <span className="stats-label">Avg. Processing Time</span>
              <span className="stats-value">2.1 days</span>
            </div>
            <div className="stats-item">
              <span className="stats-label">Storage Used</span>
              <span className="stats-value">67.8%</span>
            </div>
            <div className="stats-item">
              <span className="stats-label">Active Users</span>
              <span className="stats-value">{users.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardOverview