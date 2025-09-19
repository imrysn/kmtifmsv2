import { useState, useEffect, useRef } from 'react'
import './FileApproval.css'

const FileApproval = ({ clearMessages, error, success, setError, setSuccess }) => {
  const [files, setFiles] = useState([])
  const [filteredFiles, setFilteredFiles] = useState([])
  const [teams, setTeams] = useState([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [fileSearchQuery, setFileSearchQuery] = useState('')
  const [fileFilter, setFileFilter] = useState('all')
  const [fileSortBy, setFileSortBy] = useState('date-desc')
  const [selectedFile, setSelectedFile] = useState(null)
  const [showFileModal, setShowFileModal] = useState(false)
  const [fileComment, setFileComment] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [fileToDelete, setFileToDelete] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const statusCardsRef = useRef(null)
  const searchInputRef = useRef(null)
  const filterSelectRef = useRef(null)

  // Auto-clear messages after 3 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        clearMessages()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [error, success, clearMessages])

  // Mouse move handler for cursor shadow effect
  useEffect(() => {
    const handleMouseMove = (e) => {
      const elements = document.querySelectorAll('.file-status-card, .search-input, .form-select')
      elements.forEach(el => {
        const rect = el.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        el.style.setProperty('--mouse-x', `${x}px`)
        el.style.setProperty('--mouse-y', `${y}px`)
      })
    }

    document.addEventListener('mousemove', handleMouseMove)
    return () => document.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // Fetch files and teams on component mount
  useEffect(() => {
    fetchFiles()
    fetchTeams()
  }, [])

  // Filter and sort files when dependencies change
  useEffect(() => {
    let filtered = files

    // Apply status filter
    if (fileFilter !== 'all') {
      filtered = filtered.filter(file => {
        const mappedStatus = mapFileStatus(file.status)
        return mappedStatus === fileFilter
      })
    }

    // Apply search filter
    if (fileSearchQuery.trim() !== '') {
      filtered = filtered.filter(file => 
        file.filename.toLowerCase().includes(fileSearchQuery.toLowerCase()) ||
        file.username.toLowerCase().includes(fileSearchQuery.toLowerCase()) ||
        file.user_team.toLowerCase().includes(fileSearchQuery.toLowerCase())
      )
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      switch (fileSortBy) {
        case 'date-desc':
          return new Date(b.uploaded_at) - new Date(a.uploaded_at)
        case 'date-asc':
          return new Date(a.uploaded_at) - new Date(b.uploaded_at)
        case 'filename-asc':
          return a.filename.localeCompare(b.filename)
        case 'filename-desc':
          return b.filename.localeCompare(a.filename)
        case 'user-asc':
          return a.username.localeCompare(b.username)
        case 'user-desc':
          return b.username.localeCompare(a.username)
        default:
          return 0
      }
    })

    setFilteredFiles(filtered)
  }, [files, fileSearchQuery, fileFilter, fileSortBy])

  const fetchTeams = async () => {
    setTeamsLoading(true)
    try {
      const response = await fetch('http://localhost:3001/api/teams')
      const data = await response.json()
      if (data.success) {
        setTeams(data.teams || [])
      } else {
        console.error('Failed to fetch teams:', data.message)
      }
    } catch (error) {
      console.error('Error fetching teams:', error)
    } finally {
      setTeamsLoading(false)
    }
  }

  const fetchFiles = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('http://localhost:3001/api/files/all')
      const data = await response.json()
      if (data.success) {
        setFiles(data.files)
        setFilteredFiles(data.files)
      } else {
        setError('Failed to fetch files')
      }
    } catch (error) {
      console.error('Error fetching files:', error)
      setError('Failed to connect to server')
    } finally {
      setIsLoading(false)
    }
  }

  // Map database status to display status
  const mapFileStatus = (dbStatus) => {
    switch (dbStatus) {
      case 'uploaded':
      case 'team_leader_approved':
        return 'pending'
      case 'final_approved':
        return 'approved'
      case 'rejected_by_team_leader':
      case 'rejected_by_admin':
        return 'rejected'
      default:
        return 'pending'
    }
  }

  const getStatusDisplayName = (dbStatus) => {
    switch (dbStatus) {
      case 'uploaded':
        return 'Pending Team Leader'
      case 'team_leader_approved':
        return 'Pending Admin'
      case 'final_approved':
        return 'Final Approved'
      case 'rejected_by_team_leader':
        return 'Rejected by Team Leader'
      case 'rejected_by_admin':
        return 'Rejected by Admin'
      default:
        return dbStatus.charAt(0).toUpperCase() + dbStatus.slice(1)
    }
  }

  const getTeamColor = (teamName) => {
    const team = teams.find(t => t.name === teamName)
    return team ? team.color : '#6B7280' // Default gray color
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const deleteFile = async () => {
    if (!fileToDelete) return
    
    setIsLoading(true)
    try {
      const response = await fetch(`http://localhost:3001/api/files/${fileToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          adminId: 1, // Should come from logged in admin user
          adminUsername: 'admin',
          adminRole: 'ADMIN',
          team: 'IT Administration'
        })
      })
      
      const data = await response.json()
      if (data.success) {
        const updatedFiles = files.filter(file => file.id !== fileToDelete.id)
        setFiles(updatedFiles)
        setShowDeleteModal(false)
        setFileToDelete(null)
        setSuccess('File deleted successfully')
      } else {
        setError(data.message || 'Failed to delete file')
      }
    } catch (error) {
      console.error('Error deleting file:', error)
      setError('Failed to delete file')
    } finally {
      setIsLoading(false)
    }
  }

  const openDeleteModal = (file) => {
    setFileToDelete(file)
    setShowDeleteModal(true)
  }

  const openFileModal = (file) => {
    setSelectedFile({
      ...file,
      comments: [] // Initialize comments array for UI compatibility
    })
    setFileComment('')
    setShowFileModal(true)
  }

  const addComment = async () => {
    if (!selectedFile || !fileComment.trim()) return
    
    setIsLoading(true)
    try {
      const response = await fetch(`http://localhost:3001/api/files/${selectedFile.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          comment: fileComment.trim(),
          userId: 1, // Should come from logged in admin user
          username: 'admin',
          userRole: 'ADMIN'
        })
      })
      
      const data = await response.json()
      if (data.success) {
        // Update the selected file with new comment
        const updatedComments = [
          ...selectedFile.comments,
          { text: fileComment.trim(), date: new Date() }
        ]
        setSelectedFile({
          ...selectedFile,
          comments: updatedComments
        })
        
        setFileComment('')
        setSuccess('Comment added successfully')
      } else {
        setError(data.message || 'Failed to add comment')
      }
    } catch (error) {
      console.error('Error adding comment:', error)
      setError('Failed to add comment')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCommentKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      addComment()
    }
  }

  const approveFile = async () => {
    if (!selectedFile) return
    
    setIsLoading(true)
    try {
      const response = await fetch(`http://localhost:3001/api/files/${selectedFile.id}/admin-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'approve',
          comments: fileComment.trim(),
          adminId: 1, // Should come from logged in admin user
          adminUsername: 'admin',
          adminRole: 'ADMIN',
          team: 'IT Administration'
        })
      })
      
      const data = await response.json()
      if (data.success) {
        // Refresh files list
        fetchFiles()
        setShowFileModal(false)
        setSelectedFile(null)
        setFileComment('')
        setSuccess('File approved successfully')
      } else {
        setError(data.message || 'Failed to approve file')
      }
    } catch (error) {
      console.error('Error approving file:', error)
      setError('Failed to approve file')
    } finally {
      setIsLoading(false)
    }
  }

  const rejectFile = async () => {
    if (!selectedFile) return
    
    setIsLoading(true)
    try {
      const response = await fetch(`http://localhost:3001/api/files/${selectedFile.id}/admin-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'reject',
          comments: fileComment.trim(),
          adminId: 1, // Should come from logged in admin user
          adminUsername: 'admin',
          adminRole: 'ADMIN',
          team: 'IT Administration'
        })
      })
      
      const data = await response.json()
      if (data.success) {
        // Refresh files list
        fetchFiles()
        setShowFileModal(false)
        setSelectedFile(null)
        setFileComment('')
        setSuccess('File rejected successfully')
      } else {
        setError(data.message || 'Failed to reject file')
      }
    } catch (error) {
      console.error('Error rejecting file:', error)
      setError('Failed to reject file')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="file-approval-section">
      <div className="page-header">
        <h1>File Approval</h1>
        <p>Review and manage submitted files requiring approval</p>
      </div>
      
      {/* Messages */}
      {(error || success) && (
        <div className={`alert ${error ? 'alert-error' : 'alert-success'} message-fade`}>
          <span className="alert-message">{error || success}</span>
          <button onClick={clearMessages} className="alert-close">×</button>
        </div>
      )}
      
      {/* Status Cards */}
      <div className="file-status-cards" ref={statusCardsRef}>
        <div className="file-status-card pending">
          <div className="status-icon pending-icon">PE</div>
          <div className="status-info">
            <div className="status-number">{files.filter(f => mapFileStatus(f.status) === 'pending').length}</div>
            <div className="status-label">Pending Review</div>
          </div>
        </div>
        
        <div className="file-status-card approved">
          <div className="status-icon approved-icon">AP</div>
          <div className="status-info">
            <div className="status-number">{files.filter(f => mapFileStatus(f.status) === 'approved').length}</div>
            <div className="status-label">Approved Files</div>
          </div>
        </div>
        
        <div className="file-status-card rejected">
          <div className="status-icon rejected-icon">RE</div>
          <div className="status-info">
            <div className="status-number">{files.filter(f => mapFileStatus(f.status) === 'rejected').length}</div>
            <div className="status-label">Rejected Files</div>
          </div>
        </div>
      </div>
      
      {/* Filter and Search Controls */}
      <div className="file-controls">
        <div className="file-search">
          <input
            type="text"
            placeholder="Search files by name, user, or team..."
            value={fileSearchQuery}
            onChange={(e) => setFileSearchQuery(e.target.value)}
            className="search-input"
            ref={searchInputRef}
          />
          {fileSearchQuery && (
            <button 
              className="search-clear-btn"
              onClick={() => setFileSearchQuery('')}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
        
        <div className="file-filters">
          <select
            value={fileFilter}
            onChange={(e) => setFileFilter(e.target.value)}
            className="form-select"
            ref={filterSelectRef}
          >
            <option value="all">All Files</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          
          <select
            value={fileSortBy}
            onChange={(e) => setFileSortBy(e.target.value)}
            className="form-select"
          >
            <option value="date-desc">Latest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="filename-asc">Filename A-Z</option>
            <option value="filename-desc">Filename Z-A</option>
            <option value="user-asc">User A-Z</option>
            <option value="user-desc">User Z-A</option>
          </select>
        </div>
      </div>
      
      {/* Files Table */}
      <div className="table-section">
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading files...</p>
          </div>
        ) : (
          <div className="files-table-container">
            <table className="files-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Submitted By</th>
                  <th>Date & Time</th>
                  <th>Team</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file) => (
                  <tr 
                    key={file.id} 
                    className="file-row"
                    onClick={() => openFileModal(file)}
                  >
                    <td>
                      <div className="file-cell">
                        <div className="file-icon">{file.file_type.charAt(0)}</div>
                        <div className="file-details">
                          <span className="file-name">{file.filename}</span>
                          <span className="file-size">{formatFileSize(file.file_size)}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar">{file.username.charAt(0).toUpperCase()}</div>
                        <span className="user-name">{file.username}</span>
                      </div>
                    </td>
                    <td>
                      <div className="datetime-cell">
                        <div className="date">{new Date(file.uploaded_at).toLocaleDateString()}</div>
                        <div className="time">{new Date(file.uploaded_at).toLocaleTimeString()}</div>
                      </div>
                    </td>
                    <td>
                      <span 
                        className="team-badge"
                        style={{ 
                          backgroundColor: 'transparent',
                          color: getTeamColor(file.user_team),
                          borderColor: getTeamColor(file.user_team)
                        }}
                      >
                        {file.user_team}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge status-${mapFileStatus(file.status)}`}>
                        {getStatusDisplayName(file.status)}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="action-btn delete-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          openDeleteModal(file)
                        }}
                        title="Delete File"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {!isLoading && filteredFiles.length === 0 && (
          <div className="empty-state">
            <h3>No files found</h3>
            <p>No files match your current search and filter criteria.</p>
          </div>
        )}
      </div>

      {/* File Details Modal */}
      {showFileModal && selectedFile && (
        <div className="modal-overlay" onClick={() => setShowFileModal(false)}>
          <div className="modal file-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>File Details</h3>
              <button onClick={() => setShowFileModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="file-details-section">
                <div className="file-detail-row">
                  <span className="detail-label">Filename:</span>
                  <span className="detail-value">{selectedFile.filename}</span>
                </div>
                <div className="file-detail-row">
                  <span className="detail-label">Original Name:</span>
                  <span className="detail-value">{selectedFile.original_name}</span>
                </div>
                <div className="file-detail-row">
                  <span className="detail-label">Submitted By:</span>
                  <span className="detail-value">{selectedFile.username}</span>
                </div>
                <div className="file-detail-row">
                  <span className="detail-label">Team:</span>
                  <span 
                    className="detail-value team-badge"
                    style={{ 
                      backgroundColor: 'transparent',
                      color: getTeamColor(selectedFile.user_team),
                      borderColor: getTeamColor(selectedFile.user_team),
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: '500'
                    }}
                  >
                    {selectedFile.user_team}
                  </span>
                </div>
                <div className="file-detail-row">
                  <span className="detail-label">Date Submitted:</span>
                  <span className="detail-value">{new Date(selectedFile.uploaded_at).toLocaleString()}</span>
                </div>
                <div className="file-detail-row">
                  <span className="detail-label">File Size:</span>
                  <span className="detail-value">{formatFileSize(selectedFile.file_size)}</span>
                </div>
                <div className="file-detail-row">
                  <span className="detail-label">File Type:</span>
                  <span className="detail-value">{selectedFile.file_type}</span>
                </div>
                <div className="file-detail-row">
                  <span className="detail-label">Current Status:</span>
                  <span className={`detail-value status-badge status-${mapFileStatus(selectedFile.status)}`}>
                    {getStatusDisplayName(selectedFile.status)}
                  </span>
                </div>
                <div className="file-detail-row">
                  <span className="detail-label">Description:</span>
                  <span className="detail-value">{selectedFile.description || 'No description provided'}</span>
                </div>
              </div>
              
              {/* Comments Section */}
              <div className="comments-section">
                <h4>Comments History</h4>
                {selectedFile.team_leader_comments && (
                  <div className="comments-list">
                    <div className="comment-item">
                      <div className="comment-text">
                        <strong>Team Leader:</strong> {selectedFile.team_leader_comments}
                      </div>
                      <div className="comment-date">
                        {selectedFile.team_leader_reviewed_at && new Date(selectedFile.team_leader_reviewed_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
                {selectedFile.admin_comments && (
                  <div className="comments-list">
                    <div className="comment-item">
                      <div className="comment-text">
                        <strong>Admin:</strong> {selectedFile.admin_comments}
                      </div>
                      <div className="comment-date">
                        {selectedFile.admin_reviewed_at && new Date(selectedFile.admin_reviewed_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
                {!selectedFile.team_leader_comments && !selectedFile.admin_comments && (
                  <p className="no-comments">No comments yet.</p>
                )}
              </div>
              
              {/* Add Comment */}
              <div className="add-comment-section">
                <h4>Add Comment</h4>
                <div className="comment-input-container">
                  <textarea
                    value={fileComment}
                    onChange={(e) => setFileComment(e.target.value)}
                    onKeyPress={handleCommentKeyPress}
                    placeholder="Add a comment for the user..."
                    className="comment-textarea"
                    rows="3"
                  />
                  <button
                    className="btn btn-primary comment-btn"
                    onClick={addComment}
                    disabled={isLoading || !fileComment.trim()}
                  >
                    {isLoading ? 'Adding...' : 'Add Comment'}
                  </button>
                </div>
                <p className="help-text">This comment will be sent to the user. Press Enter to submit or Shift+Enter for new line.</p>
              </div>
            </div>
            <div className="modal-footer">
              <div className="approval-actions">
                <button 
                  type="button" 
                  onClick={() => setShowFileModal(false)} 
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={rejectFile}
                  className="btn btn-danger" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Rejecting...' : 'Reject File'}
                </button>
                <button 
                  type="button" 
                  onClick={approveFile}
                  className="btn btn-primary" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Approving...' : 'Approve File'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && fileToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal delete-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete File</h3>
              <button onClick={() => setShowDeleteModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="delete-warning">
                <div className="warning-icon">⚠️</div>
                <div className="warning-content">
                  <h4>Are you sure you want to delete this file?</h4>
                  <p className="file-info">
                    <strong>{fileToDelete.filename}</strong>
                    <br />
                    Submitted by <strong>{fileToDelete.username}</strong> from <strong>{fileToDelete.user_team}</strong> team
                  </p>
                  <p className="warning-text">
                    This action cannot be undone. The file and all its associated data will be permanently removed.
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <div className="delete-actions">
                <button 
                  type="button" 
                  onClick={() => setShowDeleteModal(false)} 
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={deleteFile}
                  className="btn btn-danger" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Deleting...' : 'Delete File'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FileApproval