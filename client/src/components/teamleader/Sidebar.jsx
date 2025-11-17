const Sidebar = ({ 
  activeTab, 
  setActiveTab, 
  clearMessages, 
  setSidebarOpen, 
  sidebarOpen, 
  onLogout 
}) => {
  const handleTabChange = (tab) => {
    setActiveTab(tab)
    clearMessages()
    setSidebarOpen(false)
  }

  return (
    <aside className={`tl-sidebar ${sidebarOpen ? 'open' : ''}`}>
      {/* Brand */}
      <div className="tl-brand">
        <div className="tl-brand-logo">TL</div>
        <span className="tl-brand-name">Team Leader</span>
      </div>

      {/* Navigation */}
      <nav className="tl-nav">
        <button
          className={`tl-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => handleTabChange('overview')}
        >
          <svg className="tl-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span>Overview</span>
        </button>

        <button
          className={`tl-nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => handleTabChange('notifications')}
        >
          <svg className="tl-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span>Notifications</span>
        </button>

        <button
          className={`tl-nav-item ${activeTab === 'file-collection' ? 'active' : ''}`}
          onClick={() => handleTabChange('file-collection')}
        >
          <svg className="tl-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            <line x1="12" y1="11" x2="12" y2="17"></line>
            <line x1="9" y1="14" x2="15" y2="14"></line>
          </svg>
          <span>File Collection</span>
        </button>
        
        <button
          className={`tl-nav-item ${activeTab === 'assignments' ? 'active' : ''}`}
          onClick={() => handleTabChange('assignments')}
        >
          <svg className="tl-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4"></path>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
          <span>Tasks</span>
        </button>

        <button
          className={`tl-nav-item ${activeTab === 'team-management' ? 'active' : ''}`}
          onClick={() => handleTabChange('team-management')}
        >
          <svg className="tl-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span>Team Management</span>
        </button>
      </nav>

      {/* Footer */}
      <div className="tl-sidebar-footer">
        <button className="tl-logout-btn" onClick={onLogout}>
          <svg className="tl-logout-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
