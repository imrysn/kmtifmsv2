import React from 'react'
import './DashboardCharts.css'
import ApprovalTrendChart from '../charts/ApprovalTrendChart'
import AnimatedPieChart from '../charts/AnimatedPieChart'

const DashboardCharts = ({ approvalTrends, fileTypes, loading }) => {
  return (
    <div className="charts-section">
      <div className="chart-card">
        <div className="chart-header">
          <h3>File Approval Trends</h3>
        </div>
        <div className="chart-content">
          <ApprovalTrendChart trends={approvalTrends} loading={loading} />
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-header">
          <h3>File Types Distribution</h3>
          <span className="chart-subtitle">All file types tracked</span>
        </div>
        <div className="chart-content">
          <AnimatedPieChart fileTypes={fileTypes} loading={loading} />
        </div>
      </div>
    </div>
  )
}

export default React.memo(DashboardCharts)
