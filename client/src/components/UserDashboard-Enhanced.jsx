import { useState, useEffect, useRef } from 'react'
import anime from 'animejs'
import './Dashboard.css'

const UserDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [files, setFiles] = useState([])
  const [filteredFiles, setFilteredFiles] = useState([])
  const [uploadedFile, setUploadedFile] = useState(null)
  const [description, setDescription] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [showFileModal, setShowFileModal] = useState(false)
  const [fileComments, setFileComments] = useState([])
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  const dashboardRef = useRef(null)
  const headerRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    // Simple entrance animation
    anime({
      targets: headerRef.current,
      opacity: [0, 1],
      duration: 400,
      easing: 'easeOutCubic'
    })

    anime({
      targets: '.dashboard-card',
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 400,
      delay: anime.stagger(50, {start: 100}),
      easing: 'easeOutCubic'
    })
  }, [])

  useEffect(() => {
    if (activeTab === 'my-files') {
      fetchUserFiles()
    }
  }, [activeTab, user.id])

  useEffect(() => {
    applyFilters()
  }, [files, filterStatus, searchQuery])

  const applyFilters = () => {
    let filtered = files

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(file => {
        switch (filterStatus) {
          case 'pending':
            return file.current_stage.includes('pending')
          case 'approved':
            return file.status === 'final_approved'
          case 'rejected':
            return file.status.includes('rejected')
          default:
            return true
        }
      })
    }

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(file => 
        file.original_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.file_type.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    setFilteredFiles(filtered)
  }

  const fetchUserFiles = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`http://localhost:3001/api/files/user/${user.id}`)
      const data = await response.json()
      
      if (data.success) {
        setFiles(data.files || [])
      } else {
        setError('Failed to fetch your files')
      }
    } catch (error) {
      console.error('Error fetching user files:', error)
      setError('Failed to connect to server')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Check file size (100MB limit)
      if (file.size > 100 * 1024 * 1024) {
        setError('File size must be less than 100MB')
        return
      }
      
      setUploadedFile(file)
      setError('')
    }
  }

  const handleFileUpload = async (e) => {
    e.preventDefault()
    
    if (!uploadedFile) {
      setError('Please select a file to upload')
      return
    }

    setIsUploading(true)
    setError('')
    setSuccess('')

    try {
      const formData = new FormData()
      formData.append('file', uploadedFile)
      formData.append('description', description)
      formData.append('userId', user.id)
      formData.append('username', user.username)
      formData.append('userTeam', user.team)

      const response = await fetch('http://localhost:3001/api/files/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('File uploaded successfully! It has been submitted for team leader review.')
        setUploadedFile(null)
        setDescription('')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        
        // Refresh file list if we're on the files tab
        if (activeTab === 'my-files') {
          fetchUserFiles()
        }
      } else {
        setError(data.message || 'Failed to upload file')
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      setError('Failed to upload file. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const openFileModal = async (file) => {
    setSelectedFile(file)
    setShowFileModal(true)
    
    // Fetch comments for this file
    try {
      const response = await fetch(`http://localhost:3001/api/files/${file.id}/comments`)
      const data = await response.json()
      if (data.success) {
        setFileComments(data.comments || [])
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
      setFileComments([])
    }
  }

  const getStatusBadgeClass = (status, currentStage) => {
    if (status === 'final_approved') return 'status-approved'
    if (status.includes('rejected')) return 'status-rejected'
    if (currentStage.includes('pending')) return 'status-pending'
    return 'status-uploaded'
  }

  const getStatusText = (status, currentStage) => {
    switch (status) {
      case 'uploaded':
        return 'Uploaded'
      case 'team_leader_approved':
        return 'Team Leader Approved'
      case 'final_approved':
        return 'Final Approved'
      case 'rejected_by_team_leader':
        return 'Rejected by Team Leader'
      case 'rejected_by_admin':
        return 'Rejected by Admin'
      default:
        return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')
    }
  }

  const getCurrentStageText = (currentStage) => {
    switch (currentStage) {
      case 'pending_team_leader':
        return 'Pending Team Leader Review'
      case 'pending_admin':
        return 'Pending Admin Review'
      case 'published_to_public':
        return 'Published to Public Network'
      case 'rejected_by_team_leader':
        return 'Rejected by Team Leader'
      case 'rejected_by_admin':
        return 'Rejected by Admin'
      default:
        return currentStage.charAt(0).toUpperCase() + currentStage.slice(1).replace('_', ' ')
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const handleLogout = () => {
    onLogout()
  }

  return (
    <div className="minimal-dashboard user-dashboard" ref={dashboardRef}>
      <div className="dashboard-header" ref={headerRef}>
        <div className="header-content">
          <div className="header-info">
            <div className="header-title">
              <h1>User Portal</h1>
              <span className="role-badge user">{user.role}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="dashboard-nav">
        <button 
          className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button 
          className={`nav-tab ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('upload')
            clearMessages()
          }}
        >
          Upload File
        </button>
        <button 
          className={`nav-tab ${activeTab === 'my-files' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('my-files')
            clearMessages()
          }}
        >
          My Files ({files.length})
        </button>
      </div>
      
      <div className="dashboard-content">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="dashboard-grid">
            {/* Welcome Card */}
            <div className="dashboard-card welcome-card">
              <div className="card-header">
                <h2>Welcome Back</h2>
                <p className="card-subtitle">Your personal workspace</p>
              </div>
              
              {user && (
                <div className="user-info-section">
                  <div className="user-avatar">
                    {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="user-details">
                    <div className="user-detail-item">
                      <span className="detail-label">Full Name</span>
                      <span className="detail-value">{user.fullName}</span>
                    </div>
                    <div className="user-detail-item">
                      <span className="detail-label">Email</span>
                      <span className="detail-value">{user.email}</span>
                    </div>
                    <div className="user-detail-item">
                      <span className="detail-label">Team</span>
                      <span className="detail-value team-highlight">{user.team}</span>
                    </div>
                    <div className="user-detail-item">
                      <span className="detail-label">Role</span>
                      <span className="detail-value role-highlight">{user.role}</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="success-indicator">
                <div className="success-content">
                  <h3>Authentication Successful</h3>
                  <p>You have successfully logged into your User Portal. You can now upload files for review and track their approval status.</p>
                </div>
              </div>
            </div>

            {/* File Status Overview */}
            <div className="dashboard-card files-overview-card">
              <div className="card-header">
                <h3>Files Overview</h3>
                <p className="card-subtitle">Your file submission status</p>
              </div>
              
              <div className="files-stats">
                <div className="file-stat">
                  <div className="stat-number">{files.length}</div>
                  <div className="stat-label">Total Files</div>
                </div>
                <div className="file-stat">
                  <div className="stat-number">{files.filter(f => f.current_stage.includes('pending')).length}</div>
                  <div className="stat-label">Under Review</div>
                </div>
                <div className="file-stat">
                  <div className="stat-number">{files.filter(f => f.status === 'final_approved').length}</div>
                  <div className="stat-label">Approved</div>
                </div>
                <div className="file-stat">
                  <div className="stat-number">{files.filter(f => f.status.includes('rejected')).length}</div>
                  <div className="stat-label">Rejected</div>
                </div>
              </div>

              <div className="file-actions">
                <button 
                  className="action-btn primary"
                  onClick={() => setActiveTab('upload')}
                >
                  Upload New File
                </button>
                <button 
                  className="action-btn secondary"
                  onClick={() => setActiveTab('my-files')}
                >
                  View My Files
                </button>
              </div>
            </div>

            {/* File Approval Workflow Info */}
            <div className="dashboard-card workflow-info-card">
              <div className="card-header">
                <h3>File Approval Process</h3>
                <p className="card-subtitle">How your files get reviewed</p>
              </div>
              
              <div className="workflow-steps">
                <div className="workflow-step">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <h4>Upload File</h4>
                    <p>Submit your file with description for review</p>
                  </div>
                </div>
                <div className="workflow-step">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <h4>Team Leader Review</h4>
                    <p>Your team leader reviews and approves/rejects</p>
                  </div>
                </div>
                <div className="workflow-step">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <h4>Admin Review</h4>
                    <p>Final approval by system administrator</p>
                  </div>
                </div>
                <div className="workflow-step">
                  <div className="step-number">4</div>
                  <div className="step-content">
                    <h4>Public Network</h4>
                    <p>Approved files are published to public network</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Team Leader Notice (if applicable) */}
            {user.role === 'TEAM LEADER' && (
              <div className="dashboard-card team-leader-notice">
                <div className="notice-header">
                  <div className="notice-icon">TL</div>
                  <h3>Team Leader Access</h3>
                </div>
                
                <div className="notice-content">
                  <p>You have additional privileges as a Team Leader. You can access the Admin Panel for team management features and file approval.</p>
                  
                  <div className="access-info">
                    <div className="access-item">
                      <span className="access-label">User Portal</span>
                      <span className="access-status current">Currently Active</span>
                    </div>
                    <div className="access-item">
                      <span className="access-label">Admin Panel</span>
                      <span className="access-status available">Switch Available</span>
                    </div>
                  </div>
                  
                  <div className="switch-instruction">
                    <p>To access your Team Leader panel, logout and use the Admin Login option.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Upload File Tab */}
        {activeTab === 'upload' && (
          <div className="upload-section">
            <div className="page-header">
              <h2>Upload File for Review</h2>
              <p>Submit your file to the approval workflow. Files will be reviewed by your team leader first, then by an administrator.</p>
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

            <div className="upload-container">
              <div className="upload-card">
                <form onSubmit={handleFileUpload} className="upload-form">
                  <div className="form-group">
                    <label className="form-label">Select File</label>
                    <div className="file-input-container">
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileSelect}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif,.zip"
                        className="file-input"
                        disabled={isUploading}
                      />
                      <div className="file-input-info">
                        <p>Supported formats: PDF, Word, Excel, Text, Images, ZIP</p>
                        <p>Maximum file size: 100MB</p>
                      </div>
                    </div>
                  </div>

                  {uploadedFile && (
                    <div className="selected-file-info">
                      <h4>Selected File:</h4>
                      <div className="file-preview">
                        <div className="file-icon">{uploadedFile.name.split('.').pop().toUpperCase()}</div>
                        <div className="file-details">
                          <div className="file-name">{uploadedFile.name}</div>
                          <div className="file-size">{formatFileSize(uploadedFile.size)}</div>
                          <div className="file-type">{uploadedFile.type || 'Unknown type'}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Provide a brief description of this file and its purpose..."
                      rows="4"
                      className="form-textarea"
                      disabled={isUploading}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Submission Details</label>
                    <div className="submission-info">
                      <div className="info-item">
                        <span className="info-label">Team:</span>
                        <span className="info-value">{user.team}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Submitted by:</span>
                        <span className="info-value">{user.fullName} ({user.username})</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Will be reviewed by:</span>
                        <span className="info-value">{user.team} Team Leader → Administrator</span>
                      </div>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button
                      type="submit"
                      disabled={!uploadedFile || isUploading}
                      className={`btn btn-primary ${isUploading ? 'loading' : ''}`}
                    >
                      {isUploading ? 'Uploading...' : 'Submit for Review'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedFile(null)
                        setDescription('')
                        if (fileInputRef.current) {
                          fileInputRef.current.value = ''
                        }
                        clearMessages()
                      }}
                      disabled={isUploading}
                      className="btn btn-secondary"
                    >
                      Clear
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* My Files Tab */}
        {activeTab === 'my-files' && (
          <div className="my-files-section">
            <div className="page-header">
              <h2>My Files</h2>
              <p>Track the status of all your submitted files through the approval workflow.</p>
            </div>

            {/* Filters and Search */}
            <div className="files-controls">
              <div className="files-filters">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="form-select"
                >
                  <option value="all">All Files</option>
                  <option value="pending">Under Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                
                <div className="files-search">
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                  />
                  {searchQuery && (
                    <button 
                      className="search-clear-btn"
                      onClick={() => setSearchQuery('')}
                      title="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              
              <div className="files-actions">
                <button 
                  className="btn btn-primary"
                  onClick={() => setActiveTab('upload')}
                >
                  Upload New File
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={fetchUserFiles}
                  disabled={isLoading}
                >
                  {isLoading ? 'Refreshing...' : 'Refresh'}
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

            {/* Files List */}
            <div className="files-container">
              {isLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading your files...</p>
                </div>
              ) : filteredFiles.length > 0 ? (
                <div className="files-grid">
                  {filteredFiles.map((file) => (
                    <div 
                      key={file.id} 
                      className="file-card"
                      onClick={() => openFileModal(file)}
                    >
                      <div className="file-header">
                        <div className="file-icon-large">
                          {file.file_type.split(' ')[0].slice(0, 3).toUpperCase()}
                        </div>
                        <div className="file-basic-info">
                          <h3 className="file-name">{file.original_name}</h3>
                          <p className="file-size">{formatFileSize(file.file_size)}</p>
                        </div>
                      </div>
                      
                      <div className="file-content">
                        <div className="file-description">
                          {file.description || 'No description provided'}
                        </div>
                        
                        <div className="file-meta">
                          <div className="meta-item">
                            <span className="meta-label">Type:</span>
                            <span className="meta-value">{file.file_type}</span>
                          </div>
                          <div className="meta-item">
                            <span className="meta-label">Uploaded:</span>
                            <span className="meta-value">{new Date(file.uploaded_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="file-footer">
                        <div className="file-status-info">
                          <div className={`status-badge ${getStatusBadgeClass(file.status, file.current_stage)}`}>
                            {getStatusText(file.status, file.current_stage)}
                          </div>
                          <div className="current-stage">
                            {getCurrentStageText(file.current_stage)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📁</div>
                  <h3>No files found</h3>
                  <p>
                    {files.length === 0 
                      ? "You haven't uploaded any files yet." 
                      : "No files match your current filter criteria."}
                  </p>
                  <button 
                    className="btn btn-primary"
                    onClick={() => setActiveTab('upload')}
                  >
                    Upload Your First File
                  </button>
                </div>
              )}
            </div>
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
                  <span className="detail-value">{selectedFile.original_name}</span>
                </div>
                <div className="file-detail-row">
                  <span className="detail-label">File Type:</span>
                  <span className="detail-value">{selectedFile.file_type}</span>
                </div>
                <div className="file-detail-row">
                  <span className="detail-label">File Size:</span>
                  <span className="detail-value">{formatFileSize(selectedFile.file_size)}</span>
                </div>
                <div className="file-detail-row">
                  <span className="detail-label">Uploaded:</span>
                  <span className="detail-value">{new Date(selectedFile.uploaded_at).toLocaleString()}</span>
                </div>
                <div className="file-detail-row">
                  <span className="detail-label">Current Status:</span>
                  <div className="status-container">
                    <span className={`status-badge ${getStatusBadgeClass(selectedFile.status, selectedFile.current_stage)}`}>
                      {getStatusText(selectedFile.status, selectedFile.current_stage)}
                    </span>
                    <div className="stage-text">{getCurrentStageText(selectedFile.current_stage)}</div>
                  </div>
                </div>
                {selectedFile.description && (
                  <div className="file-detail-row">
                    <span className="detail-label">Description:</span>
                    <span className="detail-value">{selectedFile.description}</span>
                  </div>
                )}
                
                {/* Review Details */}
                {selectedFile.team_leader_reviewed_at && (
                  <div className="review-section">
                    <h4>Team Leader Review</h4>
                    <div className="review-info">
                      <div className="review-detail">
                        <span className="review-label">Reviewed by:</span>
                        <span className="review-value">{selectedFile.team_leader_username}</span>
                      </div>
                      <div className="review-detail">
                        <span className="review-label">Review Date:</span>
                        <span className="review-value">{new Date(selectedFile.team_leader_reviewed_at).toLocaleString()}</span>
                      </div>
                      {selectedFile.team_leader_comments && (
                        <div className="review-detail">
                          <span className="review-label">Comments:</span>
                          <span className="review-value">{selectedFile.team_leader_comments}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {selectedFile.admin_reviewed_at && (
                  <div className="review-section">
                    <h4>Admin Review</h4>
                    <div className="review-info">
                      <div className="review-detail">
                        <span className="review-label">Reviewed by:</span>
                        <span className="review-value">{selectedFile.admin_username}</span>
                      </div>
                      <div className="review-detail">
                        <span className="review-label">Review Date:</span>
                        <span className="review-value">{new Date(selectedFile.admin_reviewed_at).toLocaleString()}</span>
                      </div>
                      {selectedFile.admin_comments && (
                        <div className="review-detail">
                          <span className="review-label">Comments:</span>
                          <span className="review-value">{selectedFile.admin_comments}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {selectedFile.public_network_url && (
                  <div className="public-network-section">
                    <h4>Public Network</h4>
                    <div className="public-info">
                      <div className="public-detail">
                        <span className="public-label">Published URL:</span>
                        <a 
                          href={selectedFile.public_network_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="public-link"
                        >
                          {selectedFile.public_network_url}
                        </a>
                      </div>
                      <div className="public-detail">
                        <span className="public-label">Published Date:</span>
                        <span className="public-value">{new Date(selectedFile.final_approved_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {selectedFile.rejection_reason && (
                  <div className="rejection-section">
                    <h4>Rejection Details</h4>
                    <div className="rejection-info">
                      <div className="rejection-detail">
                        <span className="rejection-label">Rejected by:</span>
                        <span className="rejection-value">{selectedFile.rejected_by}</span>
                      </div>
                      <div className="rejection-detail">
                        <span className="rejection-label">Rejection Date:</span>
                        <span className="rejection-value">{new Date(selectedFile.rejected_at).toLocaleString()}</span>
                      </div>
                      <div className="rejection-detail">
                        <span className="rejection-label">Reason:</span>
                        <span className="rejection-value rejection-reason">{selectedFile.rejection_reason}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Comments Section */}
              {fileComments.length > 0 && (
                <div className="comments-section">
                  <h4>Review Comments</h4>
                  <div className="comments-list">
                    {fileComments.map((comment, index) => (
                      <div key={index} className="comment-item">
                        <div className="comment-header">
                          <span className="comment-author">{comment.username}</span>
                          <span className="comment-role">({comment.user_role})</span>
                          <span className="comment-date">{new Date(comment.created_at).toLocaleString()}</span>
                        </div>
                        <div className="comment-text">{comment.comment}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                onClick={() => setShowFileModal(false)} 
                className="btn btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserDashboard