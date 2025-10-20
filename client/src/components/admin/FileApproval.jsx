import { useState, useEffect, useRef } from 'react'
import './FileApproval.css'

const FileApproval = ({ clearMessages, error, success, setError, setSuccess }) => {
  const [files, setFiles] = useState([])
  const [filteredFiles, setFilteredFiles] = useState([])
  const [fileSearchQuery, setFileSearchQuery] = useState('')
  const [fileFilter, setFileFilter] = useState('all')
  const [fileSortBy, setFileSortBy] = useState('date-desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [filesPerPage] = useState(10)
  const [selectedFile, setSelectedFile] = useState(null)
  const [showFileModal, setShowFileModal] = useState(false)
  const [fileComment, setFileComment] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [fileToDelete, setFileToDelete] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [fileComments, setFileComments] = useState([])
  const [isLoadingComments, setIsLoadingComments] = useState(false)

  // Auto-clear messages after 3 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        clearMessages()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [error, success, clearMessages])

  // Fetch files on component mount
  useEffect(() => {
    fetchFiles()
  }, [])

  // Filter and sort files when dependencies change
  useEffect(() => {
    let filtered = files

    // Apply status filter
    if (fileFilter !== 'all') {
      filtered = filtered.filter(file => {
        switch (fileFilter) {
          case 'pending-team-leader':
            return file.status === 'uploaded'
          case 'pending-admin':
            return file.status === 'team_leader_approved'
          case 'approved':
            return file.status === 'final_approved'
          case 'rejected':
            return file.status === 'rejected_by_team_leader' || file.status === 'rejected_by_admin'
          default:
            return false
        }
      })
    }

    // Apply search filter
    if (fileSearchQuery.trim() !== '') {
      filtered = filtered.filter(file => 
        file.original_name.toLowerCase().includes(fileSearchQuery.toLowerCase()) ||
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
          return a.original_name.localeCompare(b.original_name)
        case 'filename-desc':
          return b.original_name.localeCompare(a.original_name)
        case 'user-asc':
          return a.username.localeCompare(b.username)
        case 'user-desc':
          return b.username.localeCompare(a.username)
        default:
          return 0
      }
    })

    setFilteredFiles(filtered)
    // Reset to page 1 when filters change
    setCurrentPage(1)
  }, [files, fileSearchQuery, fileFilter, fileSortBy])

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
        return 'PENDING TEAM LEADER'
      case 'team_leader_approved':
        return 'PENDING ADMIN'
      case 'final_approved':
        return 'APPROVED'
      case 'rejected_by_team_leader':
        return 'REJECTED BY TL'
      case 'rejected_by_admin':
        return 'REJECTED BY ADMIN'
      default:
        return dbStatus.toUpperCase()
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toUpperCase()
    return ext.substring(0, 3)
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
          adminId: 1,
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

  const openFileModal = async (file) => {
    setSelectedFile({
      ...file,
      comments: []
    })
    setFileComment('')
    setShowFileModal(true)
    
    await fetchFileComments(file.id)
  }

  const fetchFileComments = async (fileId) => {
    setIsLoadingComments(true)
    try {
      const response = await fetch(`http://localhost:3001/api/files/${fileId}/comments`)
      const data = await response.json()
      if (data.success) {
        setFileComments(data.comments || [])
      } else {
        setFileComments([])
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
      setFileComments([])
    } finally {
      setIsLoadingComments(false)
    }
  }

  const approveFile = async () => {
    if (!selectedFile) return
    
    if (fileComment.trim()) {
      await addComment()
    }
    
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
          adminId: 1,
          adminUsername: 'admin',
          adminRole: 'ADMIN',
          team: 'IT Administration'
        })
      })
      
      const data = await response.json()
      if (data.success) {
        fetchFiles()
        setShowFileModal(false)
        setSelectedFile(null)
        setFileComment('')
        setFileComments([])
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
    
    if (!fileComment.trim()) {
      setError('Please provide a reason for rejection')
      return
    }
    
    await addComment()
    
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
          adminId: 1,
          adminUsername: 'admin',
          adminRole: 'ADMIN',
          team: 'IT Administration'
        })
      })
      
      const data = await response.json()
      if (data.success) {
        fetchFiles()
        setShowFileModal(false)
        setSelectedFile(null)
        setFileComment('')
        setFileComments([])
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
          userId: 1,
          username: 'admin',
          userRole: 'ADMIN'
        })
      })
      
      const data = await response.json()
      if (data.success) {
        setFileComment('')
        setSuccess('Comment added successfully')
        await fetchFileComments(selectedFile.id)
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

  const getCurrentPageFiles = () => {
    const startIndex = (currentPage - 1) * filesPerPage
    const endIndex = startIndex + filesPerPage
    return filteredFiles.slice(startIndex, endIndex)
  }

  const getTotalPages = () => {
    return Math.ceil(filteredFiles.length / filesPerPage)
  }

  const getTotalFileSize = () => {
    return files.reduce((total, file) => total + file.file_size, 0)
  }

  const getPendingCount = () => files.filter(f => f.status === 'uploaded' || f.status === 'team_leader_approved').length
  const getApprovedCount = () => files.filter(f => f.status === 'final_approved').length
  const getRejectedCount = () => files.filter(f => f.status === 'rejected_by_team_leader' || f.status === 'rejected_by_admin').length

  return (
    <div className="file-approval-section">
      {/* Header */}
      <div className="approval-header">
        <div className="header-top">
          <h1>File Approvals</h1>
          <p className="header-subtitle">{files.length} files • {formatFileSize(getTotalFileSize())} total</p>
        </div>
      </div>
      
      {/* Messages */}
      {(error || success) && (
        <div className={`alert ${error ? 'alert-error' : 'alert-success'} message-fade`}>
          <span className="alert-message">{error || success}</span>
          <button onClick={clearMessages} className="alert-close">×</button>
        </div>
      )}
      
      {/* Status Summary */}
      <div className="status-summary">
        <div className="summary-item pending">
          <span className="summary-icon">⏱</span>
          <div className="summary-content">
            <span className="summary-number">{getPendingCount()}</span>
            <span className="summary-label">Pending</span>
          </div>
        </div>
        
        <div className="summary-item approved">
          <span className="summary-icon">✓</span>
          <div className="summary-content">
            <span className="summary-number">{getApprovedCount()}</span>
            <span className="summary-label">Approved</span>
          </div>
        </div>
        
        <div className="summary-item rejected">
          <span className="summary-icon">×</span>
          <div className="summary-content">
            <span className="summary-number">{getRejectedCount()}</span>
            <span className="summary-label">Rejected</span>
          </div>
        </div>
      </div>
      
      {/* Files Table */}
      <div className="files-table-wrapper">
        <div className="table-header-row">
          <div className="col-filename">FILENAME</div>
          <div className="col-submitted-by">SUBMITTED BY</div>
          <div className="col-datetime">DATE & TIME</div>
          <div className="col-team">TEAM</div>
          <div className="col-status">STATUS</div>
          <div className="col-actions">ACTIONS</div>
        </div>
        
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading files...</p>
          </div>
        ) : getCurrentPageFiles().length > 0 ? (
          <div className="table-body">
            {getCurrentPageFiles().map((file) => (
              <div key={file.id} className="table-row" onClick={() => openFileModal(file)}>
                <div className="col-filename">
                  <div className="file-icon">{getFileIcon(file.original_name)}</div>
                  <div className="file-details">
                    <div className="filename">{file.original_name}</div>
                    <div className="filesize">{formatFileSize(file.file_size)}</div>
                  </div>
                </div>
                
                <div className="col-submitted-by">
                  <div className="user-avatar">{file.username.charAt(0).toUpperCase()}</div>
                  <div className="user-name">{file.username}</div>
                </div>
                
                <div className="col-datetime">
                  <div className="date">{new Date(file.uploaded_at).toLocaleDateString('en-US', {month: '2-digit', day: '2-digit', year: 'numeric'})}</div>
                  <div className="time">{new Date(file.uploaded_at).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true})}</div>
                </div>
                
                <div className="col-team">
                  <span className="team-badge">{file.user_team}</span>
                </div>
                
                <div className="col-status">
                  <span className={`status-badge status-${mapFileStatus(file.status)}`}>
                    {getStatusDisplayName(file.status)}
                  </span>
                </div>
                
                <div className="col-actions">
                  <button 
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      openDeleteModal(file)
                    }}
                  >
                    DELETE
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
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
                <h4 className="section-title">File Details</h4>
                <div className="file-details-grid">
                  <div className="detail-item">
                    <span className="detail-label">FILE NAME:</span>
                    <span className="detail-value">{selectedFile.original_name}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">FILE TYPE:</span>
                    <span className="detail-value">{selectedFile.file_type}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">FILE SIZE:</span>
                    <span className="detail-value">{formatFileSize(selectedFile.file_size)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">SUBMITTED BY:</span>
                    <span className="detail-value">{selectedFile.username}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">TEAM:</span>
                    <span className="detail-value team-badge-inline">
                      {selectedFile.user_team}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">UPLOAD DATE:</span>
                    <span className="detail-value">{new Date(selectedFile.uploaded_at).toLocaleString()}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">STATUS:</span>
                    <span className={`detail-value status-badge status-${mapFileStatus(selectedFile.status)}`}>
                      {getStatusDisplayName(selectedFile.status)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="description-section">
                <h4 className="section-title">Description</h4>
                <p className="description-text">{selectedFile.description || 'No description provided'}</p>
              </div>
              
              <div className="comments-section">
                <h4 className="section-title">Comments & History</h4>
                {isLoadingComments ? (
                  <div className="loading-comments">
                    <div className="spinner-small"></div>
                    <span>Loading comments...</span>
                  </div>
                ) : fileComments && fileComments.length > 0 ? (
                  <div className="comments-list">
                    {fileComments.map((comment, index) => (
                      <div key={index} className="comment-item">
                        <div className="comment-header">
                          <span className="comment-author">{comment.reviewer_username || comment.username}</span>
                          <span className="comment-role">{comment.reviewer_role || comment.role || 'USER'}</span>
                          <span className="comment-date">
                            {new Date(comment.reviewed_at || comment.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <div className="comment-body">
                          {comment.action && (
                            <span className={`comment-action ${comment.action.toLowerCase()}`}>
                              {comment.action.toUpperCase()}
                            </span>
                          )}
                          {comment.comments && <p className="comment-text">{comment.comments}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-comments">No comments yet</div>
                )}
              </div>
              
              <div className="add-comment-section">
                <h4 className="section-title">Add Comment</h4>
                <div className="comment-input-container">
                  <textarea
                    value={fileComment}
                    onChange={(e) => setFileComment(e.target.value)}
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
              </div>
              
              <div className="actions-section">
                <h4 className="section-title">Actions</h4>
                <div className="action-buttons">
                  <button 
                    type="button" 
                    onClick={approveFile}
                    className="btn btn-success" 
                    disabled={isLoading}
                  >
                    Approve File
                  </button>
                  <button 
                    type="button" 
                    onClick={rejectFile}
                    className="btn btn-danger" 
                    disabled={isLoading}
                  >
                    Reject File
                  </button>
                  <a 
                    href={`http://localhost:3001/api/file-viewer/view/${selectedFile.file_path.replace('/uploads/', '')}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn btn-secondary"
                  >
                    Open File
                  </a>
                </div>
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
