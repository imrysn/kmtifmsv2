import React, { useEffect, useState, useMemo, memo } from 'react'
import { API_BASE_URL } from '@/config/api'
import './DashboardOverview.css'
import { SkeletonLoader } from '../common/SkeletonLoader'
import { useAuth, useNetwork } from '../../contexts'
import { withErrorBoundary } from '../common'

const DashboardOverview = ({ user, users }) => {
  const { user: authUser } = useAuth()
  const { isConnected } = useNetwork()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState({
    totalFiles: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    fileTypes: [],
    recentActivity: [],
    approvalRate: 0,
    approvalTrends: [],
    previousMonth: {
      totalFiles: 0,
      approved: 0,
      pending: 0,
      rejected: 0
    }
  })

  // Network check removed - using NetworkContext

  useEffect(() => {
    let mounted = true
    const fetchSummary = async () => {
      if (!isConnected) return

      setLoading(true)
      setError('')
      try {
        const res = await fetch(`${API_BASE_URL}/api/dashboard/summary`)
        const data = await res.json()
        if (!mounted) return
        if (data.success) {
          setSummary(data.summary)
        } else {
          setError(data.message || 'Failed to load dashboard data')
        }
      } catch (err) {
        console.error('Error fetching dashboard summary:', err)
        if (!mounted) return
        setError('Unable to connect to server')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (isConnected) {
      fetchSummary()
      // optionally refresh every minute
      const interval = setInterval(fetchSummary, 60 * 1000)
      return () => { mounted = false; clearInterval(interval) }
    }
  }, [isConnected])

  // Memoize summary values to prevent unnecessary re-renders
  const pendingCount = summary.pending
  const approvedCount = summary.approved
  const rejectedCount = summary.rejected
  const totalCount = summary.totalFiles

  // Memoize filtered activity counts to avoid repeated filtering
  const awaitingTeamLeaderCount = useMemo(() => {
    return summary.recentActivity.filter(a => a.activity && a.activity.toLowerCase().includes('team leader')).length
  }, [summary.recentActivity])

  const awaitingAdminCount = useMemo(() => {
    return summary.recentActivity.filter(a => a.activity && a.activity.toLowerCase().includes('admin')).length
  }, [summary.recentActivity])

  // Calculate percentage changes from previous month
  const statChanges = useMemo(() => {
    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0
      return ((current - previous) / previous) * 100
    }

    // Check if previousMonth data exists
    if (!summary.previousMonth) {
      return {
        pending: 0,
        approved: 0,
        rejected: 0,
        total: 0
      }
    }

    return {
      pending: calculateChange(pendingCount, summary.previousMonth.pending),
      approved: calculateChange(approvedCount, summary.previousMonth.approved),
      rejected: calculateChange(rejectedCount, summary.previousMonth.rejected),
      total: calculateChange(totalCount, summary.previousMonth.totalFiles)
    }
  }, [pendingCount, approvedCount, rejectedCount, totalCount, summary.previousMonth])

  // Helper function to format stat change display
  const formatStatChange = (change) => {
    const absChange = Math.abs(change)
    const sign = change > 0 ? '↑' : change < 0 ? '↓' : '—'
    const className = change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral'
    const formattedChange = absChange.toFixed(1)

    if (change === 0) {
      return {
        text: '— No change from last month',
        className: 'neutral'
      }
    }

    return {
      text: `${sign} ${change >= 0 ? '+' : '-'}${formattedChange}% from last month`,
      className
    }
  }

  // Memoize activity items to prevent re-rendering on every update
  const activityItems = useMemo(() => {
    return summary.recentActivity.map(act => (
      <div className="activity-item" key={act.id}>
        <div className="activity-content">
          <div className="activity-header">
            <span className="activity-user">{act.username || act.role || 'System'}</span>
            <span className={"activity-badge " + (act.activity && act.activity.toLowerCase().includes('approved') ? 'approved' : act.activity && act.activity.toLowerCase().includes('rejected') ? 'rejected' : 'upload')}>{(act.activity || '').split(' ')[0]}</span>
          </div>
          <div className="activity-description">{act.activity}</div>
          <div className="activity-meta">{new Date(act.timestamp).toLocaleString()}</div>
        </div>
      </div>
    ))
  }, [summary.recentActivity])

  // Show skeleton loader when network is not available
  if (!isConnected) {
    return <SkeletonLoader type="admin" />
  }

  return (
    <div className={`dashboard-overview ${loading ? 'loading-cursor' : ''}`}>

      {/* Top Row: Stats Grid (Upper Right) */}
      <div className="top-row">
        <div className="stats-section">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-label">Pending Files</span>
              </div>
              <div className="stat-number">{loading ? '—' : pendingCount}</div>
              {!loading && (
                <div className={`stat-change ${formatStatChange(statChanges.pending).className}`}>
                  {formatStatChange(statChanges.pending).text}
                </div>
              )}
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-label">Approved Files</span>
              </div>
              <div className="stat-number">{loading ? '—' : approvedCount.toLocaleString()}</div>
              {!loading && (
                <div className={`stat-change ${formatStatChange(statChanges.approved).className}`}>
                  {formatStatChange(statChanges.approved).text}
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
                  {formatStatChange(statChanges.rejected).text}
                </div>
              )}
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-label">Total Files</span>
              </div>
              <div className="stat-number">{loading ? '—' : totalCount.toLocaleString()}</div>
              {!loading && (
                <div className={`stat-change ${formatStatChange(statChanges.total).className}`}>
                  {formatStatChange(statChanges.total).text}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Charts (Left) and Recent Activity (Right) */}
      <div className="bottom-row">
        <div className="charts-section">
          <div className="chart-card">
            <div className="chart-header">
              <h3>File Approval Trends</h3>
            </div>
            <div className="chart-content">
              {loading && <div style={{ padding: '1rem', textAlign: 'center' }}>Loading trends...</div>}
              {!loading && (!summary.approvalTrends || summary.approvalTrends.length === 0) && (
                <div style={{ padding: '1rem', textAlign: 'center' }}>No trend data available</div>
              )}
              {!loading && summary.approvalTrends && summary.approvalTrends.length > 0 && (
                <svg width="100%" height="300" viewBox="0 0 700 300" preserveAspectRatio="xMidYMid meet" style={{ background: 'transparent' }}>
                  {(() => {
                    const trends = summary.approvalTrends.slice(-30) // Last 30 days
                    const maxValue = Math.max(
                      ...trends.map(t => Math.max(t.approved || 0, t.rejected || 0)),
                      1
                    )
                    const padding = { left: 50, right: 50, top: 30, bottom: 50 }
                    const chartWidth = 700 - padding.left - padding.right
                    const chartHeight = 300 - padding.top - padding.bottom
                    const stepX = chartWidth / Math.max(trends.length - 1, 1)

                    // Calculate points for approved and rejected lines
                    const approvedPoints = trends.map((t, i) => ({
                      x: padding.left + i * stepX,
                      y: padding.top + chartHeight - ((t.approved || 0) / maxValue) * chartHeight
                    }))

                    const rejectedPoints = trends.map((t, i) => ({
                      x: padding.left + i * stepX,
                      y: padding.top + chartHeight - ((t.rejected || 0) / maxValue) * chartHeight
                    }))

                    return (
                      <>
                        {/* Grid lines */}
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                          const y = padding.top + chartHeight - ratio * chartHeight
                          return (
                            <line
                              key={ratio}
                              x1={padding.left}
                              y1={y}
                              x2={padding.left + chartWidth}
                              y2={y}
                              stroke="#E5E7EB"
                              strokeWidth="1"
                              strokeDasharray="4 4"
                            />
                          )
                        })}

                        {/* Approved line */}
                        {approvedPoints.map((point, i) => {
                          if (i === 0) return null
                          const prevPoint = approvedPoints[i - 1]
                          return (
                            <line
                              key={`approved-${i}`}
                              x1={prevPoint.x}
                              y1={prevPoint.y}
                              x2={point.x}
                              y2={point.y}
                              stroke="#10B981"
                              strokeWidth="3"
                            />
                          )
                        })}

                        {/* Rejected line */}
                        {rejectedPoints.map((point, i) => {
                          if (i === 0) return null
                          const prevPoint = rejectedPoints[i - 1]
                          return (
                            <line
                              key={`rejected-${i}`}
                              x1={prevPoint.x}
                              y1={prevPoint.y}
                              x2={point.x}
                              y2={point.y}
                              stroke="#EF4444"
                              strokeWidth="3"
                            />
                          )
                        })}

                        {/* Approved points */}
                        {approvedPoints.map((point, i) => (
                          <circle
                            key={`approved-point-${i}`}
                            cx={point.x}
                            cy={point.y}
                            r="4"
                            fill="#10B981"
                          />
                        ))}

                        {/* Rejected points */}
                        {rejectedPoints.map((point, i) => (
                          <circle
                            key={`rejected-point-${i}`}
                            cx={point.x}
                            cy={point.y}
                            r="4"
                            fill="#EF4444"
                          />
                        ))}

                        {/* X-axis labels - Show every 5th day to avoid crowding */}
                        {trends.map((t, i) => {
                          if (i % 5 !== 0 && i !== trends.length - 1) return null
                          const x = padding.left + i * stepX
                          const label = t.day || t.date || `D${i + 1}`
                          return (
                            <text
                              key={`label-${i}`}
                              x={x}
                              y={padding.top + chartHeight + 30}
                              fontSize="11"
                              fill="#6B7280"
                              textAnchor="middle"
                            >
                              {label}
                            </text>
                          )
                        })}

                        {/* Legend */}
                        <g transform={`translate(${padding.left}, 10)`}>
                          <circle cx="0" cy="0" r="4" fill="#10B981" />
                          <text x="10" y="4" fontSize="12" fill="#6B7280">Approved</text>
                          <circle cx="80" cy="0" r="4" fill="#EF4444" />
                          <text x="90" y="4" fontSize="12" fill="#6B7280">Rejected</text>
                        </g>
                      </>
                    )
                  })()}
                </svg>
              )}
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <h3>File Types Distribution</h3>
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>All file types tracked</span>
            </div>
            <div className="chart-content">
              {loading && <div style={{ padding: '1rem', textAlign: 'center' }}>Loading file types...</div>}
              {!loading && summary.fileTypes.length === 0 && <div style={{ padding: '1rem', textAlign: 'center' }}>No file type data available</div>}
              {!loading && summary.fileTypes.length > 0 && (
                <>
                  <svg width="100%" height="300" viewBox="0 0 200 200">
                    {(() => {
                      const total = summary.fileTypes.reduce((sum, t) => sum + t.count, 0)
                      const colors = [
                        '#6366F1', '#10B981', '#F59E0B', '#EF4444',
                        '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
                        '#F97316', '#14B8A6', '#A855F7', '#F43F5E'
                      ]
                      let offset = 0
                      return summary.fileTypes.map((fileType, i) => {
                        const percentage = (fileType.count / total) * 100
                        const dashArray = `${(percentage / 100) * 440} 440`
                        const circle = (
                          <circle
                            key={fileType.file_type}
                            cx="100"
                            cy="100"
                            r="70"
                            fill="none"
                            stroke={colors[i % colors.length] || '#999'}
                            strokeWidth="30"
                            strokeDasharray={dashArray}
                            strokeDashoffset={-offset}
                          />
                        )
                        offset += (percentage / 100) * 440
                        return circle
                      })
                    })()}
                  </svg>
                  <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px' }}>
                      {summary.fileTypes.map((t, i) => {
                        const colors = [
                          '#6366F1', '#10B981', '#F59E0B', '#EF4444',
                          '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
                          '#F97316', '#14B8A6', '#A855F7', '#F43F5E'
                        ]
                        return (
                          <span key={t.file_type} style={{ whiteSpace: 'nowrap' }}>
                            <span style={{ color: colors[i % colors.length] || '#999' }}>■</span>
                            &nbsp;{t.file_type || 'Unknown'} ({t.count})
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="section-card activity-section">
          <div className="section-header">
            <h3>Recent Activity</h3>
          </div>
          <div className="activity-list">
            {loading && <div style={{ padding: '1rem' }}>Loading recent activity…</div>}
            {!loading && summary.recentActivity.length === 0 && <div style={{ padding: '1rem' }}>No recent activity</div>}
            {!loading && activityItems}
          </div>
        </div>
      </div>
    </div>
  )
}

export default withErrorBoundary(memo(DashboardOverview), {
  componentName: 'Dashboard Overview'
})
