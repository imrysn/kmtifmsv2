import overviewIcon from '../../assets/Icon-7.svg'
import fileReviewIcon from '../../assets/Icon-6.svg'
import teamManagementIcon from '../../assets/Icon-2.svg'
import assignmentIcon from '../../assets/Icon-3.svg'
import logoutIcon from '../../assets/Icon.svg'

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
          <img src={overviewIcon} alt="" className="tl-nav-icon" width="20" height="20" />
          <span>Overview</span>
        </button>
        
        <button 
          className={`tl-nav-item ${activeTab === 'file-review' ? 'active' : ''}`}
          onClick={() => handleTabChange('file-review')}
        >
          <img src={fileReviewIcon} alt="" className="tl-nav-icon" width="20" height="20" />
          <span>File Review</span>
        </button>
        
        <button
          className={`tl-nav-item ${activeTab === 'assignments' ? 'active' : ''}`}
          onClick={() => handleTabChange('assignments')}
        >
          <img src={assignmentIcon} alt="" className="tl-nav-icon" width="20" height="20" />
          <span>Tasks</span>
        </button>
        
        <button 
          className={`tl-nav-item ${activeTab === 'team-management' ? 'active' : ''}`}
          onClick={() => handleTabChange('team-management')}
        >
          <img src={teamManagementIcon} alt="" className="tl-nav-icon" width="20" height="20" />
          <span>Team Management</span>
        </button>
      </nav>

      {/* Footer */}
      <div className="tl-sidebar-footer">
        <button className="tl-logout-btn" onClick={onLogout}>
          <img src={logoutIcon} alt="" width="20" height="20" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
