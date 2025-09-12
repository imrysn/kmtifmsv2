import { useEffect, useRef } from 'react'
import anime from 'animejs'
import './Dashboard.css'

const UserDashboard = ({ user, onLogout }) => {
  const dashboardRef = useRef(null)
  const headerRef = useRef(null)

  useEffect(() => {
    // Simple entrance animation
    anime({
      targets: headerRef.current,
      opacity: [0, 1],
      duration: 400,
      easing: 'easeOutCubic'
    })

    anime({
      targets: '.dashboard-card',
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 400,
      delay: anime.stagger(50, {start: 100}),
      easing: 'easeOutCubic'
    })
  }, [])

  const handleLogout = () => {
    onLogout()
  }

  return (
    <div className="minimal-dashboard user-dashboard" ref={dashboardRef}>
      <div className="dashboard-header" ref={headerRef}>
        <div className="header-content">
          <div className="header-info">
            <div className="header-title">
              <h1>User Portal</h1>
              <span className="role-badge user">{user.role}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </div>
      
      <div className="dashboard-content">
        <div className="dashboard-grid">
          {/* Welcome Card */}
          <div className="dashboard-card welcome-card">
            <div className="card-header">
              <h2>Welcome Back</h2>
              <p className="card-subtitle">Your personal workspace</p>
            </div>
            
            {user && (
              <div className="user-info-section">
                <div className="user-avatar">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="user-details">
                  <div className="user-detail-item">
                    <span className="detail-label">Email</span>
                    <span className="detail-value">{user.email}</span>
                  </div>
                  <div className="user-detail-item">
                    <span className="detail-label">Role</span>
                    <span className="detail-value role-highlight">{user.role}</span>
                  </div>
                  <div className="user-detail-item">
                    <span className="detail-label">User ID</span>
                    <span className="detail-value">#{user.id}</span>
                  </div>
                  <div className="user-detail-item">
                    <span className="detail-label">Member since</span>
                    <span className="detail-value">{new Date(user.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="success-indicator">
              <div className="success-content">
                <h3>Authentication Successful</h3>
                <p>You have successfully logged into your User Portal. All systems are operational and ready for use.</p>
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="dashboard-card quick-actions-card">
            <div className="card-header">
              <h3>Quick Actions</h3>
              <p className="card-subtitle">Frequently used features</p>
            </div>
            
            <div className="quick-actions-grid">
              <button className="quick-action-btn">
                <div className="action-icon">S</div>
                <span>Settings</span>
              </button>
              <button className="quick-action-btn">
                <div className="action-icon">A</div>
                <span>Analytics</span>
              </button>
              <button className="quick-action-btn">
                <div className="action-icon">M</div>
                <span>Messages</span>
              </button>
              <button className="quick-action-btn">
                <div className="action-icon">H</div>
                <span>Help</span>
              </button>
            </div>
          </div>

          {/* Features Grid Card */}
          <div className="dashboard-card features-card">
            <div className="card-header">
              <h3>Available Features</h3>
              <p className="card-subtitle">Explore what you can do</p>
            </div>
            
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">PA</div>
                <div className="feature-content">
                  <h4>Personal Analytics</h4>
                  <p>View your performance metrics and track your progress over time</p>
                  <div className="feature-status available">Available</div>
                </div>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon">TM</div>
                <div className="feature-content">
                  <h4>Task Management</h4>
                  <p>Organize and manage your personal tasks and assignments efficiently</p>
                  <div className="feature-status available">Available</div>
                </div>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon">PS</div>
                <div className="feature-content">
                  <h4>Profile Settings</h4>
                  <p>Customize your profile, preferences, and account settings</p>
                  <div className="feature-status available">Available</div>
                </div>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon">SC</div>
                <div className="feature-content">
                  <h4>Support Center</h4>
                  <p>Get help, submit tickets, and contact our support team</p>
                  <div className="feature-status available">Available</div>
                </div>
              </div>
            </div>
          </div>

          {/* Team Leader Notice (if applicable) */}
          {user.role === 'TEAM LEADER' && (
            <div className="dashboard-card team-leader-notice">
              <div className="notice-header">
                <div className="notice-icon">TL</div>
                <h3>Team Leader Access</h3>
              </div>
              
              <div className="notice-content">
                <p>You have additional privileges as a Team Leader. You can access the Admin Panel for team management features.</p>
                
                <div className="access-info">
                  <div className="access-item">
                    <span className="access-label">User Portal</span>
                    <span className="access-status current">Currently Active</span>
                  </div>
                  <div className="access-item">
                    <span className="access-label">Admin Panel</span>
                    <span className="access-status available">Switch Available</span>
                  </div>
                </div>
                
                <div className="switch-instruction">
                  <p>To access your Team Leader panel, logout and use the Admin Login option.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UserDashboard