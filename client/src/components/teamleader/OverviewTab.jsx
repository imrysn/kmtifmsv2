import overviewIcon from '../../assets/Icon-7.svg'

const OverviewTab = ({ 
  pendingFiles, 
  teamMembers, 
  calculateApprovalRate 
}) => {
  return (
    <div className="tl-content">
      {/* Page Header */}
      <div className="tl-page-header">
        <div className="tl-page-icon">
          <img src={overviewIcon} alt="" width="20" height="20" />
        </div>
        <h1>Overview</h1>
      </div>

      {/* Stats Cards */}
      <div className="tl-stats">
        <div className="tl-stat-card blue">
          <div className="tl-stat-info">
            <p className="tl-stat-label">Pending Reviews</p>
            <h2 className="tl-stat-value">{pendingFiles.length}</h2>
          </div>
          <div className="tl-stat-icon-box blue">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 5H7C6.46957 5 5.96086 5.21071 5.58579 5.58579C5.21071 5.96086 5 6.46957 5 7V19C5 19.5304 5.21071 20.0391 5.58579 20.4142C5.96086 20.7893 6.46957 21 7 21H17C17.5304 21 18.0391 20.7893 18.4142 20.4142C18.7893 20.0391 19 19.5304 19 19V7C19 6.46957 18.7893 5.96086 18.4142 5.58579C18.0391 5.21071 17.5304 5 17 5H15M9 5C9 5.53043 9.21071 6.03914 9.58579 6.41421C9.96086 6.78929 10.4696 7 11 7H13C13.5304 7 14.0391 6.78929 14.4142 6.41421C14.7893 6.03914 15 5.53043 15 5M9 5C9 4.46957 9.21071 3.96086 9.58579 3.58579C9.96086 3.21071 10.4696 3 11 3H13C13.5304 3 14.0391 3.21071 14.4142 3.58579C14.7893 3.96086 15 4.46957 15 5M12 12H15M12 16H15M9 12H9.01M9 16H9.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        <div className="tl-stat-card yellow">
          <div className="tl-stat-info">
            <p className="tl-stat-label">Team Members</p>
            <h2 className="tl-stat-value">{teamMembers.length}</h2>
          </div>
          <div className="tl-stat-icon-box yellow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88M13 7C13 9.20914 11.2091 11 9 11C6.79086 11 5 9.20914 5 7C5 4.79086 6.79086 3 9 3C11.2091 3 13 4.79086 13 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        <div className="tl-stat-card purple">
          <div className="tl-stat-info">
            <p className="tl-stat-label">Approval Rate</p>
            <h2 className="tl-stat-value">{calculateApprovalRate()}%</h2>
          </div>
          <div className="tl-stat-icon-box purple">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Team Activity Table */}
      <div className="tl-table-container">
        <div className="tl-table-header">
          <div className="tl-table-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88M13 7C13 9.20914 11.2091 11 9 11C6.79086 11 5 9.20914 5 7C5 4.79086 6.79086 3 9 3C11.2091 3 13 4.79086 13 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
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
                <td className="email">{member.email}</td>
                <td className="date">{member.joined}</td>
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
