import { useState, useEffect, useRef } from 'react'
import anime from 'animejs'
import '../css/UserDashboard.css'

// Import refactored components
import Sidebar from '../components/user/Sidebar'
import AlertMessage from '../components/user/AlertMessage'
import DashboardTab from '../components/user/DashboardTab'
import TeamFilesTab from '../components/user/TeamFilesTab'
import MyFilesTab from '../components/user/MyFilesTab'
import NotificationTab from '../components/user/NotificationTab'
import FileModal from '../components/user/FileModal'
import FileApprovalTabEnhanced from '../components/user/FileApprovalTab-Enhanced'

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
  const [searchQuery, setSearchQuery] = useState('')
  
  const dashboardRef = useRef(null)
  const headerRef = useRef(null)

  useEffect(() => {
    // Simple entrance animation
    if (headerRef.current) {
      anime({
        targets: headerRef.current,
        opacity: [0, 1],
        duration: 400,
        easing: 'easeOutCubic'
      })
    }

    // Animate dashboard cards when they appear
    setTimeout(() => {
      anime({
        targets: '.dashboard-card',
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 400,
        delay: anime.stagger(50, {start: 100}),
        easing: 'easeOutCubic'
      })
    }, 100)
  }, [activeTab]) // Re-run animation when tab changes

  useEffect(() => {
    if (activeTab === 'my-files' || activeTab === 'file-approvals') {
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

  const onWithdrawFile = (fileId) => {
    // Remove the file from the files state
    setFiles(prevFiles => prevFiles.filter(file => file.id !== fileId))
    setSuccess('File withdrawn successfully')
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
        return <TeamFilesTab setActiveTab={setActiveTab} />;
      case 'my-files':
        return (
          <MyFilesTab 
            filteredFiles={filteredFiles}
            isLoading={isLoading}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            setActiveTab={setActiveTab}
            fetchUserFiles={fetchUserFiles}
            formatFileSize={formatFileSize}
            openFileModal={openFileModal}
            files={files}
            user={user}
            onUploadSuccess={onUploadSuccess}
          />
        );
      case 'file-approvals':
        return (
          <FileApprovalTabEnhanced
            user={user}
            files={files}
            isLoading={isLoading}
            formatFileSize={formatFileSize}
            openFileModal={openFileModal}
            onWithdrawFile={onWithdrawFile}
          />
        );
      case 'notification':
        return <NotificationTab user={user} />;
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
    <div className="minimal-dashboard user-dashboard" ref={dashboardRef}>
      <Sidebar 
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        filesCount={files.length}
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
    </div>
  )
}

export default UserDashboard