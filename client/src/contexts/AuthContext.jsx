import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export const AuthProvider = ({ children, initialUser }) => {
  const [user, setUser] = useState(initialUser || null)
  const [isAuthenticated, setIsAuthenticated] = useState(!!initialUser)

  useEffect(() => {
    if (initialUser) {
      setUser(initialUser)
      setIsAuthenticated(true)
    }
  }, [initialUser])

  const login = (userData) => {
    setUser(userData)
    setIsAuthenticated(true)
  }

  const logout = () => {
    setUser(null)
    setIsAuthenticated(false)
  }

  const updateUser = (updates) => {
    setUser(prev => ({ ...prev, ...updates }))
  }

  const hasPermission = (requiredRole) => {
    if (!user) return false
    
    const roleHierarchy = {
      'ADMIN': 3,
      'TEAM LEADER': 2,
      'USER': 1
    }
    
    const userLevel = roleHierarchy[user.role] || 0
    const requiredLevel = roleHierarchy[requiredRole] || 0
    
    return userLevel >= requiredLevel
  }

  const value = {
    user,
    isAuthenticated,
    login,
    logout,
    updateUser,
    hasPermission
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
