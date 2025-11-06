import { useState, useEffect, useMemo, useRef, memo, useCallback } from 'react'
import './ActivityLogs.css'
import { ConfirmationModal, AlertMessage } from './modals'
import { memoize } from '../../utils/performance'

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

const ActivityLogs = ({ clearMessages, error, success, setError, setSuccess }) => {
  const [activityLogs, setActivityLogs] = useState([])
  const [logsSearchQuery, setLogsSearchQuery] = useState('')
  const [searchedQuery, setSearchedQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [showDeleteLogsModal, setShowDeleteLogsModal] = useState(false)
  const [paginationInfo, setPaginationInfo] = useState(null)
  const [hasActiveFilters, setHasActiveFilters] = useState(false)
  const itemsPerPage = 12 // Set to 12 logs per page as requested

  // Fetch activity logs on component mount and when date filter changes to 'all'
  useEffect(() => {
    if (dateFilter === 'all') {
      fetchActivityLogs()
    }
  }, [dateFilter])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => setSearchedQuery(logsSearchQuery), 300)
    return () => clearTimeout(timer)
  }, [logsSearchQuery])

  // Memoized filtered logs
  const filteredLogs = useMemo(() => {
    let filtered = [...activityLogs]

    // Apply search filter
    if (searchedQuery.trim() !== '') {
      const query = searchedQuery.toLowerCase()
      filtered = filtered.filter(log =>
        log.username.toLowerCase().includes(query) ||
        log.role.toLowerCase().includes(query) ||
        log.team.toLowerCase().includes(query) ||
        log.activity.toLowerCase().includes(query)
      )
    }

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      filtered = filtered.filter(log => {
        const logDate = new Date(log.timestamp)

        switch (dateFilter) {
          case 'today':
            return logDate >= today
          case 'week':
            const weekAgo = new Date(today)
            weekAgo.setDate(today.getDate() - 7)
            return logDate >= weekAgo
          case 'month':
            const monthAgo = new Date(today)
            monthAgo.setMonth(today.getMonth() - 1)
            return logDate >= monthAgo
          default:
            return true
        }
      })
    }

    return filtered
  }, [activityLogs, searchedQuery, dateFilter])

  // Memoized pagination data
  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentLogs = filteredLogs.slice(startIndex, endIndex)

    return {
      totalPages,
      startIndex,
      endIndex,
      currentLogs
    }
  }, [filteredLogs, currentPage, itemsPerPage])

  // Extract from memoized data
  const { totalPages, startIndex, endIndex, currentLogs } = paginationData

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filteredLogs])

  const fetchActivityLogs = async (limit = 10000) => {
    setIsLoading(true)
    try {
      const url = `http://localhost:3001/api/activity-logs?limit=${limit}`
      const response = await fetch(url)
      const data = await response.json()
      if (data.success) {
        setActivityLogs(data.logs)
      } else {
        setError('Failed to fetch activity logs')
      }
    } catch (error) {
      console.error('Error fetching activity logs:', error)
      setError('Failed to connect to server')
    } finally {
      setIsLoading(false)
    }
  }

  const exportLogs = () => {
    const csvContent = [
      ['Username', 'Role', 'Team', 'Date & Time', 'Activity'],
      ...filteredLogs.map(log => [
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

  const goToPage = useCallback((page) => {
    setCurrentPage(page)
  }, [])

  const goToPreviousPage = useCallback(() => {
    setCurrentPage(prev => Math.max(prev - 1, 1))
  }, [])

  const goToNextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages))
  }, [totalPages])

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
    const hasSearchFilter = logsSearchQuery.trim() !== ''
    const hasDateFilter = dateFilter !== 'all'
    
    if (hasSearchFilter && hasDateFilter) {
      const dateFilterText = {
        'today': 'today',
        'week': 'this week',
        'month': 'this month'
      }[dateFilter]
      return `search "${logsSearchQuery}" and ${dateFilterText}`
    } else if (hasSearchFilter) {
      return `search "${logsSearchQuery}"`
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
    const hasSearchFilter = logsSearchQuery.trim() !== ''
    const hasDateFilter = dateFilter !== 'all'
    
    if (!hasSearchFilter && !hasDateFilter) {
      setError('Please apply a search term or date filter to specify logs for deletion')
      return
    }

    if (filteredLogs.length === 0) {
      setError('No logs found matching your current filter criteria')
      return
    }

    setShowDeleteLogsModal(true)
  }

  const confirmDeleteLogs = async () => {
    const logsToDelete = filteredLogs.length
    const logIdsToDelete = filteredLogs.map(log => log.id)
    
    console.log('Attempting to delete logs:', { logsToDelete, logIdsToDelete })

    // Quick API test first
    try {
      const testResponse = await fetch('http://localhost:3001/api/health')
      console.log('API health check:', testResponse.status, testResponse.ok)
    } catch (healthError) {
      console.error('API health check failed:', healthError)
      setError('Cannot connect to server. Please ensure the server is running.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      console.log('Making delete request to:', 'http://localhost:3001/api/activity-logs/bulk-delete')
      
      // Make API call to delete the logs
      const response = await fetch('http://localhost:3001/api/activity-logs/bulk-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logIds: logIdsToDelete })
      })
      
      console.log('Response status:', response.status, 'OK:', response.ok)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Response error text:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }
      
      const data = await response.json()
      console.log('Delete response:', data)
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to delete logs')
      }
      
      // Update the state by removing deleted logs
      const updatedActivityLogs = activityLogs.filter(log => 
        !logIdsToDelete.includes(log.id)
      )
      
      console.log('Updating state:', { 
        originalCount: activityLogs.length, 
        newCount: updatedActivityLogs.length,
        deletedCount: data.deletedCount
      })
      
      // Set the new activity logs
      setActivityLogs(updatedActivityLogs)

      setCurrentPage(1) // Reset to first page
      setShowDeleteLogsModal(false)
      
      // Clear any existing errors
      if (error) {
        setError('')
      }
      
      setSuccess(`Successfully deleted ${data.deletedCount || logsToDelete} log(s) matching your filter criteria`)
      
    } catch (error) {
      console.error('Error deleting logs:', error)
      setError(`Failed to delete logs: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="activity-logs-section">
      
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
                {currentLogs.map((log) => (
                  <LogRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {!isLoading && filteredLogs.length === 0 && (
          <div className="empty-state">
            <h3>No activity logs found</h3>
            <p>No activity logs match your current search criteria.</p>
          </div>
        )}
        
        {/* Pagination */}
        {!isLoading && filteredLogs.length > 0 && totalPages > 1 && (
          <div className="pagination-section">
            <div className="pagination-info">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length} logs
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
        confirmText={`Delete ${filteredLogs.length} Log(s)`}
        variant="danger"
        isLoading={isLoading}
      >
        <p className="confirmation-description">
          You are about to delete <strong>{filteredLogs.length} log(s)</strong> that match your {getFilterDescription()}.
        </p>
        <p className="confirmation-description" style={{ marginTop: '0.5rem' }}>
          This action cannot be undone. The selected activity logs will be permanently removed from the system and cannot be recovered.
        </p>
      </ConfirmationModal>
    </div>
  )
}

export default memo(ActivityLogs)
