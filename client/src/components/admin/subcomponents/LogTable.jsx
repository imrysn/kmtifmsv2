import React, { memo } from 'react'
import './LogTable.css'
import { memoize } from '../../../utils/performance'

// Memoize expensive date formatting functions
const formatDate = memoize((timestamp) => {
  return new Date(timestamp).toLocaleDateString()
})

const formatTime = memoize((timestamp) => {
  return new Date(timestamp).toLocaleTimeString()
})

const LogRow = memo(({ log }) => (
  <tr>
    <td>{log.username}</td>
    <td>{log.role}</td>
    <td>{log.team}</td>
    <td>
      {formatDate(log.timestamp)} {formatTime(log.timestamp)}
    </td>
    <td>{log.activity}</td>
  </tr>
))

const LogTable = ({
  isLoading,
  currentLogs,
  filteredLogs,
  totalPages,
  currentPage,
  itemsPerPage,
  setCurrentPage,
  renderPaginationNumbers
}) => {
  if (isLoading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading activity logs...</p>
      </div>
    )
  }

  if (filteredLogs.length === 0) {
    return (
      <div className="empty-state">
        <h3>No activity logs found</h3>
        <p>No activity logs match your current search criteria.</p>
      </div>
    )
  }

  return (
    <div className="table-section">
      <div className="logs-table-container">
        <table className="activity-logs-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Team</th>
              <th>Date & Time</th>
              <th>Activity</th>
            </tr>
          </thead>
          <tbody>
            {currentLogs.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination-section">
          <div className="pagination-info">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length} logs
          </div>
          <div className="pagination-controls">
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              ‹
            </button>
            {renderPaginationNumbers}
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default React.memo(LogTable)
