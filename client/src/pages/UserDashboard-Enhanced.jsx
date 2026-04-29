import { useState, useEffect, Suspense, lazy, useCallback, useMemo, memo, startTransition } from 'react'
import { API_BASE_URL } from '@/config/api'
import '../css/UserDashboard.css'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { AlertMessage } from '../components/shared'

// Eagerly import critical components that are always visible
import Sidebar from '../components/user/Sidebar'
import DashboardTab from '../components/user/DashboardTab'
import FileModal from '../components/user/FileModal'

// Lazy load tab components
const TeamTasksTab = lazy(() => import('../components/user/TeamTasksTab'))
const MyFilesTab = lazy(() => import('../components/user/MyFilesTab'))
const NotificationTab = lazy(() => import('../components/user/NotificationTab-RealTime'))
const TasksTab = lazy(() => import('../components/user/TasksTab-Enhanced'))

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

  // Wrap in startTransition so badge updates never block scroll/interaction
  const handleUpdateUnreadCount = useCallback((count) => {
    startTransition(() => setNotificationCount(count))
  }, [])

  // Smart Navigation State
  const [highlightedAssignmentId, setHighlightedAssignmentId] = useState(null)
  const [highlightedFileId, setHighlightedFileId] = useState(null)
  const [notificationCommentContext, setNotificationCommentContext] = useState(null)

  const fetchUserFiles = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/files/user/${user.id}`)
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
  }, [user.id])

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab)
  }, [])

  const clearMessages = useCallback(() => {
    setError('')
    setSuccess('')
  }, [])

  const handleLogout = useCallback(() => {
    onLogout()
  }, [onLogout])

  const onUploadSuccess = useCallback((message) => {
    setSuccess(message)
  }, [])

  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }, [])

  // Notification count is updated by NotificationTab via onUpdateUnreadCount
  // No polling here — avoids duplicate requests running in parallel

  useEffect(() => {
    fetchUserFiles()
  }, [fetchUserFiles])


  useEffect(() => {
    let filtered = files
    if (filterStatus !== 'all') {
      filtered = files.filter(file => {
        switch (filterStatus) {
          case 'pending':
            return (file.current_stage || '').includes('pending')
          case 'approved':
            return file.status === 'final_approved'
          case 'rejected':
            return (file.status || '').includes('rejected')
          default:
            return true
        }
      })
    }
    setFilteredFiles(filtered)
  }, [files, filterStatus])

  const openFileModal = useCallback(async (file) => {
    setSelectedFile(file)
    setShowFileModal(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/files/${file.id}/comments`)
      const data = await response.json()
      if (data.success) {
        setFileComments(data.comments || [])
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
      setFileComments([])
    }
  }, [])

  const openFileByIdFromNotification = useCallback(async (fileId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/files/user/${user.id}`)
      const data = await response.json()
      if (data.success && data.files) {
        const file = data.files.find(f => f.id === parseInt(fileId))
        if (file) {
          setActiveTab('my-files')
          openFileModal(file)
        } else {
          setError('File not found')
        }
      }
    } catch (error) {
      console.error('Error fetching file:', error)
      setError('Failed to connect to server')
    }
  }, [user.id, openFileModal])

  const navigateToTasks = useCallback((assignmentId = null) => {
    setActiveTab('tasks')
    if (assignmentId) {
      setHighlightedAssignmentId(assignmentId)
    }
  }, [])

  const handleSmartNavigation = useCallback((tab, context) => {
    const storedAssignmentId = sessionStorage.getItem('highlightAssignmentId')
    const storedFileId = sessionStorage.getItem('highlightFileId')
    const storedContext = sessionStorage.getItem('notificationContext')

    const mergedContext = {
      ...context,
      assignmentId: context?.assignmentId || (storedAssignmentId ? parseInt(storedAssignmentId) : null),
      fileId: context?.fileId || (storedFileId ? parseInt(storedFileId) : null),
      ...(storedContext ? JSON.parse(storedContext) : {})
    }

    setActiveTab(tab)

    if (mergedContext) {
      if (mergedContext.assignmentId) setHighlightedAssignmentId(mergedContext.assignmentId)
      if (mergedContext.fileId) setHighlightedFileId(mergedContext.fileId)
      if (mergedContext.shouldOpenComments || mergedContext.expandAllReplies) {
        setNotificationCommentContext(mergedContext)
      }
      if (tab === 'my-files' && mergedContext.fileId) {
        openFileByIdFromNotification(mergedContext.fileId)
      }
    }

    sessionStorage.removeItem('highlightAssignmentId')
    sessionStorage.removeItem('highlightFileId')
    sessionStorage.removeItem('notificationContext')
    sessionStorage.removeItem('fromNotificationId')
  }, [openFileByIdFromNotification])

  const handleToastNavigation = useCallback(async (tabName, contextData) => {
    if (tabName === 'my-files' && contextData) {
      await openFileByIdFromNotification(contextData)
    } else if (tabName === 'tasks' && contextData) {
      setActiveTab('tasks')
      sessionStorage.setItem('scrollToAssignment', contextData)
    } else {
      setActiveTab(tabName)
    }
  }, [openFileByIdFromNotification])

  // Stable callbacks for clearing highlights — created once
  const clearHighlight = useCallback(() => setHighlightedAssignmentId(null), [])
  const clearFileHighlight = useCallback(() => setHighlightedFileId(null), [])
  const clearNotificationContext = useCallback(() => setNotificationCommentContext(null), [])

  // filesCount derived without recreating on every render
  const filesCount = useMemo(() =>
    files.filter(f =>
      f.status === 'uploaded' ||
      f.status === 'team_leader_approved' ||
      f.status === 'final_approved'
    ).length
  , [files])

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardTab
            user={user}
            files={files}
            setActiveTab={setActiveTab}
          />
        )
      case 'team-files':
        return (
          <Suspense fallback={<SkeletonLoader type="table" />}>
            <TeamTasksTab user={user} />
          </Suspense>
        )
      case 'my-files':
        return (
          <Suspense fallback={<SkeletonLoader type="myfiles" />}>
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
          </Suspense>
        )
      case 'notification':
        return (
          <Suspense fallback={<SkeletonLoader type="list" />}>
            <NotificationTab
              user={user}
              onOpenFile={openFileByIdFromNotification}
              onNavigateToTasks={navigateToTasks}
              onNavigate={handleSmartNavigation}
              onUpdateUnreadCount={handleUpdateUnreadCount}
            />
          </Suspense>
        )
      case 'tasks':
        return (
          <Suspense fallback={<SkeletonLoader type="table" />}>
            <TasksTab
              user={user}
              highlightedAssignmentId={highlightedAssignmentId}
              highlightedFileId={highlightedFileId}
              notificationCommentContext={notificationCommentContext}
              onClearHighlight={clearHighlight}
              onClearFileHighlight={clearFileHighlight}
              onClearNotificationContext={clearNotificationContext}
            />
          </Suspense>
        )
      default:
        return (
          <DashboardTab
            user={user}
            files={files}
            setActiveTab={handleTabChange}
            onOpenFile={openFileByIdFromNotification}
            onNavigateToTasks={navigateToTasks}
          />
        )
    }
  }

  return (
    <Suspense fallback={<SkeletonLoader type="dashboard" />}>
      <div className="minimal-dashboard user-dashboard">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          filesCount={filesCount}
          notificationCount={notificationCount}
          onLogout={handleLogout}
          user={user}
        />

        {/* Main Content */}
        <div className="main-content">
          <div className="dashboard-content">
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
          </div>
        </div>

        {/* File Details Modal */}
        {showFileModal && (
          <Suspense fallback={<div />}>
            <FileModal
              showFileModal={showFileModal}
              setShowFileModal={setShowFileModal}
              selectedFile={selectedFile}
              fileComments={fileComments}
              formatFileSize={formatFileSize}
            />
          </Suspense>
        )}

        {/* Toast notifications handled inside NotificationTab */}
      </div>
    </Suspense>
  )
}

export default UserDashboard
