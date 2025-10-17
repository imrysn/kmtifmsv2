import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import './css/App.css'

// Lazy load components for better performance
const Login = lazy(() => import('./components/Login'))
const UserDashboard = lazy(() => import('./pages/UserDashboard-Enhanced'))
const TeamLeaderDashboard = lazy(() => import('./pages/TeamLeaderDashboard-Enhanced'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))

// Loading component
const LoadingFallback = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    fontSize: '18px',
    color: '#666'
  }}>
    <div>
      <div style={{ marginBottom: '16px', textAlign: 'center' }}>⚡</div>
      <div>Loading...</div>
    </div>
  </div>
)

function App() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check authentication status on app load
  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (error) {
        console.error('Error parsing saved user:', error)
        localStorage.removeItem('user')
      }
    }
    setIsLoading(false)
  }, [])

  // Handle login
  const handleLogin = (userData) => {
    console.log('App handleLogin called with:', userData)
    setUser(userData)
    localStorage.setItem('user', JSON.stringify(userData))
    console.log('User state updated and saved to localStorage')
  }

  // Handle logout
  const handleLogout = () => {
    console.log('User logging out')
    setUser(null)
    localStorage.removeItem('user')
  }

  // Get the appropriate dashboard component based on user's panel type
  const getDashboardComponent = () => {
    if (!user) return null
    
    console.log(`Rendering dashboard for panelType: ${user.panelType}`)
    
    switch (user.panelType) {
      case 'user':
        return <UserDashboard user={user} onLogout={handleLogout} />
      case 'teamleader':
        return <TeamLeaderDashboard user={user} onLogout={handleLogout} />
      case 'admin':
        return <AdminDashboard user={user} onLogout={handleLogout} />
      default:
        console.error('Unknown panel type:', user.panelType)
        return <UserDashboard user={user} onLogout={handleLogout} />
    }
  }

  if (isLoading) {
    return (
      <div className="app">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          fontSize: '18px'
        }}>
          Loading...
        </div>
      </div>
    )
  }

  return (
    <Router>
      <div className="app">
        <Suspense fallback={<LoadingFallback />}>
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
  )
}

export default App
