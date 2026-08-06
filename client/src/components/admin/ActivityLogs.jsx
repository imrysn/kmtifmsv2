import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { apiFetch } from '@/config/api'
import './ActivityLogs.css'
import { ConfirmationModal, AlertMessage } from './modals'
import { SkeletonLoader } from '../common/SkeletonLoader'
import { memoize } from '../../utils/performance'
import { useAuth, useNetwork } from '../../contexts'
import { withErrorBoundary } from '../common'

// Memoize expensive date formatting functions to avoid creating Date objects repeatedly
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
LogRow.displayName = 'LogRow'

const ActivityLogs = ({ clearMessages, error, success, setError, setSuccess, isActive = true }) => {
  const { user: authUser } = useAuth()
  const { isConnected } = useNetwork()

  const [activityLogs, setActivityLogs] = useState([])
  const [logsSearchQuery, setLogsSearchQuery] = useState('')
  const [searchedQuery, setSearchedQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [showDeleteLogsModal, setShowDeleteLogsModal] = useState(false)
  const [totalPages, setTotalPages] = useState(1)
  const [totalLogs, setTotalLogs] = useState(0)
  const itemsPerPage = 12 // Set to 12 logs per page as requested

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchedQuery(logsSearchQuery)
      setCurrentPage(1) // reset to first page on new search
    }, 500)
    return () => clearTimeout(timer)
  }, [logsSearchQuery])

  // Reset page when date filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [dateFilter])

  const fetchActivityLogs = useCallback(async () => {
    if (!isActive || !isConnected) return;
    
    setIsLoading(true)
    try {
      const queryParams = new URLSearchParams({
        page: currentPage,
        limit: itemsPerPage,
        search: searchedQuery,
        dateFilter: dateFilter
      })
      const data = await apiFetch(`/api/activity-logs?${queryParams}`)
      if (data.success) {
        setActivityLogs(data.logs)
        setTotalPages(data.pagination?.pages || 1)
        setTotalLogs(data.pagination?.total || 0)
      } else {
        setError('Failed to fetch activity logs')
      }
    } catch (error) {
      console.error('Error fetching activity logs:', error)
      setError('Failed to connect to server')
    } finally {
      setIsLoading(false)
    }
  }, [isActive, isConnected, currentPage, itemsPerPage, searchedQuery, dateFilter, setError])

  // Fetch activity logs when dependencies change
  useEffect(() => {
    fetchActivityLogs()
  }, [fetchActivityLogs])

  const exportLogs = async () => {
    // Request all matching logs for export (up to a reasonable large limit)
    try {
      const queryParams = new URLSearchParams({
        page: 1,
        limit: 10000,
        search: searchedQuery,
        dateFilter: dateFilter
      })
      const data = await apiFetch(`/api/activity-logs?${queryParams}`)
      
      if (!data.success) throw new Error('Failed to fetch logs for export')
      
      const logsToExport = data.logs || []
      const csvContent = [
        ['Username', 'Role', 'Team', 'Date & Time', 'Activity'],
        ...logsToExport.map(log => [
          log.username,
          log.role,
          log.team,
          new Date(log.timestamp).toLocaleString(),
          log.activity
        ])
      ].map(row => row.join(',')).join('\n')
  
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      setSuccess('Activity logs exported successfully')
    } catch (error) {
      console.error('Export error:', error)
      setError('Failed to export logs')
    }
  }

  const clearLogFilters = () => {
    setLogsSearchQuery('')
    setDateFilter('all')
    setCurrentPage(1)
    setSuccess('All filters cleared')
  }

  const clearLogsSearch = useCallback(() => {
    setLogsSearchQuery('')
  }, [])

  const renderPaginationNumbers = useMemo(() => {
    const pageNumbers = []
    const maxVisiblePages = 5

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(
          <button
            key={i}
            className={`pagination-btn ${i === currentPage ? 'active' : ''}`}
            onClick={() => setCurrentPage(i)}
          >
            {i}
          </button>
        )
      }
    } else {
      pageNumbers.push(
        <button
          key={1}
          className={`pagination-btn ${1 === currentPage ? 'active' : ''}`}
          onClick={() => setCurrentPage(1)}
        >
          1
        </button>
      )

      if (currentPage > 3) {
        pageNumbers.push(<span key="ellipsis1" className="pagination-ellipsis">...</span>)
      }

      const startPage = Math.max(2, currentPage - 1)
      const endPage = Math.min(totalPages - 1, currentPage + 1)

      for (let i = startPage; i <= endPage; i++) {
        if (i !== 1 && i !== totalPages) {
          pageNumbers.push(
            <button
              key={i}
              className={`pagination-btn ${i === currentPage ? 'active' : ''}`}
              onClick={() => setCurrentPage(i)}
            >
              {i}
            </button>
          )
        }
      }

      if (currentPage < totalPages - 2) {
        pageNumbers.push(<span key="ellipsis2" className="pagination-ellipsis">...</span>)
      }

      if (totalPages > 1) {
        pageNumbers.push(
          <button
            key={totalPages}
            className={`pagination-btn ${totalPages === currentPage ? 'active' : ''}`}
            onClick={() => setCurrentPage(totalPages)}
          >
            {totalPages}
          </button>
        )
      }
    }

    return pageNumbers
  }, [totalPages, currentPage])

  // Helper function to get current filter description
  const getFilterDescription = () => {
    const hasSearchFilter = searchedQuery.trim() !== ''
    const hasDateFilter = dateFilter !== 'all'

    if (hasSearchFilter && hasDateFilter) {
      const dateFilterText = {
        'today': 'today',
        'week': 'this week',
        'month': 'this month'
      }[dateFilter]
      return `search "${searchedQuery}" and ${dateFilterText}`
    } else if (hasSearchFilter) {
      return `search "${searchedQuery}"`
    } else if (hasDateFilter) {
      const dateFilterText = {
        'today': 'today',
        'week': 'this week',
        'month': 'this month'
      }[dateFilter]
      return `date filter "${dateFilterText}"`
    }
    return 'current filters'
  }

  const deleteFilteredLogs = async () => {
    // Check if any filter is applied
    const hasSearchFilter = searchedQuery.trim() !== ''
    const hasDateFilter = dateFilter !== 'all'

    if (!hasSearchFilter && !hasDateFilter) {
      setError('Please apply a search term or date filter to specify logs for deletion')
      return
    }

    if (totalLogs === 0) {
      setError('No logs found matching your current filter criteria')
      return
    }

    setShowDeleteLogsModal(true)
  }

  const confirmDeleteLogs = async () => {
    const logsToDelete = totalLogs

    setIsLoading(true)
    try {
      // Fetch all matching IDs to delete since we don't hold them all in memory anymore
      const queryParams = new URLSearchParams({
        page: 1,
        limit: 10000,
        search: searchedQuery,
        dateFilter: dateFilter
      })
      const data = await apiFetch(`/api/activity-logs?${queryParams}`)
      
      if (!data.success) throw new Error('Failed to fetch logs for deletion')
      
      const logIdsToDelete = data.logs.map(log => log.id)

      if (logIdsToDelete.length === 0) {
        throw new Error('No logs found to delete')
      }

      // Make API call to delete the logs
      const deleteData = await apiFetch(`/api/activity-logs/bulk-delete`, {
        method: 'DELETE',
        body: JSON.stringify({ logIds: logIdsToDelete })
      })

      if (!deleteData.success) {
        throw new Error(deleteData.message || 'Failed to delete logs')
      }

      setCurrentPage(1) // Reset to first page
      setShowDeleteLogsModal(false)
      fetchActivityLogs() // Refresh table

      // Clear any existing errors
      if (error) {
        setError('')
      }

      setSuccess(`Successfully deleted ${deleteData.deletedCount || logsToDelete} log(s) matching your filter criteria`)

    } catch (error) {
      console.error('Error deleting logs:', error)
      setError(`Failed to delete logs: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Show skeleton loader when network is not available
  if (!isConnected) {
    return <SkeletonLoader type="table" />
  }

  return (
    <div className={`activity-logs-section ${isLoading ? 'loading-cursor' : ''}`}>

      {/* Action Bar */}
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
            disabled={(searchedQuery.trim() === '' && dateFilter === 'all') || totalLogs === 0 || isLoading}
            title={
              (searchedQuery.trim() === '' && dateFilter === 'all')
                ? "Apply a search term or date filter to specify logs for deletion"
                : `Delete ${totalLogs} filtered log(s)`
            }
          >
            {isLoading ? 'Deleting...' : `Delete Logs (${totalLogs})`}
          </button>
          <button
            className="btn btn-primary"
            onClick={exportLogs}
            disabled={totalLogs === 0}
          >
            Export Logs
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <AlertMessage
          type="error"
          message={error}
          onClose={clearMessages}
        />
      )}

      {success && (
        <AlertMessage
          type="success"
          message={success}
          onClose={clearMessages}
        />
      )}

      {/* Activity Logs Table */}
      <div className="table-section">
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading activity logs...</p>
          </div>
        ) : (
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
                {activityLogs.map((log) => (
                  <LogRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && activityLogs.length === 0 && (
          <div className="empty-state">
            <h3>No activity logs found</h3>
            <p>No activity logs match your current search criteria.</p>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && activityLogs.length > 0 && totalPages > 1 && (
          <div className="pagination-section">
            <div className="pagination-info">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalLogs)} of {totalLogs} logs
            </div>
            {totalPages > 1 && (
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
            )}
          </div>
        )}
      </div>

      {/* Delete Logs Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteLogsModal}
        onClose={() => setShowDeleteLogsModal(false)}
        onConfirm={confirmDeleteLogs}
        title="Delete Activity Logs"
        message="Are you sure you want to delete these activity logs?"
        confirmText={`Delete ${totalLogs} Log(s)`}
        variant="danger"
        isLoading={isLoading}
      >
        <p className="confirmation-description">
          You are about to delete <strong>{totalLogs} log(s)</strong> that match your {getFilterDescription()}.
        </p>
        <p className="confirmation-description" style={{ marginTop: '0.5rem' }}>
          This action cannot be undone. The selected activity logs will be permanently removed from the system and cannot be recovered.
        </p>
      </ConfirmationModal>
    </div>
  )
}

export default withErrorBoundary(memo(ActivityLogs), {
  componentName: 'Activity Logs'
})
