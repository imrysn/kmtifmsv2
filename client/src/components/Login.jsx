import { useState, useEffect, useRef } from 'react'
import anime from 'animejs'
import './Login.css'
import Logo from '../assets/kmti_logo.png'

const Login = ({ onLogin }) => {
  const [loginType, setLoginType] = useState('user') // 'user' or 'admin'
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const mainContainerRef = useRef(null)
  const welcomeSectionRef = useRef(null)
  const loginCardRef = useRef(null)

  useEffect(() => {
    // Entrance animations
    anime({
      targets: mainContainerRef.current,
      opacity: [0, 1],
      scale: [0.95, 1],
      duration: 600,
      easing: 'easeOutCubic'
    })

    anime({
      targets: welcomeSectionRef.current,
      opacity: [0, 1],
      translateX: [-20, 0],
      duration: 400,
      delay: 300,
      easing: 'easeOutCubic'
    })

    anime({
      targets: loginCardRef.current,
      opacity: [0, 1],
      translateX: [20, 0],
      duration: 400,
      delay: 400,
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
        anime({
          targets: mainContainerRef.current,
          opacity: [1, 0],
          scale: [1, 0.95],
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
    <div className="unified-login-container">
      {/* Main Container holding both sections */}
      <div className="main-login-card" ref={mainContainerRef}>
        
        {/* Left Side - Welcome Section */}
        <div className="welcome-section" ref={welcomeSectionRef}>
          <div className="welcome-content">
            <div className="logo-container">
              <img src={Logo} alt="KMTI Logo" className="login-logo" />
            </div>
            <div className="system-name">
              <p>KMTI File Management System</p>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="login-section" ref={loginCardRef}>
          <div className="login-form-container">
            <div className="login-header">
              <h2>Sign in</h2>
            </div>

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
                <input
                  type="text"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={errors.email ? 'error' : ''}
                  disabled={isLoading}
                  placeholder="User Name"
                />
                {errors.email && <span className="error-message">{errors.email}</span>}
              </div>
              
              <div className="form-group">
                <div className="password-input-container">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={errors.password ? 'error' : ''}
                    disabled={isLoading}
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    className="show-password-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    SHOW
                  </button>
                </div>
                {errors.password && <span className="error-message">{errors.password}</span>}
              </div>

              <div className="form-options">
                <label className="remember-me">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span className="checkmark"></span>
                  Remember me
                </label>
                <button type="button" className="forgot-password">
                  Forgot Password?
                </button>
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
                  'Sign in'
                )}
              </button>
            </form>
          </div>
        </div>
        
      </div>
    </div>
  )
}

export default Login