import { useState, useEffect, Suspense } from 'react'
import '../css/UserDashboard.css'
import SkeletonLoader from '../components/common/SkeletonLoader'

// Import refactored components
import Sidebar from '../components/user/Sidebar'
import AlertMessage from '../components/user/AlertMessage'
import DashboardTab from '../components/user/DashboardTab'
import TeamTasksTab from '../components/user/TeamTasksTab'
import MyFilesTab from '../components/user/MyFilesTab'
import NotificationTab from '../components/user/NotificationTab-RealTime'
import TasksTab from '../components/user/TasksTab-Enhanced'
import FileModal from '../components/user/FileModal'
import ToastNotification from '../components/user/ToastNotification'

const UserDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [files, setFiles] = useState([])
  const [filteredFiles, setFilteredFiles] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [showFileModal, setShowFileModal] = useState(false)
  const [fileComments, setFileComments] = useState([])
  const [filterStatus, setFilterStatus] = useState('all')
  const [notificationCount, setNotificationCount] = useState(0)
  const [notifications, setNotifications] = useState([])

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

  useEffect(() => {
    // Fetch notifications
    const fetchNotifications = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/notifications/user/${user.id}`)
        const data = await response.json()
        if (data.success) {
          setNotificationCount(data.unreadCount || 0)
          setNotifications(data.notifications || [])
        }
      } catch (error) {
        console.error('Error fetching notifications:', error)
      }
    }

    fetchNotifications()
    const interval = setInterval(fetchNotifications, 5000)
    return () => clearInterval(interval)
  }, [user.id])

  useEffect(() => {
    // Fetch files on component mount
    fetchUserFiles()
  }, [user.id])

  useEffect(() => {
    if (activeTab === 'my-files') {
      fetchUserFiles()
    }
  }, [activeTab, user.id])

  useEffect(() => {
    applyFilters()
  }, [files, filterStatus])

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

    // Apply search filter - REMOVED since search bar is removed

    setFilteredFiles(filtered)
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

  const openFileByIdFromNotification = async (fileId) => {
    try {
      // Fetch the specific file
      const response = await fetch(`http://localhost:3001/api/files/user/${user.id}`)
      const data = await response.json()

      
      if (data.success && data.files) {
        const file = data.files.find(f => f.id === parseInt(fileId))
        
        if (file) {
          // Switch to My Files tab
          setActiveTab('my-files')
          // Small delay to ensure tab switches before opening modal
          setTimeout(async () => {
            await openFileModal(file)
          }, 100);
        } else {
          setError('File not found in your files')
        }
      } else {
        setError('Failed to fetch file details')
      }
    } catch (error) {
      console.error('Error fetching file:', error)
      setError('Failed to connect to server')
    }
  }

  const navigateToTasks = (assignmentId = null) => {
    setActiveTab('tasks')
    // Store the assignment ID to scroll to after tab switch
    if (assignmentId) {
      sessionStorage.setItem('scrollToAssignment', assignmentId)
    }
  }

  const handleToastNavigation = async (tabName, contextData) => {
    
    if (tabName === 'my-files' && contextData) {
      // For file notifications, open the file modal directly
      await openFileByIdFromNotification(contextData);
    } else if (tabName === 'tasks' && contextData) {
      // For task/assignment notifications
      setActiveTab('tasks');
      sessionStorage.setItem('scrollToAssignment', contextData);
    } else {
      // Default tab navigation
      setActiveTab(tabName);
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

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    clearMessages()
  }

  const handleLogout = () => {
    onLogout()
  }

  const onUploadSuccess = (message) => {
    setSuccess(message)
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardTab 
            user={user}
            files={files}
            setActiveTab={setActiveTab}
          />
        );
      case 'team-files':
        return <TeamTasksTab user={user} />;
      case 'my-files':
        return (
          <MyFilesTab 
            filteredFiles={filteredFiles}
            isLoading={isLoading}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            setActiveTab={setActiveTab}
            fetchUserFiles={fetchUserFiles}
            formatFileSize={formatFileSize}
            openFileModal={openFileModal}
            files={files}
            user={user}
            onUploadSuccess={onUploadSuccess}
          />
        );
      case 'notification':
        return (
          <NotificationTab 
            user={user} 
            onOpenFile={openFileByIdFromNotification}
            onNavigateToTasks={navigateToTasks}
          />
        );
      case 'tasks':
        return <TasksTab user={user} />;
      default:
        return (
          <DashboardTab
            user={user}
            files={files}
            setActiveTab={setActiveTab}
          />
        );
    }
  };

  return (
    <Suspense fallback={<SkeletonLoader type="dashboard" />}>
      <div className="minimal-dashboard user-dashboard">
      <Sidebar 
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        filesCount={files.filter(f => f.status === 'uploaded' || f.status === 'team_leader_approved' || f.status === 'final_approved').length}
        notificationCount={notificationCount}
        onLogout={handleLogout}
        user={user}
      />

      {/* Main Content */}
      <div className="main-content">
        <div className="dashboard-content">
          {/* Alert Messages */}
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

          {/* Render Active Tab */}
          {renderActiveTab()}
        </div>
      </div>

      {/* File Details Modal */}
      <FileModal 
        showFileModal={showFileModal}
        setShowFileModal={setShowFileModal}
        selectedFile={selectedFile}
        fileComments={fileComments}
        formatFileSize={formatFileSize}
      />

      {/* Toast Notifications */}
      <ToastNotification 
        notifications={notifications}
        onNavigate={handleToastNavigation}
      />
      </div>
    </Suspense>
  )
}

export default UserDashboard
