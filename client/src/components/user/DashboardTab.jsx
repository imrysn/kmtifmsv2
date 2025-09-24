import './css/DashboardTab.css';

const DashboardTab = ({ user, files, setActiveTab }) => {
  return (
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
                <span className="detail-label">Full Name</span>
                <span className="detail-value">{user.fullName}</span>
              </div>
              <div className="user-detail-item">
                <span className="detail-label">Email</span>
                <span className="detail-value">{user.email}</span>
              </div>
              <div className="user-detail-item">
                <span className="detail-label">Team</span>
                <span className="detail-value team-highlight">{user.team}</span>
              </div>
              <div className="user-detail-item">
                <span className="detail-label">Role</span>
                <span className="detail-value role-highlight">{user.role}</span>
              </div>
            </div>
          </div>
        )}
        
        <div className="success-indicator">
          <div className="success-content">
            <h3>Authentication Successful</h3>
            <p>You have successfully logged into your User Portal. You can now upload files for review and track their approval status.</p>
          </div>
        </div>
      </div>

      {/* File Status Overview */}
      <div className="dashboard-card files-overview-card">
        <div className="card-header">
          <h3>Files Overview</h3>
          <p className="card-subtitle">Your file submission status</p>
        </div>
        
        <div className="files-stats">
          <div className="file-stat">
            <div className="stat-number">{files.length}</div>
            <div className="stat-label">Total Files</div>
          </div>
          <div className="file-stat">
            <div className="stat-number">{files.filter(f => f.current_stage.includes('pending')).length}</div>
            <div className="stat-label">Under Review</div>
          </div>
          <div className="file-stat">
            <div className="stat-number">{files.filter(f => f.status === 'final_approved').length}</div>
            <div className="stat-label">Approved</div>
          </div>
          <div className="file-stat">
            <div className="stat-number">{files.filter(f => f.status.includes('rejected')).length}</div>
            <div className="stat-label">Rejected</div>
          </div>
        </div>

        <div className="file-actions">
          <button 
            className="action-btn primary"
            onClick={() => setActiveTab('upload')}
          >
            Submit New File
          </button>
          <button 
            className="action-btn secondary"
            onClick={() => setActiveTab('my-files')}
          >
            View My Files
          </button>
        </div>
      </div>

      {/* File Approval Workflow Info */}
      <div className="dashboard-card workflow-info-card">
        <div className="card-header">
          <h3>File Approval Process</h3>
          <p className="card-subtitle">How your files get reviewed</p>
        </div>
        
        <div className="workflow-steps">
          <div className="workflow-step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h4>Upload File</h4>
              <p>Submit your file with description for review</p>
            </div>
          </div>
          <div className="workflow-step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h4>Team Leader Review</h4>
              <p>Your team leader reviews and approves/rejects</p>
            </div>
          </div>
          <div className="workflow-step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h4>Admin Review</h4>
              <p>Final approval by system administrator</p>
            </div>
          </div>
          <div className="workflow-step">
            <div className="step-number">4</div>
            <div className="step-content">
              <h4>Public Network</h4>
              <p>Approved files are published to public network</p>
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
            <p>You have additional privileges as a Team Leader. You can access the Admin Panel for team management features and file approval.</p>
            
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
  );
};

export default DashboardTab;