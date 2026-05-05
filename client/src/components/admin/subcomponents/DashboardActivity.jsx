import React from 'react'
import './DashboardActivity.css'

const DashboardActivity = ({ loading, recentActivity, activityItems }) => {
  return (
    <div className="section-card activity-section">
      <div className="section-header">
        <h3>Recent Activity</h3>
      </div>
      <div className="activity-list">
        {loading && <div className="activity-loading">Loading recent activity…</div>}
        {!loading && recentActivity.length === 0 && <div className="activity-empty">No recent activity</div>}
        {!loading && activityItems}
      </div>
    </div>
  )
}

export default React.memo(DashboardActivity)
