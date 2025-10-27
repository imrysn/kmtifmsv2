import { useState, useEffect, Suspense } from 'react'
import '../css/TeamLeaderDashboard.css'
import SkeletonLoader from '../components/common/SkeletonLoader'
import overviewIcon from '../assets/Icon-7.svg'
import fileReviewIcon from '../assets/Icon-6.svg'
import teamManagementIcon from '../assets/Icon-2.svg'
import assignmentIcon from '../assets/Icon-3.svg'
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
  
  // Bulk action states
  const [selectedFileIds, setSelectedFileIds] = useState([])
  const [showBulkActionModal, setShowBulkActionModal] = useState(false)
  const [bulkAction, setBulkAction] = useState('')
  const [bulkComments, setBulkComments] = useState('')

  // Filter states
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [filters, setFilters] = useState({
    fileType: [],
    submittedBy: [],
    dateFrom: '',
    dateTo: '',
    priority: '',
    hasDeadline: false,
    isOverdue: false
  })
  const [sortConfig, setSortConfig] = useState({ field: 'uploaded_at', direction: 'DESC' })

  // Priority/Deadline states
  const [showPriorityModal, setShowPriorityModal] = useState(false)
  const [priorityFileId, setPriorityFileId] = useState(null)
  const [priorityValue, setPriorityValue] = useState('normal')
  const [dueDateValue, setDueDateValue] = useState('')

  // Notification states
  const [notifications, setNotifications] = useState([])
  const [notificationCounts, setNotificationCounts] = useState({ overdue: 0, urgent: 0, pending: 0 })
  const [showNotifications, setShowNotifications] = useState(false)
  
  // Team management states
  const [teamMembers, setTeamMembers] = useState([])
  const [selectedMember, setSelectedMember] = useState(null)
  const [memberFiles, setMemberFiles] = useState([])
  const [isLoadingTeam, setIsLoadingTeam] = useState(false)
  const [showMemberFilesModal, setShowMemberFilesModal] = useState(false)
  
  // Analytics data for cards
  const [analyticsData, setAnalyticsData] = useState(null)
  const [selectedStatusFilter, setSelectedStatusFilter] = useState(null)

  // Assignment states
  const [assignments, setAssignments] = useState([])
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false)
  const [showCreateAssignmentModal, setShowCreateAssignmentModal] = useState(false)
  const [showAssignmentDetailsModal, setShowAssignmentDetailsModal] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [assignmentSubmissions, setAssignmentSubmissions] = useState([])
  const [assignmentForm, setAssignmentForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    fileTypeRequired: '',
    assignedTo: 'all',
    maxFileSize: 10485760,
    assignedMembers: []
  })

  useEffect(() => {
    fetchPendingFiles()
    fetchTeamMembers()
    fetchNotifications()
    fetchAnalytics() // Fetch analytics data for cards
    if (activeTab === 'assignments') {
      fetchAssignments()
    }
  }, [user.team, activeTab])

  useEffect(() => {
    // Refresh notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
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
      // Don't set filteredFiles here as it's already set in fetchPendingFiles
      return
    } else {
      // Filter from the current fetched files; assume pendingFiles has the current set
      const filtered = pendingFiles.filter(file =>
        file.original_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.file_type?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredFiles(filtered)
    }
  }, [pendingFiles, searchQuery, selectedStatusFilter])


  const fetchPendingFiles = async (status = null) => {
    setIsLoading(true)
    try {
      let url = `http://localhost:3001/api/files/team-leader/${user.team}?limit=1000`

      // For 'total' status, fetch all files from the general team endpoint
      if (status === 'total') {
        url = `http://localhost:3001/api/files/team/${user.team}?limit=1000`
      }
      // For specific status requests, use the analytics endpoint
      else if (status && status !== 'pending') {
        let statusParam = status
        url = `http://localhost:3001/api/files/team/${user.team}/status/${statusParam}?limit=1000`
      }

      const response = await fetch(url)
      const data = await response.json()

      if (data.success) {
        setFilteredFiles(data.files || []) // Update filtered files directly for status filtering
        setSelectedStatusFilter(status || null)
      }
    } catch (error) {
      console.error('Error fetching files:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatusFilter = (status) => {
    setSelectedStatusFilter(status)
    fetchPendingFiles(status)
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
          joined: new Date(member.created_at || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }),
          files: member.totalFiles || 0,
          status: 'Active',
          ...member
        }))
        setTeamMembers(mappedMembers)
      } else {
        setTeamMembers([])
      }
    } catch (error) {
      console.error('Error fetching team members:', error)
      setError('Failed to load team members')
      setTeamMembers([])
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

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/dashboard/team/${user.team}`)
      const data = await response.json()
      
      if (data.success) {
        setAnalyticsData(data.analytics || {})
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    }
  }

  // Fetch assignments
  const fetchAssignments = async () => {
    setIsLoadingAssignments(true)
    try {
      const response = await fetch(`http://localhost:3001/api/assignments/team-leader/${user.team}`)
      
      // Handle 404 as empty assignments (endpoint might not exist yet)
      if (response.status === 404) {
        setAssignments([])
        setIsLoadingAssignments(false)
        return
      }
      
      const data = await response.json()
      if (data.success) {
        setAssignments(data.assignments || [])
      } else {
        setAssignments([])
      }
    } catch (error) {
      console.error('Error fetching assignments:', error)
      // Don't show error for missing endpoint
      setAssignments([])
    } finally {
      setIsLoadingAssignments(false)
    }
  }

  // Fetch assignment details
  const fetchAssignmentDetails = async (assignmentId) => {
    setIsLoading(true)
    try {
      const response = await fetch(`http://localhost:3001/api/assignments/${assignmentId}/details`)
      const data = await response.json()
      if (data.success) {
        setSelectedAssignment(data.assignment)
        setAssignmentSubmissions(data.submissions || [])
        setShowAssignmentDetailsModal(true)
      }
    } catch (error) {
      console.error('Error fetching assignment details:', error)
      setError('Failed to load assignment details')
    } finally {
      setIsLoading(false)
    }
  }

  // Create assignment
  const createAssignment = async () => {
    if (!assignmentForm.title.trim()) {
      setError('Please enter assignment title')
      return
    }

    setIsProcessing(true)
    try {
      const response = await fetch('http://localhost:3001/api/assignments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: assignmentForm.title,
          description: assignmentForm.description,
          due_date: assignmentForm.dueDate,
          file_type_required: assignmentForm.fileTypeRequired,
          assigned_to: assignmentForm.assignedTo,
          max_file_size: assignmentForm.maxFileSize,
          assigned_members: assignmentForm.assignedMembers,
          team_leader_id: user.id,
          team_leader_username: user.username,
          team: user.team
        })
      })

      const data = await response.json()
      if (data.success) {
        setSuccess(`Assignment created! ${data.membersAssigned} members assigned.`)
        setShowCreateAssignmentModal(false)
        setAssignmentForm({
          title: '',
          description: '',
          dueDate: '',
          fileTypeRequired: '',
          assignedTo: 'all',
          maxFileSize: 10485760,
          assignedMembers: []
        })
        fetchAssignments()
      } else {
        setError(data.message || 'Failed to create assignment')
      }
    } catch (error) {
      console.error('Error creating assignment:', error)
      setError('Failed to create assignment')
    } finally {
      setIsProcessing(false)
    }
  }

  // Delete assignment
  const deleteAssignment = async (assignmentId, title) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return

    try {
      const response = await fetch(`http://localhost:3001/api/assignments/${assignmentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamLeaderUsername: user.username,
          team: user.team
        })
      })

      const data = await response.json()
      if (data.success) {
        setSuccess('Assignment deleted successfully')
        fetchAssignments()
      } else {
        setError('Failed to delete assignment')
      }
    } catch (error) {
      console.error('Error deleting assignment:', error)
      setError('Failed to delete assignment')
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
    if (!bytes || bytes === 0 || isNaN(bytes)) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Invalid Date'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Invalid Date'
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Invalid Date'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Invalid Date'
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Bulk Action Functions
  const selectAllFiles = () => {
    if (selectedFileIds.length === filteredFiles.length) {
      setSelectedFileIds([])
    } else {
      setSelectedFileIds(filteredFiles.map(f => f.id))
    }
  }

  const toggleFileSelection = (fileId) => {
    if (selectedFileIds.includes(fileId)) {
      setSelectedFileIds(selectedFileIds.filter(id => id !== fileId))
    } else {
      setSelectedFileIds([...selectedFileIds, fileId])
    }
  }

  const handleBulkAction = (action) => {
    setBulkAction(action)
    setShowBulkActionModal(true)
    setBulkComments('')
  }

  const submitBulkAction = async () => {
    if (bulkAction === 'reject' && !bulkComments.trim()) {
      setError('Please provide a reason for rejection')
      return
    }

    setIsProcessing(true)
    setError('')

    try {
      const response = await fetch('http://localhost:3001/api/files/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds: selectedFileIds,
          action: bulkAction,
          comments: bulkComments.trim(),
          reviewerId: user.id,
          reviewerUsername: user.username,
          reviewerRole: user.role,
          team: user.team
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(`Successfully ${bulkAction}d ${data.results.success.length} file(s)`)
        if (data.results.failed.length > 0) {
          setError(`Failed to process ${data.results.failed.length} file(s)`)
        }
        setShowBulkActionModal(false)
        setBulkAction('')
        setBulkComments('')
        setSelectedFileIds([])
        fetchPendingFiles()
      } else {
        setError(data.message || `Failed to ${bulkAction} files`)
      }
    } catch (error) {
      console.error('Error performing bulk action:', error)
      setError(`Failed to ${bulkAction} files. Please try again.`)
    } finally {
      setIsProcessing(false)
    }
  }

  // Filter Functions
  const applyFilters = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`http://localhost:3001/api/files/team-leader/${user.team}/filter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: filters,
          sort: sortConfig,
          page: 1,
          limit: 100
        })
      })

      const data = await response.json()
      if (data.success) {
        setPendingFiles(data.files || [])
        setShowFilterModal(false)
      } else {
        setError('Failed to apply filters')
      }
    } catch (error) {
      console.error('Error applying filters:', error)
      setError('Failed to apply filters')
    } finally {
      setIsLoading(false)
    }
  }

  const clearFilters = () => {
    setFilters({
      fileType: [],
      submittedBy: [],
      dateFrom: '',
      dateTo: '',
      priority: '',
      hasDeadline: false,
      isOverdue: false
    })
    fetchPendingFiles()
  }

  // Priority/Deadline Functions
  const openPriorityModal = (fileId) => {
    setPriorityFileId(fileId)
    const file = pendingFiles.find(f => f.id === fileId)
    setPriorityValue(file?.priority || 'normal')
    setDueDateValue(file?.due_date || '')
    setShowPriorityModal(true)
  }

  const submitPriority = async () => {
    if (!priorityFileId) return

    setIsProcessing(true)
    setError('')

    try {
      const response = await fetch(`http://localhost:3001/api/files/${priorityFileId}/priority`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priority: priorityValue,
          dueDate: dueDateValue,
          reviewerId: user.id,
          reviewerUsername: user.username
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Priority and deadline updated successfully')
        setShowPriorityModal(false)
        setPriorityFileId(null)
        fetchPendingFiles()
        fetchNotifications()
      } else {
        setError(data.message || 'Failed to update priority')
      }
    } catch (error) {
      console.error('Error updating priority:', error)
      setError('Failed to update priority. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  // Notification Functions
  const fetchNotifications = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/files/notifications/${user.team}`)
      const data = await response.json()

      if (data.success) {
        setNotifications(data.notifications || [])
        setNotificationCounts(data.counts || { overdue: 0, urgent: 0, pending: 0 })
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  const hasActiveFilters = () => {
    return (
      filters.fileType.length > 0 ||
      filters.submittedBy.length > 0 ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.priority ||
      filters.hasDeadline ||
      filters.isOverdue
    )
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
            className={`tl-nav-item ${activeTab === 'assignments' ? 'active' : ''}`}
            onClick={() => { setActiveTab('assignments'); clearMessages(); setSidebarOpen(false); }}
          >
            <img src={assignmentIcon} alt="" className="tl-nav-icon" width="20" height="20" />
            <span>Tasks</span>
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

          <button className="tl-notification-btn" onClick={() => setShowNotifications(!showNotifications)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {(notificationCounts.overdue + notificationCounts.urgent) > 0 && (
              <span className="tl-notification-count">
                {notificationCounts.overdue + notificationCounts.urgent}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="tl-notifications-dropdown">
              <div className="tl-notifications-header">
                <h4>Notifications</h4>
                <span>{notificationCounts.overdue + notificationCounts.urgent} urgent</span>
              </div>
              <div className="tl-notifications-list">
                {notifications.length > 0 ? (
                  notifications.map((notif, idx) => (
                    <div key={idx} className={`tl-notification-item ${notif.isOverdue ? 'overdue' : notif.isUrgent ? 'urgent' : ''}`} onClick={() => {
                      openReviewModal(notif, null)
                      setShowNotifications(false)
                    }}>
                      <div className="tl-notification-icon">
                        {notif.isOverdue ? '⚠️' : notif.isUrgent ? '🔴' : '📄'}
                      </div>
                      <div className="tl-notification-content">
                        <p className="tl-notification-message">{notif.message}</p>
                        <span className="tl-notification-time">{notif.submitter}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{padding: '20px', textAlign: 'center', color: '#9ca3af'}}>No notifications</div>
                )}
              </div>
            </div>
          )}

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
          <div className="tl-content" style={{position: 'relative'}}>
            <div className="tl-page-header">
              <div className="tl-page-icon">
                <img src={fileReviewIcon} alt="" width="20" height="20" />
              </div>
              <h1>File Review</h1>
            </div>

            {error && <div className="tl-alert error">{error}<button onClick={clearMessages}>×</button></div>}
            {success && <div className="tl-alert success">{success}<button onClick={clearMessages}>×</button></div>}

            {/* Analytics Cards */}
            <div className="tl-stats file-review-analytics">
              <div className={`tl-stat-card blue clickable ${selectedStatusFilter === 'total' ? 'active' : ''}`} onClick={() => handleStatusFilter('total')}>
                <p className="tl-stat-label">All Files</p>
                <div className="tl-stat-bottom">
                  <h2 className="tl-stat-value">{(analyticsData?.approvedFiles || 0) + (analyticsData?.rejectedFiles || 0) + (analyticsData?.pendingTeamLeaderReview || 0) + (analyticsData?.pendingAdminReview || 0)}</h2>
                  <div className="tl-stat-icon-box blue">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 5H7C6.46957 5 5.96086 5.21071 5.58579 5.58579C5.21071 5.96086 5 6.46957 5 7V19C5 19.5304 5.21071 20.0391 5.58579 20.4142C5.96086 20.7893 6.46957 21 7 21H17C17.5304 21 18.0391 20.7893 18.4142 20.4142C18.7893 20.0391 19 19.5304 19 19V7C19 6.46957 18.7893 5.96086 18.4142 5.58579C18.0391 5.21071 17.5304 5 17 5H15M9 5C9 5.53043 9.21071 6.03914 9.58579 6.41421C9.96086 6.78929 10.4696 7 11 7H13C13.5304 7 14.0391 6.78929 14.4142 6.41421C14.7893 6.03914 15 5.53043 15 5M9 5C9 4.46957 9.21071 3.96086 9.58579 3.58579C9.96086 3.21071 10.4696 3 11 3H13C13.5304 3 14.0391 3.21071 14.4142 3.58579C14.7893 3.96086 15 4.46957 15 5M12 12H15M12 16H15M9 12H9.01M9 16H9.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </div>

              <div className={`tl-stat-card green clickable ${selectedStatusFilter === 'approved' ? 'active' : ''}`} onClick={() => handleStatusFilter('approved')}>
                <p className="tl-stat-label">Approved</p>
                <div className="tl-stat-bottom">
                  <h2 className="tl-stat-value">{analyticsData?.approvedFiles || 0}</h2>
                  <div className="tl-stat-icon-box green">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 12L11 14L15 10M21 12C21 16.97 16.97 21 12 21C7.03 21 3 16.97 3 12C3 7.03 7.03 3 12 3C16.97 3 21 7.03 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </div>

              <div className={`tl-stat-card yellow clickable ${selectedStatusFilter === 'pending' ? 'active' : ''}`} onClick={() => handleStatusFilter('pending')}>
                <p className="tl-stat-label">Pending</p>
                <div className="tl-stat-bottom">
                  <h2 className="tl-stat-value">{(analyticsData?.pendingTeamLeaderReview || 0) + (analyticsData?.pendingAdminReview || 0)}</h2>
                  <div className="tl-stat-icon-box yellow">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </div>

              <div className={`tl-stat-card red clickable ${selectedStatusFilter === 'rejected' ? 'active' : ''}`} onClick={() => handleStatusFilter('rejected')}>
                <p className="tl-stat-label">Rejected</p>
                <div className="tl-stat-bottom">
                  <h2 className="tl-stat-value">{analyticsData?.rejectedFiles || 0}</h2>
                  <div className="tl-stat-icon-box red">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Toolbar */}
            <div className="tl-toolbar">
              {/* Bulk Actions */}
              <div className="tl-toolbar-section">
                <button className="tl-btn secondary" onClick={selectAllFiles}>
                  {selectedFileIds.length === filteredFiles.length && filteredFiles.length > 0 ? 'Deselect All' : 'Select All'}
                </button>
                {selectedFileIds.length > 0 && (
                  <>
                    <button className="tl-btn success" onClick={() => handleBulkAction('approve')}>
                      Bulk Approve ({selectedFileIds.length})
                    </button>
                    <button className="tl-btn danger" onClick={() => handleBulkAction('reject')}>
                      Bulk Reject ({selectedFileIds.length})
                    </button>
                  </>
                )}
              </div>
              
              {/* Filter & Sort */}
              <div className="tl-toolbar-section">
                <button className="tl-btn secondary" onClick={() => setShowFilterModal(true)}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M2.5 5.83333H17.5M5.83333 10H14.1667M8.33333 14.1667H11.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Filters
                  {hasActiveFilters() && <span className="tl-badge active" style={{marginLeft: '8px'}}>Active</span>}
                </button>
                <select 
                  className="tl-sort-select"
                  value={sortConfig.field} 
                  onChange={(e) => {
                    setSortConfig({...sortConfig, field: e.target.value})
                    applyFilters()
                  }}
                >
                  <option value="uploaded_at">Sort by Date</option>
                  <option value="original_name">Sort by Name</option>
                  <option value="file_size">Sort by Size</option>
                  <option value="priority">Sort by Priority</option>
                  <option value="due_date">Sort by Due Date</option>
                </select>
              </div>
            </div>

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
                      <th><input type="checkbox" checked={selectedFileIds.length === filteredFiles.length && filteredFiles.length > 0} onChange={selectAllFiles} /></th>
                      <th>FILE NAME</th>
                      <th>DATE & TIME</th>
                      <th>TYPE</th>
                      <th>SUBMITTED BY</th>
                      <th>TEAM</th>
                      <th>SIZE</th>
                      <th>PRIORITY / DEADLINE</th>
                      <th>STATUS</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFiles.map((file) => (
                      <tr key={file.id} className="tl-clickable-row" onClick={() => openReviewModal(file, null)}>
                        <td onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={selectedFileIds.includes(file.id)} 
                            onChange={() => toggleFileSelection(file.id)}
                          />
                        </td>
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
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="tl-priority-cell">
                            {file.priority && file.priority !== 'normal' && (
                              <span className={`tl-priority-badge ${file.priority}`}>
                                {file.priority.toUpperCase()}
                              </span>
                            )}
                            {file.due_date && (
                              <span className={`tl-due-date ${new Date(file.due_date) < new Date() ? 'overdue' : ''}`}>
                                {new Date(file.due_date).toLocaleDateString()}
                              </span>
                            )}
                            <button 
                              className="tl-btn-mini secondary" 
                              onClick={() => openPriorityModal(file.id)}
                              title="Set priority/deadline"
                              style={{marginLeft: '4px'}}
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M8 5.33333V8L10 10M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </div>
                        </td>
                        <td>
                          <span className={`tl-status-badge ${file.status === 'approved' ? 'approved' : file.status === 'rejected' ? 'rejected' : 'pending'}`}>
                            {file.status === 'approved' ? 'APPROVED' : file.status === 'rejected' ? 'REJECTED' : file.current_stage?.includes('pending_team_leader') ? 'PENDING TEAM LEADER' : file.current_stage?.includes('pending_admin') ? 'PENDING ADMIN' : file.status?.toUpperCase() || 'PENDING'}
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

        {/* Team Management Tab */}
        {activeTab === 'team-management' && (
          <div className="tl-content">
            <div className="tl-page-header">
              <div className="tl-page-icon">
                <img src={teamManagementIcon} alt="" width="20" height="20" />
              </div>
              <h1>Team Management</h1>
            </div>

            {error && <div className="tl-alert error">{error}<button onClick={clearMessages}>×</button></div>}
            {success && <div className="tl-alert success">{success}<button onClick={clearMessages}>×</button></div>}

            {isLoadingTeam ? (
              <div className="tl-loading">
                <div className="tl-spinner"></div>
                <p>Loading team members...</p>
              </div>
            ) : teamMembers.length > 0 ? (
              <div className="tl-table-container">
                <div className="tl-table-header">
                  <div className="tl-table-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88M13 7C13 9.20914 11.2091 11 9 11C6.79086 11 5 9.20914 5 7C5 4.79086 6.79086 3 9 3C11.2091 3 13 4.79086 13 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <h2>Team Members ({teamMembers.length})</h2>
                </div>

                <table className="tl-table">
                  <thead>
                    <tr>
                      <th>NAME</th>
                      <th>EMAIL</th>
                      <th>JOINED</th>
                      <th>FILES</th>
                      <th>STATUS</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <strong>{member.name}</strong>
                        </td>
                        <td className="email">{member.email}</td>
                        <td className="date">{member.joined}</td>
                        <td>
                          <span className="tl-files-badge">{member.files}</span>
                        </td>
                        <td>
                          <span className={`tl-badge ${member.status.toLowerCase()}`}>
                            {member.status}
                          </span>
                        </td>
                        <td>
                          <button 
                            className="tl-btn-view-files"
                            onClick={() => fetchMemberFiles(member.id, member.name)}
                            title="View member files"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                              <path d="M9 5H7C6.46957 5 5.96086 5.21071 5.58579 5.58579C5.21071 5.96086 5 6.46957 5 7V19C5 19.5304 5.21071 20.0391 5.58579 20.4142C5.96086 20.7893 6.46957 21 7 21H17C17.5304 21 18.0391 20.7893 18.4142 20.4142C18.7893 20.0391 19 19.5304 19 19V7C19 6.46957 18.7893 5.96086 18.4142 5.58579C18.0391 5.21071 17.5304 5 17 5H15M9 5C9 5.53043 9.21071 6.03914 9.58579 6.41421C9.96086 6.78929 10.4696 7 11 7H13C13.5304 7 14.0391 6.78929 14.4142 6.41421C14.7893 6.03914 15 5.53043 15 5M9 5C9 4.46957 9.21071 3.96086 9.58579 3.58579C9.96086 3.21071 10.4696 3 11 3H13C13.5304 3 14.0391 3.21071 14.4142 3.58579C14.7893 3.96086 15 4.46957 15 5M12 12H15M12 16H15M9 12H9.01M9 16H9.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="tl-empty">
                <div className="tl-empty-icon">👥</div>
                <h3>No team members</h3>
                <p>Your team currently has no members.</p>
              </div>
            )}
          </div>
        )}

        {/* Assignments Tab */}
        {activeTab === 'assignments' && (
          <div className="tl-content">
            <div className="tl-page-header">
              <div className="tl-page-icon">
                <img src={assignmentIcon} alt="" width="20" height="20" />
              </div>
              <h1>Tasks</h1>
              <button className="tl-btn success" onClick={() => setShowCreateAssignmentModal(true)} style={{marginLeft: 'auto'}}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Create Assignment
              </button>
            </div>

            {error && <div className="tl-alert error">{error}<button onClick={clearMessages}>×</button></div>}
            {success && <div className="tl-alert success">{success}<button onClick={clearMessages}>×</button></div>}

            {isLoadingAssignments ? (
              <div className="tl-loading">
                <div className="tl-spinner"></div>
                <p>Loading assignments...</p>
              </div>
            ) : assignments.length > 0 ? (
              <div className="tl-table-container">
                <div className="tl-table-header">
                  <div className="tl-table-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M9 5H7C6.46957 5 5.96086 5.21071 5.58579 5.58579C5.21071 5.96086 5 6.46957 5 7V19C5 19.5304 5.21071 20.0391 5.58579 20.4142C5.96086 20.7893 6.46957 21 7 21H17C17.5304 21 18.0391 20.7893 18.4142 20.4142C18.7893 20.0391 19 19.5304 19 19V7C19 6.46957 18.7893 5.96086 18.4142 5.58579C18.0391 5.21071 17.5304 5 17 5H15M9 5C9 5.53043 9.21071 6.03914 9.58579 6.41421C9.96086 6.78929 10.4696 7 11 7H13C13.5304 7 14.0391 6.78929 14.4142 6.41421C14.7893 6.03914 15 5.53043 15 5M9 5C9 4.46957 9.21071 3.96086 9.58579 3.58579C9.96086 3.21071 10.4696 3 11 3H13C13.5304 3 14.0391 3.21071 14.4142 3.58579C14.7893 3.96086 15 4.46957 15 5M12 12H15M12 16H15M9 12H9.01M9 16H9.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <h2>All Assignments ({assignments.length})</h2>
                </div>

                <table className="tl-table">
                  <thead>
                    <tr>
                      <th>TITLE</th>
                      <th>DESCRIPTION</th>
                      <th>DUE DATE</th>
                      <th>FILE TYPE</th>
                      <th>ASSIGNED TO</th>
                      <th>SUBMISSIONS</th>
                      <th>CREATED</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((assignment) => (
                      <tr key={assignment.id} onClick={() => fetchAssignmentDetails(assignment.id)} style={{cursor: 'pointer'}}>
                        <td><strong>{assignment.title}</strong></td>
                        <td>{assignment.description ? (assignment.description.length > 50 ? assignment.description.substring(0, 50) + '...' : assignment.description) : 'No description'}</td>
                        <td>
                          {(assignment.due_date || assignment.dueDate) ? (
                            <span className={`tl-due-date ${new Date(assignment.due_date || assignment.dueDate) < new Date() ? 'overdue' : ''}`}>
                              {formatDate(assignment.due_date || assignment.dueDate)}
                            </span>
                          ) : '-'}
                        </td>
                        <td>{assignment.file_type_required || assignment.fileTypeRequired || 'Any'}</td>
                        <td>
                          <span className="tl-badge">{(assignment.assigned_to || assignment.assignedTo) === 'all' ? 'All Members' : `${(assignment.assigned_members || assignment.assignedMembers)?.length || 0} Members`}</span>
                        </td>
                        <td>
                          <span style={{backgroundColor: '#dbeafe', color: '#1e40af', padding: '4px 12px', borderRadius: '12px', fontWeight: '600'}}>
                            {assignment.submission_count || assignment.submissionCount || 0}
                          </span>
                        </td>
                        <td className="date">{formatDate(assignment.created_at || assignment.createdAt)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button 
                            className="tl-btn danger" 
                            onClick={() => deleteAssignment(assignment.id, assignment.title)}
                            style={{padding: '4px 8px', fontSize: '12px'}}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="tl-empty">
                <div className="tl-empty-icon">📋</div>
                <h3>No assignments yet</h3>
                <p>Create an assignment to get started.</p>
                <button className="tl-btn success" onClick={() => setShowCreateAssignmentModal(true)} style={{marginTop: '20px'}}>
                  Create Your First Assignment
                </button>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Member Files Modal */}
      {showMemberFilesModal && selectedMember && (
        <div className="tl-modal-overlay" onClick={() => { setShowMemberFilesModal(false); setSelectedMember(null); setMemberFiles([]); }}>
          <div className="tl-modal-large" onClick={e => e.stopPropagation()}>
            <div className="tl-modal-header">
              <h3>Files by {selectedMember.name}</h3>
              <button onClick={() => { setShowMemberFilesModal(false); setSelectedMember(null); setMemberFiles([]); }}>×</button>
            </div>
            
            <div className="tl-modal-body-large">
              {isLoading ? (
                <div className="tl-loading">
                  <div className="tl-spinner"></div>
                  <p>Loading files...</p>
                </div>
              ) : memberFiles && memberFiles.length > 0 ? (
                <div className="tl-files-list">
                  <table className="tl-member-files-table">
                    <thead>
                      <tr>
                        <th>FILE NAME</th>
                        <th>DATE & TIME</th>
                        <th>TYPE</th>
                        <th>SIZE</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {memberFiles.map((file) => (
                        <tr key={file.id}>
                          <td>
                            <div className="tl-file-name-cell">
                              <strong>{file.original_name}</strong>
                            </div>
                          </td>
                          <td>
                            <div className="tl-date-time-cell">
                              <div>{new Date(file.uploaded_at || file.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</div>
                              <div className="tl-time-text">{new Date(file.uploaded_at || file.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</div>
                            </div>
                          </td>
                          <td>
                            <div className="tl-file-type-badge">
                              {file.file_type?.split(' ')[0]?.slice(0, 3).toUpperCase() || 'FILE'}
                            </div>
                          </td>
                          <td>{formatFileSize(file.file_size)}</td>
                          <td>
                            <span className={`tl-status-badge ${file.current_stage?.includes('pending_team_leader') ? 'pending-tl' : file.current_stage?.includes('pending_admin') ? 'pending-admin' : 'pending'}`}>
                              {file.current_stage?.includes('pending_team_leader') ? 'PENDING TL' : file.current_stage?.includes('pending_admin') ? 'PENDING ADMIN' : file.status?.toUpperCase() || 'PENDING'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="tl-empty">
                  <div className="tl-empty-icon">📄</div>
                  <h3>No files</h3>
                  <p>This team member has not uploaded any files yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Modal */}
      {showBulkActionModal && (
        <div className="tl-modal-overlay" onClick={() => setShowBulkActionModal(false)}>
          <div className="tl-modal" onClick={e => e.stopPropagation()}>
            <div className="tl-modal-header">
              <h3>Bulk {bulkAction === 'approve' ? 'Approve' : 'Reject'} ({selectedFileIds.length} files)</h3>
              <button onClick={() => setShowBulkActionModal(false)}>×</button>
            </div>
            <div className="tl-modal-body">
              <div className="tl-form-group">
                <label>Comments {bulkAction === 'reject' && '(Required)'}</label>
                <textarea 
                  value={bulkComments} 
                  onChange={(e) => setBulkComments(e.target.value)} 
                  rows="4" 
                  required={bulkAction === 'reject'}
                  placeholder={bulkAction === 'approve' ? 'Add optional comments...' : 'Please provide a reason for rejection...'}
                />
              </div>
            </div>
            <div className="tl-modal-footer">
              <button className="tl-btn secondary" onClick={() => setShowBulkActionModal(false)}>Cancel</button>
              <button 
                className={`tl-btn ${bulkAction === 'approve' ? 'success' : 'danger'}`} 
                onClick={submitBulkAction} 
                disabled={isProcessing || (bulkAction === 'reject' && !bulkComments.trim())}
              >
                {isProcessing ? 'Processing...' : `Confirm ${bulkAction}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="tl-modal-overlay" onClick={() => setShowFilterModal(false)}>
          <div className="tl-modal" onClick={e => e.stopPropagation()}>
            <div className="tl-modal-header">
              <h3>Filter Files</h3>
              <button onClick={() => setShowFilterModal(false)}>×</button>
            </div>
            <div className="tl-modal-body">
              <div className="tl-form-group">
                <label>File Type</label>
                <input
                  type="text"
                  value={filters.fileType.join(', ')}
                  onChange={(e) => setFilters({...filters, fileType: e.target.value.split(',').map(s => s.trim()).filter(s => s)})}
                  placeholder="e.g., PDF, Word Document"
                />
              </div>
              <div className="tl-form-group">
                <label>Submitted By</label>
                <input
                  type="text"
                  value={filters.submittedBy.join(', ')}
                  onChange={(e) => setFilters({...filters, submittedBy: e.target.value.split(',').map(s => s.trim()).filter(s => s)})}
                  placeholder="Username(s)"
                />
              </div>
              <div className="tl-form-group">
                <label>Date From</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                />
              </div>
              <div className="tl-form-group">
                <label>Date To</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                />
              </div>
              <div className="tl-form-group">
                <label>Priority</label>
                <select
                  value={filters.priority}
                  onChange={(e) => setFilters({...filters, priority: e.target.value})}
                >
                  <option value="">All Priorities</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="tl-form-group">
                <label style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <input
                    type="checkbox"
                    checked={filters.hasDeadline}
                    onChange={(e) => setFilters({...filters, hasDeadline: e.target.checked})}
                  />
                  Has Deadline
                </label>
              </div>
              <div className="tl-form-group">
                <label style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <input
                    type="checkbox"
                    checked={filters.isOverdue}
                    onChange={(e) => setFilters({...filters, isOverdue: e.target.checked})}
                  />
                  Is Overdue
                </label>
              </div>
            </div>
            <div className="tl-modal-footer">
              <button className="tl-btn secondary" onClick={clearFilters}>Clear All</button>
              <button className="tl-btn success" onClick={applyFilters}>Apply Filters</button>
            </div>
          </div>
        </div>
      )}

      {/* Priority Modal */}
      {showPriorityModal && (
        <div className="tl-modal-overlay" onClick={() => setShowPriorityModal(false)}>
          <div className="tl-modal" onClick={e => e.stopPropagation()}>
            <div className="tl-modal-header">
              <h3>Set Priority & Deadline</h3>
              <button onClick={() => setShowPriorityModal(false)}>×</button>
            </div>
            <div className="tl-modal-body">
              <div className="tl-form-group">
                <label>Priority</label>
                <select 
                  value={priorityValue} 
                  onChange={(e) => setPriorityValue(e.target.value)}
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="tl-form-group">
                <label>Due Date</label>
                <input 
                  type="date" 
                  value={dueDateValue} 
                  onChange={(e) => setDueDateValue(e.target.value)}
                />
              </div>
            </div>
            <div className="tl-modal-footer">
              <button className="tl-btn secondary" onClick={() => setShowPriorityModal(false)}>Cancel</button>
              <button className="tl-btn success" onClick={submitPriority} disabled={isProcessing}>
                {isProcessing ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Create Assignment Modal */}
      {showCreateAssignmentModal && (
        <div className="tl-modal-overlay" onClick={() => setShowCreateAssignmentModal(false)}>
          <div className="tl-modal-large" onClick={e => e.stopPropagation()}>
            <div className="tl-modal-header">
              <h3>Create New Assignment</h3>
              <button onClick={() => setShowCreateAssignmentModal(false)}>×</button>
            </div>
            <div className="tl-modal-body-large">
              <form>
                <div className="tl-form-group">
                  <label>Assignment Title *</label>
                  <input
                    type="text"
                    value={assignmentForm.title}
                    onChange={(e) => setAssignmentForm({...assignmentForm, title: e.target.value})}
                    placeholder="Enter assignment title..."
                    required
                  />
                </div>

                <div className="tl-form-group">
                  <label>Description</label>
                  <textarea
                    value={assignmentForm.description}
                    onChange={(e) => setAssignmentForm({...assignmentForm, description: e.target.value})}
                    placeholder="Enter assignment description..."
                    rows="4"
                  />
                </div>

                <div className="tl-form-row">
                  <div className="tl-form-group">
                    <label>Due Date</label>
                    <input
                      type="date"
                      value={assignmentForm.dueDate}
                      onChange={(e) => setAssignmentForm({...assignmentForm, dueDate: e.target.value})}
                    />
                  </div>

                  <div className="tl-form-group">
                    <label>File Type Required</label>
                    <select
                      value={assignmentForm.fileTypeRequired}
                      onChange={(e) => setAssignmentForm({...assignmentForm, fileTypeRequired: e.target.value})}
                    >
                      <option value="">Any file type</option>
                      <option value="PDF">PDF</option>
                      <option value="Word">Word Document</option>
                      <option value="Excel">Excel Spreadsheet</option>
                      <option value="PowerPoint">PowerPoint Presentation</option>
                      <option value="Image">Image Files</option>
                      <option value="Video">Video Files</option>
                      <option value="Audio">Audio Files</option>
                    </select>
                  </div>
                </div>

                <div className="tl-form-row">
                  <div className="tl-form-group">
                    <label>Max File Size (MB)</label>
                    <input
                      type="number"
                      value={assignmentForm.maxFileSize / (1024*1024)}
                      onChange={(e) => setAssignmentForm({...assignmentForm, maxFileSize: e.target.value * 1024 * 1024})}
                      placeholder="10"
                      min="1"
                      max="100"
                    />
                  </div>

                  <div className="tl-form-group">
                    <label>Assign To</label>
                    <select
                      value={assignmentForm.assignedTo}
                      onChange={(e) => setAssignmentForm({...assignmentForm, assignedTo: e.target.value})}
                    >
                      <option value="all">All Team Members</option>
                      <option value="specific">Specific Members</option>
                    </select>
                  </div>
                </div>

                {assignmentForm.assignedTo === 'specific' && teamMembers.length > 0 && (
                  <div className="tl-form-group">
                    <label>Select Members</label>
                    <div className="tl-member-selector">
                      {teamMembers.map(member => (
                        <label key={member.id} className="tl-member-checkbox">
                          <input
                            type="checkbox"
                            checked={assignmentForm.assignedMembers.includes(member.id)}
                            onChange={(e) => {
                              const updatedMembers = e.target.checked
                                ? [...assignmentForm.assignedMembers, member.id]
                                : assignmentForm.assignedMembers.filter(id => id !== member.id);
                              setAssignmentForm({...assignmentForm, assignedMembers: updatedMembers});
                            }}
                          />
                          <span className="tl-checkbox-mark"></span>
                          {member.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="tl-modal-footer">
                  <button
                    type="button"
                    className="tl-btn secondary"
                    onClick={() => {
                      setShowCreateAssignmentModal(false);
                      setAssignmentForm({
                        title: '',
                        description: '',
                        dueDate: '',
                        fileTypeRequired: '',
                        assignedTo: 'all',
                        maxFileSize: 10485760,
                        assignedMembers: []
                      });
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="tl-btn success"
                    onClick={createAssignment}
                    disabled={isProcessing || !assignmentForm.title.trim()}
                  >
                    {isProcessing ? 'Creating...' : 'Create Assignment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Details Modal - ENHANCED */}
      {showAssignmentDetailsModal && selectedAssignment && (
        <div className="tl-modal-overlay" onClick={() => { setShowAssignmentDetailsModal(false); setSelectedAssignment(null); setAssignmentSubmissions([]); }}>
          <div className="tl-modal-large" onClick={e => e.stopPropagation()}>
            <div className="tl-modal-header">
              <h3>Assignment: {selectedAssignment.title}</h3>
              <button onClick={() => { setShowAssignmentDetailsModal(false); setSelectedAssignment(null); setAssignmentSubmissions([]); }}>×</button>
            </div>

            <div className="tl-modal-body-large">
              {/* Assignment Details Section */}
              <div className="tl-modal-section">
                <h4 className="tl-section-title">Assignment Details</h4>
                <div className="tl-assignment-details-container">
                  {/* Left Column - Basic Details */}
                  <div className="tl-assignment-details-left">
                    <div className="tl-detail-card">
                      <div className="tl-detail-label">TITLE</div>
                      <div className="tl-detail-value">{selectedAssignment.title}</div>
                    </div>
                    
                    <div className="tl-detail-card">
                      <div className="tl-detail-label">DUE DATE</div>
                      <div className="tl-detail-value">
                        {(selectedAssignment.due_date || selectedAssignment.dueDate) ? formatDate(selectedAssignment.due_date || selectedAssignment.dueDate) : 'No due date'}
                      </div>
                    </div>
                    
                    <div className="tl-detail-card">
                      <div className="tl-detail-label">FILE TYPE REQUIRED</div>
                      <div className="tl-detail-value">{selectedAssignment.file_type_required || selectedAssignment.fileTypeRequired || 'Any'}</div>
                    </div>
                    
                    <div className="tl-detail-card">
                      <div className="tl-detail-label">MAX FILE SIZE</div>
                      <div className="tl-detail-value">
                        {(selectedAssignment.max_file_size || selectedAssignment.maxFileSize) ? formatFileSize(selectedAssignment.max_file_size || selectedAssignment.maxFileSize) : '10 MB'}
                      </div>
                    </div>
                    
                    <div className="tl-detail-card">
                      <div className="tl-detail-label">CREATED</div>
                      <div className="tl-detail-value">{formatDate(selectedAssignment.created_at || selectedAssignment.createdAt)}</div>
                    </div>
                    
                    <div className="tl-detail-card">
                      <div className="tl-detail-label">ASSIGNED TO</div>
                      <div className="tl-detail-value">
                        {(selectedAssignment.assigned_to || selectedAssignment.assignedTo) === 'all' ? 'All Members' : 'Specific Members'}
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Description */}
                  <div className="tl-assignment-details-right">
                    <div className="tl-detail-card tl-detail-card-full">
                      <div className="tl-detail-label">DESCRIPTION</div>
                      <p className="tl-description-text">{selectedAssignment.description || 'No description provided'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submissions Section */}
              <div className="tl-modal-section">
                <h4 className="tl-section-title">Submissions ({assignmentSubmissions.length})</h4>

                {assignmentSubmissions.length > 0 ? (
                  <div className="tl-submissions-list">
                    <table className="tl-submissions-table">
                      <thead>
                        <tr>
                          <th>SUBMITTED BY</th>
                          <th>FILE NAME</th>
                          <th>FILE TYPE</th>
                          <th>SIZE</th>
                          <th>SUBMITTED</th>
                          <th>STATUS</th>
                          <th>ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignmentSubmissions.map((submission) => (
                          <tr key={submission.id}>
                            <td>
                              <strong>{submission.fullName || submission.username}</strong>
                            </td>
                            <td>
                              <div className="tl-file-name-cell">
                                <strong>{submission.original_name}</strong>
                              </div>
                            </td>
                            <td>
                              <div className="tl-file-type-badge">
                                {submission.file_type?.split(' ')[0]?.slice(0, 3).toUpperCase() || 'FILE'}
                              </div>
                            </td>
                            <td>{formatFileSize(submission.file_size)}</td>
                            <td>{formatDateTime(submission.submitted_at)}</td>
                            <td>
                              <span className="tl-status-badge pending-approved">
                                {submission.status?.toUpperCase() || 'SUBMITTED'}
                              </span>
                            </td>
                            <td>
                              <button
                                className="tl-btn-view-file"
                                onClick={() => window.open(`http://localhost:3001${submission.file_path}`, '_blank')}
                                title="Open file"
                              >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                  <path d="M14.5 8C14.5 11.5899 11.5899 14.5 8 14.5C4.41015 14.5 1.5 11.5899 1.5 8C1.5 4.41015 4.41015 1.5 8 1.5C11.5899 1.5 14.5 4.41015 14.5 8Z" stroke="currentColor" strokeWidth="1.5"/>
                                  <path d="M6.5 4.5L11.5 8L6.5 11.5V4.5Z" fill="currentColor"/>
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="tl-no-submissions">
                    <div className="tl-empty-icon">📄</div>
                    <p>No submissions yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
