import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

const NotificationContext = createContext(null)

export const NotificationProvider = ({ children, userId }) => {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const pollingIntervalRef = useRef(null)

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!userId) return

    if (!silent) setIsLoading(true)
    
    try {
      const response = await fetch(
        `http://localhost:3001/api/notifications/user/${userId}?page=1&limit=20`
      )
      const data = await response.json()
      
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
      const response = await fetch(
        `http://localhost:3001/api/notifications/${notificationId}/read`,
        { method: 'PUT' }
      )
      
      const data = await response.json()
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
      const response = await fetch(
        `http://localhost:3001/api/notifications/user/${userId}/read-all`,
        { method: 'PUT' }
      )
      
      const data = await response.json()
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
      const response = await fetch(
        `http://localhost:3001/api/notifications/${notificationId}`,
        { method: 'DELETE' }
      )
      
      const data = await response.json()
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
