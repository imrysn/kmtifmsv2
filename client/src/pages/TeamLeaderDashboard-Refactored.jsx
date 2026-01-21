import { useState, useEffect, Suspense, lazy } from 'react'
import '../css/TeamLeaderDashboard.css'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { AlertMessage } from '../components/shared'

// Eagerly import critical components
import {
  Sidebar,
} from '../components/teamleader'

// Lazy load tab components
const OverviewTab = lazy(() => import('../components/teamleader').then(module => ({ default: module.OverviewTab })))
const FileCollectionTab = lazy(() => import('../components/teamleader').then(module => ({ default: module.FileCollectionTab })))
const TeamManagementTab = lazy(() => import('../components/teamleader').then(module => ({ default: module.TeamManagementTab })))
const AssignmentsTab = lazy(() => import('../components/teamleader').then(module => ({ default: module.AssignmentsTab })))
const NotificationTab = lazy(() => import('../components/teamleader').then(module => ({ default: module.NotificationTab })))

// Lazy load modal components
const BulkActionModal = lazy(() => import('../components/teamleader').then(module => ({ default: module.BulkActionModal })))
const FilterModal = lazy(() => import('../components/teamleader').then(module => ({ default: module.FilterModal })))
const PriorityModal = lazy(() => import('../components/teamleader').then(module => ({ default: module.PriorityModal })))
const MemberFilesModal = lazy(() => import('../components/teamleader').then(module => ({ default: module.MemberFilesModal })))
const CreateAssignmentModal = lazy(() => import('../components/teamleader').then(module => ({ default: module.CreateAssignmentModal })))
const ReviewModal = lazy(() => import('../components/teamleader').then(module => ({ default: module.ReviewModal })))
const FileViewModal = lazy(() => import('../components/teamleader').then(module => ({ default: module.FileViewModal })))

const TeamLeaderDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [filteredFiles, setFilteredFiles] = useState([])
  const [submittedFiles, setSubmittedFiles] = useState([])
  const [fileCollectionFilter, setFileCollectionFilter] = useState('all')
  const [fileCollectionSort, setFileCollectionSort] = useState('date-desc')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [showFileViewModal, setShowFileViewModal] = useState(false)
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
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('total')

  // Assignment states
  const [assignments, setAssignments] = useState([])
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false)
  const [showCreateAssignmentModal, setShowCreateAssignmentModal] = useState(false)
  const [assignmentForm, setAssignmentForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    fileTypeRequired: '',
    assignedMembers: []
  })
  const [notificationCommentContext, setNotificationCommentContext] = useState(null)
  const [highlightedAssignmentId, setHighlightedAssignmentId] = useState(null)
  const [highlightedFileId, setHighlightedFileId] = useState(null)
  const [highlightedSubmissionFileId, setHighlightedSubmissionFileId] = useState(null)

  useEffect(() => {
    // Only fetch files for tabs that need them
    if (activeTab === 'overview') {
      fetchPendingFiles('total')
    }

    if (activeTab === 'file-collection') {
      fetchAllSubmissions()
    }

    fetchTeamMembers()
    fetchNotifications()
    fetchAnalytics()

    if (activeTab === 'assignments') {
      fetchAssignments()
    }

    // For dashboard, fetch all necessary data
    if (activeTab === 'dashboard') {
      console.log('🔄 DASHBOARD TAB: Loading data...', { activeTab, team: user.team })
      fetchAllSubmissions()
      fetchAssignments()
    }
  }, [user.team, activeTab])

  useEffect(() => {
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
  }, [pendingFiles, searchQuery, selectedStatusFilter])

  const fetchAllSubmissions = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`http://localhost:3001/api/assignments/team-leader/${user.team}/all-submissions`)
      const data = await response.json()

      if (data.success) {
        setSubmittedFiles(data.submissions || [])
      }
    } catch (error) {
      console.error('Error fetching all submissions:', error)
      setSubmittedFiles([])
    } finally {
      setIsLoading(false)
    }
  }

  const fetchPendingFiles = async (status = null) => {
    setIsLoading(true)
    try {
      let url = `http://localhost:3001/api/files/team-leader/${user.team}?limit=1000`

      if (status === 'total') {
        url = `http://localhost:3001/api/files/team/${user.team}?limit=1000`
      }
      else if (status && status !== 'pending') {
        let statusParam = status
        url = `http://localhost:3001/api/files/team/${user.team}/status/${statusParam}?limit=1000`
      }

      const response = await fetch(url)
      const data = await response.json()

      if (data.success) {
      setPendingFiles(data.files || [])
      setFilteredFiles(data.files || [])
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

        // Add the team leader (current user) to the members list
        const teamLeaderMember = {
          id: user.id,
          name: user.fullName || user.username,
          email: user.email,
          joined: new Date(user.created_at || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }),
          files: 0,
          status: 'Active',
          fullName: user.fullName,
          username: user.username,
          role: user.role
        }

        // Add team leader at the beginning of the array
        setTeamMembers([teamLeaderMember, ...mappedMembers])
      } else {
        // If no members found, still add the team leader
        const teamLeaderMember = {
          id: user.id,
          name: user.fullName || user.username,
          email: user.email,
          joined: new Date(user.created_at || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }),
          files: 0,
          status: 'Active',
          fullName: user.fullName,
          username: user.username,
          role: user.role
        }
        setTeamMembers([teamLeaderMember])
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

  const fetchAssignments = async () => {
    setIsLoadingAssignments(true)
    try {
      const response = await fetch(`http://localhost:3001/api/assignments/team-leader/${user.team}`)
      
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
      setAssignments([])
    } finally {
      setIsLoadingAssignments(false)
    }
  }

  const createAssignment = async () => {
    if (!assignmentForm.title.trim()) {
      setError('Please enter assignment title')
      return
    }

    if (assignmentForm.assignedMembers.length === 0) {
      setError('Please select at least one team member')
      return
    }

    setIsProcessing(true)
    try {
      const response = await fetch('http://localhost:3001/api/assignments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...assignmentForm,
          assignedTo: assignmentForm.assignedMembers.length > 0 ? 'specific' : 'all',
          teamLeaderId: user.id,
          teamLeaderUsername: user.username,
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

  const deleteAssignment = async (assignmentId, title) => {
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
    setReviewAction(action)
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

  const openFileViewModal = async (file) => {
    try {
      const response = await fetch('http://localhost:3001/api/files/open-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ filePath: file.file_path })
      })
      const data = await response.json()
      if (data.success) {
        setSuccess('File opened successfully')
      } else {
        setError('Failed to open file')
      }
    } catch (error) {
      console.error('Error opening file:', error)
      setError('Failed to open file')
    }
  }

  const handleReviewSubmit = async (e, action = null) => {
    e.preventDefault()

    // Use the passed action or fall back to the state
    const actionToUse = action || reviewAction

    if (!selectedFile || !actionToUse) return

    setIsProcessing(true)
    setError('')

    try {
      const response = await fetch(`http://localhost:3001/api/files/${selectedFile.id}/team-leader-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: actionToUse,
          comments: reviewComments.trim(),
          teamLeaderId: user.id,
          teamLeaderUsername: user.username,
          teamLeaderRole: user.role,
          team: user.team
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(`File ${actionToUse}d successfully!`)
        setShowReviewModal(false)
        setSelectedFile(null)
        setReviewComments('')
        setReviewAction(null)
        setFileComments([])
        fetchPendingFiles()
      } else {
        setError(data.message || `Failed to ${actionToUse} file`)
      }
    } catch (error) {
      console.error(`Error ${actionToUse}ing file:`, error)
      setError(`Failed to ${actionToUse} file. Please try again.`)
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
    if (!dateString) return 'No date'
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
    e.stopPropagation()
    setOpenMenuId(openMenuId === fileId ? null : fileId)
  }

  const handleOpenInExplorer = async (filePath, e) => {
    e.stopPropagation()
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

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <Suspense fallback={<SkeletonLoader type="cards" />}>
            <OverviewTab
              pendingFiles={pendingFiles}
              teamMembers={teamMembers}
              calculateApprovalRate={calculateApprovalRate}
            />
          </Suspense>
        )
      case 'dashboard':
        return (
          <Suspense fallback={<SkeletonLoader type="cards" />}>
            <OverviewTab
              pendingFiles={pendingFiles}
              teamMembers={teamMembers}
              calculateApprovalRate={calculateApprovalRate}
              submittedFiles={submittedFiles}
              assignments={assignments}
              notifications={notifications}
              notificationCounts={notificationCounts}
              analyticsData={analyticsData}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onNavigateToTask={(assignmentId, fileId) => {
                setActiveTab('assignments')
                setHighlightedAssignmentId(assignmentId)
                if (fileId) {
                  setHighlightedSubmissionFileId(fileId)
                }
              }}
            />
          </Suspense>
        )
      case 'file-collection':
        return (
          <Suspense fallback={<SkeletonLoader type="table" />}>
            <FileCollectionTab
              submittedFiles={submittedFiles}
              isLoading={isLoading}
              openFileViewModal={openFileViewModal}
              formatFileSize={formatFileSize}
              user={user}
              openMenuId={openMenuId}
              toggleMenu={toggleMenu}
              handleOpenInExplorer={handleOpenInExplorer}
              fileCollectionFilter={fileCollectionFilter}
              setFileCollectionFilter={setFileCollectionFilter}
              fileCollectionSort={fileCollectionSort}
              setFileCollectionSort={setFileCollectionSort}
              onNavigateToTask={(assignmentId, fileId) => {
                setActiveTab('assignments')
                setHighlightedAssignmentId(assignmentId)
                if (fileId) {
                  setHighlightedSubmissionFileId(fileId)
                }
              }}
              highlightedFileId={highlightedFileId}
              onClearFileHighlight={() => setHighlightedFileId(null)}
            />
          </Suspense>
        )
      case 'team-management':
        return (
          <Suspense fallback={<SkeletonLoader type="table" />}>
            <TeamManagementTab
              isLoadingTeam={isLoadingTeam}
              teamMembers={teamMembers}
              fetchMemberFiles={fetchMemberFiles}
            />
          </Suspense>
        )
      case 'assignments':
        return (
          <Suspense fallback={<SkeletonLoader type="table" />}>
            <AssignmentsTab
              isLoadingAssignments={isLoadingAssignments}
              assignments={assignments}
              formatDate={formatDate}
              deleteAssignment={deleteAssignment}
              setShowCreateAssignmentModal={setShowCreateAssignmentModal}
              openReviewModal={openReviewModal}
              user={user}
              notificationCommentContext={notificationCommentContext}
              onClearNotificationContext={() => setNotificationCommentContext(null)}
              highlightedAssignmentId={highlightedAssignmentId}
              onClearHighlight={() => setHighlightedAssignmentId(null)}
              highlightedFileId={highlightedSubmissionFileId}
              onClearFileHighlight={() => setHighlightedSubmissionFileId(null)}
            />
          </Suspense>
        )
      case 'notifications':
        return (
          <Suspense fallback={<SkeletonLoader type="list" />}>
            <NotificationTab
              user={user}
              onNavigate={async (tab, data) => {
                console.log('🎯 Dashboard onNavigate called');
                console.log('   Tab:', tab);
                console.log('   Data:', data);
                
                if (tab === 'assignments') {
                  setActiveTab('assignments')
                  // Ensure assignments are loaded first
                  if (assignments.length === 0) {
                    console.log('   ⏳ Fetching assignments...');
                    await fetchAssignments()
                  }
                  
                  // Handle both object and primitive data formats
                  const assignmentId = typeof data === 'object' ? data.assignmentId : data
                  const shouldOpenComments = typeof data === 'object' ? data.shouldOpenComments : false
                  const expandAllReplies = typeof data === 'object' ? data.expandAllReplies : false
                  const fileId = typeof data === 'object' ? data.fileId : null

                  console.log('   📋 Extracted data:');
                  console.log('      assignmentId:', assignmentId);
                  console.log('      shouldOpenComments:', shouldOpenComments);
                  console.log('      expandAllReplies:', expandAllReplies);
                  console.log('      fileId:', fileId);

                  if (assignmentId) {
                    // Set highlighted assignment for scroll and highlight
                    setHighlightedAssignmentId(assignmentId)
                    console.log('   ✅ Set highlightedAssignmentId:', assignmentId);
                    
                    // If there's a file_id, also highlight the specific file within the task
                    if (fileId) {
                      setHighlightedSubmissionFileId(fileId)
                      console.log('   ✅ Set highlightedSubmissionFileId:', fileId);
                    }
                    
                    if (shouldOpenComments) {
                      // For comment notifications, set context to auto-open comments
                      const context = {
                        assignmentId: assignmentId,
                        expandAllReplies: expandAllReplies  // Pass the expand flag
                      };
                      console.log('   ✅ Setting notificationCommentContext:', context);
                      setNotificationCommentContext(context)
                    } else {
                      console.log('   ⚠️ Not opening comments - shouldOpenComments:', shouldOpenComments);
                    }
                  }
                } else if (tab === 'file-collection') {
                  // For file approval/rejection notifications, navigate to file collection
                  setActiveTab('file-collection')
                  // Ensure submissions are loaded first
                  if (submittedFiles.length === 0) {
                    await fetchAllSubmissions()
                  }
                  // Highlight the specific file
                  if (data) {
                    const fileId = typeof data === 'object' ? data.fileId : data
                    setHighlightedFileId(fileId)
                  }
                }
              }}
            />
          </Suspense>
        )
      default:
        return (
          <Suspense fallback={<SkeletonLoader type="cards" />}>
            <OverviewTab
              pendingFiles={pendingFiles}
              teamMembers={teamMembers}
              calculateApprovalRate={calculateApprovalRate}
            />
          </Suspense>
        )
    }
  }

  return (
    <Suspense fallback={<SkeletonLoader type="teamleader" />}>
      <div className="tl-dashboard">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          clearMessages={clearMessages}
          setSidebarOpen={setSidebarOpen}
          sidebarOpen={sidebarOpen}
          onLogout={onLogout}
        />

        <main className="tl-main">
          <AlertMessage
            type="error"
            message={error}
            onClose={clearMessages}
          />
          <AlertMessage
            type="success"
            message={success}
            onClose={clearMessages}
          />

          {renderActiveTab()}
        </main>

        {/* All Modals */}
        {showBulkActionModal && (
          <Suspense fallback={<div />}>
            <BulkActionModal
              showBulkActionModal={showBulkActionModal}
              setShowBulkActionModal={setShowBulkActionModal}
              bulkAction={bulkAction}
              selectedFileIds={selectedFileIds}
              bulkComments={bulkComments}
              setBulkComments={setBulkComments}
              isProcessing={isProcessing}
              submitBulkAction={submitBulkAction}
            />
          </Suspense>
        )}

        {showFilterModal && (
          <Suspense fallback={<div />}>
            <FilterModal
              showFilterModal={showFilterModal}
              setShowFilterModal={setShowFilterModal}
              filters={filters}
              setFilters={setFilters}
              clearFilters={clearFilters}
              applyFilters={applyFilters}
            />
          </Suspense>
        )}

        {showPriorityModal && (
          <Suspense fallback={<div />}>
            <PriorityModal
              showPriorityModal={showPriorityModal}
              setShowPriorityModal={setShowPriorityModal}
              priorityValue={priorityValue}
              setPriorityValue={setPriorityValue}
              dueDateValue={dueDateValue}
              setDueDateValue={setDueDateValue}
              isProcessing={isProcessing}
              submitPriority={submitPriority}
            />
          </Suspense>
        )}

        {showMemberFilesModal && (
          <Suspense fallback={<div />}>
            <MemberFilesModal
              showMemberFilesModal={showMemberFilesModal}
              setShowMemberFilesModal={setShowMemberFilesModal}
              selectedMember={selectedMember}
              setSelectedMember={setSelectedMember}
              memberFiles={memberFiles}
              setMemberFiles={setMemberFiles}
              isLoading={isLoading}
              formatFileSize={formatFileSize}
            />
          </Suspense>
        )}

        {showCreateAssignmentModal && (
          <Suspense fallback={<div />}>
            <CreateAssignmentModal
              showCreateAssignmentModal={showCreateAssignmentModal}
              setShowCreateAssignmentModal={setShowCreateAssignmentModal}
              assignmentForm={assignmentForm}
              setAssignmentForm={setAssignmentForm}
              teamMembers={teamMembers}
              isProcessing={isProcessing}
              createAssignment={createAssignment}
              currentUserId={user.id}
            />
          </Suspense>
        )}

        {showReviewModal && (
          <Suspense fallback={<div />}>
            <ReviewModal
              showReviewModal={showReviewModal}
              setShowReviewModal={setShowReviewModal}
              selectedFile={selectedFile}
              reviewAction={reviewAction}
              setReviewAction={setReviewAction}
              fileComments={fileComments}
              reviewComments={reviewComments}
              setReviewComments={setReviewComments}
              isProcessing={isProcessing}
              handleReviewSubmit={handleReviewSubmit}
              formatFileSize={formatFileSize}
              user={user}
            />
          </Suspense>
        )}

        {showFileViewModal && (
          <Suspense fallback={<div />}>
            <FileViewModal
              showModal={showFileViewModal}
              setShowModal={setShowFileViewModal}
              selectedFile={selectedFile}
              formatFileSize={formatFileSize}
              user={user}
            />
          </Suspense>
        )}
      </div>
    </Suspense>
  )
}

export default TeamLeaderDashboard