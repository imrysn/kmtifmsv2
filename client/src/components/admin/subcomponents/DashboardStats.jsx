import React from 'react'
import './DashboardStats.css'

const DashboardStats = ({
  loading,
  pendingCount,
  approvedCount,
  rejectedCount,
  totalCount,
  formattedStatChanges,
  statChanges
}) => {
  return (
    <div className="top-row">
      <div className="stats-section">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Pending Files</span>
            </div>
            <div className="stat-number">{loading ? '—' : pendingCount}</div>
            {!loading && (
              <div className={`stat-change ${formattedStatChanges.pending.className}`}>
                {formattedStatChanges.pending.text}
              </div>
            )}
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Approved Files</span>
            </div>
            <div className="stat-number">{loading ? '—' : approvedCount.toLocaleString()}</div>
            {!loading && (
              <div className={`stat-change ${formattedStatChanges.approved.className}`}>
                {formattedStatChanges.approved.text}
              </div>
            )}
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Rejected Files</span>
            </div>
            <div className="stat-number">{loading ? '—' : rejectedCount}</div>
            {!loading && (
              <div className={`stat-change ${statChanges.rejected > 0 ? 'negative' :
                statChanges.rejected < 0 ? 'positive' : 'neutral'
                }`}>
                {formattedStatChanges.rejected.text}
              </div>
            )}
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Total Files</span>
            </div>
            <div className="stat-number">{loading ? '—' : totalCount.toLocaleString()}</div>
            {!loading && (
              <div className={`stat-change ${formattedStatChanges.total.className}`}>
                {formattedStatChanges.total.text}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default React.memo(DashboardStats)
