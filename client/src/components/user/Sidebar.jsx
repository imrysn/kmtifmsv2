import { memo, useCallback } from 'react';
import { getSidebarIcon } from '../shared/FileIcon';
import Avatar from '../shared/Avatar';
import './css/Sidebar.css';

const Sidebar = memo(({ activeTab, setActiveTab, filesCount, notificationCount, onLogout, user }) => {
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
  }, [setActiveTab]);

  return (
    <div className="user-sidebar">
      {/* User Profile Section */}
      <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Avatar user={user} size="md" editable />
        <div className="user-text" style={{ flex: 1, minWidth: 0 }}>
          <div className="user-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.fullName || 'User'}</div>
          <div className="user-role" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.role === 'TEAM_LEADER' || user?.role === 'ADMIN'
              ? (user?.ledTeams?.length > 0 ? user.ledTeams.map(t => t.name).join(', ') : (user?.team || 'No Team'))
              : (user?.team || 'No Team')}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <button
          className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => handleTabChange('dashboard')}
        >
          <span className="nav-icon">{getSidebarIcon('dashboard')}</span>
          <span className="nav-label">Dashboard</span>
        </button>
        <button
          className={`nav-item ${activeTab === 'notification' ? 'active' : ''}`}
          onClick={() => handleTabChange('notification')}
        >
          <span className="nav-icon notification-icon-wrapper">
            {getSidebarIcon('notifications')}
            {notificationCount > 0 && <span className="notification-badge">{notificationCount}</span>}
          </span>
          <span className="nav-label">Notifications</span>
        </button>
        <button
          className={`nav-item ${activeTab === 'my-files' ? 'active' : ''}`}
          onClick={() => handleTabChange('my-files')}
        >
          <span className="nav-icon">{getSidebarIcon('files')}</span>
          <span className="nav-label">My Files</span>
        </button>
        <button
          className={`nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => handleTabChange('tasks')}
        >
          <span className="nav-icon">{getSidebarIcon('tasks')}</span>
          <span className="nav-label">Tasks</span>
        </button>
        <button
          className={`nav-item ${activeTab === 'team-files' ? 'active' : ''}`}
          onClick={() => handleTabChange('team-files')}
        >
          <span className="nav-icon">{getSidebarIcon('users')}</span>
          <span className="nav-label">Team Tasks</span>
        </button>
      </nav>

      {/* Logout */}
      <div className="sidebar-footer">
        <button className="logout-btn" onClick={onLogout}>
          <span className="nav-icon">{getSidebarIcon('logout')}</span>
          <span className="logout-btn-text">Logout</span>
        </button>
      </div>
    </div>
  );
});

Sidebar.displayName = 'Sidebar';
export default Sidebar;
