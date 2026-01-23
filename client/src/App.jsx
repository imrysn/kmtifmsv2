import React, { useEffect } from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './css/App.css'
import { createLogger } from './utils/secureLogger'
import useStore from './store/useStore'

// Direct imports for faster initial load - NO lazy loading
import Login from './components/Login'
import UserDashboard from './pages/UserDashboard-Enhanced'
import TeamLeaderDashboard from './pages/TeamLeaderDashboard-Refactored'
import AdminDashboard from './pages/AdminDashboard'
import ToastContainer from './components/common/ToastContainer'

const logger = createLogger('App')

function App() {
  // Use Zustand store instead of local state
  const { user, login, logout } = useStore()

  // Log user session restoration
  useEffect(() => {
    if (user) {
      logger.info('User session restored from store')
    }
  }, [])

  // Handle login
  const handleLogin = (userData) => {
    logger.logLogin(userData)
    login(userData)
    logger.logStateUpdate('User authenticated and saved')
  }

  // Handle logout
  const handleLogout = () => {
    logger.logLogout()
    logout()
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
