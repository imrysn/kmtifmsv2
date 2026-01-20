import React, { useState } from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './css/App.css'
import { createLogger } from './utils/secureLogger'

// Direct imports for faster initial load - NO lazy loading
import Login from './components/Login'
import UserDashboard from './pages/UserDashboard-Enhanced'
import TeamLeaderDashboard from './pages/TeamLeaderDashboard-Refactored'
import AdminDashboard from './pages/AdminDashboard'
import ToastContainer from './components/common/ToastContainer'

const logger = createLogger('App')

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser)
        logger.info('User session restored from localStorage')
        return userData
      } catch (error) {
        logger.error('Error parsing saved user', error)
        localStorage.removeItem('user')
        return null
      }
    }
    return null
  })

  // Handle login
  const handleLogin = (userData) => {
    logger.logLogin(userData)
    setUser(userData)
    localStorage.setItem('user', JSON.stringify(userData))
    logger.logStateUpdate('User authenticated and saved')
  }

  // Handle logout
  const handleLogout = () => {
    logger.logLogout()
    setUser(null)
    localStorage.removeItem('user')
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

  return (
    <Router>
      <div className="app">
        {/* Toast notifications - handles ALL notifications including updates */}
        <ToastContainer />

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
