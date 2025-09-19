import { useState, useEffect, useRef } from 'react'
import './FileApproval.css'

const FileApproval = ({ clearMessages, error, success, setError, setSuccess }) => {
  const [files, setFiles] = useState([])
  const [filteredFiles, setFilteredFiles] = useState([])
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

  // Fetch files on component mount
  useEffect(() => {
    fetchFiles()
  }, [])

  // Filter and sort files when dependencies change
  useEffect(() => {
    let filtered = files

    // Apply status filter
    if (fileFilter !== 'all') {
      filtered = filtered.filter(file => file.status === fileFilter)
    }

    // Apply search filter
    if (fileSearchQuery.trim() !== '') {
      filtered = filtered.filter(file => 
        file.filename.toLowerCase().includes(fileSearchQuery.toLowerCase()) ||
        file.username.toLowerCase().includes(fileSearchQuery.toLowerCase()) ||
        file.team.toLowerCase().includes(fileSearchQuery.toLowerCase())
      )
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      switch (fileSortBy) {
        case 'date-desc':
          return new Date(b.submittedAt) - new Date(a.submittedAt)
        case 'date-asc':
          return new Date(a.submittedAt) - new Date(b.submittedAt)
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

  const fetchFiles = async () => {
    setIsLoading(true)
    try {
      // Simulate API call with mock data
      const mockFiles = [
        {
          id: 1,
          filename: 'project_proposal.pdf',
          username: 'john_doe',
          submittedAt: new Date('2025-01-10T10:30:00'),
          team: 'Development',
          status: 'pending',
          fileSize: '2.5 MB',
          fileType: 'PDF Document',
          description: 'Q1 2025 project proposal for new features',
          comments: []
        },
        {
          id: 2,
          filename: 'budget_report.xlsx',
          username: 'jane_smith',
          submittedAt: new Date('2025-01-09T14:15:00'),
          team: 'Finance',
          status: 'approved',
          fileSize: '1.8 MB',
          fileType: 'Excel Spreadsheet',
          description: 'Annual budget report with projections',
          comments: [{ text: 'Approved - looks comprehensive', date: new Date('2025-01-09T16:20:00') }]
        },
        {
          id: 3,
          filename: 'design_mockups.zip',
          username: 'mike_wilson',
          submittedAt: new Date('2025-01-08T09:45:00'),
          team: 'Design',
          status: 'rejected',
          fileSize: '15.2 MB',
          fileType: 'ZIP Archive',
          description: 'UI/UX mockups for mobile app redesign',
          comments: [{ text: 'Please revise the color scheme and resubmit', date: new Date('2025-01-08T11:30:00') }]
        },
        {
          id: 4,
          filename: 'meeting_notes.docx',
          username: 'sarah_johnson',
          submittedAt: new Date('2025-01-07T16:20:00'),
          team: 'Management',
          status: 'pending',
          fileSize: '845 KB',
          fileType: 'Word Document',
          description: 'Weekly team meeting notes and action items',
          comments: []
        },
        {
          id: 5,
          filename: 'test_results.pdf',
          username: 'alex_brown',
          submittedAt: new Date('2025-01-06T13:10:00'),
          team: 'QA',
          status: 'approved',
          fileSize: '3.1 MB',
          fileType: 'PDF Document',
          description: 'Automated testing results for latest build',
          comments: [{ text: 'All tests passed - approved for release', date: new Date('2025-01-06T15:45:00') }]
        }
      ]
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800))
      setFiles(mockFiles)
      setFilteredFiles(mockFiles)
    } catch (error) {
      console.error('Error fetching files:', error)
      setError('Failed to fetch files')
    } finally {
      setIsLoading(false)
    }
  }

  const deleteFile = async () => {
    if (!fileToDelete) return
    
    setIsLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const updatedFiles = files.filter(file => file.id !== fileToDelete.id)
      setFiles(updatedFiles)
      setShowDeleteModal(false)
      setFileToDelete(null)
      setSuccess('File deleted successfully')
    } catch (error) {
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
    setSelectedFile(file)
    setFileComment('')
    setShowFileModal(true)
  }

  const addComment = async () => {
    if (!selectedFile || !fileComment.trim()) return
    
    setIsLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const updatedFiles = files.map(file => {
        if (file.id === selectedFile.id) {
          const updatedFile = {
            ...file,
            comments: [
              ...file.comments,
              { text: fileComment.trim(), date: new Date() }
            ]
          }
          setSelectedFile(updatedFile) // Update the selected file in modal
          return updatedFile
        }
        return file
      })
      
      setFiles(updatedFiles)
      setFileComment('')
      setSuccess('Comment added successfully')
    } catch (error) {
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
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const updatedFiles = files.map(file => {
        if (file.id === selectedFile.id) {
          const updatedFile = {
            ...file,
            status: 'approved',
            comments: [
              ...file.comments,
              ...(fileComment.trim() ? [{ text: fileComment.trim(), date: new Date() }] : [])
            ]
          }
          return updatedFile
        }
        return file
      })
      
      setFiles(updatedFiles)
      setShowFileModal(false)
      setSelectedFile(null)
      setFileComment('')
      setSuccess('File approved successfully')
    } catch (error) {
      setError('Failed to approve file')
    } finally {
      setIsLoading(false)
    }
  }

  const rejectFile = async () => {
    if (!selectedFile) return
    
    setIsLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const updatedFiles = files.map(file => {
        if (file.id === selectedFile.id) {
          const updatedFile = {
            ...file,
            status: 'rejected',
            comments: [
              ...file.comments,
              ...(fileComment.trim() ? [{ text: fileComment.trim(), date: new Date() }] : [])
            ]
          }
          return updatedFile
        }
        return file
      })
      
      setFiles(updatedFiles)
      setShowFileModal(false)
      setSelectedFile(null)
      setFileComment('')
      setSuccess('File rejected successfully')
    } catch (error) {
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
            <div className="status-number">{files.filter(f => f.status === 'pending').length}</div>
            <div className="status-label">Pending Review</div>
          </div>
        </div>
        
        <div className="file-status-card approved">
          <div className="status-icon approved-icon">AP</div>
          <div className="status-info">
            <div className="status-number">{files.filter(f => f.status === 'approved').length}</div>
            <div className="status-label">Approved Files</div>
          </div>
        </div>
        
        <div className="file-status-card rejected">
          <div className="status-icon rejected-icon">RE</div>
          <div className="status-info">
            <div className="status-number">{files.filter(f => f.status === 'rejected').length}</div>
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
            ref={filterSelectRef}
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
                        <div className="file-icon">{file.fileType.charAt(0)}</div>
                        <div className="file-details">
                          <span className="file-name">{file.filename}</span>
                          <span className="file-size">{file.fileSize}</span>
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
                        <div className="date">{file.submittedAt.toLocaleDateString()}</div>
                        <div className="time">{file.submittedAt.toLocaleTimeString()}</div>
                      </div>
                    </td>
                    <td>
                      <span className="team-badge">{file.team}</span>
                    </td>
                    <td>
                      <span className={`status-badge status-${file.status}`}>
                        {file.status.charAt(0).toUpperCase() + file.status.slice(1)}
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
                  <span className="detail-label">Submitted By:</span>
                  <span className="detail-value">{selectedFile.username}</span>
                </div>
                <div className="file-detail-row">
                  <span className="detail-label">Team:</span>
                  <span className="detail-value">{selectedFile.team}</span>
                </div>
                <div className="file-detail-row">
                  <span className="detail-label">Date Submitted:</span>
                  <span className="detail-value">{selectedFile.submittedAt.toLocaleString()}</span>
                </div>
                <div className="file-detail-row">
                  <span className="detail-label">File Size:</span>
                  <span className="detail-value">{selectedFile.fileSize}</span>
                </div>
                <div className="file-detail-row">
                  <span className="detail-label">File Type:</span>
                  <span className="detail-value">{selectedFile.fileType}</span>
                </div>
                <div className="file-detail-row">
                  <span className="detail-label">Current Status:</span>
                  <span className={`detail-value status-badge status-${selectedFile.status}`}>
                    {selectedFile.status.charAt(0).toUpperCase() + selectedFile.status.slice(1)}
                  </span>
                </div>
                <div className="file-detail-row">
                  <span className="detail-label">Description:</span>
                  <span className="detail-value">{selectedFile.description}</span>
                </div>
              </div>
              
              {/* Comments Section */}
              <div className="comments-section">
                <h4>Comments History</h4>
                {selectedFile.comments && selectedFile.comments.length > 0 ? (
                  <div className="comments-list">
                    {selectedFile.comments.map((comment, index) => (
                      <div key={index} className="comment-item">
                        <div className="comment-text">{comment.text}</div>
                        <div className="comment-date">{comment.date.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                ) : (
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
                    Submitted by <strong>{fileToDelete.username}</strong> from <strong>{fileToDelete.team}</strong> team
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