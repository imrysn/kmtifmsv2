import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from '@/config/api'

const NotificationContext = createContext(null)

// Helper: update Electron taskbar badge + flash the app icon
const updateElectronBadge = (unreadCount) => {
  if (!window.electron) return
  // Badge: shows red circle with count on taskbar icon
  if (typeof window.electron.setBadge === 'function') {
    window.electron.setBadge(unreadCount)
  }
  // Flash: makes the taskbar icon flash only when window is NOT focused
  if (typeof window.electron.flashFrame === 'function') {
    window.electron.flashFrame(unreadCount > 0)
  }
}

export const NotificationProvider = ({ children, userId }) => {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const pollingIntervalRef = useRef(null)

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!userId) return

    if (!silent) setIsLoading(true)

    try {
      const data = await apiFetch(
        `/api/notifications/user/${userId}?page=1&limit=20`
      )

      if (data.success) {
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [userId])

  const markAsRead = useCallback(async (notificationId) => {
    try {
      const data = await apiFetch(
        `/api/notifications/${notificationId}/read`,
        { method: 'PUT' }
      )
      if (data.success) {
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    if (!userId) return

    try {
      const data = await apiFetch(
        `/api/notifications/user/${userId}/read-all`,
        { method: 'PUT' }
      )
      if (data.success) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }, [userId])

  const deleteNotification = useCallback(async (notificationId) => {
    try {
      const data = await apiFetch(
        `/api/notifications/${notificationId}`,
        { method: 'DELETE' }
      )
      if (data.success) {
        const deletedNotification = notifications.find(n => n.id === notificationId)
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
        if (deletedNotification && !deletedNotification.is_read) {
          setUnreadCount(prev => Math.max(0, prev - 1))
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }, [notifications])

  const startPolling = useCallback((interval = 30000) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    pollingIntervalRef.current = setInterval(() => {
      fetchNotifications(true)
    }, interval)
  }, [fetchNotifications])

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }, [])

  // Initial fetch and start polling
  useEffect(() => {
    if (userId) {
      fetchNotifications()
      startPolling()
    }

    return () => stopPolling()
  }, [userId, fetchNotifications, startPolling, stopPolling])

  // Sync unread count to Electron taskbar badge + icon flash
  useEffect(() => {
    updateElectronBadge(unreadCount)
  }, [unreadCount])

  const value = {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    startPolling,
    stopPolling
  }

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

export default NotificationContext
