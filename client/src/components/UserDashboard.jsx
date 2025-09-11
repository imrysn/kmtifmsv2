import './Dashboard.css'

const UserDashboard = ({ user, onLogout }) => {
  const handleLogout = () => {
    onLogout()
  }

  return (
    <div className="dashboard-container user-dashboard">
      <div className="dashboard-header">
        <div className="header-info">
          <h1>👤 User Dashboard</h1>
          <span className="role-badge user">{user.role}</span>
        </div>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </div>
      
      <div className="dashboard-content">
        <div className="welcome-card">
          <h2>Welcome to your User Portal! 🎉</h2>
          {user && (
            <div className="user-info">
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Role:</strong> {user.role}</p>
              <p><strong>User ID:</strong> {user.id}</p>
              <p><strong>Account created:</strong> {new Date(user.created_at).toLocaleDateString()}</p>
            </div>
          )}
          
          <div className="success-message user">
            <h3>✅ User Login Successful!</h3>
            <p>You have successfully logged in to the User Portal.</p>
            <p>This is your personal dashboard where you can access user-specific features.</p>
          </div>
          
          <div className="features-section">
            <h3>👤 User Features:</h3>
            <div className="feature-grid">
              <div className="feature-card">
                <div className="feature-icon">📊</div>
                <h4>Personal Analytics</h4>
                <p>View your personal statistics and progress</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">📝</div>
                <h4>Task Management</h4>
                <p>Manage your personal tasks and assignments</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">⚙️</div>
                <h4>Profile Settings</h4>
                <p>Update your profile and preferences</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">📞</div>
                <h4>Support Center</h4>
                <p>Get help and contact support team</p>
              </div>
            </div>
          </div>
          
          {user.role === 'TEAM LEADER' && (
            <div className="role-info team-leader">
              <h3>💡 Team Leader Notice</h3>
              <p>As a Team Leader, you also have access to the <strong>Admin Login</strong> for team management features.</p>
              <p>Logout and switch to Admin Login to access your team leader panel.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UserDashboard
