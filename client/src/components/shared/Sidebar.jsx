import { memo, useCallback, useState, useMemo } from 'react';
import {
  LayoutDashboard,
  Bell,
  Users,
  FileText,
  Settings,
  LogOut,
  History,
  ClipboardCheck,
  FolderOpen,
  UserCircle,
  Menu
} from 'lucide-react';
import useStore from '../../store/useStore';
import { MemberAvatar, PremiumBadge, PremiumButton } from '../shared';
import './Sidebar.css';

const iconMap = {
  dashboard: LayoutDashboard,
  notifications: Bell,
  users: Users,
  activityLogs: History,
  fileApproval: ClipboardCheck,
  tasks: FileText,
  settings: Settings,
  files: FolderOpen,
  logout: LogOut,
  team: Users
};

const EMPTY_ARRAY = [];

const Sidebar = memo(({
  user,
  items,
  activeTab,
  onTabChange,
  onLogout,
  isOpen,
  onClose,
  brandLabel = "KMTI FMS"
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  // STABILIZED: Sidebar fetches its own badge data to avoid parent re-renders
  const notificationCount = useStore(state => state.globalUnreadCount);
  const files = useStore(state => state.filesCache[user?.id] || EMPTY_ARRAY);
  const filesCount = useMemo(() => 
    files.filter(f => 
      f.status === 'uploaded' || 
      f.status === 'team_leader_approved' || 
      f.status === 'final_approved'
    ).length
  , [files]);

  const handleTabClick = useCallback((id) => {
    onTabChange(id);
    if (onClose) onClose();
  }, [onTabChange, onClose]);

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`premium-sidebar-overlay ${isOpen ? 'active' : ''}`}
        onClick={onClose}
      ></div>

      <aside 
        className={`premium-sidebar ${isOpen ? 'open' : ''} ${!isHovered ? 'collapsed' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="sidebar-profile">
          <div className="profile-wrapper">
            <MemberAvatar
              name={user?.fullName}
              size="lg"
              className="profile-avatar"
            />
            <div className="profile-details">
              <h3 className="profile-name" title={user?.fullName}>{user?.fullName || 'User'}</h3>
              <div className="profile-role-row">
                {user?.team && (
                   <span className="team-label" title={user.team}>
                    {user.team}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <nav className="sidebar-navigation">
          <div className="nav-group">
            {items.map((item) => {
              const Icon = iconMap[item.icon] || FileText;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  className={`premium-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleTabClick(item.id)}
                  title={!isHovered ? item.label : ""}
                >
                  <div className="nav-item-content">
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="nav-label">{item.label}</span>
                  </div>
                  {item.type === 'notification' && notificationCount > 0 && (
                    <PremiumBadge variant="danger" size="sm" className="nav-badge">
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </PremiumBadge>
                  )}
                  {item.type === 'files' && filesCount > 0 && (
                    <PremiumBadge variant="primary" size="sm" className="nav-badge">
                      {filesCount}
                    </PremiumBadge>
                  )}
                  {isActive && <div className="active-indicator" />}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="sidebar-footer">
          <button className={`premium-logout-btn ${!isHovered ? 'collapsed' : ''}`} onClick={onLogout} title={!isHovered ? "Logout" : ""}>
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;
