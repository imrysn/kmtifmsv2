import './Dashboard.css'

const TeamLeaderDashboard = ({ user, onLogout }) => {
  const handleLogout = () => {
    onLogout()
  }

  return (
    <div className="dashboard-container team-leader-dashboard">
      <div className="dashboard-header">
        <div className="header-info">
          <h1>👥 Team Leader Panel</h1>
          <span className="role-badge team-leader">{user.role}</span>
        </div>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </div>
      
      <div className="dashboard-content">
        <div className="welcome-card">
          <h2>Welcome to your Team Leader Panel! 🚀</h2>
          {user && (
            <div className="user-info">
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Role:</strong> {user.role}</p>
              <p><strong>User ID:</strong> {user.id}</p>
              <p><strong>Access Level:</strong> Team Management</p>
            </div>
          )}
          
          <div className="success-message team-leader">
            <h3>✅ Team Leader Access Granted!</h3>
            <p>You have successfully logged in to the Team Leader Panel.</p>
            <p>Manage your team and access advanced features from here.</p>
          </div>
          
          <div className="features-section">
            <h3>👥 Team Leader Features:</h3>
            <div className="feature-grid">
              <div className="feature-card">
                <div className="feature-icon">👥</div>
                <h4>Team Management</h4>
                <p>Manage team members and their assignments</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">📈</div>
                <h4>Team Analytics</h4>
                <p>View team performance and statistics</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">📋</div>
                <h4>Project Oversight</h4>
                <p>Monitor and manage team projects</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">📊</div>
                <h4>Reports & Metrics</h4>
                <p>Generate team reports and track KPIs</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">⏰</div>
                <h4>Schedule Management</h4>
                <p>Manage team schedules and meetings</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🎯</div>
                <h4>Goal Setting</h4>
                <p>Set and track team objectives</p>
              </div>
            </div>
          </div>
          
          <div className="role-info team-leader">
            <h3>🔑 Access Information</h3>
            <p>As a Team Leader, you have dual access:</p>
            <ul>
              <li><strong>User Login:</strong> Access your personal user dashboard</li>
              <li><strong>Admin Login:</strong> Access this team management panel</li>
            </ul>
            <p>Switch between portals as needed for different tasks.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TeamLeaderDashboard
