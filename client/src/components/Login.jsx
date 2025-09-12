import { useState } from 'react'
import './Login.css'

const Login = ({ onLogin }) => {
  const [loginType, setLoginType] = useState('user') // 'user' or 'admin'
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState('')

  const handleToggle = () => {
    const newLoginType = loginType === 'user' ? 'admin' : 'user'
    setLoginType(newLoginType)
    // Clear form and errors when switching
    setFormData({ email: '', password: '' })
    setErrors({})
    setApiError('')
    console.log(`Switched to ${newLoginType} login mode`)
  }

  const validateUsernameOrEmail = (input) => {
    // Check if it's an email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    // Check if it's a valid username format (alphanumeric, dots, underscores, hyphens)
    const usernameRegex = /^[a-zA-Z0-9._-]+$/
    
    // If it contains @, validate as email
    if (input.includes('@')) {
      return emailRegex.test(input)
    }
    // Otherwise validate as username
    return usernameRegex.test(input) && input.length >= 3 && input.length <= 30
  }

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.email.trim()) {
      newErrors.email = 'Username or email is required'
    } else if (!validateUsernameOrEmail(formData.email)) {
      if (formData.email.includes('@')) {
        newErrors.email = 'Please enter a valid email address'
      } else {
        newErrors.email = 'Username must be 3-30 characters and contain only letters, numbers, dots, underscores, or hyphens'
      }
    }
    
    if (!formData.password.trim()) {
      newErrors.password = 'Password is required'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Clear errors when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
    
    // Clear API error when user starts typing
    if (apiError) {
      setApiError('')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    console.log(`${loginType} login form submitted with:`, formData)
    
    if (!validateForm()) {
      console.log('Form validation failed')
      return
    }
    
    setIsLoading(true)
    setApiError('')
    console.log(`Sending ${loginType} login request...`)
    
    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          loginType
        })
      })
      
      const data = await response.json()
      console.log('API response:', data)
      
      if (data.success) {
        console.log('Login successful, calling onLogin...')
        // Call the onLogin prop to update app state
        onLogin(data.user)
      } else {
        console.log('Login failed:', data.message)
        setApiError(data.message || 'Login failed')
      }
    } catch (error) {
      console.error('Login error:', error)
      setApiError('Unable to connect to server. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }



  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-toggle">
          <div className="toggle-container">
            <button
              type="button"
              className={`toggle-btn ${loginType === 'user' ? 'active' : ''}`}
              onClick={() => loginType !== 'user' && handleToggle()}
            >
              User
            </button>
            <button
              type="button"
              className={`toggle-btn ${loginType === 'admin' ? 'active' : ''}`}
              onClick={() => loginType !== 'admin' && handleToggle()}
            >
              Admin
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Username or Email</label>
            <input
              type="text"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={errors.email ? 'error' : ''}
              disabled={isLoading}
              placeholder="Enter username or email"
            />
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className={errors.password ? 'error' : ''}
              disabled={isLoading}
              placeholder="Enter your password"
            />
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>
          
          {apiError && <div className="api-error">{apiError}</div>}
          
          <button 
            type="submit" 
            className={`login-button ${loginType}`}
            disabled={isLoading}
          >
            {isLoading 
              ? 'Logging in...' 
              : 'Login'
            }
          </button>
        </form>

      </div>
    </div>
  )
}

export default Login
