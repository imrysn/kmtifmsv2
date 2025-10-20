import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import './css/App.css'

// Lazy load components for better performance
const Login = lazy(() => import('./components/Login'))
const UserDashboard = lazy(() => import('./pages/UserDashboard-Enhanced'))
const TeamLeaderDashboard = lazy(() => import('./pages/TeamLeaderDashboard-Enhanced'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))

// Skeleton Loading component (Facebook-style)
const LoadingFallback = () => (
  <div style={{ 
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto'
  }}>
    {/* Header Skeleton */}
    <div style={{
      height: '60px',
      background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'loading 1.5s ease-in-out infinite',
      borderRadius: '8px',
      marginBottom: '20px'
    }} />
    
    {/* Content Area Skeleton */}
    <div style={{ display: 'flex', gap: '20px' }}>
      {/* Sidebar Skeleton */}
      <div style={{ flex: '0 0 250px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            height: '40px',
            background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'loading 1.5s ease-in-out infinite',
            borderRadius: '8px',
            marginBottom: '10px'
          }} />
        ))}
      </div>
      
      {/* Main Content Skeleton */}
      <div style={{ flex: '1' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
            border: '1px solid #e0e0e0'
          }}>
            {/* Title */}
            <div style={{
              height: '24px',
              width: '60%',
              background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
              backgroundSize: '200% 100%',
              animation: 'loading 1.5s ease-in-out infinite',
              borderRadius: '4px',
              marginBottom: '12px'
            }} />
            {/* Content lines */}
            <div style={{
              height: '16px',
              width: '100%',
              background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
              backgroundSize: '200% 100%',
              animation: 'loading 1.5s ease-in-out infinite',
              borderRadius: '4px',
              marginBottom: '8px'
            }} />
            <div style={{
              height: '16px',
              width: '80%',
              background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
              backgroundSize: '200% 100%',
              animation: 'loading 1.5s ease-in-out infinite',
              borderRadius: '4px'
            }} />
          </div>
        ))}
      </div>
    </div>
    
    <style>{`
      @keyframes loading {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }
    `}</style>
  </div>
)

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      try {
        return JSON.parse(savedUser)
      } catch (error) {
        console.error('Error parsing saved user:', error)
        localStorage.removeItem('user')
        return null
      }
    }
    return null
  })

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
