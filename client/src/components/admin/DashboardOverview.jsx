import React, { useEffect, useState, useMemo, memo, lazy, Suspense } from 'react'
import './DashboardOverview.css'
import { SkeletonLoader } from '../common/SkeletonLoader'
import { useAuth, useNetwork } from '../../contexts'
import { withErrorBoundary } from '../common'
import { adminService } from '../../services/adminService'

const AnimatedTrendChart = lazy(() => import('./charts/AnimatedTrendChart'))
const AnimatedPieChart = lazy(() => import('./charts/AnimatedPieChart'))

const DashboardOverview = ({ user, users }) => {
  const { isConnected } = useNetwork()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState({
    totalFiles: 0, approved: 0, pending: 0, rejected: 0,
    fileTypes: [], recentActivity: [], approvalRate: 0, approvalTrends: [],
    previousMonth: { totalFiles: 0, approved: 0, pending: 0, rejected: 0 }
  })

  useEffect(() => {
    let mounted = true
    const fetchSummary = async () => {
      if (!isConnected) return
      setLoading(true)
      try {
        const data = await adminService.getDashboardSummary()
        if (!mounted) return
        if (data.success) setSummary(data.summary)
        else setError(data.message || 'Failed to load dashboard data')
      } catch (err) {
        console.error('Error fetching dashboard summary:', err)
        if (mounted) setError('Unable to connect to server')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (isConnected) {
      fetchSummary()
      const interval = setInterval(fetchSummary, 5 * 60 * 1000) // Refresh every 5 minutes (reduced frequency)
      return () => { mounted = false; clearInterval(interval) }
    }
  }, [isConnected])

  const { pending, approved, rejected, totalFiles } = summary

  const statChanges = useMemo(() => {
    const calc = (cur, prev) => prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100
    if (!summary.previousMonth) return { pending: 0, approved: 0, rejected: 0, total: 0 }
    return {
      pending: calc(pending, summary.previousMonth.pending),
      approved: calc(approved, summary.previousMonth.approved),
      rejected: calc(rejected, summary.previousMonth.rejected),
      total: calc(totalFiles, summary.previousMonth.totalFiles)
    }
  }, [pending, approved, rejected, totalFiles, summary.previousMonth])

  const formatStatChange = (change) => {
    if (change === 0) return { text: '— No change', className: 'neutral' }
    const sign = change > 0 ? '↑' : '↓'
    return {
      text: `${sign} ${Math.abs(change).toFixed(1)}% from last month`,
      className: change > 0 ? 'positive' : 'negative'
    }
  }

  const activityItems = useMemo(() => (
    summary.recentActivity.map(act => (
      <div className="activity-item" key={act.id}>
        <div className="activity-content">
          <div className="activity-header">
            <span className="activity-user">{act.username || act.role || 'System'}</span>
            <span className={`activity-badge ${act.activity?.toLowerCase().includes('approved') ? 'approved' : act.activity?.toLowerCase().includes('rejected') ? 'rejected' : 'upload'}`}>
              {act.activity?.split(' ')[0]}
            </span>
          </div>
          <div className="activity-description">{act.activity}</div>
          <div className="activity-meta">{new Date(act.timestamp).toLocaleString()}</div>
        </div>
      </div>
    ))
  ), [summary.recentActivity])

  if (!isConnected) return <SkeletonLoader type="admin" />

  return (
    <div className={`dashboard-overview ${loading ? 'loading-cursor' : ''}`}>
      <div className="top-row">
        <div className="stats-section">
          <div className="stats-grid">
            {[
              { label: 'Pending Files', val: pending, change: statChanges.pending },
              { label: 'Approved Files', val: approved, change: statChanges.approved },
              { label: 'Rejected Files', val: rejected, change: statChanges.rejected, inv: true },
              { label: 'Total Files', val: totalFiles, change: statChanges.total }
            ].map((stat, i) => {
              const display = formatStatChange(stat.change)
              return (
                <div className="stat-card" key={i}>
                  <div className="stat-header"><span className="stat-label">{stat.label}</span></div>
                  <div className="stat-number">{loading ? '—' : stat.val.toLocaleString()}</div>
                  {!loading && <div className={`stat-change ${stat.inv ? (stat.change > 0 ? 'negative' : stat.change < 0 ? 'positive' : 'neutral') : display.className}`}>{display.text}</div>}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="bottom-row">
        <div className="charts-section">
          <div className="chart-card">
            <div className="chart-header"><h3>File Approval Trends</h3></div>
            <div className="chart-content">
              <Suspense fallback={<SkeletonLoader type="card" />}>
                <AnimatedTrendChart trends={summary.approvalTrends} loading={loading} />
              </Suspense>
            </div>
          </div>
          <div className="chart-card">
            <div className="chart-header"><h3>File Types Distribution</h3></div>
            <div className="chart-content">
              <Suspense fallback={<SkeletonLoader type="card" />}>
                <AnimatedPieChart fileTypes={summary.fileTypes} loading={loading} />
              </Suspense>
            </div>
          </div>
        </div>

        <div className="section-card activity-section">
          <div className="section-header"><h3>Recent Activity</h3></div>
          <div className="activity-list">
            {loading ? <div className="p-4">Loading activity...</div> : (summary.recentActivity.length === 0 ? <div className="p-4">No recent activity</div> : activityItems)}
          </div>
        </div>
      </div>
    </div>
  )
}

export default withErrorBoundary(memo(DashboardOverview), { componentName: 'Dashboard Overview' })
