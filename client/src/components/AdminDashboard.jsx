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
  const [settings, setSettings] = useState({
    system: {
      siteName: 'KMTIFMSV2 Admin',
      siteDescription: 'Enterprise User Management System',
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
  const [showUserDeleteModal, setShowUserDeleteModal] = useState(false)
  const [userToDelete, setUserToDelete] = useState(null)
  const [showDeleteLogsModal, setShowDeleteLogsModal] = useState(false)
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
  }, []) // Only run on component mount

  // Handle tab changes and fetch data when needed
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers()
    } else if (activeTab === 'activity-logs') {
      fetchActivityLogs()
    } else if (activeTab === 'file-approval') {
      fetchFiles()
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

  const fetchFiles = async () => {
    setIsLoading(true)
    try {
      // Simulate API call with mock data for now
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
            className={`nav-item ${activeTab === 'file-approval' ? 'active' : ''}`}
            onClick={(e) => { 
              e.preventDefault()
              setActiveTab('file-approval')
              clearMessages()
            }}
          >
            <span className="nav-label">File Approval</span>
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
              <h1>System Overview</h1>
              <p>Welcome back, {user.fullName || 'Administrator'}! Here's your system status.</p>
            </div>
            
            <div className="stats-section">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon users-icon">U</div>
                  <div className="stat-info">
                    <div className="stat-number">{users.length}</div>
                    <div className="stat-label">Total Users</div>
                    <div className="stat-change positive">+2 this week</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon admins-icon">A</div>
                  <div className="stat-info">
                    <div className="stat-number">{users.filter(u => u.role === 'ADMIN').length}</div>
                    <div className="stat-label">Administrators</div>
                    <div className="stat-change neutral">No change</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon leaders-icon">L</div>
                  <div className="stat-info">
                    <div className="stat-number">{users.filter(u => u.role === 'TEAM LEADER').length}</div>
                    <div className="stat-label">Team Leaders</div>
                    <div className="stat-change positive">+1 this month</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon users-only-icon">M</div>
                  <div className="stat-info">
                    <div className="stat-number">{users.filter(u => u.role === 'USER').length}</div>
                    <div className="stat-label">Regular Users</div>
                    <div className="stat-change positive">+1 this week</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="admin-features-section">
              <div className="features-header">
                <h2>Administration Features</h2>
                <p>Comprehensive system management tools</p>
              </div>
              
              <div className="admin-features-grid">
                <div className="admin-feature-card">
                  <div className="feature-header">
                    <div className="feature-icon">UM</div>
                    <h3>User Management</h3>
                  </div>
                  <p>Create, edit, and manage user accounts with role-based permissions and team assignments.</p>
                  <ul>
                    <li>CRUD operations for all users</li>
                    <li>Role assignment and permissions</li>
                    <li>Team organization</li>
                    <li>Password management</li>
                  </ul>
                </div>
                
                <div className="admin-feature-card">
                  <div className="feature-header">
                    <div className="feature-icon">SA</div>
                    <h3>Security & Access</h3>
                  </div>
                  <p>Monitor system access, manage authentication, and maintain security protocols.</p>
                  <ul>
                    <li>Access control management</li>
                    <li>Login monitoring</li>
                    <li>Security audit trails</li>
                    <li>Permission management</li>
                  </ul>
                </div>
                
                <div className="admin-feature-card">
                  <div className="feature-header">
                    <div className="feature-icon">AR</div>
                    <h3>Analytics & Reports</h3>
                  </div>
                  <p>Generate comprehensive reports and analyze system usage patterns and trends.</p>
                  <ul>
                    <li>User activity reports</li>
                    <li>System usage analytics</li>
                    <li>Performance metrics</li>
                    <li>Export capabilities</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* File Management Tab */}
        {activeTab === 'file-management' && (
          <div className="file-management-section">
            <div className="page-header">
              <h1>File Management</h1>
              <p>Browse and manage files and folders in the system directory</p>
            </div>
            
            {/* Navigation Controls */}
            <div className="file-nav-controls">
              {/* Breadcrumb Navigation */}
              <div className="breadcrumb-container">
                <nav className="breadcrumb">
                  {getBreadcrumbs().map((crumb, index) => (
                    <span key={crumb.path} className="breadcrumb-item">
                      {index > 0 && <span className="breadcrumb-separator">/</span>}
                      <button
                        className={`breadcrumb-link ${index === getBreadcrumbs().length - 1 ? 'active' : ''}`}
                        onClick={() => navigateToPath(crumb.path)}
                        disabled={index === getBreadcrumbs().length - 1}
                      >
                        {crumb.name}
                      </button>
                    </span>
                  ))}
                </nav>
              </div>
              
              {/* Search and View Controls */}
              <div className="file-controls-right">
                <div className="file-search">
                  <input
                    type="text"
                    placeholder="Search files and folders..."
                    value={fileManagementSearch}
                    onChange={(e) => setFileManagementSearch(e.target.value)}
                    className="search-input"
                  />
                  {fileManagementSearch && (
                    <button 
                      className="search-clear-btn"
                      onClick={() => setFileManagementSearch('')}
                      title="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>
                
                <div className="view-mode-toggle">
                  <button
                    className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => setViewMode('grid')}
                    title="Grid View"
                  >
                    ☰
                  </button>
                  <button
                    className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                    onClick={() => setViewMode('list')}
                    title="List View"
                  >
                    ≡
                  </button>
                </div>
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
            
            {/* File System Display */}
            <div className="file-system-container">
              {isLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading files...</p>
                </div>
              ) : (
                <>
                  {viewMode === 'grid' ? (
                    <div className="files-grid">
                      {filteredItems.map((item) => (
                        <div
                          key={item.id}
                          className={`file-item ${item.type} ${selectedItems.includes(item.id) ? 'selected' : ''}`}
                          onClick={() => item.type === 'folder' ? navigateToPath(item.path) : null}
                          onDoubleClick={() => item.type === 'file' ? console.log('Open file:', item.name) : null}
                        >
                          <div className="file-icon-container">
                            <div className={`file-icon ${item.type === 'folder' ? 'folder-icon' : 'file-icon-' + (item.fileType || 'unknown')}`}>
                              {item.type === 'folder' ? (
                                item.isParent ? '←' : '📁'
                              ) : (
                                getFileIcon(item.fileType)
                              )}
                            </div>
                            {item.type === 'folder' && !item.isParent && (
                              <div className="folder-overlay"></div>
                            )}
                          </div>
                          <div className="file-info">
                            <div className="file-name" title={item.name}>
                              {item.name}
                            </div>
                            {item.size && (
                              <div className="file-size">{item.size}</div>
                            )}
                            {item.modified && (
                              <div className="file-date">
                                {item.modified.toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="files-list">
                      <table className="files-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Size</th>
                            <th>Type</th>
                            <th>Modified</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredItems.map((item) => (
                            <tr
                              key={item.id}
                              className={`file-row ${item.type} ${selectedItems.includes(item.id) ? 'selected' : ''}`}
                              onClick={() => item.type === 'folder' ? navigateToPath(item.path) : null}
                              onDoubleClick={() => item.type === 'file' ? console.log('Open file:', item.name) : null}
                            >
                              <td className="file-name-cell">
                                <div className="file-name-container">
                                  <div className={`file-icon-small ${item.type === 'folder' ? 'folder-icon' : 'file-icon-' + (item.fileType || 'unknown')}`}>
                                    {item.type === 'folder' ? (
                                      item.isParent ? '←' : '📁'
                                    ) : (
                                      getFileIcon(item.fileType)
                                    )}
                                  </div>
                                  <span className="file-name">{item.name}</span>
                                </div>
                              </td>
                              <td className="file-size-cell">
                                {item.size || (item.type === 'folder' ? '--' : '')}
                              </td>
                              <td className="file-type-cell">
                                {item.type === 'folder' ? 'Folder' : (item.fileType?.toUpperCase() || 'File')}
                              </td>
                              <td className="file-date-cell">
                                {item.modified ? item.modified.toLocaleString() : '--'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  
                  {!isLoading && filteredItems.length === 0 && (
                    <div className="empty-state">
                      <h3>No files found</h3>
                      <p>This directory is empty or no files match your search criteria.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* User Management Tab */}
        {activeTab === 'users' && (
          <div className="users-management">
            <div className="page-header">
              <h1>User Management</h1>
              <p>Manage system users, roles, and permissions</p>
            </div>
            
            {/* Action Bar */}
            <div className="action-bar">
              <div className="search-section">
                <div className="search-container">
                  <input
                    type="text"
                    placeholder="Search users by name, email, role, or team..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                  />
                </div>
              </div>
              
              <div className="action-buttons">
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    setError('')
                    setSuccess('')
                    setSelectedUser(null)
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
                        <th>Username</th>
                        <th>Email</th>
                        <th>Password</th>
                        <th>Role</th>
                        <th>Team</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="user-row">
                          <td>
                            <div className="user-cell">
                              <div className="user-avatar">{user.fullName.charAt(0).toUpperCase()}</div>
                              <span className="user-name">{user.fullName}</span>
                            </div>
                          </td>
                          <td>{user.username}</td>
                          <td className="email-cell">{user.email}</td>
                          <td>
                            <div className="password-cell">
                              <span className="password-hidden">••••••••</span>
                              <button 
                                className="password-reset-btn"
                                onClick={() => openPasswordModal(user)}
                                title="Reset Password"
                              >
                                Reset
                              </button>
                            </div>
                          </td>
                          <td>
                            <span className={`role-badge ${user.role.toLowerCase().replace(' ', '-')}`}>
                              {user.role}
                            </span>
                          </td>
                          <td>
                            <span className="team-badge">{user.team}</span>
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
          </div>
        )}

        {/* File Approval Tab */}
        {activeTab === 'file-approval' && (
          <div className="file-approval-section">
            <div className="page-header">
              <h1>File Approval</h1>
              <p>Review and manage submitted files requiring approval</p>
            </div>
            
            {/* Status Cards */}
            <div className="file-status-cards">
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
              <div className="file-filters">
                <select
                  value={fileFilter}
                  onChange={(e) => setFileFilter(e.target.value)}
                  className="form-select"
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
                  placeholder="Search files by name, user, or team..."
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
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="settings-section">
            <div className="page-header">
              <h1>System Settings</h1>
              <p>Configure system preferences, security, and administrative options</p>
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
            
            <div className="settings-grid">
              {/* System Settings */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-icon system-icon">SY</div>
                  <h3>System Configuration</h3>
                </div>
                <div className="settings-card-body">
                  <div className="form-group">
                    <label>Site Name</label>
                    <input
                      type="text"
                      value={settings.system.siteName}
                      onChange={(e) => handleSettingsChange('system', 'siteName', e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Site Description</label>
                    <textarea
                      value={settings.system.siteDescription}
                      onChange={(e) => handleSettingsChange('system', 'siteDescription', e.target.value)}
                      className="form-textarea"
                      rows="3"
                    />
                  </div>
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings.system.maintenanceMode}
                        onChange={(e) => handleSettingsChange('system', 'maintenanceMode', e.target.checked)}
                        className="form-checkbox"
                      />
                      <span>Maintenance Mode</span>
                    </label>
                    <p className="help-text">Enable maintenance mode to prevent user access</p>
                  </div>
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings.system.debugMode}
                        onChange={(e) => handleSettingsChange('system', 'debugMode', e.target.checked)}
                        className="form-checkbox"
                      />
                      <span>Debug Mode</span>
                    </label>
                    <p className="help-text">Enable detailed logging and error reporting</p>
                  </div>
                </div>
              </div>
              
              {/* Security Settings */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-icon security-icon">SE</div>
                  <h3>Security & Authentication</h3>
                </div>
                <div className="settings-card-body">
                  <div className="form-group">
                    <label>Session Timeout (minutes)</label>
                    <input
                      type="number"
                      value={settings.security.sessionTimeout}
                      onChange={(e) => handleSettingsChange('security', 'sessionTimeout', parseInt(e.target.value))}
                      min="5"
                      max="1440"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Minimum Password Length</label>
                    <input
                      type="number"
                      value={settings.security.passwordMinLength}
                      onChange={(e) => handleSettingsChange('security', 'passwordMinLength', parseInt(e.target.value))}
                      min="4"
                      max="50"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Max Login Attempts</label>
                    <input
                      type="number"
                      value={settings.security.maxLoginAttempts}
                      onChange={(e) => handleSettingsChange('security', 'maxLoginAttempts', parseInt(e.target.value))}
                      min="1"
                      max="20"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings.security.requireTwoFactor}
                        onChange={(e) => handleSettingsChange('security', 'requireTwoFactor', e.target.checked)}
                        className="form-checkbox"
                      />
                      <span>Require Two-Factor Authentication</span>
                    </label>
                    <p className="help-text">Require 2FA for all admin accounts</p>
                  </div>
                </div>
              </div>
              
              {/* Notifications */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-icon notifications-icon">NO</div>
                  <h3>Notifications</h3>
                </div>
                <div className="settings-card-body">
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings.notifications.emailNotifications}
                        onChange={(e) => handleSettingsChange('notifications', 'emailNotifications', e.target.checked)}
                        className="form-checkbox"
                      />
                      <span>Email Notifications</span>
                    </label>
                  </div>
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings.notifications.loginAlerts}
                        onChange={(e) => handleSettingsChange('notifications', 'loginAlerts', e.target.checked)}
                        className="form-checkbox"
                      />
                      <span>Login Alerts</span>
                    </label>
                    <p className="help-text">Notify on suspicious login activities</p>
                  </div>
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings.notifications.userRegistrationAlerts}
                        onChange={(e) => handleSettingsChange('notifications', 'userRegistrationAlerts', e.target.checked)}
                        className="form-checkbox"
                      />
                      <span>User Registration Alerts</span>
                    </label>
                  </div>
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings.notifications.systemAlerts}
                        onChange={(e) => handleSettingsChange('notifications', 'systemAlerts', e.target.checked)}
                        className="form-checkbox"
                      />
                      <span>System Alerts</span>
                    </label>
                    <p className="help-text">Notify on system errors and warnings</p>
                  </div>
                </div>
              </div>
              
              {/* Backup Settings */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-icon backup-icon">BA</div>
                  <h3>Backup & Maintenance</h3>
                </div>
                <div className="settings-card-body">
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings.backup.autoBackup}
                        onChange={(e) => handleSettingsChange('backup', 'autoBackup', e.target.checked)}
                        className="form-checkbox"
                      />
                      <span>Automatic Backups</span>
                    </label>
                  </div>
                  <div className="form-group">
                    <label>Backup Frequency</label>
                    <select
                      value={settings.backup.backupFrequency}
                      onChange={(e) => handleSettingsChange('backup', 'backupFrequency', e.target.value)}
                      className="form-select"
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Retention Period (days)</label>
                    <input
                      type="number"
                      value={settings.backup.retentionDays}
                      onChange={(e) => handleSettingsChange('backup', 'retentionDays', parseInt(e.target.value))}
                      min="1"
                      max="365"
                      className="form-input"
                    />
                  </div>
                  <div className="backup-actions">
                    <button 
                      className="btn btn-secondary"
                      onClick={handleExportDatabase}
                    >
                      Export Database
                    </button>
                    <button 
                      className="btn btn-danger"
                      onClick={handleResetDatabase}
                    >
                      Reset Database
                    </button>
                  </div>
                </div>
              </div>
              
              {/* System Information */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-icon info-icon">IN</div>
                  <h3>System Information</h3>
                </div>
                <div className="settings-card-body">
                  <div className="system-info">
                    <div className="info-row">
                      <span className="info-label">Application Version:</span>
                      <span className="info-value">v2.0.0</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Database Version:</span>
                      <span className="info-value">SQLite 3.45.0</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Node.js Version:</span>
                      <span className="info-value">{typeof process !== 'undefined' ? process.version : 'v20.x.x'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Uptime:</span>
                      <span className="info-value">2 days, 14 hours</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Total Users:</span>
                      <span className="info-value">{users.length}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Active Sessions:</span>
                      <span className="info-value">5</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Application Settings */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-icon app-icon">AP</div>
                  <h3>Application Settings</h3>
                </div>
                <div className="settings-card-body">
                  <div className="form-group">
                    <label>Theme Preference</label>
                    <select className="form-select">
                      <option value="auto">Auto (System)</option>
                      <option value="light">Light Mode</option>
                      <option value="dark">Dark Mode</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Date Format</label>
                    <select className="form-select">
                      <option value="US">MM/DD/YYYY</option>
                      <option value="EU">DD/MM/YYYY</option>
                      <option value="ISO">YYYY-MM-DD</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Time Zone</label>
                    <select className="form-select">
                      <option value="UTC">UTC</option>
                      <option value="local">Local Time</option>
                      <option value="PST">Pacific Time</option>
                      <option value="EST">Eastern Time</option>
                    </select>
                  </div>
                </div>
              </div>
              
              {/* File Management Settings */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-icon file-mgmt-icon">FM</div>
                  <h3>File Management</h3>
                </div>
                <div className="settings-card-body">
                  <div className="form-group">
                    <label>Root Directory Path</label>
                    <input
                      type="text"
                      value={settings.fileManagement.rootDirectory}
                      onChange={(e) => handleSettingsChange('fileManagement', 'rootDirectory', e.target.value)}
                      placeholder="/home/admin/files"
                      className="form-input"
                    />
                    <p className="help-text">Base directory for file management system</p>
                  </div>
                  <div className="form-group">
                    <label>Maximum File Size</label>
                    <select
                      value={settings.fileManagement.maxFileSize}
                      onChange={(e) => handleSettingsChange('fileManagement', 'maxFileSize', e.target.value)}
                      className="form-select"
                    >
                      <option value="10MB">10 MB</option>
                      <option value="50MB">50 MB</option>
                      <option value="100MB">100 MB</option>
                      <option value="500MB">500 MB</option>
                      <option value="1GB">1 GB</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings.fileManagement.showHiddenFiles}
                        onChange={(e) => handleSettingsChange('fileManagement', 'showHiddenFiles', e.target.checked)}
                        className="form-checkbox"
                      />
                      <span>Show Hidden Files</span>
                    </label>
                    <p className="help-text">Display files starting with dot (.)</p>
                  </div>
                  <div className="form-group">
                    <label>Allowed File Extensions</label>
                    <textarea
                      value={settings.fileManagement.allowedExtensions.join(', ')}
                      onChange={(e) => {
                        const extensions = e.target.value.split(',').map(ext => ext.trim()).filter(ext => ext)
                        handleSettingsChange('fileManagement', 'allowedExtensions', extensions)
                      }}
                      placeholder=".pdf, .doc, .docx, .jpg, .png"
                      className="form-textarea"
                      rows="2"
                    />
                    <p className="help-text">Comma-separated list of allowed file extensions</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Save Settings Action */}
            <div className="settings-actions">
              <button 
                className="btn btn-primary btn-large"
                onClick={handleSaveSettings}
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : 'Save All Settings'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New User</h3>
              <button onClick={() => setShowAddModal(false)} className="modal-close">×</button>
            </div>
            <form onSubmit={handleAddUser}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={e => setFormData({...formData, fullName: e.target.value})}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Username *</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={e => setFormData({...formData, username: e.target.value})}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Password *</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      required
                      minLength="6"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Role *</label>
                    <select
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value})}
                      className="form-select"
                    >
                      <option value="USER">User</option>
                      <option value="TEAM LEADER">Team Leader</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Team</label>
                    <input
                      type="text"
                      value={formData.team}
                      onChange={e => setFormData({...formData, team: e.target.value})}
                      placeholder="General"
                      className="form-input"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)} 
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit User</h3>
              <button onClick={() => setShowEditModal(false)} className="modal-close">×</button>
            </div>
            <form onSubmit={handleEditUser}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={e => setFormData({...formData, fullName: e.target.value})}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Username *</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={e => setFormData({...formData, username: e.target.value})}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Role *</label>
                    <select
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value})}
                      className="form-select"
                    >
                      <option value="USER">User</option>
                      <option value="TEAM LEADER">Team Leader</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Team</label>
                    <input
                      type="text"
                      value={formData.team}
                      onChange={e => setFormData({...formData, team: e.target.value})}
                      placeholder="General"
                      className="form-input"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={() => setShowEditModal(false)} 
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Updating...' : 'Update User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reset Password</h3>
              <button onClick={() => setShowPasswordModal(false)} className="modal-close">×</button>
            </div>
            <form onSubmit={handleResetPassword}>
              <div className="modal-body">
                <div className="form-group">
                  <label>User: <strong>{selectedUser.fullName} ({selectedUser.username})</strong></label>
                </div>
                <div className="form-group">
                  <label>New Password *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    required
                    minLength="6"
                    placeholder="Enter new password"
                    className="form-input"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={() => setShowPasswordModal(false)} 
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* User Delete Confirmation Modal */}
      {showUserDeleteModal && userToDelete && (
        <div className="modal-overlay" onClick={() => setShowUserDeleteModal(false)}>
          <div className="modal delete-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete User</h3>
              <button onClick={() => setShowUserDeleteModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="delete-warning">
                <div className="warning-icon">⚠️</div>
                <div className="warning-content">
                  <h4>Are you sure you want to delete this user?</h4>
                  <p className="file-info">
                    <strong>{userToDelete.fullName}</strong>
                    <br />
                    Username: <strong>{userToDelete.username}</strong>
                    <br />
                    Email: <strong>{userToDelete.email}</strong>
                    <br />
                    Role: <strong>{userToDelete.role}</strong> | Team: <strong>{userToDelete.team}</strong>
                  </p>
                  <p className="warning-text">
                    This action cannot be undone. The user account and all associated data will be permanently removed from the system.
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <div className="delete-actions">
                <button 
                  type="button" 
                  onClick={() => setShowUserDeleteModal(false)} 
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleDeleteUser}
                  className="btn btn-danger" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Deleting...' : 'Delete User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                    <strong>{filteredLogs.length} log(s)</strong> matching your search criteria will be deleted:
                    <br />
                    Search term: <strong>"{logsSearchQuery}"</strong>
                  </p>
                  <p className="warning-text">
                    This action cannot be undone. The selected activity logs will be permanently removed from the system.
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

export default AdminDashboard