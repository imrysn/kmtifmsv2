import { getSidebarIcon } from '../admin/FileIcon';
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
          className={`nav-item ${activeTab === 'notification' ? 'active' : ''}`}
          onClick={() => setActiveTab('notification')}
        >
          <span className="nav-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="file-icon-svg">
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" fill="currentColor"/>
            </svg>
          </span>
          <span className="nav-label">Notifications</span>
          {notificationCount > 0 && <span className="notification-badge">{notificationCount}</span>}
        </button>
        <button
          className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <span className="nav-icon">{getSidebarIcon('dashboard')}</span>
          <span className="nav-label">Dashboard</span>
        </button>
        <button
          className={`nav-item ${activeTab === 'team-files' ? 'active' : ''}`}
          onClick={() => setActiveTab('team-files')}
        >
          <span className="nav-icon">{getSidebarIcon('users')}</span>
          <span className="nav-label">Team Files</span>
        </button>
        <button
          className={`nav-item ${activeTab === 'my-files' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-files')}
        >
          <span className="nav-icon">{getSidebarIcon('files')}</span>
          <span className="nav-label">My Files</span>
          {filesCount > 0 && <span className="file-count-badge">{filesCount}</span>}
        </button>
        <button
          className={`nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          <span className="nav-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="file-icon-svg">
              <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" fill="currentColor"/>
            </svg>
          </span>
          <span className="nav-label">Tasks</span>
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
