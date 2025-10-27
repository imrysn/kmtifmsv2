const TopBar = ({
  toggleSidebar,
  searchQuery,
  setSearchQuery,
  showNotifications,
  setShowNotifications,
  notificationCounts,
  notifications,
  openReviewModal
}) => {
  return (
    <header className="tl-top-bar">
      <button className="tl-hamburger" onClick={toggleSidebar}>
        <span></span>
        <span></span>
        <span></span>
      </button>

      <div className="tl-search">
        <svg className="tl-search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M9 17C13.4183 17 17 13.4183 17 9C17 4.58172 13.4183 1 9 1C4.58172 1 1 4.58172 1 9C1 13.4183 4.58172 17 9 17Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M19 19L14.65 14.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <input
          type="text"
          placeholder="Search here..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <button className="tl-notification-btn" onClick={() => setShowNotifications(!showNotifications)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {(notificationCounts.overdue + notificationCounts.urgent) > 0 && (
          <span className="tl-notification-count">
            {notificationCounts.overdue + notificationCounts.urgent}
          </span>
        )}
      </button>

      {showNotifications && (
        <div className="tl-notifications-dropdown">
          <div className="tl-notifications-header">
            <h4>Notifications</h4>
            <span>{notificationCounts.overdue + notificationCounts.urgent} urgent</span>
          </div>
          <div className="tl-notifications-list">
            {notifications.length > 0 ? (
              notifications.map((notif, idx) => (
                <div 
                  key={idx} 
                  className={`tl-notification-item ${notif.isOverdue ? 'overdue' : notif.isUrgent ? 'urgent' : ''}`} 
                  onClick={() => {
                    openReviewModal(notif, null)
                    setShowNotifications(false)
                  }}
                >
                  <div className="tl-notification-icon">
                    {notif.isOverdue ? '⚠️' : notif.isUrgent ? '🔴' : '📄'}
                  </div>
                  <div className="tl-notification-content">
                    <p className="tl-notification-message">{notif.message}</p>
                    <span className="tl-notification-time">{notif.submitter}</span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{padding: '20px', textAlign: 'center', color: '#9ca3af'}}>No notifications</div>
            )}
          </div>
        </div>
      )}

      <div className="tl-user-avatar"></div>
    </header>
  )
}

export default TopBar
