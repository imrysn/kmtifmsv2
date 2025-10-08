import './DashboardOverview.css'

const DashboardOverview = ({ user, users }) => {
  const pendingCount = 127
  const approvedCount = 1842
  const rejectedCount = 23
  const totalCount = 3156

  return (
    <div className="dashboard-overview">
      <div className="page-header">
        <h1>File Approval Dashboard</h1>
        <p>Monitor and manage engineering file submissions, approvals, and workflow status.</p>
      </div>
      
      {/* Stats Grid */}
      <div className="stats-section">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Pending Files</span>
            </div>
            <div className="stat-number">{pendingCount}</div>
            <div className="stat-change positive">↑ +8.2% from last month</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Approved Files</span>
            </div>
            <div className="stat-number">{approvedCount.toLocaleString()}</div>
            <div className="stat-change positive">↑ +12.5% from last month</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Rejected Files</span>
            </div>
            <div className="stat-number">{rejectedCount}</div>
            <div className="stat-change negative">↓ -15.1% from last month</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Total Files</span>
            </div>
            <div className="stat-number">{totalCount.toLocaleString()}</div>
            <div className="stat-change positive">↑ +6.8% from last month</div>
          </div>
        </div>
      </div>

      {/* Workflow Status Cards */}
      <div className="workflow-grid">
        <div className="workflow-card blue">
          <div className="workflow-title">Awaiting Team Leader</div>
          <div className="workflow-number">23</div>
          <div className="workflow-subtitle">Files under review</div>
        </div>
        
        <div className="workflow-card yellow">
          <div className="workflow-title">Awaiting Admin</div>
          <div className="workflow-number">8</div>
          <div className="workflow-subtitle">Ready for final approval</div>
        </div>
        
        <div className="workflow-card green">
          <div className="workflow-title">Ready for NAS</div>
          <div className="workflow-number">45</div>
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
                <span style={{ color: '#6366F1' }}>■</span> CAD Files &nbsp;
                <span style={{ color: '#10B981' }}>■</span> Documents &nbsp;
                <span style={{ color: '#F59E0B' }}>■</span> Drawings &nbsp;
                <span style={{ color: '#EF4444' }}>■</span> Other
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
            <div className="activity-item">
              <div className="activity-content">
                <div className="activity-header">
                  <span className="activity-user">Mike Rodriguez</span>
                  <span className="activity-badge upload">Upload</span>
                </div>
                <div className="activity-description">Submitted CAD file for approval</div>
                <div className="activity-meta">engine_design_v2.dwg • 5 minutes ago</div>
              </div>
            </div>
            
            <div className="activity-item">
              <div className="activity-content">
                <div className="activity-header">
                  <span className="activity-user">Sarah Chen</span>
                  <span className="activity-badge approved">Approved</span>
                </div>
                <div className="activity-description">Approved file from Engineering team</div>
                <div className="activity-meta">structural_analysis.pdf • 12 minutes ago</div>
              </div>
            </div>
            
            <div className="activity-item">
              <div className="activity-content">
                <div className="activity-header">
                  <span className="activity-user">Admin</span>
                  <span className="activity-badge rejected">Rejected</span>
                </div>
                <div className="activity-description">Rejected file due to format issues</div>
                <div className="activity-meta">blueprint_scan.jpg • 25 minutes ago</div>
              </div>
            </div>
            
            <div className="activity-item">
              <div className="activity-content">
                <div className="activity-header">
                  <span className="activity-user">Emily Johnson</span>
                  <span className="activity-badge upload">Upload</span>
                </div>
                <div className="activity-description">Uploaded final design document</div>
                <div className="activity-meta">final_specifications.pdf • 1 hour ago</div>
              </div>
            </div>
            
            <div className="activity-item">
              <div className="activity-content">
                <div className="activity-header">
                  <span className="activity-user">David Park</span>
                  <span className="activity-badge approved">Approved</span>
                </div>
                <div className="activity-description">Completed team leader review</div>
                <div className="activity-meta">quality_report.xlsx • 2 hours ago</div>
              </div>
            </div>
            
            <div className="activity-item">
              <div className="activity-content">
                <div className="activity-header">
                  <span className="activity-user">System</span>
                  <span className="activity-badge upload">System</span>
                </div>
                <div className="activity-description">Files uploaded to NAS storage</div>
                <div className="activity-meta">Batch: 15 files • 3 hours ago</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="section-card">
          <div className="section-header">
            <h3>System Stats</h3>
          </div>
          <div className="stats-list">
            <div className="stats-item">
              <span className="stats-label">Approval Rate</span>
              <span className="stats-value success">94.2%</span>
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