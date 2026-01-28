import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './css/index.css'
import './css/transitions.css'
import './css/glassmorphism.css'
import './css/micro-interactions.css'

// Ensure React is available globally for debugging
if (typeof window !== 'undefined') {
  window.React = React;
}

// Remove StrictMode in production for better performance
// StrictMode causes double-rendering which can make the app feel laggy
const isDevelopment = import.meta.env.MODE === 'development'

// Get root element
const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Failed to find the root element')
}

// Create root and render
const root = ReactDOM.createRoot(rootElement)

root.render(
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

console.log('✅ React application initialized successfully')
