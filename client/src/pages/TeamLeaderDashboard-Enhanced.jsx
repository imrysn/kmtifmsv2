import { useState, useEffect, useRef } from 'react'
import anime from 'animejs'
import '../css/TeamLeaderDashboard.css'

const TeamLeaderDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [pendingFiles, setPendingFiles] = useState([])
  const [filteredFiles, setFilteredFiles] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewComments, setReviewComments] = useState('')
  const [reviewAction, setReviewAction] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [fileComments, setFileComments] = useState([])
  
  // Team management states
  const [teamMembers, setTeamMembers] = useState([])
  const [selectedMember, setSelectedMember] = useState(null)
  const [memberFiles, setMemberFiles] = useState([])
  const [isLoadingTeam, setIsLoadingTeam] = useState(false)
  const [showMemberFilesModal, setShowMemberFilesModal] = useState(false)

  const dashboardRef = useRef(null)
  const headerRef = useRef(null)

  useEffect(() => {
    // Simple entrance animation for sidebar
    anime({
      targets: headerRef.current,
      opacity: [0, 1],
      translateX: [-20, 0],
      duration: 400,
      easing: 'easeOutCubic'
    })

    // Animate dashboard cards
    setTimeout(() => {
      anime({
        targets: '.dashboard-card',
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 400,
        delay: anime.stagger(60, {start: 150}),
        easing: 'easeOutCubic'
      })
    }, 100)

    // Animate navigation tabs
    setTimeout(() => {
      anime({
        targets: '.nav-tab',
        opacity: [0, 1],
        translateX: [-10, 0],
        duration: 300,
        delay: anime.stagger(50, {start: 200}),
        easing: 'easeOutCubic'
      })
    }, 200)

    // Simple stat counter animation
    setTimeout(() => {
      anime({
        targets: '.stat-number',
        innerHTML: [0, (el) => el.getAttribute('data-count')],
        duration: 1200,
        delay: 600,
        round: 1,
        easing: 'easeOutQuart'
      })
    }, 600)
  }, [])

  useEffect(() => {
    if (activeTab === 'file-review') {
      fetchPendingFiles()
    } else if (activeTab === 'manage-team') {
      fetchTeamMembers()
    } else if (activeTab === 'dashboard') {
      // Re-animate dashboard cards when switching to dashboard tab
      setTimeout(() => {
        anime({
          targets: '.dashboard-card',
          opacity: [0, 1],
          translateY: [10, 0],
          duration: 300,
          delay: anime.stagger(50),
          easing: 'easeOutCubic'
        })
        
        // Re-animate stat counters
        anime({
          targets: '.stat-number',
          innerHTML: [0, (el) => el.getAttribute('data-count')],
          duration: 800,
          delay: 200,
          round: 1,
          easing: 'easeOutQuart'
        })
      }, 50)
    }
  }, [activeTab, user.team])

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredFiles(pendingFiles)
    } else {
      const filtered = pendingFiles.filter(file => 
        file.original_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.file_type.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredFiles(filtered)
    }
  }, [pendingFiles, searchQuery])

  const fetchPendingFiles = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`http://localhost:3001/api/files/team-leader/${user.team}`)
      const data = await response.json()
      
      if (data.success) {
        setPendingFiles(data.files || [])
      } else {
        setError('Failed to fetch pending files')
      }
    } catch (error) {
      console.error('Error fetching pending files:', error)
      setError('Failed to connect to server')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTeamMembers = async () => {
    setIsLoadingTeam(true)
    try {
      const response = await fetch(`http://localhost:3001/api/team-members/${user.team}`)
      const data = await response.json()
      
      if (data.success) {
        setTeamMembers(data.members || [])
      } else {
        setError('Failed to fetch team members')
      }
    } catch (error) {
      console.error('Error fetching team members:', error)
      setError('Failed to connect to server')
    } finally {
      setIsLoadingTeam(false)
    }
  }

  const fetchMemberFiles = async (memberId, memberName) => {
    setSelectedMember({ id: memberId, name: memberName })
    setIsLoading(true)
    try {
      const response = await fetch(`http://localhost:3001/api/files/member/${memberId}`)
      const data = await response.json()
      
      if (data.success) {
        setMemberFiles(data.files || [])
        setShowMemberFilesModal(true)
      } else {
        setError('Failed to fetch member files')
      }
    } catch (error) {
      console.error('Error fetching member files:', error)
      setError('Failed to connect to server')
    } finally {
      setIsLoading(false)
    }
  }

  const openReviewModal = async (file, action) => {
    setSelectedFile(file)
    setReviewAction(action)
    setReviewComments('')
    setShowReviewModal(true)
    
    // Fetch existing comments for context
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

  const handleReviewSubmit = async (e) => {
    e.preventDefault()
    
    if (!selectedFile || !reviewAction) return
    
    if (reviewAction === 'reject' && !reviewComments.trim()) {
      setError('Please provide a reason for rejection')
      return
    }

    setIsProcessing(true)
    setError('')

    try {
      const response = await fetch(`http://localhost:3001/api/files/${selectedFile.id}/team-leader-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: reviewAction,
          comments: reviewComments.trim(),
          teamLeaderId: user.id,
          teamLeaderUsername: user.username,
          teamLeaderRole: user.role,
          team: user.team
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(`File ${reviewAction}d successfully!`)
        setShowReviewModal(false)
        setSelectedFile(null)
        setReviewComments('')
        
        // Refresh the files list
        fetchPendingFiles()
      } else {
        setError(data.message || `Failed to ${reviewAction} file`)
      }
    } catch (error) {
      console.error(`Error ${reviewAction}ing file:`, error)
      setError(`Failed to ${reviewAction} file. Please try again.`)
    } finally {
      setIsProcessing(false)
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
    <div className="minimal-dashboard team-leader-dashboard" ref={dashboardRef}>
      {/* Sidebar */}
      <div className="dashboard-sidebar" ref={headerRef}>
        <div className="sidebar-header">
          <div className="header-title">
            <h1>{user.fullName || user.username}</h1>
            <span className="role-badge team-leader">{user.role}</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="sidebar-nav">
          <button 
            className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <span className="nav-icon"></span>
            Dashboard
          </button>
          <button 
            className={`nav-tab ${activeTab === 'file-review' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('file-review')
              clearMessages()
            }}
          >
            <span className="nav-icon"></span>
            File Review
            <span className="nav-badge">{pendingFiles.length}</span>
          </button>
          <button 
            className={`nav-tab ${activeTab === 'manage-team' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('manage-team')
              clearMessages()
            }}
          >
            <span className="nav-icon"></span>
            Manage Team
          </button>
        </div>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-button">
            <span className="logout-icon">↗</span>
            Logout
          </button>
        </div>
      </div>
      
      <div className="dashboard-content">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="dashboard-grid">
            {/* Team Overview Card */}
            <div className="dashboard-card team-overview-card">
              <div className="card-header">
                <h2>Team Leadership Hub</h2>
                <p className="card-subtitle">Manage your team effectively</p>
              </div>
              
              {user && (
                <div className="leader-info-section">
                  <div className="leader-avatar">
                    {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'TL'}
                  </div>
                  <div className="leader-details">
                    <div className="leader-name">{user.fullName || 'Team Leader'}</div>
                    <div className="leader-email">{user.email}</div>
                    <div className="leader-team">{user.team} Team</div>
                    <div className="access-level">Team Management Access</div>
                  </div>
                </div>
              )}
              
              <div className="team-stats">
                <div className="stat-item">
                  <div className="stat-number" data-count={pendingFiles.length}>0</div>
                  <div className="stat-label">Pending Reviews</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number" data-count="12">0</div>
                  <div className="stat-label">Team Members</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number" data-count="94">0</div>
                  <div className="stat-label">Approval Rate</div>
                </div>
              </div>
              
              <div className="success-indicator team-leader">
                <div className="success-content">
                  <h3>Team Leader Access Granted</h3>
                  <p>You have successfully accessed your Team Leadership Panel. You can now review and approve files submitted by your team members.</p>
                </div>
              </div>
            </div>

            {/* File Review Overview */}
            <div className="dashboard-card file-review-overview-card">
              <div className="card-header">
                <h3>File Review Overview</h3>
                <p className="card-subtitle">Files awaiting your review from {user.team} team</p>
              </div>
              
              <div className="review-stats">
                <div className="review-stat urgent">
                  <div className="stat-icon">📋</div>
                  <div className="stat-info">
                    <div className="stat-number">{pendingFiles.length}</div>
                    <div className="stat-label">Pending Reviews</div>
                  </div>
                </div>
              </div>

              {pendingFiles.length > 0 ? (
                <div className="recent-submissions">
                  <h4>Recent Submissions</h4>
                  <div className="submissions-list">
                    {pendingFiles.slice(0, 3).map((file) => (
                      <div key={file.id} className="submission-item">
                        <div className="submission-file">
                          <div className="file-icon-small">{file.file_type.split(' ')[0].slice(0, 3).toUpperCase()}</div>
                          <div className="file-info-small">
                            <div className="file-name-small">{file.original_name}</div>
                            <div className="file-meta-small">by {file.username} • {formatFileSize(file.file_size)}</div>
                          </div>
                        </div>
                        <div className="submission-date">
                          {new Date(file.uploaded_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button 
                    className="view-all-btn"
                    onClick={() => setActiveTab('file-review')}
                  >
                    Review All Files
                  </button>
                </div>
              ) : (
                <div className="no-pending-files">
                  <div className="no-files-icon">✅</div>
                  <p>All files have been reviewed!</p>
                  <p className="sub-text">Your {user.team} team has no pending file submissions.</p>
                </div>
              )}
            </div>

            {/* File Approval Workflow */}
            <div className="dashboard-card workflow-card">
              <div className="card-header">
                <h3>Your Role in File Approval</h3>
                <p className="card-subtitle">Understanding your responsibilities</p>
              </div>
              
              <div className="workflow-role">
                <div className="role-step current-role">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <h4>Team Leader Review (Your Role)</h4>
                    <p>Review files from your {user.team} team members</p>
                    <ul className="role-responsibilities">
                      <li>Download and examine submitted files</li>
                      <li>Approve files for admin review</li>
                      <li>Reject files with feedback to users</li>
                      <li>Ensure quality standards are met</li>
                    </ul>
                  </div>
                </div>
                
                <div className="workflow-flow">
                  <div className="flow-item">
                    <div className="flow-label">If you approve</div>
                    <div className="flow-arrow">→</div>
                    <div className="flow-destination">File goes to Admin for final review</div>
                  </div>
                  <div className="flow-item">
                    <div className="flow-label">If you reject</div>
                    <div className="flow-arrow">→</div>
                    <div className="flow-destination">File returns to user with your feedback</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Access Information */}
            <div className="dashboard-card access-info-card">
              <div className="card-header">
                <div className="info-icon">DA</div>
                <div>
                  <h3>Dual Access Information</h3>
                  <p className="card-subtitle">Your leadership privileges</p>
                </div>
              </div>
              
              <div className="access-info-content">
                <p className="access-description">
                  As a Team Leader, you have dual access to both user and administrative interfaces.
                </p>
                
                <div className="access-types">
                  <div className="access-type">
                    <div className="access-icon">U</div>
                    <div className="access-details">
                      <h4>User Login Portal</h4>
                      <p>Access your personal user dashboard and upload files</p>
                      <span className="access-badge user">Personal Access</span>
                    </div>
                  </div>
                  
                  <div className="access-type current">
                    <div className="access-icon">A</div>
                    <div className="access-details">
                      <h4>Admin Login Panel</h4>
                      <p>Access team file review and management features</p>
                      <span className="access-badge team-leader">Currently Active</span>
                    </div>
                  </div>
                </div>
                
                <div className="switch-info">
                  <div className="switch-tip">
                    <span>Switch between portals anytime to access different functionalities based on your current needs.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* File Review Tab */}
        {activeTab === 'file-review' && (
          <div className="file-review-section">
            <div className="page-header">
              <h2>File Review - {user.team} Team</h2>
              <p>Review files submitted by your team members. You can approve files for admin review or reject them with feedback.</p>
            </div>

            {/* Controls */}
            <div className="review-controls">
              <div className="controls-left">
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
              
              <div className="controls-right">
                <button 
                  className="btn btn-secondary"
                  onClick={fetchPendingFiles}
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
            
            {success && (
              <div className="alert alert-success">
                <span className="alert-message">{success}</span>
                <button onClick={clearMessages} className="alert-close">×</button>
              </div>
            )}

            {/* Files List */}
            <div className="files-container">
              {isLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading pending files...</p>
                </div>
              ) : filteredFiles.length > 0 ? (
                <div className="review-files-list">
                  {filteredFiles.map((file) => (
                    <div key={file.id} className="review-file-card">
                      <div className="file-main-info">
                        <div className="file-icon-large">
                          {file.file_type.split(' ')[0].slice(0, 3).toUpperCase()}
                        </div>
                        <div className="file-details">
                          <h3 className="file-name">{file.original_name}</h3>
                          <div className="file-meta">
                            <span className="file-type">{file.file_type}</span>
                            <span className="file-size">{formatFileSize(file.file_size)}</span>
                            <span className="file-date">Uploaded {new Date(file.uploaded_at).toLocaleString()}</span>
                          </div>
                          <div className="file-author">
                            <span className="author-label">Submitted by:</span>
                            <span className="author-name">{file.username}</span>
                          </div>
                          {file.description && (
                            <div className="file-description">
                              <span className="description-label">Description:</span>
                              <span className="description-text">{file.description}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="file-actions">
                        <div className="action-buttons">
                          <button 
                            className="btn btn-success"
                            onClick={() => openReviewModal(file, 'approve')}
                            title="Approve and send to Admin"
                          >
                            Approve
                          </button>
                          <button 
                            className="btn btn-danger"
                            onClick={() => openReviewModal(file, 'reject')}
                            title="Reject and send back to user"
                          >
                            Reject
                          </button>
                        </div>
                        
                        <div className="file-download">
                          <a 
                            href={`http://localhost:3001${file.file_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-download"
                            title="Download file for review"
                          >
                            Download
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">✅</div>
                  <h3>No files to review</h3>
                  <p>
                    {pendingFiles.length === 0 
                      ? `Your ${user.team} team has no files pending review.` 
                      : "No files match your search criteria."}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Manage Team Tab */}
        {activeTab === 'manage-team' && (
          <div className="manage-team-section">
            <div className="page-header">
              <h2>Manage Team - {user.team} Team</h2>
              <p>View your team members and manage their file submissions.</p>
            </div>

            {/* Team Controls */}
            <div className="team-controls">
              <div className="controls-left">
                <div className="team-summary">
                  <span className="summary-text">Total Members: {teamMembers.length}</span>
                </div>
              </div>
              
              <div className="controls-right">
                <button 
                  className="btn btn-secondary"
                  onClick={fetchTeamMembers}
                  disabled={isLoadingTeam}
                >
                  {isLoadingTeam ? 'Refreshing...' : 'Refresh'}
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

            {/* Team Members List */}
            <div className="team-container">
              {isLoadingTeam ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading team members...</p>
                </div>
              ) : teamMembers.length > 0 ? (
                <div className="team-members-grid">
                  {teamMembers.map((member) => (
                    <div key={member.id} className="team-member-card">
                      <div className="member-avatar">
                        {member.fullName ? member.fullName.charAt(0).toUpperCase() : member.username.charAt(0).toUpperCase()}
                      </div>
                      
                      <div className="member-info">
                        <h3 className="member-name">{member.fullName || member.username}</h3>
                        <div className="member-details">
                          <span className="member-username">@{member.username}</span>
                          <span className="member-email">{member.email}</span>
                          <span className="member-role">{member.role}</span>
                        </div>
                        
                        <div className="member-stats">
                          <div className="stat">
                            <span className="stat-number">{member.totalFiles || 0}</span>
                            <span className="stat-label">Total Files</span>
                          </div>
                          <div className="stat">
                            <span className="stat-number">{member.pendingFiles || 0}</span>
                            <span className="stat-label">Pending</span>
                          </div>
                          <div className="stat">
                            <span className="stat-number">{member.approvedFiles || 0}</span>
                            <span className="stat-label">Approved</span>
                          </div>
                        </div>
                        
                        <div className="member-actions">
                          <button 
                            className="btn btn-primary"
                            onClick={() => fetchMemberFiles(member.id, member.fullName || member.username)}
                            disabled={isLoading}
                          >
                            {isLoading ? 'Loading...' : 'View Files'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">👥</div>
                  <h3>No team members found</h3>
                  <p>Your {user.team} team has no members or they haven't been loaded yet.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {showReviewModal && selectedFile && (
        <div className="modal-overlay" onClick={() => setShowReviewModal(false)}>
          <div className="modal review-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{reviewAction === 'approve' ? 'Approve' : 'Reject'} File</h3>
              <button onClick={() => setShowReviewModal(false)} className="modal-close">×</button>
            </div>
            <form onSubmit={handleReviewSubmit}>
              <div className="modal-body">
                <div className="file-review-info">
                  <div className="review-file-details">
                    <h4>File: {selectedFile.original_name}</h4>
                    <div className="review-meta">
                      <span>Submitted by: {selectedFile.username}</span>
                      <span>Type: {selectedFile.file_type}</span>
                      <span>Size: {formatFileSize(selectedFile.file_size)}</span>
                    </div>
                    {selectedFile.description && (
                      <div className="file-description-review">
                        <strong>Description:</strong> {selectedFile.description}
                      </div>
                    )}
                  </div>
                  
                  <div className="download-link">
                    <a 
                      href={`http://localhost:3001${selectedFile.file_path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                    >
                      Download for Review
                    </a>
                  </div>
                </div>

                {reviewAction === 'approve' && (
                  <div className="approval-info">
                    <div className="info-box success">
                      <h4>Approving this file will:</h4>
                      <ul>
                        <li>Move the file to Admin review queue</li>
                        <li>Notify the user that you have approved their submission</li>
                        <li>Send your comments (if any) to both user and admin</li>
                      </ul>
                    </div>
                  </div>
                )}

                {reviewAction === 'reject' && (
                  <div className="rejection-info">
                    <div className="info-box danger">
                      <h4>Rejecting this file will:</h4>
                      <ul>
                        <li>Return the file to the user for revision</li>
                        <li>Notify the user of rejection with your feedback</li>
                        <li>Allow the user to resubmit after making changes</li>
                      </ul>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">
                    {reviewAction === 'approve' ? 'Comments (Optional)' : 'Rejection Reason (Required)'}
                  </label>
                  <textarea
                    value={reviewComments}
                    onChange={(e) => setReviewComments(e.target.value)}
                    placeholder={
                      reviewAction === 'approve' 
                        ? "Add any comments about your approval..."
                        : "Please explain why you are rejecting this file..."
                    }
                    rows="4"
                    className="form-textarea"
                    required={reviewAction === 'reject'}
                  />
                </div>

                {/* Show existing comments for context */}
                {fileComments.length > 0 && (
                  <div className="existing-comments">
                    <h4>Previous Comments</h4>
                    <div className="comments-list-small">
                      {fileComments.map((comment, index) => (
                        <div key={index} className="comment-item-small">
                          <div className="comment-meta-small">
                            <span className="comment-author-small">{comment.username}</span>
                            <span className="comment-date-small">{new Date(comment.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="comment-text-small">{comment.comment}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <div className="review-actions">
                  <button 
                    type="button" 
                    onClick={() => setShowReviewModal(false)} 
                    className="btn btn-secondary"
                    disabled={isProcessing}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className={`btn ${reviewAction === 'approve' ? 'btn-success' : 'btn-danger'}`}
                    disabled={isProcessing || (reviewAction === 'reject' && !reviewComments.trim())}
                  >
                    {isProcessing ? 'Processing...' : (reviewAction === 'approve' ? 'Approve File' : 'Reject File')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Files Modal */}
      {showMemberFilesModal && selectedMember && (
        <div className="modal-overlay" onClick={() => setShowMemberFilesModal(false)}>
          <div className="modal member-files-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedMember.name}'s Files</h3>
              <button onClick={() => setShowMemberFilesModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="member-files-info">
                <p>All files submitted by {selectedMember.name}</p>
              </div>
              
              {memberFiles.length > 0 ? (
                <div className="member-files-list">
                  {memberFiles.map((file) => (
                    <div key={file.id} className="member-file-item">
                      <div className="file-icon">
                        {file.file_type.split(' ')[0].slice(0, 3).toUpperCase()}
                      </div>
                      
                      <div className="file-info">
                        <div className="file-name">{file.original_name}</div>
                        <div className="file-meta">
                          <span className="file-type">{file.file_type}</span>
                          <span className="file-size">{formatFileSize(file.file_size)}</span>
                          <span className="file-date">{new Date(file.uploaded_at).toLocaleDateString()}</span>
                        </div>
                        <div className="file-status">
                          <span className={`status-badge ${file.status.toLowerCase().replace('_', '-')}`}>
                            {file.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>
                      
                      <div className="file-actions">
                        <a 
                          href={`http://localhost:3001${file.file_path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-secondary"
                          title="Download file"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-files">
                  <div className="empty-icon">📁</div>
                  <p>{selectedMember.name} hasn't submitted any files yet.</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowMemberFilesModal(false)}
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

export default TeamLeaderDashboard