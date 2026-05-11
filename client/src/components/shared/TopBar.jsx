import { memo } from 'react';
import { Menu, Search, User, LogOut, Settings } from 'lucide-react';
import { PremiumButton, MemberAvatar } from '../shared';
import './TopBar.css';

const TopBar = memo(({ 
  title, 
  onMenuClick, 
  searchQuery, 
  onSearchChange,
  user,
  onLogout,
  onSettings,
  actions
}) => {
  return (
    <header className="premium-topbar">
      <div className="topbar-left">
        <button 
          className="mobile-menu-toggle" 
          onClick={onMenuClick}
          aria-label="Toggle Menu"
        >
          <Menu size={24} />
        </button>
        <h1 className="topbar-title">{title}</h1>
      </div>

      <div className="topbar-center">
        {onSearchChange && (
          <div className="topbar-search">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search anything..." 
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="topbar-right">
        {actions}
        <div className="user-profile-trigger">
          <MemberAvatar 
            name={user?.fullName} 
            size="md" 
            className="topbar-avatar"
          />
          <div className="user-dropdown-content">
            <div className="dropdown-header">
              <p className="dropdown-name">{user?.fullName}</p>
              <p className="dropdown-email">{user?.email}</p>
            </div>
            <hr className="dropdown-divider" />
            <button className="dropdown-item" onClick={onSettings}>
              <Settings size={16} />
              <span>Settings</span>
            </button>
            <button className="dropdown-item logout" onClick={onLogout}>
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
});

TopBar.displayName = 'TopBar';

export default TopBar;
