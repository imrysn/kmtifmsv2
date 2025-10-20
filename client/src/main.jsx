import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './css/index.css'

// Remove StrictMode in production for better performance
// StrictMode causes double-rendering which can make the app feel laggy
const isDevelopment = import.meta.env.MODE === 'development'

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    {isDevelopment ? (
      <React.StrictMode>
        <App />
      </React.StrictMode>
    ) : (
      <App />
    )}
  </ErrorBoundary>
)
