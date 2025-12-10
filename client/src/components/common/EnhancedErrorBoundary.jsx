import React, { Component } from 'react'
import './EnhancedErrorBoundary.css'

/**
 * Enhanced Error Boundary Component
 * Catches and handles React component errors gracefully
 * 
 * Features:
 * - Error logging to console
 * - User-friendly error UI
 * - Reset functionality
 * - Component stack trace display (dev mode)
 * - Customizable fallback UI
 */
class EnhancedErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    const { onError, componentName } = this.props
    
    // Log error details
    console.error('🚨 Error Boundary Caught Error:', {
      component: componentName || 'Unknown',
      error: error.toString(),
      stack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    })

    // Update state with error details
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }))

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo)
    }

    // Optional: Send error to logging service
    // this.logErrorToService(error, errorInfo)
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
    
    // Call custom reset handler if provided
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  logErrorToService = (error, errorInfo) => {
    // Implement error logging to external service
    // Example: Sentry, LogRocket, etc.
    try {
      // fetch('/api/log-error', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     error: error.toString(),
      //     stack: errorInfo.componentStack,
      //     timestamp: new Date().toISOString()
      //   })
      // })
    } catch (loggingError) {
      console.error('Failed to log error:', loggingError)
    }
  }

  render() {
    const { hasError, error, errorInfo, errorCount } = this.state
    const { 
      children, 
      fallback, 
      componentName = 'Component',
      showDetails = process.env.NODE_ENV === 'development'
    } = this.props

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return typeof fallback === 'function' 
          ? fallback(error, this.handleReset)
          : fallback
      }

      // Default error UI
      return (
        <div className="error-boundary-container">
          <div className="error-boundary-content">
            <div className="error-icon">⚠️</div>
            <h2 className="error-title">Something went wrong</h2>
            <p className="error-message">
              {componentName} encountered an unexpected error and couldn't render.
            </p>
            
            {showDetails && error && (
              <div className="error-details">
                <details>
                  <summary className="error-summary">
                    Technical Details (Click to expand)
                  </summary>
                  <div className="error-stack">
                    <div className="error-info-section">
                      <strong>Error:</strong>
                      <pre>{error.toString()}</pre>
                    </div>
                    {errorInfo && (
                      <div className="error-info-section">
                        <strong>Component Stack:</strong>
                        <pre>{errorInfo.componentStack}</pre>
                      </div>
                    )}
                    <div className="error-info-section">
                      <strong>Error Count:</strong> {errorCount}
                    </div>
                  </div>
                </details>
              </div>
            )}

            <div className="error-actions">
              <button 
                onClick={this.handleReset} 
                className="error-btn error-btn-primary"
              >
                Try Again
              </button>
              <button 
                onClick={() => window.location.reload()} 
                className="error-btn error-btn-secondary"
              >
                Reload Page
              </button>
            </div>

            {errorCount > 2 && (
              <div className="error-persistent-notice">
                <p>⚠️ This error has occurred {errorCount} times.</p>
                <p>If the problem persists, please contact support.</p>
              </div>
            )}
          </div>
        </div>
      )
    }

    return children
  }
}

// HOC to wrap components with error boundary
export const withErrorBoundary = (Component, errorBoundaryProps = {}) => {
  const WrappedComponent = (props) => (
    <EnhancedErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </EnhancedErrorBoundary>
  )
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`
  
  return WrappedComponent
}

export default EnhancedErrorBoundary
