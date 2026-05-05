import React, { memo } from 'react'
import FileIcon from '../../shared/FileIcon'

const NotificationItem = memo(({ notification, onNotificationClick, onDeleteNotification, formatTimeAgo }) => {
  return (
    <div
      className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
      onClick={() => onNotificationClick(notification)}
    >
      <div className="notification-icon">
        <FileIcon
          fileType={notification.type}
          size="medium"
          altText={`${notification.type} notification icon`}
          className="notification-type-icon"
        />
      </div>

      <div className="notification-content">
        <div className="notification-title">
          {notification.title}
        </div>
        <div className="notification-message">{notification.message}</div>

        <div className="notification-meta">
          <span className="notification-author">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="13" height="13" style={{marginRight: '4px', verticalAlign: 'middle', flexShrink: 0}}>
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
            </svg>
            {notification.action_by_username} ({notification.action_by_role})
          </span>
          {notification.assignment_title && (
            <span className="notification-assignment">
              Assignment: {notification.assignment_title}
            </span>
          )}
          {notification.file_name && (
            <span className="notification-file">
              {notification.file_name}
            </span>
          )}
          {notification.assignment_due_date && (
            <span className="notification-due-date">
              Due: {new Date(notification.assignment_due_date).toLocaleDateString()}
            </span>
          )}
        </div>

        <div className="notification-time">
          {formatTimeAgo(notification.created_at)}
        </div>
      </div>

      <button
        className="notification-delete"
        onClick={(e) => {
          e.stopPropagation();
          onDeleteNotification(notification.id);
        }}
      >
        ✕
      </button>
    </div>
  );
});

const NotificationList = ({
  notifications,
  handleNotificationClick,
  deleteNotification,
  formatTimeAgo,
  loadingMore,
  hasMore,
  loadMoreRef,
  limit
}) => {
  if (notifications.length === 0) {
    return (
      <div className="no-notifications">
        <div className="no-notifications-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="56" height="56">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </div>
        <h3>No notifications</h3>
        <p>You're all caught up! Check back later for updates.</p>
      </div>
    )
  }

  return (
    <>
      <div className="notifications-list">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onNotificationClick={handleNotificationClick}
            onDeleteNotification={deleteNotification}
            formatTimeAgo={formatTimeAgo}
          />
        ))}
      </div>

      {loadingMore && (
        <div className="notifications-loading-more">
          <div className="notification-skeleton-item">
            <div className="skeleton-icon"></div>
            <div className="skeleton-content">
              <div className="skeleton-line skeleton-line-title"></div>
              <div className="skeleton-line skeleton-line-message"></div>
            </div>
          </div>
          <div className="notification-skeleton-item">
            <div className="skeleton-icon"></div>
            <div className="skeleton-content">
              <div className="skeleton-line skeleton-line-title"></div>
              <div className="skeleton-line skeleton-line-message"></div>
            </div>
          </div>
        </div>
      )}

      {hasMore && !loadingMore && (
        <div ref={loadMoreRef} className="load-more-trigger" />
      )}

      {!hasMore && notifications.length >= limit && (
        <div className="end-of-list">
          <p>You've reached the end of your notifications</p>
        </div>
      )}
    </>
  )
}

export default React.memo(NotificationList)
