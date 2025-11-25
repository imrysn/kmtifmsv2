import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './css/App.css'
import { createLogger } from './utils/secureLogger'
import { apiClient, getAuthToken, clearAuthToken, isAuthenticated } from './config/api'

// Direct imports for faster initial load - NO lazy loading
import Login from './components/Login'
import UserDashboard from './pages/UserDashboard-Enhanced'
import TeamLeaderDashboard from './pages/TeamLeaderDashboard-Refactored'
import AdminDashboard from './pages/AdminDashboard'

const logger = createLogger('App')

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Verify token on mount
  useEffect(() => {
    const verifyAuth = async () => {
      if (!isAuthenticated()) {
        setLoading(false)
        return
      }

      try {
        const response = await apiClient('/api/auth/verify')
        if (response.success) {
          logger.info('User session restored from token')
          setUser(response.user)
        }
      } catch (error) {
        logger.error('Token verification failed', error)
        clearAuthToken()
      } finally {
        setLoading(false)
      }
    }

    verifyAuth()
  }, [])

  // Handle login
  const handleLogin = (userData, token) => {
    logger.logLogin(userData)
    setUser(userData)
    logger.logStateUpdate('User authenticated and saved')
  }

  // Handle logout
  const handleLogout = async () => {
    try {
      await apiClient('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      logger.error('Logout error', error)
    } finally {
      logger.logLogout()
      clearAuthToken()
      setUser(null)
    }
  }

  // Get the appropriate dashboard component based on user's panel type
  const getDashboardComponent = () => {
    if (!user) return null
    
    logger.logNavigation('login', `${user.panelType}-dashboard`)
    
    switch (user.panelType) {
      case 'user':
        return <UserDashboard user={user} onLogout={handleLogout} />
      case 'teamleader':
        return <TeamLeaderDashboard user={user} onLogout={handleLogout} />
      case 'admin':
        return <AdminDashboard user={user} onLogout={handleLogout} />
      default:
        logger.warn('Unknown panel type, defaulting to user dashboard', { panelType: user.panelType })
        return <UserDashboard user={user} onLogout={handleLogout} />
    }
  }

  // Show loading state while verifying authentication
  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <Router>
      <div className="app">
        <Routes>
          <Route 
            path="/login" 
            element={!user ? <Login onLogin={handleLogin} /> : <Navigate to="/dashboard" replace />} 
          />
          <Route 
            path="/dashboard" 
            element={user ? getDashboardComponent() : <Navigate to="/login" replace />} 
          />
          <Route 
            path="/" 
            element={<Navigate to={user ? "/dashboard" : "/login"} replace />} 
          />
        </Routes>
      </div>
    </Router>
  )
}

export default App
