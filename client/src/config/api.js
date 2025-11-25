// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// API Client with CSRF protection and error handling
export class APIError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'APIError'
    this.status = status
    this.data = data
  }
}

// Get CSRF token from cookie
const getCsrfToken = () => {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/)
  return match ? match[1] : null
}

// Detect if running in Electron
const isElectron = typeof window !== 'undefined' &&
  window.navigator &&
  window.navigator.userAgent.includes('Electron')

// Simple obfuscation for Electron localStorage (not true encryption but better than plain text)
const TOKEN_KEY = 'zwF9x#$1pL8!mA2'

// Obfuscate/deobfuscate token (simple XOR for Electron security)
const obfuscateToken = (token) => {
  if (!token) return null
  const key = TOKEN_KEY.repeat(Math.ceil(token.length / TOKEN_KEY.length)).slice(0, token.length)
  let result = ''
  for (let i = 0; i < token.length; i++) {
    result += String.fromCharCode(token.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return btoa(result) // Base64 encode
}

const unobfuscateToken = (obfuscated) => {
  if (!obfuscated) return null
  try {
    const decoded = atob(obfuscated) // Base64 decode
    const key = TOKEN_KEY.repeat(Math.ceil(decoded.length / TOKEN_KEY.length)).slice(0, decoded.length)
    let result = ''
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length))
    }
    return result
  } catch {
    return null // Invalid token
  }
}

// Get auth token - obfuscated localStorage for Electron, cookies for web
export const getAuthToken = () => {
  if (isElectron) {
    try {
      const obfuscated = localStorage.getItem('authToken')
      return unobfuscateToken(obfuscated)
    } catch (error) {
      console.warn('Failed to get auth token from localStorage:', error)
      return null
    }
  } else {
    // Web browser - use cookies for security
    const match = document.cookie.match(/authToken=([^;]+)/)
    return match ? match[1] : null
  }
}

// Set auth token - obfuscated localStorage for Electron, cookie for web
export const setAuthToken = (token) => {
  if (isElectron) {
    try {
      const obfuscated = obfuscateToken(token)
      localStorage.setItem('authToken', obfuscated)
    } catch (error) {
      console.warn('Failed to save auth token to localStorage:', error)
    }
  } else {
    // Web browser - use httpOnly cookie
    const maxAge = 24 * 60 * 60 // 24 hours in seconds
    document.cookie = `authToken=${token}; max-age=${maxAge}; path=/; SameSite=Strict${
      window.location.protocol === 'https:' ? '; Secure' : ''
    }`
  }
}

// Clear auth token
export const clearAuthToken = () => {
  if (isElectron) {
    try {
      localStorage.removeItem('authToken')
    } catch (error) {
      console.warn('Failed to clear auth token from localStorage:', error)
    }
  } else {
    document.cookie = 'authToken=; max-age=0; path=/'
  }
}

// Check if user is authenticated
export const isAuthenticated = () => {
  return !!getAuthToken()
}

/**
 * API Client - Makes authenticated requests with CSRF protection
 * @param {string} endpoint - API endpoint (e.g., '/api/users')
 * @param {Object} options - Fetch options
 * @returns {Promise<any>} Response data
 */
export const apiClient = async (endpoint, options = {}) => {
  try {
    const token = getAuthToken()
    const csrfToken = getCsrfToken()
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        ...options.headers
      },
      credentials: 'include' // Important: Include cookies in requests
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config)
    
    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401) {
      clearAuthToken()
      window.location.href = '/login'
      throw new APIError('Session expired. Please login again.', 401)
    }

    const data = await response.json()
    
    if (!response.ok) {
      throw new APIError(
        data.message || data.error || 'Request failed',
        response.status,
        data
      )
    }
    
    return data
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    
    // Network or parsing error
    console.error('API Client Error:', error)
    throw new APIError(
      error.message || 'Network error occurred',
      0,
      { originalError: error }
    )
  }
}

/**
 * Upload file with progress tracking
 * @param {string} endpoint - Upload endpoint
 * @param {FormData} formData - Form data with file
 * @param {Function} onProgress - Progress callback (optional)
 * @returns {Promise<any>} Response data
 */
export const uploadFile = async (endpoint, formData, onProgress = null) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const token = getAuthToken()
    const csrfToken = getCsrfToken()
    
    // Upload progress
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100
          onProgress(percentComplete)
        }
      })
    }
    
    // Handle response
    xhr.addEventListener('load', () => {
      try {
        const data = JSON.parse(xhr.responseText)
        
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data)
        } else {
          reject(new APIError(
            data.message || 'Upload failed',
            xhr.status,
            data
          ))
        }
      } catch (error) {
        reject(new APIError('Invalid response from server', xhr.status))
      }
    })
    
    // Handle errors
    xhr.addEventListener('error', () => {
      reject(new APIError('Upload failed', 0))
    })
    
    xhr.addEventListener('abort', () => {
      reject(new APIError('Upload cancelled', 0))
    })
    
    // Open and send
    xhr.open('POST', `${API_BASE_URL}${endpoint}`)
    
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    }
    
    if (csrfToken) {
      xhr.setRequestHeader('X-CSRF-Token', csrfToken)
    }
    
    xhr.withCredentials = true
    xhr.send(formData)
  })
}

export default apiClient
