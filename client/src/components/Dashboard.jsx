import './Dashboard.css'

const Dashboard = ({ user, onLogout }) => {
  const handleLogout = () => {
    onLogout()
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </div>
      
      <div className="dashboard-content">
        <div className="welcome-card">
          <h2>Welcome to your Dashboard! 🎉</h2>
          {user && (
            <div className="user-info">
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>User ID:</strong> {user.id}</p>
              <p><strong>Account created:</strong> {new Date(user.created_at).toLocaleDateString()}</p>
            </div>
          )}
          
          <div className="success-message">
            <h3>✅ Login Successful!</h3>
            <p>You have successfully logged in to the desktop application.</p>
            <p>This is a placeholder dashboard page.</p>
          </div>
          
          <div className="tech-stack">
            <h3>Tech Stack Used:</h3>
            <ul>
              <li>Frontend: React + Vite</li>
              <li>Backend: Node.js + Express</li>
              <li>Framework: Electron</li>
              <li>Database: SQLite</li>
              <li>Authentication: bcryptjs</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
