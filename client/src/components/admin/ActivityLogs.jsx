import { useState, useEffect } from 'react'
import './ActivityLogs.css'

const ActivityLogs = ({ clearMessages, error, success, setError, setSuccess }) => {
  const [activityLogs, setActivityLogs] = useState([])
  const [filteredLogs, setFilteredLogs] = useState([])
  const [logsSearchQuery, setLogsSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showDeleteLogsModal, setShowDeleteLogsModal] = useState(false)

  // Fetch activity logs on component mount
  useEffect(() => {
    fetchActivityLogs()
  }, [])

  // Filter logs when search query or logs change
  useEffect(() => {
    if (logsSearchQuery.trim() === '') {
      setFilteredLogs(activityLogs)
    } else {
      const filtered = activityLogs.filter(log => 
        log.username.toLowerCase().includes(logsSearchQuery.toLowerCase()) ||
        log.role.toLowerCase().includes(logsSearchQuery.toLowerCase()) ||
        log.team.toLowerCase().includes(logsSearchQuery.toLowerCase()) ||
        log.activity.toLowerCase().includes(logsSearchQuery.toLowerCase())
      )
      setFilteredLogs(filtered)
    }
  }, [logsSearchQuery, activityLogs])

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
    setFilteredLogs(activityLogs)
    setSuccess('Search cleared')
  }

  const clearLogsSearch = () => {
    setLogsSearchQuery('')
  }

  const deleteFilteredLogs = async () => {
    if (!logsSearchQuery.trim()) {
      setError('Please enter a search term to filter logs for deletion')
      return
    }

    if (filteredLogs.length === 0) {
      setError('No logs found matching your search criteria')
      return
    }

    setShowDeleteLogsModal(true)
  }

  const confirmDeleteLogs = async () => {
    const logsToDelete = filteredLogs.length

    setIsLoading(true)
    try {
      // Simulate API call to delete filtered logs
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Remove the filtered logs from the main logs array
      const remainingLogs = activityLogs.filter(log => 
        !filteredLogs.some(filteredLog => filteredLog.id === log.id)
      )
      
      setActivityLogs(remainingLogs)
      setFilteredLogs(remainingLogs)
      setLogsSearchQuery('') // Clear search after deletion
      setShowDeleteLogsModal(false)
      setSuccess(`Successfully deleted ${logsToDelete} log(s)`)
    } catch (error) {
      setError('Failed to delete logs')
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
        <div className="search-section">
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
        </div>
        
        <div className="action-buttons">
          <button 
            className="btn btn-danger"
            onClick={deleteFilteredLogs}
            disabled={!logsSearchQuery.trim() || filteredLogs.length === 0 || isLoading}
            title={!logsSearchQuery.trim() ? "Enter search term to filter logs for deletion" : `Delete ${filteredLogs.length} filtered log(s)`}
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
                {filteredLogs.map((log) => (
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
                      <span className="team-badge">{log.team}</span>
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
      </div>

      {/* Delete Logs Confirmation Modal */}
      {showDeleteLogsModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteLogsModal(false)}>
          <div className="modal delete-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Activity Logs</h3>
              <button onClick={() => setShowDeleteLogsModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="delete-warning">
                <div className="warning-icon">⚠️</div>
                <div className="warning-content">
                  <h4>Are you sure you want to delete these activity logs?</h4>
                  <p className="file-info">
                    You are about to delete <strong>{filteredLogs.length} log(s)</strong> that match your search criteria: "<strong>{logsSearchQuery}</strong>"
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
                  onClick={() => setShowDeleteLogsModal(false)} 
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={confirmDeleteLogs}
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
