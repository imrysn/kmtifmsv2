import overviewIcon from '../../assets/Icon-7.svg'
import { LoadingTable, LoadingCards } from '../common/InlineSkeletonLoader'

const OverviewTab = ({
  pendingFiles,
  teamMembers,
  calculateApprovalRate,
  isLoading = false
}) => {
  // Show skeleton loading if data is loading
  if (isLoading) {
    return (
      <div className="tl-content">
        {/* Page Header Skeleton */}
        <div className="tl-page-header">
          <h1>Overview</h1>
          <p>Team performance and activity summary</p>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="tl-stats">
          <LoadingCards count={3} />
        </div>

        {/* Team Activity Table Skeleton */}
        <div className="tl-table-container">
          <div className="tl-table-header">
            <h2>Team Activity</h2>
          </div>
          <LoadingTable rows={5} columns={5} />
        </div>
      </div>
    )
  }
  return (
    <div className="tl-content">
      {/* Page Header */}
      <div className="tl-page-header">
        <h1>Overview</h1>
        <p>Team performance and activity summary</p>
      </div>

      {/* Stats Grid - EXACT Admin Match */}
      <div className="tl-stats">
        <div className="tl-stat-card">
          <div className="tl-stat-header">
            <span className="tl-stat-label">Pending Reviews</span>
          </div>
          <div className="tl-stat-number">{pendingFiles.length}</div>
          <div className="tl-stat-change positive">↑ Files awaiting review</div>
        </div>

        <div className="tl-stat-card">
          <div className="tl-stat-header">
            <span className="tl-stat-label">Team Members</span>
          </div>
          <div className="tl-stat-number">{teamMembers.length}</div>
          <div className="tl-stat-change neutral">Active team members</div>
        </div>

        <div className="tl-stat-card">
          <div className="tl-stat-header">
            <span className="tl-stat-label">Approval Rate</span>
          </div>
          <div className="tl-stat-number">{calculateApprovalRate()}%</div>
          <div className="tl-stat-change positive">↑ Overall performance</div>
        </div>
      </div>

      {/* Team Activity Table */}
      <div className="tl-table-container">
        <div className="tl-table-header">
          <h2>Team Activity</h2>
        </div>

        <table className="tl-table">
          <thead>
            <tr>
              <th>NAME</th>
              <th>EMAIL</th>
              <th>JOINED</th>
              <th>FILES</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {teamMembers.map((member) => (
              <tr key={member.id}>
                <td>{member.name}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{member.email}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{member.joined}</td>
                <td>{member.files}</td>
                <td>
                  <span className={`tl-badge ${member.status.toLowerCase()}`}>
                    {member.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default OverviewTab
