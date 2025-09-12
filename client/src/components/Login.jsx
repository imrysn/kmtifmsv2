import { useState, useEffect, useRef } from 'react'
import anime from 'animejs'
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

  const loginCardRef = useRef(null)
  const formRef = useRef(null)

  useEffect(() => {
    // Simplified entrance animation
    anime({
      targets: loginCardRef.current,
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 400,
      easing: 'easeOutCubic'
    })

    anime({
      targets: '.form-group',
      opacity: [0, 1],
      duration: 300,
      delay: anime.stagger(50, {start: 200}),
      easing: 'easeOutCubic'
    })
  }, [])

  const handleToggle = () => {
    const newLoginType = loginType === 'user' ? 'admin' : 'user'
    setLoginType(newLoginType)
    setFormData({ email: '', password: '' })
    setErrors({})
    setApiError('')
  }

  const validateUsernameOrEmail = (input) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const usernameRegex = /^[a-zA-Z0-9._-]+$/
    
    if (input.includes('@')) {
      return emailRegex.test(input)
    }
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
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
    
    if (apiError) {
      setApiError('')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setIsLoading(true)
    setApiError('')
    
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
      
      if (data.success) {
        // Simple success animation
        anime({
          targets: loginCardRef.current,
          opacity: [1, 0],
          duration: 300,
          easing: 'easeInCubic',
          complete: () => {
            onLogin(data.user)
          }
        })
      } else {
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
    <div className="minimal-login-container">
      <div className="login-card" ref={loginCardRef}>
        <div className="login-header">
          <h1>Welcome Back</h1>
          <p>Sign in to access your workspace</p>
        </div>

        <div className="login-toggle">
          <div className="toggle-container">
            <button
              type="button"
              className={`toggle-btn ${loginType === 'user' ? 'active' : ''}`}
              onClick={() => loginType !== 'user' && handleToggle()}
            >
              User Portal
            </button>
            <button
              type="button"
              className={`toggle-btn ${loginType === 'admin' ? 'active' : ''}`}
              onClick={() => loginType !== 'admin' && handleToggle()}
            >
              Admin Panel
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form" ref={formRef}>
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
          
          {apiError && (
            <div className="api-error">
              {apiError}
            </div>
          )}
          
          <button 
            type="submit" 
            className={`login-button ${loginType} ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="loading-spinner"></span>
                <span>Signing In...</span>
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login