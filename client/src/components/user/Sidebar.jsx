const Sidebar = ({ activeTab, setActiveTab, filesCount, onLogout, user }) => {
  return (
    <div className="sidebar">
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
          <span className="nav-icon">🔔</span>
          <span className="nav-text">Notifications</span>
        </button>
        <button
          className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <span className="nav-icon">🏠</span>
          <span className="nav-text">Dashboard</span>
        </button>
        <button
          className={`sidebar-item ${activeTab === 'team-files' ? 'active' : ''}`}
          onClick={() => setActiveTab('team-files')}
        >
          <span className="nav-icon">👥</span>
          <span className="nav-text">Team Files</span>
        </button>
        <button
          className={`sidebar-item ${activeTab === 'my-files' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-files')}
        >
          <span className="nav-icon">📁</span>
          <span className="nav-text">My Files ({filesCount})</span>
        </button>
        <button
          className={`sidebar-item ${activeTab === 'file-approvals' ? 'active' : ''}`}
          onClick={() => setActiveTab('file-approvals')}
        >
          <span className="nav-icon">📋</span>
          <span className="nav-text">File Approvals</span>
        </button>
      </nav>

      {/* Logout Button */}
      <button className="sidebar-logout" onClick={onLogout}>
        <span className="nav-icon">🚪</span>
        <span className="nav-text">Logout</span>
      </button>
    </div>
  );
};

export default Sidebar;