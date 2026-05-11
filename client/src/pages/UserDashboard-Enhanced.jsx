import { useState, useEffect, Suspense, lazy, useCallback, useMemo, startTransition, memo } from 'react'
import { apiFetch, API_BASE_URL } from '@/config/api'
import useStore from '../store/useStore'
import '../css/UserDashboard.css'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { AlertMessage, Sidebar } from '../components/shared'

// Eagerly import critical components that are always visible
import DashboardTab from '../components/user/DashboardTab'
import FileModal from '../components/user/FileModal'

// Lazy load tab components
const TeamTasksTab = lazy(() => import('../components/user/TeamTasksTab'))
const MyFilesTab = lazy(() => import('../components/user/MyFilesTab'))
const NotificationTab = lazy(() => import('../components/user/NotificationTab-RealTime'))
const TasksTab = lazy(() => import('../components/user/TasksTab-Enhanced'))

const EMPTY_ARRAY = [];

const UserDashboard = memo(({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // STABILIZED: Use selectors only for critical structural data
  const setFilesCache = useStore(state => state.setFilesCache)
  // Removed notificationCount and filesCache subscriptions from here to prevent re-renders
  
  const [isLoading, setIsLoading] = useState(false) // Initialized as false, fetchUserFiles will handle it
  const [error, setError] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [showFileModal, setShowFileModal] = useState(false)
  const [fileComments, setFileComments] = useState([])

  // Stable callback for unread count updates from children
  const handleUpdateUnreadCount = useCallback((count) => {
    useStore.getState().setGlobalUnreadCount(count)
  }, [])

  // Fetch unread count directly — used by SSE and initial load
  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/notifications/user/${user.id}/unread-count`)
      if (data.success) {
        useStore.getState().setGlobalUnreadCount(data.count || 0)
      }
    } catch (_) {}
  }, [user.id])



  // SSE — instant badge + flash when a new notification arrives (runs regardless of active tab)
  useEffect(() => {
    // Pause global SSE if the notification tab is active, because PremiumNotificationCenter
    // handles its own SSE + fetching, preventing double connections/lag.
    if (activeTab === 'notification') return;

    let es
    let reconnectTimer
    let isMounted = true

    const connect = () => {
      if (!isMounted) return;
      const { token } = useStore.getState()
      const url = `${API_BASE_URL}/api/notifications/user/${user.id}/stream${token ? `?token=${token}` : ''}`
      es = new EventSource(url)
      es.onmessage = (event) => {
        if (event.data === 'ping') fetchUnreadCount()
      }
      es.onerror = () => {
        es.close()
        if (isMounted) {
          reconnectTimer = setTimeout(connect, 5000)
        }
      }
    }
    connect()
    return () => {
      isMounted = false;
      if (es) es.close()
      clearTimeout(reconnectTimer)
    }
  }, [user.id, fetchUnreadCount, activeTab])

  // Smart Navigation State
  const [highlightedAssignmentId, setHighlightedAssignmentId] = useState(null)
  const [highlightedFileId, setHighlightedFileId] = useState(null)
  const [notificationCommentContext, setNotificationCommentContext] = useState(null)

  const fetchUserFiles = useCallback(async () => {
    const currentFiles = useStore.getState().filesCache[user.id]
    if (!currentFiles) setIsLoading(true)
    try {
      const data = await apiFetch(`/api/files/user/${user.id}`)
      if (data.success) {
        setFilesCache(user.id, data.files || [])
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

  // Initial data load
  useEffect(() => {
    fetchUnreadCount()
    fetchUserFiles()
  }, [fetchUnreadCount, fetchUserFiles])

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab)
    setSidebarOpen(false)
  }, [])

  const clearMessages = useCallback(() => {
    setError('')
  }, [])

  const handleLogout = useCallback(() => {
    onLogout()
  }, [onLogout])

  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }, [])

  // Initial load effect handled above
  // Removed redundant useEffect to prevent duplicate calls

  // Sync unread badge + flash to Electron taskbar moved to App.jsx for performance


  const openFileModal = useCallback(async (file) => {
    setSelectedFile(file)
    setShowFileModal(true)
    try {
      const data = await apiFetch(`/api/files/${file.id}/comments`)
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
      const data = await apiFetch(`/api/files/user/${user.id}`)
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

  // STABILIZED: userNavItems no longer depends on notificationCount/filesCount
  // These will be injected by the Sidebar itself to prevent UserDashboard re-renders
  const userNavItems = useMemo(() => [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'notification', label: 'Notifications', icon: 'notifications', type: 'notification' },
    { id: 'my-files', label: 'My Files', icon: 'files', type: 'files' },
    { id: 'tasks', label: 'My Tasks', icon: 'tasks' },
    { id: 'team-files', label: 'Team Tasks', icon: 'team' }
  ], []);

  const files = useStore(state => state.filesCache[user.id] || EMPTY_ARRAY);

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
              filteredFiles={files}
              isLoading={isLoading}
              fetchUserFiles={fetchUserFiles}
              formatFileSize={formatFileSize}
              files={files}
              user={user}
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
      <div className="user-layout">
        <Sidebar
          user={user}
          items={userNavItems}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onLogout={handleLogout}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Content */}
        <div 
          className="main-content"
          style={{ 
            marginLeft: '80px',
            width: 'calc(100% - 80px)'
          }}
        >
          <div className="dashboard-content">
            <AlertMessage
              type="error"
              message={error}
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
});

export default UserDashboard
