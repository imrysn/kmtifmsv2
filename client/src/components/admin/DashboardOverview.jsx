import './DashboardOverview.css'

const DashboardOverview = ({ user, users }) => {
  return (
    <div className="dashboard-overview">
      <div className="page-header">
        <h1>System Overview</h1>
        <p>Welcome back, {user.fullName || 'Administrator'}! Here's your system status.</p>
      </div>
      
      <div className="stats-section">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon users-icon">U</div>
            <div className="stat-info">
              <div className="stat-number">{users.length}</div>
              <div className="stat-label">Total Users</div>
              <div className="stat-change positive">+2 this week</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon admins-icon">A</div>
            <div className="stat-info">
              <div className="stat-number">{users.filter(u => u.role === 'ADMIN').length}</div>
              <div className="stat-label">Administrators</div>
              <div className="stat-change neutral">No change</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon leaders-icon">L</div>
            <div className="stat-info">
              <div className="stat-number">{users.filter(u => u.role === 'TEAM LEADER').length}</div>
              <div className="stat-label">Team Leaders</div>
              <div className="stat-change positive">+1 this month</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon users-only-icon">M</div>
            <div className="stat-info">
              <div className="stat-number">{users.filter(u => u.role === 'USER').length}</div>
              <div className="stat-label">Regular Users</div>
              <div className="stat-change positive">+1 this week</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="admin-features-section">
        <div className="features-header">
          <h2>Administration Features</h2>
          <p>Comprehensive system management tools</p>
        </div>
        
        <div className="admin-features-grid">
          <div className="admin-feature-card">
            <div className="feature-header">
              <div className="feature-icon">UM</div>
              <h3>User Management</h3>
            </div>
            <p>Create, edit, and manage user accounts with role-based permissions and team assignments.</p>
            <ul>
              <li>CRUD operations for all users</li>
              <li>Role assignment and permissions</li>
              <li>Team organization</li>
              <li>Password management</li>
            </ul>
          </div>
          
          <div className="admin-feature-card">
            <div className="feature-header">
              <div className="feature-icon">SA</div>
              <h3>Security & Access</h3>
            </div>
            <p>Monitor system access, manage authentication, and maintain security protocols.</p>
            <ul>
              <li>Access control management</li>
              <li>Login monitoring</li>
              <li>Security audit trails</li>
              <li>Permission management</li>
            </ul>
          </div>
          
          <div className="admin-feature-card">
            <div className="feature-header">
              <div className="feature-icon">AR</div>
              <h3>Analytics & Reports</h3>
            </div>
            <p>Generate comprehensive reports and analyze system usage patterns and trends.</p>
            <ul>
              <li>User activity reports</li>
              <li>System usage analytics</li>
              <li>Performance metrics</li>
              <li>Export capabilities</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardOverview
