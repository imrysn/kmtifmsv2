import React, { useEffect, useState, useMemo, memo, useCallback } from 'react'
import { API_BASE_URL } from '@/config/api'
import './DashboardOverview.css'
import { SkeletonLoader } from '../common/SkeletonLoader'
import { useAuth, useNetwork } from '../../contexts'
import { withErrorBoundary } from '../common'

// Sub-components
import DashboardStats from './subcomponents/DashboardStats'
import DashboardCharts from './subcomponents/DashboardCharts'
import DashboardActivity from './subcomponents/DashboardActivity'

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

  const fetchSummary = useCallback(async () => {
    if (!isConnected) return
    setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/dashboard/summary`)
      const data = await res.json()
      if (data.success) {
        setSummary(data.summary)
      } else {
        setError(data.message || 'Failed to load dashboard data')
      }
    } catch (err) {
      console.error('Error fetching dashboard summary:', err)
      setError('Unable to connect to server')
    } finally {
      setLoading(false)
    }
  }, [isConnected])

  useEffect(() => {
    if (isConnected) {
      fetchSummary()
      const interval = setInterval(fetchSummary, 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [isConnected, fetchSummary])

  const pendingCount = summary.pending
  const approvedCount = summary.approved
  const rejectedCount = summary.rejected
  const totalCount = summary.totalFiles

  const statChanges = useMemo(() => {
    const calculateChange = (current, previous) => {
      if (!previous || previous === 0) return current > 0 ? 100 : 0
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

  const formattedStatChanges = useMemo(() => {
    const formatStatChange = (change) => {
      const absChange = Math.abs(change)
      const sign = change > 0 ? '↑' : change < 0 ? '↓' : '—'
      const className = change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral'
      const formattedChange = absChange.toFixed(1)

      if (change === 0) return { text: '— No change from last month', className: 'neutral' }
      return { text: `${sign} ${change >= 0 ? '+' : '-'}${formattedChange}% from last month`, className }
    }

    return {
      pending: formatStatChange(statChanges.pending),
      approved: formatStatChange(statChanges.approved),
      rejected: formatStatChange(statChanges.rejected),
      total: formatStatChange(statChanges.total)
    }
  }, [statChanges])

  const activityItems = useMemo(() => {
    return summary.recentActivity.map(act => (
      <div className="activity-item" key={act.id}>
        <div className="activity-content">
          <div className="activity-header">
            <span className="activity-user">{act.username || act.role || 'System'}</span>
            <span className={"activity-badge " + (act.activity?.toLowerCase().includes('approved') ? 'approved' : act.activity?.toLowerCase().includes('rejected') ? 'rejected' : 'upload')}>
              {(act.activity || '').split(' ')[0]}
            </span>
          </div>
          <div className="activity-description">{act.activity}</div>
          <div className="activity-meta">{new Date(act.timestamp).toLocaleString()}</div>
        </div>
      </div>
    ))
  }, [summary.recentActivity])

  if (!isConnected) return <SkeletonLoader type="admin" />

  return (
    <div className={`dashboard-overview ${loading ? 'loading-cursor' : ''}`}>
      <DashboardStats
        loading={loading}
        pendingCount={pendingCount}
        approvedCount={approvedCount}
        rejectedCount={rejectedCount}
        totalCount={totalCount}
        formattedStatChanges={formattedStatChanges}
        statChanges={statChanges}
      />

      <div className="bottom-row">
        <DashboardCharts
          approvalTrends={summary.approvalTrends}
          fileTypes={summary.fileTypes}
          loading={loading}
        />

        <DashboardActivity
          loading={loading}
          recentActivity={summary.recentActivity}
          activityItems={activityItems}
        />
      </div>
    </div>
  )
}

export default withErrorBoundary(memo(DashboardOverview), {
  componentName: 'Dashboard Overview'
})
