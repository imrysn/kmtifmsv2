import { useState, useEffect } from 'react'
import '../css/Login.css'
import Logo from '../assets/kmti_logo.png'
import { createLogger } from '../utils/secureLogger'
import { apiClient, setAuthToken } from '../config/api'

const logger = createLogger('Login')

const STORAGE_KEYS = {
  EMAIL: 'kmt_login_email',
  REMEMBER: 'kmt_remember_me'
}

// Enforce maximum email length for security
const MAX_EMAIL_LENGTH = 100

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
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState('')
  const [isForgotPasswordSubmitting, setIsForgotPasswordSubmitting] = useState(false)
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')

  // Load remembered email on component mount (NOT password for security)
  useEffect(() => {
    try {
      const remembered = localStorage.getItem(STORAGE_KEYS.REMEMBER)
      if (remembered === 'true') {
        const savedEmail = localStorage.getItem(STORAGE_KEYS.EMAIL) || ''
        setFormData({
          email: savedEmail,
          password: '' // Never save password
        })
        setRememberMe(true)
      }
    } catch (error) {
      console.warn('Failed to load remembered email:', error)
    }
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

  const handleForgotPassword = () => {
    setShowForgotPasswordModal(true)
    setForgotPasswordEmail('')
  }

  const handleForgotPasswordSubmit = async () => {
    if (!forgotPasswordEmail.trim()) {
      return
    }

    setIsForgotPasswordSubmitting(true)
    setForgotPasswordMessage('')

    try {
      const data = await apiClient('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotPasswordEmail.trim() })
      })

      if (data.success) {
        setForgotPasswordMessage('Password reset instructions have been sent to Admin (Contact him for your new password).')
        setShowForgotPasswordModal(false)
      } else {
        setForgotPasswordMessage(data.message || 'Failed to send reset email.')
      }
    } catch (error) {
      logger.error('Forgot password failed', error)
      setForgotPasswordMessage('Unable to connect to server. Please try again.')
    } finally {
      setIsForgotPasswordSubmitting(false)
    }
  }

  const handleForgotPasswordCancel = () => {
    setShowForgotPasswordModal(false)
    setForgotPasswordEmail('')
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target

    // Sanitize input - remove HTML tags and limit length for security
    let sanitizedValue = value.replace(/<[^>]*>/g, '').trim()

    if (name === 'email') {
      sanitizedValue = sanitizedValue.slice(0, MAX_EMAIL_LENGTH)
    }

    setFormData(prev => ({
      ...prev,
      [name]: sanitizedValue
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

  // Safe localStorage operations with error handling
  const safeLocalStorage = {
    setItem: (key, value) => {
      try {
        localStorage.setItem(key, value)
        return true
      } catch (error) {
        console.warn('localStorage setItem failed:', error)
        return false
      }
    },
    removeItem: (key) => {
      try {
        localStorage.removeItem(key)
        return true
      } catch (error) {
        console.warn('localStorage removeItem failed:', error)
        return false
      }
    }
  }

  // Handle remember me checkbox change - save preference immediately
  const handleRememberMeChange = (checked) => {
    setRememberMe(checked)

    if (checked) {
      // Save current email when enabling remember me
      if (formData.email.trim()) {
        safeLocalStorage.setItem(STORAGE_KEYS.EMAIL, formData.email.slice(0, MAX_EMAIL_LENGTH))
        safeLocalStorage.setItem(STORAGE_KEYS.REMEMBER, 'true')
      }
    } else {
      // Clear when disabling remember me
      safeLocalStorage.removeItem(STORAGE_KEYS.EMAIL)
      safeLocalStorage.removeItem(STORAGE_KEYS.REMEMBER)
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
      const data = await apiClient('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          loginType
        })
      })
      
      if (data.success) {
        // Save auth token in cookie (handled by API client)
        setAuthToken(data.token)
        
        // Save only email if remember me is checked (NEVER password)
        if (rememberMe) {
          safeLocalStorage.setItem(STORAGE_KEYS.EMAIL, formData.email.slice(0, MAX_EMAIL_LENGTH))
          safeLocalStorage.setItem(STORAGE_KEYS.REMEMBER, 'true')
        } else {
          safeLocalStorage.removeItem(STORAGE_KEYS.EMAIL)
          safeLocalStorage.removeItem(STORAGE_KEYS.REMEMBER)
        }

        // Smooth transition
        setTimeout(() => {
          onLogin(data.user, data.token)
        }, 200)
      } else {
        setApiError(data.message || 'Login failed')
      }
    } catch (error) {
      logger.error('Login failed', error)
      setApiError(error.message || 'Unable to connect to server. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="unified-login-container">
      {/* Main Container holding both sections */}
      <div className="main-login-card">
        
        {/* Left Side - Welcome Section */}
        <div className="welcome-section">
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
        <div className="login-section">
          <div className="login-form-container">
            <div className="login-header">
              <h2>Sign in</h2>
            </div>

            {/* Toggle Switch */}
            <div className="login-toggle">
              <button
                type="button"
                className={`toggle-switch ${loginType}`}
                onClick={handleToggle}
                aria-label={`Switch to ${loginType === 'user' ? 'Admin' : 'User'} login`}
              >
                <span className="toggle-slider"></span>
              </button>
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
                  autoComplete="username"
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
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="show-password-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
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
                    onChange={(e) => handleRememberMeChange(e.target.checked)}
                  />
                  <span className="checkmark"></span>
                  Remember me
                </label>
                <button
                  type="button"
                  className="forgot-password"
                  onClick={handleForgotPassword}
                  disabled={isForgotPasswordSubmitting || isLoading}
                >
                  {isForgotPasswordSubmitting ? 'Sending...' : 'Forgot Password?'}
                </button>
              </div>
              
              {apiError && (
                <div className="api-error">
                  {apiError}
                </div>
              )}

              {forgotPasswordMessage && (
                <div className="api-error" style={{ backgroundColor: '#DCFCE7', color: '#166534', borderColor: '#BBF7D0' }}>
                  {forgotPasswordMessage}
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

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="modal-overlay" onClick={handleForgotPasswordCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Reset Password</h3>
            <p>Enter your email address to receive password reset instructions.</p>
            <input
              type="email"
              value={forgotPasswordEmail}
              onChange={(e) => setForgotPasswordEmail(e.target.value)}
              placeholder="Email"
              disabled={isForgotPasswordSubmitting}
              autoComplete="email"
            />
            <div className="modal-buttons">
              <button
                onClick={handleForgotPasswordCancel}
                disabled={isForgotPasswordSubmitting}
                className="cancel-button"
              >
                Cancel
              </button>
              <button
                onClick={handleForgotPasswordSubmit}
                disabled={!forgotPasswordEmail.trim() || isForgotPasswordSubmitting}
                className="submit-button"
              >
                {isForgotPasswordSubmitting ? 'Sending...' : 'Send Reset Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Login
