import { useState, useEffect, Suspense, lazy, useCallback, useMemo, startTransition, useRef } from 'react'
import { apiFetch, API_BASE_URL } from '@/config/api'
import useStore from '../store/useStore'
import '../css/UserDashboard.css'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { AlertMessage } from '../components/shared'
import OnlineMembersPanel from '../components/shared/OnlineMembersPanel'
import BroadcastAlert from '../components/shared/BroadcastAlert'
import { BroadcastModal } from '../components/admin/modals'

// Sync unread count to Electron taskbar badge + icon flash
const syncElectronBadge = (count) => {
  if (!window.electron) return
  if (typeof window.electron.setBadge === 'function') window.electron.setBadge(count)
  if (typeof window.electron.flashFrame === 'function') window.electron.flashFrame(count > 0)
}

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
  const [visitedTabs, setVisitedTabs] = useState(new Set(['dashboard']))
  const [files, setFiles] = useState([])
  const [activeBroadcast, setActiveBroadcast] = useState(null)
  const [broadcastQueue, setBroadcastQueue] = useState([])
  const seenBroadcasts = useRef(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [showFileModal, setShowFileModal] = useState(false)
  const [fileComments, setFileComments] = useState([])
  const [notificationCount, setNotificationCount] = useState(0)
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)

  // Wrap in startTransition so badge updates never block scroll/interaction
  const handleUpdateUnreadCount = useCallback((count) => {
    startTransition(() => setNotificationCount(count))
  }, [])

  // Fetch unread count directly — used by SSE and initial load
  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/notifications/user/${user.id}/unread-count`)
      if (data.success) {
        startTransition(() => setNotificationCount(data.count || 0))
      }
    } catch (_) { }
  }, [user.id])

  // SSE — instant badge + flash when a new notification arrives (runs regardless of active tab)
  useEffect(() => {
    fetchUnreadCount() // get initial count on mount

    // Fetch full user profile to ensure ledTeams are updated in the store
    apiFetch('/api/users/profile').then(data => {
      if (data.success && data.user) {
        useStore.getState().updateUser(data.user)
      }
    }).catch(err => console.error('Failed to fetch user profile:', err))

    // Fetch offline broadcasts
    const fetchOfflineBroadcasts = async () => {
      try {
        const data = await apiFetch(`/api/notifications/user/${user.id}/unread-broadcasts`);
        if (data.success && data.broadcasts?.length > 0) {
          const formatted = data.broadcasts.map(b => ({
            id: b.id,
            title: b.title,
            message: b.message,
            senderId: b.action_by_id,
            senderName: b.action_by_username
          }));
          setBroadcastQueue(prev => {
            const newItems = formatted.filter(f => !seenBroadcasts.current.has(f.id));
            newItems.forEach(f => seenBroadcasts.current.add(f.id));
            return [...prev, ...newItems];
          });
        }
      } catch (err) {
        console.error('Error fetching unread broadcasts:', err);
      }
    };
    if (user?.id) fetchOfflineBroadcasts();

    let es
    let reconnectTimer
    const connect = () => {
      const { token } = useStore.getState()
      const url = `${API_BASE_URL}/api/notifications/user/${user.id}/stream${token ? `?token=${token}` : ''}`
      es = new EventSource(url)
      es.onmessage = (event) => {
        if (event.data === 'ping') {
          fetchUnreadCount()
        } else {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'broadcast') {
              setBroadcastQueue(prev => {
                if (seenBroadcasts.current.has(data.id)) return prev;
                seenBroadcasts.current.add(data.id);
                return [...prev, {
                  id: data.id,
                  title: data.title, 
                  message: data.message,
                  senderId: data.senderId,
                  senderName: data.senderName
                }];
              });
            }
          } catch (e) { }
        }
      }
      es.onerror = () => {
        es.close()
        reconnectTimer = setTimeout(connect, 5000)
      }
    }
    connect()
    return () => {
      if (es) es.close()
      clearTimeout(reconnectTimer)
    }
  }, [user.id, fetchUnreadCount])

  useEffect(() => {
    if (!activeBroadcast && broadcastQueue.length > 0) {
      setActiveBroadcast(broadcastQueue[0]);
      setBroadcastQueue(prev => prev.slice(1));
    }
  }, [activeBroadcast, broadcastQueue])

  // Smart Navigation State
  const [highlightedAssignmentId, setHighlightedAssignmentId] = useState(null)
  const [highlightedFileId, setHighlightedFileId] = useState(null)
  const [highlightedFileStatus, setHighlightedFileStatus] = useState(null)
  const [notificationCommentContext, setNotificationCommentContext] = useState(null)

  const fetchUserFiles = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await apiFetch(`/api/files/user/${user.id}`)
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
    startTransition(() => {
      setActiveTab(tab)
      setVisitedTabs(prev => {
        const newSet = new Set(prev)
        newSet.add(tab)
        return newSet
      })
    })
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

  useEffect(() => {
    fetchUserFiles()
  }, [fetchUserFiles])

  // Sync unread badge + flash to Electron taskbar whenever count changes
  useEffect(() => {
    syncElectronBadge(notificationCount)
  }, [notificationCount])

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

  const [taskInitialTab, setTaskInitialTab] = useState(null) // 'for-checking' | null
  const clearInitialTab = useCallback(() => setTaskInitialTab(null), [])

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
      if (mergedContext.forChecking || mergedContext.initialTab === 'for-checking') setTaskInitialTab('for-checking')
      if (mergedContext.assignmentId) setHighlightedAssignmentId(mergedContext.assignmentId)
      if (mergedContext.fileId) setHighlightedFileId(mergedContext.fileId)
      if (mergedContext.fileStatus) setHighlightedFileStatus(mergedContext.fileStatus)
      if (mergedContext.shouldOpenComments || mergedContext.expandAllReplies) {
        setNotificationCommentContext(mergedContext)
      }
    }

    sessionStorage.removeItem('highlightAssignmentId')
    sessionStorage.removeItem('highlightFileId')
    sessionStorage.removeItem('notificationContext')
    sessionStorage.removeItem('fromNotificationId')
  }, [])

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
  const clearFileHighlight = useCallback(() => {
    setHighlightedFileId(null)
    setHighlightedFileStatus(null)
  }, [])
  const clearNotificationContext = useCallback(() => setNotificationCommentContext(null), [])

  // filesCount derived without recreating on every render
  const filesCount = useMemo(() =>
    files.filter(f =>
      f.status === 'uploaded' ||
      f.status === 'team_leader_approved' ||
      f.status === 'final_approved'
    ).length
    , [files])

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
          setShowBroadcastModal={setShowBroadcastModal}
        />

        {/* Main Content */}
        <div className="main-content">
          {/* Online Members Panel — top right */}
          <div style={{ position: 'fixed', top: '16px', right: '24px', zIndex: 1000 }}>
            <OnlineMembersPanel user={user} />
          </div>

          <div className="dashboard-content">
            <AlertMessage
              type="error"
              message={error}
              onClose={clearMessages}
            />

            <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none', height: '100%' }}>
              {visitedTabs.has('dashboard') && (
                <DashboardTab
                  user={user}
                  files={files}
                  setActiveTab={setActiveTab}
                />
              )}
            </div>
            
            <div style={{ display: activeTab === 'team-files' ? 'block' : 'none', height: '100%' }}>
              {visitedTabs.has('team-files') && (
                <Suspense fallback={<SkeletonLoader type="table" />}>
                  <TeamTasksTab user={user} />
                </Suspense>
              )}
            </div>

            <div style={{ display: activeTab === 'my-files' ? 'block' : 'none', height: '100%' }}>
              {visitedTabs.has('my-files') && (
                <Suspense fallback={<SkeletonLoader type="myfiles" />}>
                  <MyFilesTab
                    filteredFiles={files}
                    isLoading={isLoading}
                    fetchUserFiles={fetchUserFiles}
                    formatFileSize={formatFileSize}
                    files={files}
                    user={user}
                    highlightFileId={highlightedFileId}
                    onClearFileHighlight={clearFileHighlight}
                  />
                </Suspense>
              )}
            </div>

            <div style={{ display: activeTab === 'notification' ? 'block' : 'none', height: '100%' }}>
              {visitedTabs.has('notification') && (
                <Suspense fallback={<SkeletonLoader type="list" />}>
                  <NotificationTab
                    user={user}
                    onOpenFile={openFileByIdFromNotification}
                    onNavigateToTasks={navigateToTasks}
                    onNavigate={handleSmartNavigation}
                    onUpdateUnreadCount={handleUpdateUnreadCount}
                  />
                </Suspense>
              )}
            </div>

            <div style={{ display: activeTab === 'tasks' ? 'block' : 'none', height: '100%' }}>
              {visitedTabs.has('tasks') && (
                <Suspense fallback={<SkeletonLoader type="table" />}>
                  <TasksTab
                    user={user}
                    highlightedAssignmentId={highlightedAssignmentId}
                    highlightedFileId={highlightedFileId}
                    highlightedFileStatus={highlightedFileStatus}
                    notificationCommentContext={notificationCommentContext}
                    onClearHighlight={clearHighlight}
                    onClearFileHighlight={clearFileHighlight}
                    onClearNotificationContext={clearNotificationContext}
                    initialTab={taskInitialTab}
                    onClearInitialTab={clearInitialTab}
                  />
                </Suspense>
              )}
            </div>
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

      {activeBroadcast && (
        <BroadcastAlert
          broadcast={activeBroadcast}
          remainingCount={broadcastQueue.length}
          onClose={() => {
            if (activeBroadcast?.id) {
              apiFetch(`/api/notifications/${activeBroadcast.id}/read`, { method: 'PUT' }).catch(console.error);
            }
            setActiveBroadcast(null);
          }}
        />
      )}
      {showBroadcastModal && (
        <BroadcastModal 
          isOpen={showBroadcastModal} 
          onClose={() => setShowBroadcastModal(false)}
          onSuccess={() => {
            // Optional success handling
          }}
        />
      )}
    </Suspense>
  )
}

export default UserDashboard
