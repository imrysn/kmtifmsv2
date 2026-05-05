import React from 'react'

const NotificationHeader = ({
  unreadCount,
  notificationsCount,
  markAllAsRead,
  setShowDeleteAllModal
}) => {
  return (
    <div className="notifications-header">
      <div>
        <h2>Notifications</h2>
        <p className="notifications-subtitle">Stay updated with your file approvals and system messages</p>
      </div>
      <div className="notifications-actions">
        {unreadCount > 0 && (
          <button className="btn-mark-all-read" onClick={markAllAsRead}>
            Mark All as Read
          </button>
        )}
        {notificationsCount > 0 && (
          <button className="btn-delete-all" onClick={() => setShowDeleteAllModal(true)}>
            Delete All
          </button>
        )}
      </div>
    </div>
  )
}

export default React.memo(NotificationHeader)
