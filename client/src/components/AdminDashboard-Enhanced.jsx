import { useState, useEffect, useRef } from 'react'
import anime from 'animejs'
import './AdminDashboard.css'

const AdminDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [users, setUsers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredUsers, setFilteredUsers] = useState([])
  const [activityLogs, setActivityLogs] = useState([])
  const [filteredLogs, setFilteredLogs] = useState([])
  const [logsSearchQuery, setLogsSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    role: 'USER',
    team: 'General'
  })
  
  // File Approval System State
  const [allFiles, setAllFiles] = useState([])
  const [pendingAdminFiles, setPendingAdminFiles] = useState([])
  const [filteredFiles, setFilteredFiles] = useState([])
  const [fileSearchQuery, setFileSearchQuery] = useState('')
  const [fileFilter, setFileFilter] = useState('all')
  const [fileSortBy, setFileSortBy] = useState('date-desc')
  const [selectedFile, setSelectedFile] = useState(null)
  const [showFileModal, setShowFileModal] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewComments, setReviewComments] = useState('')
  const [reviewAction, setReviewAction] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [fileComments, setFileComments] = useState([])
  const [fileHistory, setFileHistory] = useState([])
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [fileToDelete, setFileToDelete] = useState(null)
  const [showUserDeleteModal, setShowUserDeleteModal] = useState(false)
  const [userToDelete, setUserToDelete] = useState(null)
  const [showDeleteLogsModal, setShowDeleteLogsModal] = useState(false)
  
  // File Management System State (existing)
  const [settings, setSettings] = useState({
    system: {
      siteName: 'KMTIFMSV2 Admin',
      siteDescription: 'Enterprise File Management System',
      maintenanceMode: false,
      debugMode: false
    },
    security: {
      sessionTimeout: 30,
      passwordMinLength: 6,
      maxLoginAttempts: 5,
      requireTwoFactor: false
    },
    notifications: {
      emailNotifications: true,
      loginAlerts: true,
      userRegistrationAlerts: false,
      systemAlerts: true
    },
    backup: {
      autoBackup: true,
      backupFrequency: 'daily',
      retentionDays: 30
    },
    fileManagement: {
      rootDirectory: '/home/admin/files',
      allowedExtensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.jpg', '.png', '.zip'],
      maxFileSize: '100MB',
      showHiddenFiles: false
    }
  })
  const [currentPath, setCurrentPath] = useState('/')
  const [fileSystemItems, setFileSystemItems] = useState([])
  const [filteredItems, setFilteredItems] = useState([])
  const [fileManagementSearch, setFileManagementSearch] = useState('')
  const [selectedItems, setSelectedItems] = useState([])
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'

  const sidebarRef = useRef(null)
  const mainContentRef = useRef(null)

  // Initial animations on component mount only
  useEffect(() => {
    anime({
      targets: sidebarRef.current,
      opacity: [0, 1],
      duration: 300,
      easing: 'easeOutCubic'
    })

    anime({
      targets: mainContentRef.current,
      opacity: [0, 1],
      duration: 300,
      delay: 100,
      easing: 'easeOutCubic'
    })
  }, [])

  // Handle tab changes and fetch data when needed
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers()
    } else if (activeTab === 'activity-logs') {
      fetchActivityLogs()
    } else if (activeTab === 'file-approval') {
      fetchAllFiles()
      fetchPendingAdminFiles()
    } else if (activeTab === 'file-management') {
      fetchFileSystemItems()
    }
  }, [activeTab, currentPath])

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users)
    } else {
      const filtered = users.filter(u => 
        u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.team.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredUsers(filtered)
    }
  }, [searchQuery, users])

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

  useEffect(() => {
    let filtered = allFiles

    // Apply status filter
    if (fileFilter !== 'all') {
      filtered = filtered.filter(file => {
        switch (fileFilter) {
          case 'pending_admin':
            return file.current_stage === 'pending_admin'
          case 'pending_team_leader':
            return file.current_stage === 'pending_team_leader'
          case 'approved':
            return file.status === 'final_approved'
          case 'rejected':
            return file.status.includes('rejected')
          default:
            return file.status === fileFilter
        }
      })
    }

    // Apply search filter
    if (fileSearchQuery.trim() !== '') {
      filtered = filtered.filter(file => 
        file.original_name.toLowerCase().includes(fileSearchQuery.toLowerCase()) ||
        file.username.toLowerCase().includes(fileSearchQuery.toLowerCase()) ||
        file.user_team.toLowerCase().includes(fileSearchQuery.toLowerCase()) ||
        file.description.toLowerCase().includes(fileSearchQuery.toLowerCase())
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
        case 'status-asc':
          return a.status.localeCompare(b.status)
        case 'status-desc':
          return b.status.localeCompare(a.status)
        default:
          return 0
      }
    })

    setFilteredFiles(filtered)
  }, [allFiles, fileSearchQuery, fileFilter, fileSortBy])

  useEffect(() => {
    if (fileManagementSearch.trim() === '') {
      setFilteredItems(fileSystemItems)
    } else {
      const filtered = fileSystemItems.filter(item => 
        item.name.toLowerCase().includes(fileManagementSearch.toLowerCase())
      )
      setFilteredItems(filtered)
    }
  }, [fileSystemItems, fileManagementSearch])

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('http://localhost:3001/api/users')
      const data = await response.json()
      if (data.success) {
        setUsers(data.users)
        setFilteredUsers(data.users)
      } else {
        setError('Failed to fetch users')
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      setError('Failed to connect to server')
    } finally {
      setIsLoading(false)
    }
  }

  // File Approval System Functions
  const fetchAllFiles = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('http://localhost:3001/api/files/all')
      const data = await response.json()
      if (data.success) {
        setAllFiles(data.files || [])
      } else {
        setError('Failed to fetch files')
      }
    } catch (error) {
      console.error('Error fetching all files:', error)
      setError('Failed to connect to server')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchPendingAdminFiles = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/files/admin')
      const data = await response.json()
      if (data.success) {
        setPendingAdminFiles(data.files || [])
      }
    } catch (error) {
      console.error('Error fetching pending admin files:', error)
    }
  }

  const openFileModal = async (file) => {
    setSelectedFile(file)
    setShowFileModal(true)
    
    // Fetch comments and history
    try {
      const [commentsRes, historyRes] = await Promise.all([
        fetch(`http://localhost:3001/api/files/${file.id}/comments`),
        fetch(`http://localhost:3001/api/files/${file.id}/history`)
      ])
      
      const [commentsData, historyData] = await Promise.all([
        commentsRes.json(),
        historyRes.json()
      ])
      
      if (commentsData.success) setFileComments(commentsData.comments || [])
      if (historyData.success) setFileHistory(historyData.history || [])
    } catch (error) {
      console.error('Error fetching file details:', error)
    }
  }

  const openReviewModal = (file, action) => {
    setSelectedFile(file)
    setReviewAction(action)
    setReviewComments('')
    setShowFileModal(false)
    setShowReviewModal(true)
  }

  const handleAdminReview = async (e) => {
    e.preventDefault()
    
    if (!selectedFile || !reviewAction) return
    
    if (reviewAction === 'reject' && !reviewComments.trim()) {
      setError('Please provide a reason for rejection')
      return
    }

    setIsProcessing(true)
    setError('')

    try {
      const response = await fetch(`http://localhost:3001/api/files/${selectedFile.id}/admin-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: reviewAction,
          comments: reviewComments.trim(),
          adminId: user.id,
          adminUsername: user.username,
          adminRole: user.role,
          team: user.team
        })
      })

      const data = await response.json()

      if (data.success) {
        const actionText = reviewAction === 'approve' ? 'approved and published to Public Network' : 'rejected'
        setSuccess(`File ${actionText} successfully!`)
        setShowReviewModal(false)
        setSelectedFile(null)
        setReviewComments('')
        
        // Refresh the files list
        fetchAllFiles()
        fetchPendingAdminFiles()
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
          adminId: user.id,
          adminUsername: user.username,
          adminRole: user.role,
          team: user.team
        })
      })
      
      const data = await response.json()
      if (data.success) {
        setSuccess('File deleted successfully')
        setShowDeleteModal(false)
        setFileToDelete(null)
        fetchAllFiles()
        fetchPendingAdminFiles()
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

  // File System Functions (existing)
  const fetchFileSystemItems = async () => {
    setIsLoading(true)
    try {
      // Simulate API call with mock file system data
      const mockItems = generateMockFileSystem(currentPath)
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 600))
      setFileSystemItems(mockItems)
      setFilteredItems(mockItems)
    } catch (error) {
      console.error('Error fetching file system items:', error)
      setError('Failed to load file system')
    } finally {
      setIsLoading(false)
    }
  }

  const generateMockFileSystem = (path) => {
    const items = []
    
    // Add parent directory if not at root
    if (path !== '/') {
      items.push({
        id: 'parent',
        name: '..',
        type: 'folder',
        path: getParentPath(path),
        size: null,
        modified: null,
        isParent: true
      })
    }
    
    // Mock folder structure
    const mockStructure = {
      '/': {
        folders: ['Documents', 'Images', 'Projects', 'Archives'],
        files: [
          { name: 'README.txt', size: '2.1 KB', type: 'text' },
          { name: 'system_config.json', size: '1.5 KB', type: 'json' }
        ]
      },
      '/Documents': {
        folders: ['Reports', 'Templates', 'Drafts'],
        files: [
          { name: 'annual_report_2024.pdf', size: '3.2 MB', type: 'pdf' },
          { name: 'meeting_notes.docx', size: '156 KB', type: 'docx' },
          { name: 'budget_analysis.xlsx', size: '892 KB', type: 'xlsx' }
        ]
      },
      '/Images': {
        folders: ['Screenshots', 'Logos', 'Thumbnails'],
        files: [
          { name: 'company_logo.png', size: '245 KB', type: 'png' },
          { name: 'banner_image.jpg', size: '1.8 MB', type: 'jpg' },
          { name: 'profile_pics.zip', size: '5.4 MB', type: 'zip' }
        ]
      },
      '/Projects': {
        folders: ['Active', 'Completed', 'Archive'],
        files: [
          { name: 'project_timeline.pdf', size: '678 KB', type: 'pdf' },
          { name: 'requirements.docx', size: '234 KB', type: 'docx' }
        ]
      }
    }
    
    const currentStructure = mockStructure[path] || { folders: [], files: [] }
    
    // Add folders
    currentStructure.folders.forEach((folderName, index) => {
      items.push({
        id: `folder-${index}`,
        name: folderName,
        type: 'folder',
        path: path === '/' ? `/${folderName}` : `${path}/${folderName}`,
        size: null,
        modified: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        isParent: false
      })
    })
    
    // Add files
    currentStructure.files.forEach((file, index) => {
      items.push({
        id: `file-${index}`,
        name: file.name,
        type: 'file',
        fileType: file.type,
        path: path === '/' ? `/${file.name}` : `${path}/${file.name}`,
        size: file.size,
        modified: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000),
        isParent: false
      })
    })
    
    return items
  }

  const getParentPath = (path) => {
    const parts = path.split('/').filter(p => p)
    if (parts.length <= 1) return '/'
    return '/' + parts.slice(0, -1).join('/')
  }

  const navigateToPath = (newPath) => {
    setCurrentPath(newPath)
    setFileManagementSearch('')
    setSelectedItems([])
  }

  const getBreadcrumbs = () => {
    if (currentPath === '/') return [{ name: 'Root', path: '/' }]
    
    const parts = currentPath.split('/').filter(p => p)
    const breadcrumbs = [{ name: 'Root', path: '/' }]
    
    let currentBreadcrumbPath = ''
    parts.forEach(part => {
      currentBreadcrumbPath += `/${part}`
      breadcrumbs.push({
        name: part,
        path: currentBreadcrumbPath
      })
    })
    
    return breadcrumbs
  }

  const getFileIcon = (fileType) => {
    const iconMap = {
      pdf: '📄',
      doc: '📝',
      docx: '📝', 
      xls: '📊',
      xlsx: '📊',
      txt: '📄',
      json: '📄',
      jpg: '🖼️',
      png: '🖼️',
      zip: '🗜️',
      unknown: '📄'
    }
    return iconMap[fileType] || iconMap.unknown
  }

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

  const clearFileFilters = () => {
    setFileSearchQuery('')
    setFileFilter('all')
    setFileSortBy('date-desc')
    setSuccess('File filters cleared')
  }

  const handleAddUser = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch('http://localhost:3001/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      const data = await response.json()
      if (data.success) {
        setSuccess('User created successfully')
        setShowAddModal(false)
        setFormData({ 
          fullName: '', 
          username: '', 
          email: '', 
          password: '', 
          role: 'USER', 
          team: 'General' 
        })
        fetchUsers()
      } else {
        setError(data.message)
      }
    } catch (error) {
      setError('Failed to create user')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditUser = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch(`http://localhost:3001/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          username: formData.username,
          email: formData.email,
          role: formData.role,
          team: formData.team
        })
      })
      
      const data = await response.json()
      if (data.success) {
        setSuccess('User updated successfully')
        setShowEditModal(false)
        setSelectedUser(null)
        fetchUsers()
      } else {
        setError(data.message)
      }
    } catch (error) {
      setError('Failed to update user')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch(`http://localhost:3001/api/users/${selectedUser.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: formData.password })
      })
      
      const data = await response.json()
      if (data.success) {
        setSuccess('Password reset successfully')
        setShowPasswordModal(false)
        setSelectedUser(null)
        setFormData({ ...formData, password: '' })
      } else {
        setError(data.message)
      }
    } catch (error) {
      setError('Failed to reset password')
    } finally {
      setIsLoading(false)
    }
  }

  const openUserDeleteModal = (user) => {
    setUserToDelete(user)
    setShowUserDeleteModal(true)
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return
    
    setIsLoading(true)
    try {
      const response = await fetch(`http://localhost:3001/api/users/${userToDelete.id}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      if (data.success) {
        setSuccess(`User ${userToDelete.fullName} deleted successfully`)
        setShowUserDeleteModal(false)
        setUserToDelete(null)
        fetchUsers()
      } else {
        setError(data.message)
      }
    } catch (error) {
      setError('Failed to delete user')
    } finally {
      setIsLoading(false)
    }
  }

  const openEditModal = (user) => {
    setError('')
    setSuccess('')
    setSelectedUser(user)
    setFormData({
      fullName: user.fullName || '',
      username: user.username || '',
      email: user.email || '',
      password: '',
      role: user.role || 'USER',
      team: user.team || 'General'
    })
    setShowEditModal(true)
  }

  const openPasswordModal = (user) => {
    setError('')
    setSuccess('')
    setSelectedUser(user)
    setFormData({ ...formData, password: '' })
    setShowPasswordModal(true)
  }

  const handleLogout = () => {
    onLogout()
  }

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const handleSettingsChange = (category, field, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }))
  }

  const handleSaveSettings = async () => {
    setIsLoading(true)
    try {
      // Here you would typically save to your backend
      // const response = await fetch('/api/settings', { method: 'PUT', ... })
      
      // For now, we'll just simulate a successful save
      await new Promise(resolve => setTimeout(resolve, 1000))
      setSuccess('Settings saved successfully')
    } catch (error) {
      setError('Failed to save settings')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportDatabase = () => {
    setSuccess('Database export initiated')
    // Simulate database export
  }

  const handleResetDatabase = () => {
    if (confirm('Are you sure you want to reset the database? This will remove all data and cannot be undone.')) {
      setSuccess('Database reset initiated')
      // Here you would call your reset script
    }
  }

  // Utility functions
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
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

  return (
    <div className="minimal-admin-dashboard">
      {/* Sidebar */}
      <div className="admin-sidebar" ref={sidebarRef}>
        <div className="sidebar-header">
          <div className="admin-avatar">A</div>
          <h2>Admin Center</h2>
          <div className="admin-info">
            <div className="admin-name">{user.fullName || 'Administrator'}</div>
            <div className="admin-role">{user.role}</div>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={(e) => { 
              e.preventDefault()
              setActiveTab('dashboard')
              clearMessages()
            }}
          >
            <span className="nav-label">Dashboard</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'file-approval' ? 'active' : ''}`}
            onClick={(e) => { 
              e.preventDefault()
              setActiveTab('file-approval')
              clearMessages()
            }}
          >
            <span className="nav-label">File Approval ({pendingAdminFiles.length})</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'file-management' ? 'active' : ''}`}
            onClick={(e) => { 
              e.preventDefault()
              setActiveTab('file-management')
              clearMessages()
            }}
          >
            <span className="nav-label">File Management</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={(e) => { 
              e.preventDefault()
              setActiveTab('users')
              clearMessages()
            }}
          >
            <span className="nav-label">User Management</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'activity-logs' ? 'active' : ''}`}
            onClick={(e) => { 
              e.preventDefault()
              setActiveTab('activity-logs')
              clearMessages()
            }}
          >
            <span className="nav-label">Activity Logs</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={(e) => { 
              e.preventDefault()
              setActiveTab('settings')
              clearMessages()
            }}
          >
            <span className="nav-label">Settings</span>
          </button>
        </nav>
        
        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="admin-main-content" ref={mainContentRef}>
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="dashboard-overview">
            <div className="page-header">
              <h1>Admin Dashboard</h1>
              <p>Welcome back, {user.fullName || 'Administrator'}! Monitor system status and manage file approvals.</p>
            </div>
            
            <div className="stats-section">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon users-icon">U</div>
                  <div className="stat-info">
                    <div className="stat-number">{users.length}</div>
                    <div className="stat-label">Total Users</div>
                    <div className="stat-change positive">Active system</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon files-icon">F</div>
                  <div className="stat-info">
                    <div className="stat-number">{allFiles.length}</div>
                    <div className="stat-label">Total Files</div>
                    <div className="stat-change neutral">All submissions</div>
                  </div>
                </div>
                
                <div className="stat-card urgent">
                  <div className="stat-icon pending-icon">P</div>
                  <div className="stat-info">
                    <div className="stat-number">{pendingAdminFiles.length}</div>
                    <div className="stat-label">Pending Admin Review</div>
                    <div className="stat-change urgent">Requires attention</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon approved-icon">A</div>
                  <div className="stat-info">
                    <div className="stat-number">{allFiles.filter(f => f.status === 'final_approved').length}</div>
                    <div className="stat-label">Approved Files</div>
                    <div className="stat-change positive">Published</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="admin-features-section">
              <div className="features-header">
                <h2>File Approval Workflow</h2>
                <p>Comprehensive two-tier approval system with public network publishing</p>
              </div>
              
              <div className="workflow-diagram">
                <div className="workflow-step">
                  <div className="step-circle">1</div>
                  <div className="step-content">
                    <h3>User Upload</h3>
                    <p>Users submit files with descriptions</p>
                  </div>
                </div>
                <div className="workflow-arrow">→</div>
                <div className="workflow-step">
                  <div className="step-circle">2</div>
                  <div className="step-content">
                    <h3>Team Leader Review</h3>
                    <p>Team leaders approve/reject files</p>
                  </div>
                </div>
                <div className="workflow-arrow">→</div>
                <div className="workflow-step current">
                  <div className="step-circle">3</div>
                  <div className="step-content">
                    <h3>Admin Review</h3>
                    <p>Final approval and publishing</p>
                  </div>
                </div>
                <div className="workflow-arrow">→</div>
                <div className="workflow-step">
                  <div className="step-circle">4</div>
                  <div className="step-content">
                    <h3>Public Network</h3>
                    <p>Files published to public network</p>
                  </div>
                </div>
              </div>
              
              {pendingAdminFiles.length > 0 && (
                <div className="pending-actions">
                  <div className="action-prompt">
                    <h3>⚠️ Action Required</h3>
                    <p>You have {pendingAdminFiles.length} file(s) awaiting final approval.</p>
                    <button 
                      className="btn btn-primary btn-large"
                      onClick={() => setActiveTab('file-approval')}
                    >
                      Review Pending Files
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* File Approval Tab */}
        {activeTab === 'file-approval' && (
          <div className="file-approval-section">
            <div className="page-header">
              <h1>File Approval System</h1>
              <p>Review and manage all files in the approval workflow. Final approval publishes files to the public network.</p>
            </div>
            
            {/* Status Cards */}
            <div className="file-status-cards">
              <div className="file-status-card pending-team-leader">
                <div className="status-icon pending-team-leader-icon">TL</div>
                <div className="status-info">
                  <div className="status-number">{allFiles.filter(f => f.current_stage === 'pending_team_leader').length}</div>
                  <div className="status-label">Pending Team Leader</div>
                </div>
              </div>
              
              <div className="file-status-card pending-admin">
                <div className="status-icon pending-admin-icon">AD</div>
                <div className="status-info">
                  <div className="status-number">{pendingAdminFiles.length}</div>
                  <div className="status-label">Pending Admin Review</div>
                </div>
              </div>
              
              <div className="file-status-card approved">
                <div className="status-icon approved-icon">AP</div>
                <div className="status-info">
                  <div className="status-number">{allFiles.filter(f => f.status === 'final_approved').length}</div>
                  <div className="status-label">Final Approved</div>
                </div>
              </div>
              
              <div className="file-status-card rejected">
                <div className="status-icon rejected-icon">RE</div>
                <div className="status-info">
                  <div className="status-number">{allFiles.filter(f => f.status.includes('rejected')).length}</div>
                  <div className="status-label">Rejected Files</div>
                </div>
              </div>
            </div>
            
            {/* Filter and Search Controls */}
            <div className="file-controls">
              <div className="file-filters">
                <select
                  value={fileFilter}
                  onChange={(e) => setFileFilter(e.target.value)}
                  className="form-select"
                >
                  <option value="all">All Files</option>
                  <option value="pending_admin">Pending Admin Review</option>
                  <option value="pending_team_leader">Pending Team Leader</option>
                  <option value="approved">Final Approved</option>
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
                  <option value="status-asc">Status A-Z</option>
                  <option value="status-desc">Status Z-A</option>
                </select>
                
                <button 
                  className="btn btn-secondary"
                  onClick={clearFileFilters}
                  disabled={fileSearchQuery === '' && fileFilter === 'all' && fileSortBy === 'date-desc'}
                >
                  Clear Filters
                </button>
              </div>
              
              <div className="file-search">
                <input
                  type="text"
                  placeholder="Search files by name, user, team, or description..."
                  value={fileSearchQuery}
                  onChange={(e) => setFileSearchQuery(e.target.value)}
                  className="search-input"
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
                        <th>File Details</th>
                        <th>Submitted By</th>
                        <th>Team</th>
                        <th>Status & Stage</th>
                        <th>Upload Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFiles.map((file) => (
                        <tr 
                          key={file.id} 
                          className="file-row"
                        >
                          <td>
                            <div className="file-cell">
                              <div className="file-icon">
                                {file.file_type.split(' ')[0].slice(0, 3).toUpperCase()}
                              </div>
                              <div className="file-details">
                                <div className="file-name">{file.original_name}</div>
                                <div className="file-meta">
                                  <span className="file-type">{file.file_type}</span>
                                  <span className="file-size">{formatFileSize(file.file_size)}</span>
                                </div>
                                {file.description && (
                                  <div className="file-description-short" title={file.description}>
                                    {file.description.length > 50 ? file.description.substring(0, 50) + '...' : file.description}
                                  </div>
                                )}
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
                            <span className="team-badge">{file.user_team}</span>
                          </td>
                          <td>
                            <div className="status-cell">
                              <span className={`status-badge ${getStatusBadgeClass(file.status, file.current_stage)}`}>
                                {getStatusText(file.status, file.current_stage)}
                              </span>
                              <div className="stage-text">{getCurrentStageText(file.current_stage)}</div>
                            </div>
                          </td>
                          <td>
                            <div className="datetime-cell">
                              <div className="date">{new Date(file.uploaded_at).toLocaleDateString()}</div>
                              <div className="time">{new Date(file.uploaded_at).toLocaleTimeString()}</div>
                            </div>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button 
                                className="action-btn view-btn"
                                onClick={() => openFileModal(file)}
                                title="View Details"
                              >
                                View
                              </button>
                              {file.current_stage === 'pending_admin' && (
                                <>
                                  <button 
                                    className="action-btn approve-btn"
                                    onClick={() => openReviewModal(file, 'approve')}
                                    title="Approve & Publish"
                                  >
                                    Approve
                                  </button>
                                  <button 
                                    className="action-btn reject-btn"
                                    onClick={() => openReviewModal(file, 'reject')}
                                    title="Reject File"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              <button 
                                className="action-btn delete-btn"
                                onClick={() => openDeleteModal(file)}
                                title="Delete File"
                              >
                                Delete
                              </button>
                            </div>
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
          </div>
        )}

        {/* File Management Tab */}
        {activeTab === 'file-management' && (
          <div className="file-management-section">
            <div className="page-header">
              <h1>File Management</h1>
              <p>Browse and manage files in the system with a Google Drive-inspired interface.</p>
            </div>
            
            {/* Breadcrumb Navigation */}
            <div className="breadcrumb-nav">
              <div className="breadcrumbs">
                {getBreadcrumbs().map((crumb, index) => (
                  <span key={index} className="breadcrumb-item">
                    {index > 0 && <span className="breadcrumb-separator">/</span>}
                    <button 
                      className="breadcrumb-link"
                      onClick={() => navigateToPath(crumb.path)}
                    >
                      {crumb.name}
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* File Management Controls */}
            <div className="file-management-controls">
              <div className="controls-left">
                <div className="view-mode-toggle">
                  <button 
                    className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => setViewMode('grid')}
                    title="Grid View"
                  >
                    ⊞
                  </button>
                  <button 
                    className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                    onClick={() => setViewMode('list')}
                    title="List View"
                  >
                    ≡
                  </button>
                </div>
                
                <div className="file-search">
                  <input
                    type="text"
                    placeholder="Search files and folders..."
                    value={fileManagementSearch}
                    onChange={(e) => setFileManagementSearch(e.target.value)}
                    className="search-input"
                  />
                </div>
              </div>
              
              <div className="controls-right">
                <button 
                  className="btn btn-secondary"
                  onClick={fetchFileSystemItems}
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : 'Refresh'}
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

            {/* File System Items */}
            <div className="file-system-container">
              {isLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading file system...</p>
                </div>
              ) : (
                <div className={`file-system-items ${viewMode}-view`}>
                  {filteredItems.map((item) => (
                    <div 
                      key={item.id} 
                      className={`file-system-item ${item.type} ${selectedItems.includes(item.id) ? 'selected' : ''}`}
                      onClick={() => {
                        if (item.type === 'folder') {
                          navigateToPath(item.path)
                        }
                      }}
                    >
                      <div className="item-icon">
                        {item.type === 'folder' ? '📁' : getFileIcon(item.fileType)}
                      </div>
                      <div className="item-details">
                        <div className="item-name">{item.name}</div>
                        {item.type === 'file' && (
                          <div className="item-meta">
                            <span className="item-size">{item.size}</span>
                            {item.modified && (
                              <span className="item-modified">
                                {item.modified.toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        )}
                        {item.type === 'folder' && !item.isParent && (
                          <div className="item-meta">
                            <span className="item-type">Folder</span>
                            {item.modified && (
                              <span className="item-modified">
                                {item.modified.toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {!isLoading && filteredItems.length === 0 && (
                <div className="empty-state">
                  <h3>No items found</h3>
                  <p>This directory is empty or no items match your search.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="users-section">
            <div className="page-header">
              <h1>User Management</h1>
              <p>Manage system users, roles, and permissions. Create, edit, and delete user accounts.</p>
            </div>

            {/* User Controls */}
            <div className="users-controls">
              <div className="users-search">
                <input
                  type="text"
                  placeholder="Search users by name, email, role, or team..."
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
              
              <div className="users-actions">
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    setError('')
                    setSuccess('')
                    setFormData({ 
                      fullName: '', 
                      username: '', 
                      email: '', 
                      password: '', 
                      role: 'USER', 
                      team: 'General' 
                    })
                    setShowAddModal(true)
                  }}
                >
                  Add User
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={fetchUsers}
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

            {/* Users Table */}
            <div className="table-section">
              {isLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading users...</p>
                </div>
              ) : (
                <div className="users-table-container">
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Contact</th>
                        <th>Role & Team</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="user-row">
                          <td>
                            <div className="user-info">
                              <div className="user-avatar-small">
                                {user.fullName.charAt(0).toUpperCase()}
                              </div>
                              <div className="user-details">
                                <div className="user-name">{user.fullName}</div>
                                <div className="username">@{user.username}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="contact-info">
                              <div className="email">{user.email}</div>
                            </div>
                          </td>
                          <td>
                            <div className="role-team">
                              <span className={`role-badge ${user.role.toLowerCase().replace(' ', '-')}`}>
                                {user.role}
                              </span>
                              <div className="team-name">{user.team}</div>
                            </div>
                          </td>
                          <td>
                            <div className="date-info">
                              <div className="date">
                                {new Date(user.created_at).toLocaleDateString()}
                              </div>
                              <div className="time">
                                {new Date(user.created_at).toLocaleTimeString()}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button 
                                className="action-btn edit-btn"
                                onClick={() => openEditModal(user)}
                                title="Edit User"
                              >
                                Edit
                              </button>
                              <button 
                                className="action-btn password-btn"
                                onClick={() => openPasswordModal(user)}
                                title="Reset Password"
                              >
                                Reset
                              </button>
                              <button 
                                className="action-btn delete-btn"
                                onClick={() => openUserDeleteModal(user)}
                                title="Delete User"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {!isLoading && filteredUsers.length === 0 && (
                <div className="empty-state">
                  <h3>No users found</h3>
                  <p>No users match your current search criteria.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Activity Logs Tab */}
        {activeTab === 'activity-logs' && (
          <div className="activity-logs-section">
            <div className="page-header">
              <h1>Activity Logs</h1>
              <p>Monitor system activity and user actions. Search, filter, and export activity logs.</p>
            </div>

            {/* Logs Controls */}
            <div className="logs-controls">
              <div className="logs-search">
                <input
                  type="text"
                  placeholder="Search logs by user, role, team, or activity..."
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
              
              <div className="logs-actions">
                <button 
                  className="btn btn-success"
                  onClick={exportLogs}
                  disabled={filteredLogs.length === 0}
                >
                  Export CSV
                </button>
                <button 
                  className="btn btn-warning"
                  onClick={clearLogFilters}
                  disabled={logsSearchQuery === ''}
                >
                  Clear Filter
                </button>
                <button 
                  className="btn btn-danger"
                  onClick={deleteFilteredLogs}
                  disabled={logsSearchQuery === '' || filteredLogs.length === 0}
                >
                  Delete Filtered
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={fetchActivityLogs}
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

            {/* Activity Logs Table */}
            <div className="table-section">
              {isLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading activity logs...</p>
                </div>
              ) : (
                <div className="logs-table-container">
                  <table className="logs-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Role & Team</th>
                        <th>Activity</th>
                        <th>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log, index) => (
                        <tr key={log.id || index} className="log-row">
                          <td>
                            <div className="log-user">
                              <div className="user-avatar-small">
                                {log.username.charAt(0).toUpperCase()}
                              </div>
                              <span className="username">{log.username}</span>
                            </div>
                          </td>
                          <td>
                            <div className="log-role-team">
                              <span className={`role-badge ${log.role.toLowerCase().replace(' ', '-')}`}>
                                {log.role}
                              </span>
                              <div className="team-name">{log.team}</div>
                            </div>
                          </td>
                          <td>
                            <div className="log-activity">{log.activity}</div>
                          </td>
                          <td>
                            <div className="log-timestamp">
                              <div className="date">
                                {new Date(log.timestamp).toLocaleDateString()}
                              </div>
                              <div className="time">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </div>
                            </div>
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
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="settings-section">
            <div className="page-header">
              <h1>System Settings</h1>
              <p>Configure system settings, security options, and file management preferences.</p>
            </div>

            <div className="settings-container">
              {/* System Settings */}
              <div className="settings-group">
                <h3>System Configuration</h3>
                <div className="settings-grid">
                  <div className="setting-item">
                    <label className="setting-label">Site Name</label>
                    <input
                      type="text"
                      value={settings.system.siteName}
                      onChange={(e) => handleSettingsChange('system', 'siteName', e.target.value)}
                      className="setting-input"
                    />
                  </div>
                  <div className="setting-item">
                    <label className="setting-label">Site Description</label>
                    <textarea
                      value={settings.system.siteDescription}
                      onChange={(e) => handleSettingsChange('system', 'siteDescription', e.target.value)}
                      className="setting-textarea"
                      rows="3"
                    />
                  </div>
                  <div className="setting-item">
                    <label className="setting-checkbox">
                      <input
                        type="checkbox"
                        checked={settings.system.maintenanceMode}
                        onChange={(e) => handleSettingsChange('system', 'maintenanceMode', e.target.checked)}
                      />
                      <span className="checkmark"></span>
                      Maintenance Mode
                    </label>
                  </div>
                  <div className="setting-item">
                    <label className="setting-checkbox">
                      <input
                        type="checkbox"
                        checked={settings.system.debugMode}
                        onChange={(e) => handleSettingsChange('system', 'debugMode', e.target.checked)}
                      />
                      <span className="checkmark"></span>
                      Debug Mode
                    </label>
                  </div>
                </div>
              </div>

              {/* Security Settings */}
              <div className="settings-group">
                <h3>Security Settings</h3>
                <div className="settings-grid">
                  <div className="setting-item">
                    <label className="setting-label">Session Timeout (minutes)</label>
                    <input
                      type="number"
                      value={settings.security.sessionTimeout}
                      onChange={(e) => handleSettingsChange('security', 'sessionTimeout', parseInt(e.target.value))}
                      className="setting-input"
                      min="5"
                      max="480"
                    />
                  </div>
                  <div className="setting-item">
                    <label className="setting-label">Password Minimum Length</label>
                    <input
                      type="number"
                      value={settings.security.passwordMinLength}
                      onChange={(e) => handleSettingsChange('security', 'passwordMinLength', parseInt(e.target.value))}
                      className="setting-input"
                      min="6"
                      max="50"
                    />
                  </div>
                  <div className="setting-item">
                    <label className="setting-label">Max Login Attempts</label>
                    <input
                      type="number"
                      value={settings.security.maxLoginAttempts}
                      onChange={(e) => handleSettingsChange('security', 'maxLoginAttempts', parseInt(e.target.value))}
                      className="setting-input"
                      min="3"
                      max="10"
                    />
                  </div>
                  <div className="setting-item">
                    <label className="setting-checkbox">
                      <input
                        type="checkbox"
                        checked={settings.security.requireTwoFactor}
                        onChange={(e) => handleSettingsChange('security', 'requireTwoFactor', e.target.checked)}
                      />
                      <span className="checkmark"></span>
                      Require Two-Factor Authentication
                    </label>
                  </div>
                </div>
              </div>

              {/* Notification Settings */}
              <div className="settings-group">
                <h3>Notification Settings</h3>
                <div className="settings-grid">
                  <div className="setting-item">
                    <label className="setting-checkbox">
                      <input
                        type="checkbox"
                        checked={settings.notifications.emailNotifications}
                        onChange={(e) => handleSettingsChange('notifications', 'emailNotifications', e.target.checked)}
                      />
                      <span className="checkmark"></span>
                      Email Notifications
                    </label>
                  </div>
                  <div className="setting-item">
                    <label className="setting-checkbox">
                      <input
                        type="checkbox"
                        checked={settings.notifications.loginAlerts}
                        onChange={(e) => handleSettingsChange('notifications', 'loginAlerts', e.target.checked)}
                      />
                      <span className="checkmark"></span>
                      Login Alerts
                    </label>
                  </div>
                  <div className="setting-item">
                    <label className="setting-checkbox">
                      <input
                        type="checkbox"
                        checked={settings.notifications.userRegistrationAlerts}
                        onChange={(e) => handleSettingsChange('notifications', 'userRegistrationAlerts', e.target.checked)}
                      />
                      <span className="checkmark"></span>
                      User Registration Alerts
                    </label>
                  </div>
                  <div className="setting-item">
                    <label className="setting-checkbox">
                      <input
                        type="checkbox"
                        checked={settings.notifications.systemAlerts}
                        onChange={(e) => handleSettingsChange('notifications', 'systemAlerts', e.target.checked)}
                      />
                      <span className="checkmark"></span>
                      System Alerts
                    </label>
                  </div>
                </div>
              </div>

              {/* File Management Settings */}
              <div className="settings-group">
                <h3>File Management</h3>
                <div className="settings-grid">
                  <div className="setting-item">
                    <label className="setting-label">Root Directory</label>
                    <input
                      type="text"
                      value={settings.fileManagement.rootDirectory}
                      onChange={(e) => handleSettingsChange('fileManagement', 'rootDirectory', e.target.value)}
                      className="setting-input"
                    />
                  </div>
                  <div className="setting-item">
                    <label className="setting-label">Max File Size</label>
                    <input
                      type="text"
                      value={settings.fileManagement.maxFileSize}
                      onChange={(e) => handleSettingsChange('fileManagement', 'maxFileSize', e.target.value)}
                      className="setting-input"
                      placeholder="e.g., 100MB"
                    />
                  </div>
                  <div className="setting-item full-width">
                    <label className="setting-label">Allowed Extensions</label>
                    <input
                      type="text"
                      value={settings.fileManagement.allowedExtensions.join(', ')}
                      onChange={(e) => handleSettingsChange('fileManagement', 'allowedExtensions', e.target.value.split(',').map(ext => ext.trim()))}
                      className="setting-input"
                      placeholder=".pdf, .doc, .docx, .jpg, .png"
                    />
                  </div>
                  <div className="setting-item">
                    <label className="setting-checkbox">
                      <input
                        type="checkbox"
                        checked={settings.fileManagement.showHiddenFiles}
                        onChange={(e) => handleSettingsChange('fileManagement', 'showHiddenFiles', e.target.checked)}
                      />
                      <span className="checkmark"></span>
                      Show Hidden Files
                    </label>
                  </div>
                </div>
              </div>

              {/* Database Management */}
              <div className="settings-group danger-zone">
                <h3>Database Management</h3>
                <div className="danger-actions">
                  <div className="danger-item">
                    <div className="danger-info">
                      <h4>Export Database</h4>
                      <p>Download a backup of all system data</p>
                    </div>
                    <button 
                      className="btn btn-warning"
                      onClick={handleExportDatabase}
                    >
                      Export Database
                    </button>
                  </div>
                  <div className="danger-item">
                    <div className="danger-info">
                      <h4>Reset Database</h4>
                      <p className="danger-text">⚠️ This will permanently delete all data</p>
                    </div>
                    <button 
                      className="btn btn-danger"
                      onClick={handleResetDatabase}
                    >
                      Reset Database
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Settings */}
            <div className="settings-footer">
              <button 
                className="btn btn-primary btn-large"
                onClick={handleSaveSettings}
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* File Details Modal */}
      {showFileModal && selectedFile && (
        <div className="modal-overlay" onClick={() => setShowFileModal(false)}>
          <div className="modal file-modal large-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>File Details & History</h3>
              <button onClick={() => setShowFileModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="file-details-grid">
                <div className="file-info-section">
                  <h4>File Information</h4>
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
                    <span className="detail-label">Submitted by:</span>
                    <span className="detail-value">{selectedFile.username} ({selectedFile.user_team} Team)</span>
                  </div>
                  <div className="file-detail-row">
                    <span className="detail-label">Upload Date:</span>
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
                </div>

                {/* Review History */}
                <div className="review-history-section">
                  <h4>Review History</h4>
                  
                  {selectedFile.team_leader_reviewed_at && (
                    <div className="review-item">
                      <div className="review-header">
                        <h5>Team Leader Review</h5>
                        <span className="review-date">{new Date(selectedFile.team_leader_reviewed_at).toLocaleString()}</span>
                      </div>
                      <div className="review-content">
                        <div className="reviewer">Reviewed by: {selectedFile.team_leader_username}</div>
                        {selectedFile.team_leader_comments && (
                          <div className="review-comments">{selectedFile.team_leader_comments}</div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {selectedFile.admin_reviewed_at && (
                    <div className="review-item">
                      <div className="review-header">
                        <h5>Admin Review</h5>
                        <span className="review-date">{new Date(selectedFile.admin_reviewed_at).toLocaleString()}</span>
                      </div>
                      <div className="review-content">
                        <div className="reviewer">Reviewed by: {selectedFile.admin_username}</div>
                        {selectedFile.admin_comments && (
                          <div className="review-comments">{selectedFile.admin_comments}</div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {selectedFile.public_network_url && (
                    <div className="review-item success">
                      <div className="review-header">
                        <h5>Published to Public Network</h5>
                        <span className="review-date">{new Date(selectedFile.final_approved_at).toLocaleString()}</span>
                      </div>
                      <div className="review-content">
                        <div className="public-url">
                          <a href={selectedFile.public_network_url} target="_blank" rel="noopener noreferrer">
                            {selectedFile.public_network_url}
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {selectedFile.rejection_reason && (
                    <div className="review-item rejected">
                      <div className="review-header">
                        <h5>Rejection Details</h5>
                        <span className="review-date">{new Date(selectedFile.rejected_at).toLocaleString()}</span>
                      </div>
                      <div className="review-content">
                        <div className="reviewer">Rejected by: {selectedFile.rejected_by}</div>
                        <div className="rejection-reason">{selectedFile.rejection_reason}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Comments Section */}
              {fileComments.length > 0 && (
                <div className="comments-section">
                  <h4>All Comments</h4>
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

              {/* Status History */}
              {fileHistory.length > 0 && (
                <div className="history-section">
                  <h4>Status History</h4>
                  <div className="history-list">
                    {fileHistory.map((history, index) => (
                      <div key={index} className="history-item">
                        <div className="history-content">
                          <div className="status-change">
                            {history.old_status ? `${history.old_status} → ${history.new_status}` : history.new_status}
                            {history.reason && <span className="change-reason"> ({history.reason})</span>}
                          </div>
                          <div className="history-meta">
                            <span className="changed-by">Changed by: {history.changed_by_username} ({history.changed_by_role})</span>
                            <span className="change-date">{new Date(history.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <div className="file-actions">
                <a 
                  href={`http://localhost:3001${selectedFile.file_path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                >
                  Download File
                </a>
                {selectedFile.current_stage === 'pending_admin' && (
                  <>
                    <button 
                      className="btn btn-success"
                      onClick={() => openReviewModal(selectedFile, 'approve')}
                    >
                      Approve & Publish
                    </button>
                    <button 
                      className="btn btn-danger"
                      onClick={() => openReviewModal(selectedFile, 'reject')}
                    >
                      Reject File
                    </button>
                  </>
                )}
                <button 
                  onClick={() => setShowFileModal(false)} 
                  className="btn btn-primary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Review Modal */}
      {showReviewModal && selectedFile && (
        <div className="modal-overlay" onClick={() => setShowReviewModal(false)}>
          <div className="modal review-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{reviewAction === 'approve' ? 'Final Approval & Publish' : 'Reject File'}</h3>
              <button onClick={() => setShowReviewModal(false)} className="modal-close">×</button>
            </div>
            <form onSubmit={handleAdminReview}>
              <div className="modal-body">
                <div className="file-review-info">
                  <div className="review-file-details">
                    <h4>File: {selectedFile.original_name}</h4>
                    <div className="review-meta">
                      <span>Submitted by: {selectedFile.username} ({selectedFile.user_team} Team)</span>
                      <span>Type: {selectedFile.file_type}</span>
                      <span>Size: {formatFileSize(selectedFile.file_size)}</span>
                    </div>
                    <div className="team-leader-approval">
                      <strong>Team Leader Approval:</strong> {selectedFile.team_leader_username}
                      {selectedFile.team_leader_comments && (
                        <div className="previous-comment">"{selectedFile.team_leader_comments}"</div>
                      )}
                    </div>
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
                      <h4>🚀 Final approval will:</h4>
                      <ul>
                        <li>Publish the file to the Public Network</li>
                        <li>Generate a public URL for external access</li>
                        <li>Notify the user of successful approval</li>
                        <li>Complete the approval workflow</li>
                      </ul>
                    </div>
                  </div>
                )}

                {reviewAction === 'reject' && (
                  <div className="rejection-info">
                    <div className="info-box danger">
                      <h4>❌ Rejecting this file will:</h4>
                      <ul>
                        <li>Return the file to the user for revision</li>
                        <li>Notify the user of admin rejection</li>
                        <li>Allow the user to resubmit after making changes</li>
                        <li>End the current approval workflow</li>
                      </ul>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">
                    {reviewAction === 'approve' ? 'Final Comments (Optional)' : 'Rejection Reason (Required)'}
                  </label>
                  <textarea
                    value={reviewComments}
                    onChange={(e) => setReviewComments(e.target.value)}
                    placeholder={
                      reviewAction === 'approve' 
                        ? "Add any final comments about the approval..."
                        : "Please explain why you are rejecting this file..."
                    }
                    rows="4"
                    className="form-textarea"
                    required={reviewAction === 'reject'}
                  />
                </div>
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
                    {isProcessing ? 'Processing...' : (reviewAction === 'approve' ? 'Approve & Publish' : 'Reject File')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* File Delete Confirmation Modal */}
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
                    <strong>{fileToDelete.original_name}</strong>
                    <br />
                    Submitted by <strong>{fileToDelete.username}</strong> from <strong>{fileToDelete.user_team}</strong> team
                    <br />
                    Status: <strong>{getStatusText(fileToDelete.status, fileToDelete.current_stage)}</strong>
                  </p>
                  <p className="warning-text">
                    This action cannot be undone. The file and all its associated data (comments, history) will be permanently removed.
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

      {/* ... Other existing modals remain the same ... */}
    </div>
  )
}

export default AdminDashboard