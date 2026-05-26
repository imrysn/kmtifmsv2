import React, { lazy, Suspense, useEffect, useState, useRef } from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import './css/App.css'
import { createLogger } from './utils/secureLogger'
import useStore from './store/useStore'
import { queryClient } from './config/queryClient'
import { API_BASE_URL } from './config/api'

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
  const { user, login, logout, _hasHydrated } = useStore()

  // ── DB-ready gate ──────────────────────────────────────────────────────
  // Poll /api/health until MySQL is connected before letting the dashboard
  // fire any API calls. This prevents every tab simultaneously hitting 503
  // and waiting on independent retry timers.
  const [dbReady, setDbReady] = useState(false)
  const dbPollRef = useRef(null)

  useEffect(() => {
    if (!user || !_hasHydrated) return // only poll when logged in

    let cancelled = false

    const poll = async () => {
      while (!cancelled) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/health`, { cache: 'no-store' })
          const data = await res.json()
          if (data.dbReady) {
            if (!cancelled) setDbReady(true)
            return
          }
        } catch (_) {
          // server not yet responding — keep polling
        }
        await new Promise(r => setTimeout(r, 600))
      }
    }

    poll()
    return () => { cancelled = true }
  }, [user, _hasHydrated])

  // Reset dbReady on logout so next login re-polls
  useEffect(() => {
    if (!user) setDbReady(false)
  }, [user])
  // ───────────────────────────────────────────────────────────────────────

  // Log user session restoration
  useEffect(() => {
    if (user && _hasHydrated) {
      logger.info('User session restored from store')
    }
  }, [user, _hasHydrated])

  // Don't render until persisted store is rehydrated — prevents 401s from
  // components firing apiFetch before the token is available
  if (!_hasHydrated) {
    return <LoadingSpinner message="Loading..." />
  }

  // Handle login
  const handleLogin = (userData, token) => {
    logger.logLogin(userData)
    login(userData, token)
    logger.logStateUpdate('User authenticated and saved')
  }

  // Handle logout — mark offline BEFORE clearing the token so the DELETE request is authenticated
  const handleLogout = async () => {
    logger.logLogout()
    const { token } = useStore.getState()
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/api/presence/ping`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          keepalive: true, // ensures the request completes even if the page navigates away
        })
      } catch { /* non-critical */ }
    }
    logout()
  }

  // Get the appropriate dashboard component based on user's panel type
  const getDashboardComponent = () => {
    if (!user) return null

    // Show a brief connecting screen until MySQL is ready.
    // This ensures all tabs load together instead of hammering 503s independently.
    if (!dbReady) {
      return <LoadingSpinner message="Connecting to database..." />
    }

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
