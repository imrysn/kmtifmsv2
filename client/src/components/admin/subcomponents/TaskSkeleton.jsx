const TaskSkeleton = () => {
  return (
    <div className="loading-skeleton">
      {[1, 2, 3].map(i => (
        <div key={i} className="skeleton-assignment-card">
          {/* Card Header */}
          <div className="skeleton-card-header">
            <div className="skeleton-header-left">
              <div className="skeleton-avatar"></div>
              <div className="skeleton-header-info">
                <div className="skeleton-line skeleton-line-medium"></div>
                <div className="skeleton-line skeleton-line-small"></div>
              </div>
            </div>
            <div className="skeleton-header-right">
              <div className="skeleton-line skeleton-line-tiny"></div>
            </div>
          </div>

          {/* Task Title */}
          <div className="skeleton-title-section">
            <div className="skeleton-line skeleton-line-title"></div>
          </div>

          {/* Task Description */}
          <div className="skeleton-description-section">
            <div className="skeleton-line skeleton-line-full"></div>
            <div className="skeleton-line skeleton-line-full"></div>
            <div className="skeleton-line skeleton-line-medium"></div>
          </div>

          {/* Attachments */}
          <div className="skeleton-attachment-section">
            <div className="skeleton-line skeleton-line-small"></div>
            <div className="skeleton-file-item">
              <div className="skeleton-file-icon"></div>
              <div className="skeleton-file-info">
                <div className="skeleton-line skeleton-line-medium"></div>
                <div className="skeleton-line skeleton-line-small"></div>
              </div>
            </div>
          </div>

          {/* Comments */}
          <div className="skeleton-comments-section">
            <div className="skeleton-line skeleton-line-tiny"></div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default TaskSkeleton
