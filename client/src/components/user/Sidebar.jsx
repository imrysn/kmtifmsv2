import { getSidebarIcon } from '../shared/FileIcon';
import './css/Sidebar.css';

const Sidebar = ({ activeTab, setActiveTab, filesCount, notificationCount, onLogout, user }) => {
  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="user-sidebar">
      {/* User Profile Section - Matching Admin Header */}
      <div className="sidebar-header">
        <div className="user-info">
          <div className="user-name">{user?.fullName || 'User'}</div>
          <div className="user-role">{user?.team || 'No Team'}</div>
        </div>
      </div>

      {/* Navigation - Matching Admin Nav */}
      <nav className="sidebar-nav">
        <button
          className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <span className="nav-icon">{getSidebarIcon('dashboard')}</span>
          <span className="nav-label">Dashboard</span>
        </button>
        <button
          className={`nav-item ${activeTab === 'notification' ? 'active' : ''}`}
          onClick={() => setActiveTab('notification')}
        >
          <span className="nav-icon notification-icon-wrapper">
            {getSidebarIcon('notifications')}
            {notificationCount > 0 && <span className="notification-badge">{notificationCount}</span>}
          </span>
          <span className="nav-label">Notifications</span>
        </button>
        <button
          className={`nav-item ${activeTab === 'my-files' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-files')}
        >
          <span className="nav-icon">{getSidebarIcon('files')}</span>
          <span className="nav-label">My Files</span>
        </button>
        <button
          className={`nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          <span className="nav-icon">{getSidebarIcon('tasks')}</span>
          <span className="nav-label">Tasks</span>
        </button>
        <button
          className={`nav-item ${activeTab === 'team-files' ? 'active' : ''}`}
          onClick={() => setActiveTab('team-files')}
        >
          <span className="nav-icon">{getSidebarIcon('users')}</span>
          <span className="nav-label">Team Tasks</span>
        </button>
      </nav>

      {/* Logout Button - Matching Admin Footer */}
      <div className="sidebar-footer">
        <button className="logout-btn" onClick={onLogout}>
          <span className="nav-icon">{getSidebarIcon('logout')}</span>
          <span className="logout-btn-text">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
