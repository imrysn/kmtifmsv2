import { useEffect, useRef } from 'react'
import anime from 'animejs'
import './Dashboard.css'

const TeamLeaderDashboard = ({ user, onLogout }) => {
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
      delay: anime.stagger(60, {start: 150}),
      easing: 'easeOutCubic'
    })

    // Simple stat counter animation
    anime({
      targets: '.stat-number',
      innerHTML: [0, (el) => el.getAttribute('data-count')],
      duration: 1200,
      delay: 600,
      round: 1,
      easing: 'easeOutQuart'
    })
  }, [])

  const handleLogout = () => {
    onLogout()
  }

  return (
    <div className="minimal-dashboard team-leader-dashboard" ref={dashboardRef}>
      <div className="dashboard-header" ref={headerRef}>
        <div className="header-content">
          <div className="header-info">
            <div className="header-title">
              <h1>Team Leader Panel</h1>
              <span className="role-badge team-leader">{user.role}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </div>
      
      <div className="dashboard-content">
        <div className="dashboard-grid">
          {/* Team Overview Card */}
          <div className="dashboard-card team-overview-card">
            <div className="card-header">
              <h2>Team Leadership Hub</h2>
              <p className="card-subtitle">Manage your team effectively</p>
            </div>
            
            {user && (
              <div className="leader-info-section">
                <div className="leader-avatar">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'TL'}
                </div>
                <div className="leader-details">
                  <div className="leader-name">{user.fullName || 'Team Leader'}</div>
                  <div className="leader-email">{user.email}</div>
                  <div className="access-level">Team Management Access</div>
                </div>
              </div>
            )}
            
            <div className="team-stats">
              <div className="stat-item">
                <div className="stat-number" data-count="12">0</div>
                <div className="stat-label">Team Members</div>
              </div>
              <div className="stat-item">
                <div className="stat-number" data-count="8">0</div>
                <div className="stat-label">Active Projects</div>
              </div>
              <div className="stat-item">
                <div className="stat-number" data-count="94">0</div>
                <div className="stat-label">Completion Rate</div>
              </div>
            </div>
            
            <div className="success-indicator team-leader">
              <div className="success-content">
                <h3>Team Leader Access Granted</h3>
                <p>You have successfully accessed your Team Leadership Panel. All team management features are now available.</p>
              </div>
            </div>
          </div>

          {/* Quick Team Actions */}
          <div className="dashboard-card quick-actions-card">
            <div className="card-header">
              <h3>Quick Team Actions</h3>
              <p className="card-subtitle">Manage your team efficiently</p>
            </div>
            
            <div className="team-actions-grid">
              <button className="team-action-btn">
                <div className="action-icon">T</div>
                <div className="action-content">
                  <span className="action-title">View Team</span>
                  <span className="action-desc">12 members</span>
                </div>
              </button>
              <button className="team-action-btn">
                <div className="action-icon">P</div>
                <div className="action-content">
                  <span className="action-title">Projects</span>
                  <span className="action-desc">8 active</span>
                </div>
              </button>
              <button className="team-action-btn">
                <div className="action-icon">R</div>
                <div className="action-content">
                  <span className="action-title">Reports</span>
                  <span className="action-desc">Weekly</span>
                </div>
              </button>
              <button className="team-action-btn">
                <div className="action-icon">S</div>
                <div className="action-content">
                  <span className="action-title">Schedule</span>
                  <span className="action-desc">3 meetings</span>
                </div>
              </button>
            </div>
          </div>

          {/* Team Features */}
          <div className="dashboard-card team-features-card">
            <div className="card-header">
              <h3>Team Management Features</h3>
              <p className="card-subtitle">Comprehensive team leadership tools</p>
            </div>
            
            <div className="team-features-grid">
              <div className="team-feature-card">
                <div className="feature-header">
                  <div className="feature-icon">TM</div>
                  <h4>Team Management</h4>
                </div>
                <p>Manage team members, roles, and responsibilities. View team hierarchy and assignments.</p>
                <div className="feature-actions">
                  <button className="feature-btn primary">Manage Team</button>
                </div>
              </div>
              
              <div className="team-feature-card">
                <div className="feature-header">
                  <div className="feature-icon">TA</div>
                  <h4>Team Analytics</h4>
                </div>
                <p>Track team performance metrics, productivity trends, and goal achievements.</p>
                <div className="feature-actions">
                  <button className="feature-btn primary">View Analytics</button>
                </div>
              </div>
              
              <div className="team-feature-card">
                <div className="feature-header">
                  <div className="feature-icon">PO</div>
                  <h4>Project Oversight</h4>
                </div>
                <p>Monitor project progress, deadlines, and resource allocation across all team projects.</p>
                <div className="feature-actions">
                  <button className="feature-btn primary">View Projects</button>
                </div>
              </div>
              
              <div className="team-feature-card">
                <div className="feature-header">
                  <div className="feature-icon">RK</div>
                  <h4>Reports & KPIs</h4>
                </div>
                <p>Generate comprehensive reports and track key performance indicators for your team.</p>
                <div className="feature-actions">
                  <button className="feature-btn primary">Generate Reports</button>
                </div>
              </div>
              
              <div className="team-feature-card">
                <div className="feature-header">
                  <div className="feature-icon">SM</div>
                  <h4>Schedule Management</h4>
                </div>
                <p>Coordinate team schedules, meetings, and important milestones efficiently.</p>
                <div className="feature-actions">
                  <button className="feature-btn primary">Manage Schedule</button>
                </div>
              </div>
              
              <div className="team-feature-card">
                <div className="feature-header">
                  <div className="feature-icon">GS</div>
                  <h4>Goal Setting</h4>
                </div>
                <p>Set team objectives, track progress, and celebrate achievements together.</p>
                <div className="feature-actions">
                  <button className="feature-btn primary">Set Goals</button>
                </div>
              </div>
            </div>
          </div>

          {/* Access Information */}
          <div className="dashboard-card access-info-card">
            <div className="card-header">
              <div className="info-icon">DA</div>
              <div>
                <h3>Dual Access Information</h3>
                <p className="card-subtitle">Your leadership privileges</p>
              </div>
            </div>
            
            <div className="access-info-content">
              <p className="access-description">
                As a Team Leader, you have dual access to both user and administrative interfaces.
              </p>
              
              <div className="access-types">
                <div className="access-type">
                  <div className="access-icon">U</div>
                  <div className="access-details">
                    <h4>User Login Portal</h4>
                    <p>Access your personal user dashboard and individual features</p>
                    <span className="access-badge user">Personal Access</span>
                  </div>
                </div>
                
                <div className="access-type current">
                  <div className="access-icon">A</div>
                  <div className="access-details">
                    <h4>Admin Login Panel</h4>
                    <p>Access team management features and administrative tools</p>
                    <span className="access-badge team-leader">Currently Active</span>
                  </div>
                </div>
              </div>
              
              <div className="switch-info">
                <div className="switch-tip">
                  <span>Switch between portals anytime to access different functionalities based on your current needs.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TeamLeaderDashboard