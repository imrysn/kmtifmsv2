import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const NetworkContext = createContext(null)

const API_BASE = process.env.NODE_ENV === 'development'
  ? 'http://localhost:3001'
  : 'http://localhost:3001'

export const NetworkProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true)
  const [isServerAvailable, setIsServerAvailable] = useState(true)
  const [lastChecked, setLastChecked] = useState(null)
  const [checkInterval, setCheckInterval] = useState(30000) // 30 seconds default

  const checkNetworkStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/health`, {
        method: 'GET',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })
      
      const isAvailable = response.ok
      setIsServerAvailable(isAvailable)
      setIsOnline(true)
      setLastChecked(new Date())
      return isAvailable
    } catch (error) {
      console.warn('Network check failed:', error.message)
      setIsServerAvailable(false)
      setIsOnline(navigator.onLine)
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
      setIsOnline(true)
      checkNetworkStatus()
    }
    
    const handleOffline = () => {
      setIsOnline(false)
      setIsServerAvailable(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [checkNetworkStatus])

  const value = {
    isOnline,
    isServerAvailable,
    isConnected: isOnline && isServerAvailable,
    lastChecked,
    checkNetworkStatus,
    setCheckInterval
  }

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
