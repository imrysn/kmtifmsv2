import { memo, useCallback } from 'react';
import { getSidebarIcon } from '../shared/FileIcon';
import Avatar from '../shared/Avatar';
import ThemeToggle from '../shared/ThemeToggle';
import './css/Sidebar.css';

const Sidebar = memo(({ activeTab, setActiveTab, filesCount, notificationCount, onLogout, user, setShowBroadcastModal }) => {
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
            {user?.team || 'No Team'}
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
        <button 
          type="button" 
          className="nav-item" 
          onClick={() => setShowBroadcastModal(true)} 
          style={{ marginBottom: '8px', width: '100%', border: '1px solid var(--border-color)', background: 'transparent' }} 
          aria-label="Message Administrators"
        >
          <span className="nav-icon" style={{ position: 'relative' }}>
            <svg width="22" height="22" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <path d="M 75.8,20.4 86.4,12.7 89.2,21.5 Z" fill="#64748b"/>
              <path d="M 85.1,38.9 97.4,32.3 98.4,41.9 Z" fill="#64748b"/>
              <path d="M 86.6,56.8 98.9,56.1 97.1,65.3 Z" fill="#64748b"/>
              <path d="M 78.5,72.4 88.0,79.5 81.3,86.6 Z" fill="#64748b"/>
              <path d="M 33.1,69.5 41.5,89.2 C 43.1,93.0 48.0,91.2 46.5,87.6 L 39.5,71.1 Z" fill="#cbd5e1"/>
              <path d="M 23.3,46.9 C 10.1,51.8 11.4,70.9 25.1,73.1 L 34.0,70.0 L 29.5,45.0 Z" fill="#dc2626"/>
              <path d="M 26.5,45.5 C 38.0,38.0 49.5,25.0 59.8,27.5 C 70.1,30.0 73.1,65.0 63.8,70.5 C 54.5,76.0 42.0,70.0 31.5,71.0 Z" fill="#e2e8f0"/>
              <ellipse cx="61.5" cy="49" rx="11" ry="24" fill="#64748b" transform="rotate(-12 61.5 49)"/>
              <ellipse cx="60" cy="49" rx="5" ry="12" fill="#ffffff" transform="rotate(-12 60 49)"/>
            </svg>
          </span>
          <span className="nav-label">Message Admin</span>
        </button>
        <ThemeToggle />
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
