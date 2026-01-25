import React, { lazy, Suspense, useEffect } from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import './css/App.css'
import { createLogger } from './utils/secureLogger'
import useStore from './store/useStore'
import { queryClient } from './config/queryClient'

// Eager load (always needed)
import Login from './components/Login'
import LoadingSpinner from './components/LoadingSpinner'
import ToastContainer from './components/common/ToastContainer'

// Lazy load dashboards (only when needed)
const UserDashboard = lazy(() => import('./pages/UserDashboard-Enhanced'))
const TeamLeaderDashboard = lazy(() => import('./pages/TeamLeaderDashboard-Refactored'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))

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
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="app">
          {/* Toast notifications - handles ALL notifications including updates */}
          <ToastContainer />

          <Suspense fallback={<LoadingSpinner message="Loading dashboard..." />}>
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
          </Suspense>
        </div>
      </Router>
      {/* React Query DevTools - only in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}

export default App
