import React from 'react';

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 * Prevents the entire app from crashing
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // You can also log the error to an error reporting service here
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <h1 style={styles.title}>⚠️ Oops! Something went wrong</h1>
            <p style={styles.message}>
              The application encountered an unexpected error. Don't worry, your data is safe.
            </p>
            
            <div style={styles.buttonGroup}>
              <button 
                onClick={this.handleReset} 
                style={styles.primaryButton}
              >
                Try Again
              </button>
              <button 
                onClick={() => window.location.reload()} 
                style={styles.secondaryButton}
              >
                Reload Page
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={styles.details}>
                <summary style={styles.summary}>Error Details (Development Only)</summary>
                <div style={styles.errorDetails}>
                  <p style={styles.errorMessage}>
                    <strong>Error:</strong> {this.state.error.toString()}
                  </p>
                  <pre style={styles.errorStack}>
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Inline styles for better reliability (in case CSS fails to load)
const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    padding: '20px'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '40px',
    maxWidth: '600px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    textAlign: 'center'
  },
  title: {
    fontSize: '24px',
    marginBottom: '16px',
    color: '#333'
  },
  message: {
    fontSize: '16px',
    color: '#666',
    marginBottom: '24px',
    lineHeight: '1.5'
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    marginBottom: '24px'
  },
  primaryButton: {
    padding: '12px 24px',
    fontSize: '16px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  secondaryButton: {
    padding: '12px 24px',
    fontSize: '16px',
    backgroundColor: '#fff',
    color: '#333',
    border: '2px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  details: {
    marginTop: '24px',
    textAlign: 'left'
  },
  summary: {
    cursor: 'pointer',
    padding: '12px',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
    fontWeight: '600'
  },
  errorDetails: {
    marginTop: '12px',
    padding: '16px',
    backgroundColor: '#fff5f5',
    borderRadius: '4px',
    border: '1px solid #ffcccb'
  },
  errorMessage: {
    marginBottom: '12px',
    color: '#d32f2f'
  },
  errorStack: {
    fontSize: '12px',
    color: '#666',
    overflow: 'auto',
    maxHeight: '200px',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word'
  }
};

export default ErrorBoundary;
