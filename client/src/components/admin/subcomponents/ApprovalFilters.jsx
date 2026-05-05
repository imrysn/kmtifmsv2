import { memo } from 'react'
import './ApprovalFilters.css'

const StatusCard = memo(({ icon, label, count, className, active, onClick }) => (
  <div 
    className={`file-status-card ${className} ${active ? 'active' : ''}`}
    onClick={onClick}
    style={{ cursor: 'pointer' }}
  >
    <div className={`status-icon ${className}-icon`}>{icon}</div>
    <div className="status-info">
      <div className="status-number">{count}</div>
      <div className="status-label">{label}</div>
    </div>
  </div>
))

const ApprovalFilters = ({
  fileSearchInput,
  setFileSearchInput,
  fileFilter,
  setFileFilter,
  fileSortBy,
  setFileSortBy,
  viewMode,
  setViewMode,
  statusCounts
}) => {
  return (
    <div className="approval-filters-section">
      <div className="filters-top-header">
        <div className="search-box">
          <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            type="text"
            placeholder="Search files by name, user, or team..."
            value={fileSearchInput}
            onChange={(e) => setFileSearchInput(e.target.value)}
          />
        </div>

        <div className="status-cards-grid">
          <StatusCard
            className="pending"
            icon="TL"
            label="Pending Team Leader"
            count={statusCounts.pendingTeamLeader}
            active={fileFilter === 'pending-team-leader'}
            onClick={() => setFileFilter('pending-team-leader')}
          />
          <StatusCard
            className="pending-admin"
            icon="AD"
            label="Pending Admin"
            count={statusCounts.pendingAdmin}
            active={fileFilter === 'pending-admin'}
            onClick={() => setFileFilter('pending-admin')}
          />
          <StatusCard
            className="approved"
            icon="AP"
            label="Approved Files"
            count={statusCounts.approved}
            active={fileFilter === 'approved'}
            onClick={() => setFileFilter('approved')}
          />
          <StatusCard
            className="rejected"
            icon="RE"
            label="Rejected Files"
            count={statusCounts.rejected}
            active={fileFilter === 'rejected'}
            onClick={() => setFileFilter('rejected')}
          />
        </div>
      </div>

      <div className="filters-controls-row">
        <div className="filter-dropdowns">
          <select value={fileFilter} onChange={(e) => setFileFilter(e.target.value)}>
            <option value="all">All Files</option>
            <option value="pending-team-leader">Pending Team Leader</option>
            <option value="pending-admin">Pending Admin</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <select value={fileSortBy} onChange={(e) => setFileSortBy(e.target.value)}>
            <option value="date-desc">Latest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="filename-asc">Name (A-Z)</option>
            <option value="filename-desc">Name (Z-A)</option>
          </select>

          <select value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
            <option value="all">All Items</option>
            <option value="files">Files Only</option>
            <option value="folders">Folders Only</option>
            <option value="by-date">Timeline</option>
          </select>
        </div>
      </div>
    </div>
  )
}

export default memo(ApprovalFilters)
