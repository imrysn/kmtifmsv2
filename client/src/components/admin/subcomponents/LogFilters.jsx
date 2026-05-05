import React from 'react'
import './LogFilters.css'

const LogFilters = ({
  logsSearchQuery,
  setLogsSearchQuery,
  clearLogsSearch,
  dateFilter,
  setDateFilter,
  clearLogFilters,
  filteredLogs,
  isLoading,
  deleteFilteredLogs,
  exportLogs
}) => {
  return (
    <div className="action-bar">
      <div className="filters-section">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search activity logs..."
            value={logsSearchQuery}
            onChange={(e) => setLogsSearchQuery(e.target.value)}
            className="search-input"
          />
          {logsSearchQuery && (
            <button
              className="search-clear-btn"
              onClick={clearLogsSearch}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div className="date-filter-container">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="date-filter-select"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>

        {(logsSearchQuery || dateFilter !== 'all') && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={clearLogFilters}
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="action-buttons">
        <button
          className="btn btn-danger"
          onClick={deleteFilteredLogs}
          disabled={(logsSearchQuery.trim() === '' && dateFilter === 'all') || filteredLogs.length === 0 || isLoading}
          title={
            (logsSearchQuery.trim() === '' && dateFilter === 'all')
              ? "Apply a search term or date filter to specify logs for deletion"
              : `Delete ${filteredLogs.length} filtered log(s)`
          }
        >
          {isLoading ? 'Deleting...' : `Delete Logs (${filteredLogs.length})`}
        </button>
        <button
          className="btn btn-primary"
          onClick={exportLogs}
          disabled={filteredLogs.length === 0}
        >
          Export Logs
        </button>
      </div>
    </div>
  )
}

export default React.memo(LogFilters)
