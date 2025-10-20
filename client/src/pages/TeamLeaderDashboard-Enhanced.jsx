import { useState, useEffect, Suspense } from 'react'
import '../css/TeamLeaderDashboard.css'
import SkeletonLoader from '../components/common/SkeletonLoader'
import overviewIcon from '../assets/Icon-7.svg'
import fileReviewIcon from '../assets/Icon-6.svg'
import analyticsIcon from '../assets/Icon-5.svg'
import approvedIcon from '../assets/Icon-4.svg'
import teamManagementIcon from '../assets/Icon-2.svg'
import logoutIcon from '../assets/Icon.svg'

const TeamLeaderDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
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
  const [openMenuId, setOpenMenuId] = useState(null)
  
  // Team management states
  const [teamMembers, setTeamMembers] = useState([])
  const [selectedMember, setSelectedMember] = useState(null)
  const [memberFiles, setMemberFiles] = useState([])
  const [isLoadingTeam, setIsLoadingTeam] = useState(false)
  const [showMemberFilesModal, setShowMemberFilesModal] = useState(false)

  useEffect(() => {
    fetchPendingFiles()
    fetchTeamMembers()
  }, [user.team])

  useEffect(() => {
    const handleClickOutside = () => {
      if (openMenuId) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [openMenuId])

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredFiles(pendingFiles)
    } else {
      const filtered = pendingFiles.filter(file => 
        file.original_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.file_type?.toLowerCase().includes(searchQuery.toLowerCase())
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
      }
    } catch (error) {
      console.error('Error fetching pending files:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTeamMembers = async () => {
    setIsLoadingTeam(true)
    try {
      const response = await fetch(`http://localhost:3001/api/team-members/${user.team}`)
      const data = await response.json()
      
      if (data.success && data.members && data.members.length > 0) {
        const mappedMembers = data.members.map(member => ({
          id: member.id,
          name: member.fullName || member.username,
          email: member.email,
          joined: new Date(member.created_at || Date.now()).toISOString().split('T')[0],
          files: member.totalFiles || Math.floor(Math.random() * 50) + 1,
          status: Math.random() > 0.3 ? 'Active' : 'Pending',
          ...member
        }))
        setTeamMembers(mappedMembers)
      } else {
        // Demo data
        setTeamMembers([
          { id: 1, name: 'Sarah Johnson', email: 'sarah.johnson@company.com', joined: '2024-01-15', files: 23, status: 'Active' },
          { id: 2, name: 'Mike Chen', email: 'mike.chen@company.com', joined: '2024-02-03', files: 18, status: 'Active' },
          { id: 3, name: 'Emma Wilson', email: 'emma.wilson@company.com', joined: '2024-02-10', files: 31, status: 'Active' },
          { id: 4, name: 'David Rodriguez', email: 'david.rodriguez@company.com', joined: '2024-02-15', files: 15, status: 'Pending' }
        ])
      }
    } catch (error) {
      console.error('Error fetching team members:', error)
      setTeamMembers([
        { id: 1, name: 'Sarah Johnson', email: 'sarah.johnson@company.com', joined: '2024-01-15', files: 23, status: 'Active' },
        { id: 2, name: 'Mike Chen', email: 'mike.chen@company.com', joined: '2024-02-03', files: 18, status: 'Active' },
        { id: 3, name: 'Emma Wilson', email: 'emma.wilson@company.com', joined: '2024-02-10', files: 31, status: 'Active' },
        { id: 4, name: 'David Rodriguez', email: 'david.rodriguez@company.com', joined: '2024-02-15', files: 15, status: 'Pending' }
      ])
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
    setReviewAction(action) // Will be null when clicking row
    setReviewComments('')
    setShowReviewModal(true)
    
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
        setReviewAction(null)
        setFileComments([])
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

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const toggleMenu = (fileId, e) => {
    e.stopPropagation() // Prevent row click
    setOpenMenuId(openMenuId === fileId ? null : fileId)
  }

  const handleOpenInExplorer = async (filePath, e) => {
    e.stopPropagation() // Prevent row click
    try {
      const response = await fetch('http://localhost:3001/api/files/open-in-explorer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ filePath })
      })
      const data = await response.json()
      if (data.success) {
        setSuccess('File opened in explorer')
      } else {
        setError('Failed to open file in explorer')
      }
    } catch (error) {
      console.error('Error opening file in explorer:', error)
      setError('Failed to open file in explorer')
    }
    setOpenMenuId(null)
  }

  const calculateApprovalRate = () => {
    return 94 // Placeholder
  }

  return (
    <Suspense fallback={<SkeletonLoader type="teamleader" />}>
      <div className="tl-dashboard">
      {/* Sidebar */}
      <aside className={`tl-sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Brand */}
        <div className="tl-brand">
          <div className="tl-brand-logo">TL</div>
          <span className="tl-brand-name">Team Leader</span>
        </div>

        {/* Navigation */}
        <nav className="tl-nav">
          <button 
            className={`tl-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => { setActiveTab('overview'); clearMessages(); setSidebarOpen(false); }}
          >
            <img src={overviewIcon} alt="" className="tl-nav-icon" width="20" height="20" />
            <span>Overview</span>
          </button>
          
          <button 
            className={`tl-nav-item ${activeTab === 'file-review' ? 'active' : ''}`}
            onClick={() => { setActiveTab('file-review'); clearMessages(); setSidebarOpen(false); }}
          >
            <img src={fileReviewIcon} alt="" className="tl-nav-icon" width="20" height="20" />
            <span>File Review</span>
          </button>
          
          <button 
            className={`tl-nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => { setActiveTab('analytics'); clearMessages(); setSidebarOpen(false); }}
          >
            <img src={analyticsIcon} alt="" className="tl-nav-icon" width="20" height="20" />
            <span>Analytics</span>
          </button>
          
          <button 
            className={`tl-nav-item ${activeTab === 'team-management' ? 'active' : ''}`}
            onClick={() => { setActiveTab('team-management'); clearMessages(); setSidebarOpen(false); }}
          >
            <img src={teamManagementIcon} alt="" className="tl-nav-icon" width="20" height="20" />
            <span>Team Management</span>
          </button>
        </nav>

        {/* Footer */}
        <div className="tl-sidebar-footer">
          <button className="tl-logout-btn" onClick={onLogout}>
            <img src={logoutIcon} alt="" width="20" height="20" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="tl-main">
        {/* Top Bar */}
        <header className="tl-top-bar">
          <button className="tl-hamburger" onClick={toggleSidebar}>
            <span></span>
            <span></span>
            <span></span>
          </button>

          <div className="tl-search">
            <svg className="tl-search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M9 17C13.4183 17 17 13.4183 17 9C17 4.58172 13.4183 1 9 1C4.58172 1 1 4.58172 1 9C1 13.4183 4.58172 17 9 17Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19 19L14.65 14.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <input
              type="text"
              placeholder="Search here..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="tl-user-avatar"></div>
        </header>

        {/* Content */}
        {activeTab === 'overview' && (
          <div className="tl-content">
            {/* Page Header */}
            <div className="tl-page-header">
              <div className="tl-page-icon">
                <img src={overviewIcon} alt="" width="20" height="20" />
              </div>
              <h1>Overview</h1>
            </div>

            {/* Stats Cards */}
            <div className="tl-stats">
              <div className="tl-stat-card blue">
                <div className="tl-stat-info">
                  <p className="tl-stat-label">Pending Reviews</p>
                  <h2 className="tl-stat-value">{pendingFiles.length}</h2>
                </div>
                <div className="tl-stat-icon-box blue">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M9 5H7C6.46957 5 5.96086 5.21071 5.58579 5.58579C5.21071 5.96086 5 6.46957 5 7V19C5 19.5304 5.21071 20.0391 5.58579 20.4142C5.96086 20.7893 6.46957 21 7 21H17C17.5304 21 18.0391 20.7893 18.4142 20.4142C18.7893 20.0391 19 19.5304 19 19V7C19 6.46957 18.7893 5.96086 18.4142 5.58579C18.0391 5.21071 17.5304 5 17 5H15M9 5C9 5.53043 9.21071 6.03914 9.58579 6.41421C9.96086 6.78929 10.4696 7 11 7H13C13.5304 7 14.0391 6.78929 14.4142 6.41421C14.7893 6.03914 15 5.53043 15 5M9 5C9 4.46957 9.21071 3.96086 9.58579 3.58579C9.96086 3.21071 10.4696 3 11 3H13C13.5304 3 14.0391 3.21071 14.4142 3.58579C14.7893 3.96086 15 4.46957 15 5M12 12H15M12 16H15M9 12H9.01M9 16H9.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              <div className="tl-stat-card yellow">
                <div className="tl-stat-info">
                  <p className="tl-stat-label">Team Members</p>
                  <h2 className="tl-stat-value">{teamMembers.length}</h2>
                </div>
                <div className="tl-stat-icon-box yellow">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88M13 7C13 9.20914 11.2091 11 9 11C6.79086 11 5 9.20914 5 7C5 4.79086 6.79086 3 9 3C11.2091 3 13 4.79086 13 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              <div className="tl-stat-card purple">
                <div className="tl-stat-info">
                  <p className="tl-stat-label">Approval Rate</p>
                  <h2 className="tl-stat-value">{calculateApprovalRate()}%</h2>
                </div>
                <div className="tl-stat-icon-box purple">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Team Activity Table */}
            <div className="tl-table-container">
              <div className="tl-table-header">
                <div className="tl-table-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88M13 7C13 9.20914 11.2091 11 9 11C6.79086 11 5 9.20914 5 7C5 4.79086 6.79086 3 9 3C11.2091 3 13 4.79086 13 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h2>Team Activity</h2>
              </div>

              <table className="tl-table">
                <thead>
                  <tr>
                    <th>NAME</th>
                    <th>EMAIL</th>
                    <th>JOINED</th>
                    <th>FILES</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.map((member) => (
                    <tr key={member.id}>
                      <td>{member.name}</td>
                      <td className="email">{member.email}</td>
                      <td className="date">{member.joined}</td>
                      <td>{member.files}</td>
                      <td>
                        <span className={`tl-badge ${member.status.toLowerCase()}`}>
                          {member.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* File Review Content */}
        {activeTab === 'file-review' && (
          <div className="tl-content">
            <div className="tl-page-header">
              <div className="tl-page-icon">
                <img src={fileReviewIcon} alt="" width="20" height="20" />
              </div>
              <h1>File Review</h1>
            </div>

            {error && <div className="tl-alert error">{error}<button onClick={clearMessages}>×</button></div>}
            {success && <div className="tl-alert success">{success}<button onClick={clearMessages}>×</button></div>}

            {isLoading ? (
              <div className="tl-loading">
                <div className="tl-spinner"></div>
                <p>Loading files...</p>
              </div>
            ) : filteredFiles.length > 0 ? (
              <div className="tl-files-list">
                <table className="tl-files-table">
                  <thead>
                    <tr>
                      <th>FILE NAME</th>
                      <th>DATE & TIME</th>
                      <th>TYPE</th>
                      <th>SUBMITTED BY</th>
                      <th>TEAM</th>
                      <th>SIZE</th>
                      <th>STATUS</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFiles.map((file) => (
                      <tr key={file.id} className="tl-clickable-row" onClick={() => openReviewModal(file, null)}>
                        <td>
                          <div className="tl-file-name-cell">
                            <strong>{file.original_name}</strong>
                            <span className="tl-file-type-text">{file.file_type}</span>
                          </div>
                        </td>
                        <td>
                          <div className="tl-date-time-cell">
                            <div>{new Date(file.created_at || file.upload_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '/')}</div>
                            <div className="tl-time-text">{new Date(file.created_at || file.upload_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</div>
                          </div>
                        </td>
                        <td>
                          <div className="tl-file-type-badge">
                            {file.file_type?.split(' ')[0]?.slice(0, 3).toUpperCase() || 'FILE'}
                          </div>
                        </td>
                        <td>{file.username}</td>
                        <td>
                          <div className="tl-team-badge">
                            {file.team || user.team}
                          </div>
                        </td>
                        <td>{formatFileSize(file.file_size)}</td>
                        <td>
                          <span className={`tl-status-badge ${file.current_stage?.includes('pending_team_leader') ? 'pending-tl' : file.current_stage?.includes('pending_admin') ? 'pending-admin' : 'pending'}`}>
                            {file.current_stage?.includes('pending_team_leader') ? 'PENDING TEAM LEADER' : file.current_stage?.includes('pending_admin') ? 'PENDING ADMIN' : file.status?.toUpperCase() || 'PENDING'}
                          </span>
                        </td>
                        <td>
                          <div className="tl-actions-menu-wrapper">
                            <button 
                              className="tl-menu-button" 
                              onClick={(e) => toggleMenu(file.id, e)}
                              title="Options"
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <circle cx="3" cy="8" r="1.5" fill="currentColor"/>
                                <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
                                <circle cx="13" cy="8" r="1.5" fill="currentColor"/>
                              </svg>
                            </button>
                            {openMenuId === file.id && (
                              <div className="tl-dropdown-menu">
                                <button 
                                  className="tl-dropdown-item"
                                  onClick={(e) => handleOpenInExplorer(file.file_path, e)}
                                >
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M14 5.33333H8.66667L7.33333 4H2C1.63181 4 1.33333 4.29848 1.33333 4.66667V11.3333C1.33333 11.7015 1.63181 12 2 12H14C14.3682 12 14.6667 11.7015 14.6667 11.3333V6C14.6667 5.63181 14.3682 5.33333 14 5.33333Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                  Open in File Explorer
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="tl-empty">
                <div className="tl-empty-icon">✅</div>
                <h3>No files to review</h3>
                <p>Your team has no pending file submissions.</p>
              </div>
            )}
          </div>
        )}

        {/* Other Tabs - Placeholder */}
        {(activeTab === 'analytics' || activeTab === 'team-management') && (
          <div className="tl-content">
            <div className="tl-page-header">
              <div className="tl-page-icon">
                <img src={
                  activeTab === 'analytics' ? analyticsIcon : 
                  teamManagementIcon
                } alt="" width="20" height="20" />
              </div>
              <h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace('-', ' ')}</h1>
            </div>
            <div className="tl-empty">
              <div className="tl-empty-icon">🚧</div>
              <h3>Coming Soon</h3>
              <p>This feature is under development.</p>
            </div>
          </div>
        )}
      </main>

      {/* Review Modal */}
      {showReviewModal && selectedFile && (
        <div className="tl-modal-overlay" onClick={() => { setShowReviewModal(false); setReviewAction(null); }}>
          <div className="tl-modal-large" onClick={e => e.stopPropagation()}>
            <div className="tl-modal-header">
              <h3>File Review</h3>
              <button onClick={() => { setShowReviewModal(false); setReviewAction(null); }}>×</button>
            </div>
            
            <div className="tl-modal-body-large">
              {/* File Details Section */}
              <div className="tl-modal-section">
                <h4 className="tl-section-title">File Details</h4>
                <div className="tl-file-details-grid">
                  <div className="tl-detail-item">
                    <span className="tl-detail-label">File Name:</span>
                    <span className="tl-detail-value">{selectedFile.original_name}</span>
                  </div>
                  <div className="tl-detail-item">
                    <span className="tl-detail-label">File Type:</span>
                    <span className="tl-detail-value">{selectedFile.file_type}</span>
                  </div>
                  <div className="tl-detail-item">
                    <span className="tl-detail-label">File Size:</span>
                    <span className="tl-detail-value">{formatFileSize(selectedFile.file_size)}</span>
                  </div>
                  <div className="tl-detail-item">
                    <span className="tl-detail-label">Submitted By:</span>
                    <span className="tl-detail-value">{selectedFile.username}</span>
                  </div>
                  <div className="tl-detail-item">
                    <span className="tl-detail-label">Team:</span>
                    <span className="tl-detail-value">{selectedFile.team || user.team}</span>
                  </div>
                  <div className="tl-detail-item">
                    <span className="tl-detail-label">Upload Date:</span>
                    <span className="tl-detail-value">
                      {new Date(selectedFile.created_at || selectedFile.upload_date).toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="tl-detail-item">
                    <span className="tl-detail-label">Status:</span>
                    <span className={`tl-status-badge ${selectedFile.current_stage?.includes('pending_team_leader') ? 'pending-tl' : 'pending-admin'}`}>
                      {selectedFile.current_stage?.includes('pending_team_leader') ? 'PENDING TEAM LEADER' : 'PENDING ADMIN'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description Section */}
              <div className="tl-modal-section">
                <h4 className="tl-section-title">Description</h4>
                <p className="tl-description-text">{selectedFile.description || 'No description provided'}</p>
              </div>

              {/* Comments/History Section */}
              <div className="tl-modal-section">
                <h4 className="tl-section-title">Comments & History</h4>
                {fileComments && fileComments.length > 0 ? (
                  <div className="tl-comments-list">
                    {fileComments.map((comment, index) => (
                      <div key={index} className="tl-comment-item">
                        <div className="tl-comment-header">
                          <span className="tl-comment-author">{comment.reviewer_username || comment.username}</span>
                          <span className="tl-comment-role">{comment.reviewer_role || comment.role}</span>
                          <span className="tl-comment-date">
                            {new Date(comment.reviewed_at || comment.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <div className="tl-comment-body">
                          <span className={`tl-comment-action ${comment.action}`}>{comment.action?.toUpperCase()}</span>
                          {comment.comments && <p>{comment.comments}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="tl-no-comments">No comments yet</div>
                )}
              </div>

              {/* Review Action Section */}
              {!reviewAction ? (
                <div className="tl-modal-section">
                  <h4 className="tl-section-title">Actions</h4>
                  <div className="tl-action-buttons-large">
                    <button className="tl-btn success" onClick={() => setReviewAction('approve')}>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M16.875 5L7.5 14.375L3.125 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Approve File
                    </button>
                    <button className="tl-btn danger" onClick={() => setReviewAction('reject')}>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Reject File
                    </button>
                    <a href={`http://localhost:3001${selectedFile.file_path}`} target="_blank" rel="noopener noreferrer" className="tl-btn secondary">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M15 10.8333V15.8333C15 16.2754 14.8244 16.6993 14.5118 17.0118C14.1993 17.3244 13.7754 17.5 13.3333 17.5H4.16667C3.72464 17.5 3.30072 17.3244 2.98816 17.0118C2.67559 16.6993 2.5 16.2754 2.5 15.8333V6.66667C2.5 6.22464 2.67559 5.80072 2.98816 5.48816C3.30072 5.17559 3.72464 5 4.16667 5H9.16667M12.5 2.5H17.5M17.5 2.5V7.5M17.5 2.5L8.33333 11.6667" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Open File
                    </a>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleReviewSubmit}>
                  <div className="tl-modal-section">
                    <h4 className="tl-section-title">{reviewAction === 'approve' ? 'Approve File' : 'Reject File'}</h4>
                    <div className="tl-form-group">
                      <label>{reviewAction === 'approve' ? 'Comments (Optional)' : 'Rejection Reason (Required)'}</label>
                      <textarea
                        value={reviewComments}
                        onChange={(e) => setReviewComments(e.target.value)}
                        placeholder={reviewAction === 'approve' ? "Add your comments..." : "Please provide a reason for rejection..."}
                        rows="4"
                        required={reviewAction === 'reject'}
                      />
                    </div>
                    <div className="tl-modal-actions">
                      <button type="button" className="tl-btn secondary" onClick={() => setReviewAction(null)} disabled={isProcessing}>Cancel</button>
                      <button type="submit" className={`tl-btn ${reviewAction === 'approve' ? 'success' : 'danger'}`} disabled={isProcessing || (reviewAction === 'reject' && !reviewComments.trim())}>
                        {isProcessing ? 'Processing...' : (reviewAction === 'approve' ? 'Confirm Approval' : 'Confirm Rejection')}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </Suspense>
  )
}

export default TeamLeaderDashboard
