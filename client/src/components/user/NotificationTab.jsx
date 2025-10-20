const NotificationTab = ({ user }) => {
  // Mock notifications data - you can replace this with real API calls
  const notifications = [
    {
      id: 1,
      type: 'file_approved',
      title: 'File Approved',
      message: 'Your file "Project Report.pdf" has been approved by Team Leader',
      time: '2 hours ago',
      read: false
    },
    {
      id: 2,
      type: 'file_rejected',
      title: 'File Needs Revision',
      message: 'Your file "Budget Analysis.xlsx" requires revision',
      time: '1 day ago',
      read: true
    },
    {
      id: 3,
      type: 'system',
      title: 'System Update',
      message: 'New file approval workflow has been implemented',
      time: '3 days ago',
      read: true
    }
  ];

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'file_approved':
        return '✅';
      case 'file_rejected':
        return '❌';
      case 'system':
        return '🔔';
      default:
        return '📄';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'file_approved':
        return 'notification-success';
      case 'file_rejected':
        return 'notification-error';
      case 'system':
        return 'notification-info';
      default:
        return 'notification-default';
    }
  };

  return (
    <div className="notification-section">
      <div className="page-header">
        <div className="page-header-title">
          <span className="bell-icon">🔔</span>
          <h2>Notifications</h2>
        </div>
        <p>Stay updated with your file approvals and system messages</p>
      </div>

      <div className="notifications-container">
        {notifications.length > 0 ? (
          <div className="notifications-list">
            {notifications.map((notification) => (
              <div 
                key={notification.id} 
                className={`notification-card ${getNotificationColor(notification.type)} ${!notification.read ? 'unread' : ''}`}
              >
                <div className="notification-icon">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="notification-content">
                  <div className="notification-header">
                    <h4 className="notification-title">{notification.title}</h4>
                    <span className="notification-time">{notification.time}</span>
                  </div>
                  <p className="notification-message">{notification.message}</p>
                  {!notification.read && (
                    <div className="unread-indicator"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-notifications">
            <div className="empty-icon">🔔</div>
            <h3>No notifications yet</h3>
            <p>We'll notify you when there are updates on your files or important system messages.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationTab;