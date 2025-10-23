const Sidebar = ({ activeTab, setActiveTab, filesCount, notificationCount, onLogout, user }) => {
  return (
    <div className="user-sidebar-component sidebar">
      {/* User Profile Section */}
      <div className="sidebar-profile">
        <div className="profile-avatar">
          {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
        </div>
        <div className="profile-info">
          <h3 className="profile-name">{user?.fullName || 'User'}</h3>
          <p className="profile-team">{user?.team || 'No Team'}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <button
          className={`sidebar-item ${activeTab === 'notification' ? 'active' : ''}`}
          onClick={() => setActiveTab('notification')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="nav-text">Notifications</span>
          {notificationCount > 0 && <span className="notification-badge">{notificationCount}</span>}
        </button>
        <button
          className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          <span className="nav-text">Dashboard</span>
        </button>
        <button
          className={`sidebar-item ${activeTab === 'team-files' ? 'active' : ''}`}
          onClick={() => setActiveTab('team-files')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span className="nav-text">Team Files</span>
        </button>
        <button
          className={`sidebar-item ${activeTab === 'my-files' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-files')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span className="nav-text">My Files</span>
          <span className="file-count">{filesCount}</span>
        </button>
        <button
          className={`sidebar-item ${activeTab === 'file-approvals' ? 'active' : ''}`}
          onClick={() => setActiveTab('file-approvals')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span className="nav-text">File Approvals</span>
        </button>
      </nav>

      {/* Logout Button */}
      <button className="sidebar-logout" onClick={onLogout}>
        <svg className="logout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span className="nav-text">Logout</span>
      </button>
    </div>
  );
};

export default Sidebar;