import React, { useEffect, useState, useMemo, memo } from 'react'
import { apiFetch } from '@/config/api'
import './DashboardOverview.css'
import { SkeletonLoader } from '../common/SkeletonLoader'
import { useAuth, useNetwork } from '../../contexts'
import { withErrorBoundary } from '../common'
import ApprovalTrendChart from './charts/ApprovalTrendChart'
import AnimatedPieChart from './charts/AnimatedPieChart'

// Sub-component for individual activity items to prevent mass re-renders
const ActivityItem = memo(({ act }) => {
  const badgeType = useMemo(() => {
    const activity = (act.activity || '').toLowerCase()
    if (activity.includes('approved')) return 'approved'
    if (activity.includes('rejected')) return 'rejected'
    return 'upload'
  }, [act.activity])

  const formattedDate = useMemo(() => {
    try {
      return new Date(act.timestamp).toLocaleString()
    } catch (e) {
      return 'Invalid date'
    }
  }, [act.timestamp])

  return (
    <div className="activity-item">
      <div className="activity-content">
        <div className="activity-header">
          <span className="activity-user">{act.username || act.role || 'System'}</span>
          <span className={`activity-badge ${badgeType}`}>
            {(act.activity || '').split(' ')[0]}
          </span>
        </div>
        <div className="activity-description">{act.activity}</div>
        <div className="activity-meta">{formattedDate}</div>
      </div>
    </div>
  )
})
ActivityItem.displayName = 'ActivityItem'

const DashboardOverview = () => {
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

  useEffect(() => {
    let mounted = true
    const fetchSummary = async (isInitialLoad = false) => {
      if (!isConnected) return

      if (isInitialLoad) {
        setLoading(true)
        setError('')
      }

      try {
        const data = await apiFetch('/api/dashboard/summary')
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
      fetchSummary(true) // Initial load
      const interval = setInterval(() => fetchSummary(false), 60 * 1000)
      return () => { mounted = false; clearInterval(interval) }
    }
  }, [isConnected])

  // Memoize summary values to prevent unnecessary re-renders
  const pendingCount = summary.pending
  const approvedCount = summary.approved
  const rejectedCount = summary.rejected
  const totalCount = summary.totalFiles

  // Memoize activity items - limit to top 10 for performance
  const activityItemsList = useMemo(() => {
    return summary.recentActivity.slice(0, 10).map(act => (
      <ActivityItem key={act.id} act={act} />
    ))
  }, [summary.recentActivity])

  // Memoize chart data to stabilize props
  const memoizedTrends = useMemo(() => summary.approvalTrends, [summary.approvalTrends])
  const memoizedFileTypes = useMemo(() => summary.fileTypes, [summary.fileTypes])

  // Calculate percentage changes from previous month
  const statChanges = useMemo(() => {
    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0
      return ((current - previous) / previous) * 100
    }

    if (!summary.previousMonth) {
      return { pending: 0, approved: 0, rejected: 0, total: 0 }
    }

    return {
      pending: calculateChange(pendingCount, summary.previousMonth.pending),
      approved: calculateChange(approvedCount, summary.previousMonth.approved),
      rejected: calculateChange(rejectedCount, summary.previousMonth.rejected),
      total: calculateChange(totalCount, summary.previousMonth.totalFiles)
    }
  }, [pendingCount, approvedCount, rejectedCount, totalCount, summary.previousMonth])

  // Memoize formatted stat changes
  const formattedStatChanges = useMemo(() => {
    const formatStatChange = (change) => {
      const absChange = Math.abs(change)
      const sign = change > 0 ? '↑' : change < 0 ? '↓' : '—'
      const className = change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral'
      const formattedChange = absChange.toFixed(1)

      if (change === 0) {
        return { text: '— No change', className: 'neutral' }
      }

      return {
        text: `${sign} ${change >= 0 ? '+' : '-'}${formattedChange}%`,
        className
      }
    }

    return {
      pending: formatStatChange(statChanges.pending),
      approved: formatStatChange(statChanges.approved),
      rejected: formatStatChange(statChanges.rejected),
      total: formatStatChange(statChanges.total)
    }
  }, [statChanges])

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

      {/* Bottom Row: Charts (Left) and Recent Activity (Right) */}
      <div className="bottom-row">
        <div className="charts-section">
          <div className="chart-card">
            <div className="chart-header">
              <h3>File Approval Trends</h3>
            </div>
            <div className="chart-content">
              <ApprovalTrendChart trends={memoizedTrends} loading={loading} />
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <h3>File Types Distribution</h3>
              <span className="chart-subtitle">All file types tracked</span>
            </div>
            <div className="chart-content">
              <AnimatedPieChart fileTypes={memoizedFileTypes} loading={loading} />
            </div>
          </div>
        </div>

        <div className="section-card activity-section">
          <div className="section-header">
            <h3>Recent Activity</h3>
          </div>
          <div className="activity-list">
            {loading && <div className="activity-loading">Loading recent activity…</div>}
            {!loading && summary.recentActivity.length === 0 && <div className="activity-empty">No recent activity</div>}
            {!loading && activityItemsList}
            {!isConnected && <div className="activity-offline">Currently offline - data may be stale</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default withErrorBoundary(memo(DashboardOverview), {
  componentName: 'Dashboard Overview'
})
