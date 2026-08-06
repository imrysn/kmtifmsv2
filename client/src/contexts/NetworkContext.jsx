import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { API_BASE_URL } from '@/config/api'

const NetworkContext = createContext(null)

const API_BASE = API_BASE_URL

export const NetworkProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true)
  const [isServerAvailable, setIsServerAvailable] = useState(true)
  const [lastChecked, setLastChecked] = useState(null)
  const [checkInterval, setCheckInterval] = useState(30000) // 30 seconds default

  const checkNetworkStatus = useCallback(async () => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

    try {
      const response = await fetch(`${API_BASE}/api/health`, {
        method: 'GET',
        cache: 'no-cache',
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)

      const isAvailable = response.ok
      setIsServerAvailable(isAvailable)
      setIsOnline(true) // If we can reach the server, we are online
      setLastChecked(new Date())
      return isAvailable
    } catch (error) {
      clearTimeout(timeoutId)
      console.warn('Network check failed:', error.message)
      setIsServerAvailable(false)
      // Do not trust navigator.onLine in restricted LAN environments
      // If we can't reach the server, we just consider it unavailable.
      setLastChecked(new Date())
      return false
    }
  }, [])

  // Initial check on mount
  useEffect(() => {
    checkNetworkStatus()
  }, [checkNetworkStatus])

  // Periodic checks
  useEffect(() => {
    const interval = setInterval(checkNetworkStatus, checkInterval)
    return () => clearInterval(interval)
  }, [checkNetworkStatus, checkInterval])

  // Browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      // Just trigger a check when browser thinks it's online
      checkNetworkStatus()
    }

    const handleOffline = () => {
      // Don't force offline immediately, let the health check decide
      checkNetworkStatus()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [checkNetworkStatus])

  const value = useMemo(() => ({
    isOnline,
    isServerAvailable,
    isConnected: isOnline && isServerAvailable,
    lastChecked,
    checkNetworkStatus,
    setCheckInterval
  }), [isOnline, isServerAvailable, lastChecked, checkNetworkStatus])

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
}

export const useNetwork = () => {
  const context = useContext(NetworkContext)
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider')
  }
  return context
}

export default NetworkContext
