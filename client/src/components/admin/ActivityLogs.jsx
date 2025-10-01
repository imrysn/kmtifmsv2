import { useState, useEffect } from 'react'
import './ActivityLogs.css'

const ActivityLogs = ({ clearMessages, error, success, setError, setSuccess }) => {
  const [activityLogs, setActivityLogs] = useState([])
  const [filteredLogs, setFilteredLogs] = useState([])
  const [logsSearchQuery, setLogsSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [showDeleteLogsModal, setShowDeleteLogsModal] = useState(false)
  
  const itemsPerPage = 10

  // Fetch activity logs on component mount
  useEffect(() => {
    fetchActivityLogs()
  }, [])

  // Filter logs when search query, date filter, or logs change
  useEffect(() => {
    let filtered = [...activityLogs]
    
    // Apply search filter
    if (logsSearchQuery.trim() !== '') {
      filtered = filtered.filter(log => 
        log.username.toLowerCase().includes(logsSearchQuery.toLowerCase()) ||
        log.role.toLowerCase().includes(logsSearchQuery.toLowerCase()) ||
        log.team.toLowerCase().includes(logsSearchQuery.toLowerCase()) ||
        log.activity.toLowerCase().includes(logsSearchQuery.toLowerCase())
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
    
    setFilteredLogs(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }, [logsSearchQuery, dateFilter, activityLogs])

  const fetchActivityLogs = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('http://localhost:3001/api/activity-logs')
      const data = await response.json()
      if (data.success) {
        setActivityLogs(data.logs)
        setFilteredLogs(data.logs)
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
    setFilteredLogs(activityLogs)
    setSuccess('All filters cleared')
  }

  const clearLogsSearch = () => {
    setLogsSearchQuery('')
  }
  
  // Pagination calculations
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentLogs = filteredLogs.slice(startIndex, endIndex)
  
  const goToPage = (page) => {
    setCurrentPage(page)
  }
  
  const goToPreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1))
  }
  
  const goToNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages))
  }
  
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
      
      // Re-apply filters to the updated logs
      let newFilteredLogs = [...updatedActivityLogs]
      
      // Apply search filter
      if (logsSearchQuery.trim() !== '') {
        newFilteredLogs = newFilteredLogs.filter(log => 
          log.username.toLowerCase().includes(logsSearchQuery.toLowerCase()) ||
          log.role.toLowerCase().includes(logsSearchQuery.toLowerCase()) ||
          log.team.toLowerCase().includes(logsSearchQuery.toLowerCase()) ||
          log.activity.toLowerCase().includes(logsSearchQuery.toLowerCase())
        )
      }
      
      // Apply date filter
      if (dateFilter !== 'all') {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        
        newFilteredLogs = newFilteredLogs.filter(log => {
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
      
      setFilteredLogs(newFilteredLogs)
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
      <div className="page-header">
        <h1>Activity Logs</h1>
        <p>Monitor system activities and user actions</p>
      </div>
      
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
        <div className="alert alert-error">
          <span className="alert-message">{error}</span>
          <button onClick={clearMessages} className="alert-close">×</button>
        </div>
      )}
      
      {success && (
        <div className="alert alert-success">
          <span className="alert-message">{success}</span>
          <button onClick={clearMessages} className="alert-close">×</button>
        </div>
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
                  <tr key={log.id} className="log-row">
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar">{log.username.charAt(0).toUpperCase()}</div>
                        <span className="user-name">{log.username}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`role-badge ${log.role.toLowerCase().replace(' ', '-')}`}>
                        {log.role}
                      </span>
                    </td>
                    <td>
                      <span className="team-badge">
                        {log.team}
                      </span>
                    </td>
                    <td>
                      <div className="datetime-cell">
                        <div className="date">{new Date(log.timestamp).toLocaleDateString()}</div>
                        <div className="time">{new Date(log.timestamp).toLocaleTimeString()}</div>
                      </div>
                    </td>
                    <td>
                      <div className="activity-cell">{log.activity}</div>
                    </td>
                  </tr>
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
          <div className="pagination-container">
            <div className="pagination-info">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredLogs.length)} of {filteredLogs.length} logs
            </div>
            <div className="pagination-controls">
              <button 
                className="pagination-btn"
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                title="Previous page"
              >
                ‹
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => {
                  // Show first page, last page, current page, and pages around current
                  return page === 1 || 
                         page === totalPages || 
                         Math.abs(page - currentPage) <= 1
                })
                .map((page, index, array) => {
                  // Add ellipsis if there's a gap
                  const showEllipsis = index > 0 && page - array[index - 1] > 1
                  return (
                    <div key={page}>
                      {showEllipsis && <span className="pagination-ellipsis">...</span>}
                      <button
                        className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                        onClick={() => goToPage(page)}
                      >
                        {page}
                      </button>
                    </div>
                  )
                })}
              
              <button 
                className="pagination-btn"
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                title="Next page"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Logs Confirmation Modal */}
      {showDeleteLogsModal && (
        <div className="modal-overlay" onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setShowDeleteLogsModal(false)
        }}>
          <div className="modal delete-modal" onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}>
            <div className="modal-header">
              <h3>Delete Activity Logs</h3>
              <button onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowDeleteLogsModal(false)
              }} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="delete-warning">
                <div className="warning-icon">⚠️</div>
                <div className="warning-content">
                  <h4>Are you sure you want to delete these activity logs?</h4>
                  <p className="file-info">
                    You are about to delete <strong>{filteredLogs.length} log(s)</strong> that match your {getFilterDescription()}.
                  </p>
                  <p className="warning-text">
                    This action cannot be undone. The selected activity logs will be permanently removed from the system and cannot be recovered.
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <div className="delete-actions">
                <button 
                  type="button" 
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowDeleteLogsModal(false)
                  }} 
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    confirmDeleteLogs()
                  }}
                  className="btn btn-danger" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Deleting...' : `Delete ${filteredLogs.length} Log(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ActivityLogs