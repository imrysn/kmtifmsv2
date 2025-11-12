import { useState, useEffect, useRef } from 'react'
import FileIcon from './FileIcon'
import { SkeletonLoader } from '../common/SkeletonLoader'
import './FileManagement.css'
import { AlertMessage } from './modals'
import { FastSearchEngine } from '../../services/FastSearchEngine'

const API_BASE = process.env.NODE_ENV === 'development'
  ? 'http://localhost:3001'
  : 'http://localhost:3001'

const FileManagement = ({ clearMessages, error, success, setError, setSuccess }) => {
  const [currentPath, setCurrentPath] = useState('/')
  const [fileSystemItems, setFileSystemItems] = useState([])
  const [filteredItems, setFilteredItems] = useState([])
  const [fileManagementSearch, setFileManagementSearch] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isComponentLoading, setIsComponentLoading] = useState(false)
  const [networkInfo, setNetworkInfo] = useState(null)
  const [networkAvailable, setNetworkAvailable] = useState(true)
  
  // NEW: Search engine and performance tracking
  const [searchEngine] = useState(() => new FastSearchEngine(API_BASE))
  const [searchPerformance, setSearchPerformance] = useState(null)
  const [engineStats, setEngineStats] = useState(null)

  const clickTimerRef = useRef(null)
  const lastClickedItemRef = useRef(null)
  const CLICK_DELAY = 300
  const searchDebounceRef = useRef(null)

  // Initialize search engine
  useEffect(() => {
    searchEngine.initialize()
    
    // Update stats periodically
    const statsInterval = setInterval(() => {
      setEngineStats(searchEngine.getStats())
    }, 5000)
    
    return () => clearInterval(statsInterval)
  }, [searchEngine])

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        clearMessages() 
      }, 3000)
      return () => clearTimeout(timer) 
    }
  }, [error, success, clearMessages])

  // Check network availability on mount and periodically
  useEffect(() => {
    const checkNetwork = async () => {
      try {
        await fetch(`${API_BASE}/api/health`)
        setNetworkAvailable(true)
      } catch {
        setNetworkAvailable(false)
      }
    }

    checkNetwork()
    const interval = setInterval(checkNetwork, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    checkNetworkAccess()
  }, [])

  useEffect(() => {
    if (networkAvailable) {
      fetchFileSystemItems()
    }
  }, [currentPath, networkAvailable])

  // NEW: Enhanced search with debouncing
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
    }

    if (fileManagementSearch.trim() === '') {
      setFilteredItems(fileSystemItems)
      setIsSearching(false)
      setSearchPerformance(null)
    } else {
      setIsSearching(true)
      searchDebounceRef.current = setTimeout(() => {
        handleFastSearch(fileManagementSearch)
      }, 900) // Debounce search by 300ms
    }

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
      }
    }
  }, [fileManagementSearch])

  useEffect(() => {
    if (fileManagementSearch.trim() === '') {
      setFilteredItems(fileSystemItems)
    }
  }, [fileSystemItems])

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current)
      }
    }
  }, [])

  const checkNetworkAccess = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/health`)
      if (response.ok) {
        setNetworkAvailable(true)
      } else {
        setNetworkAvailable(false)
      }

      const infoResponse = await fetch(`${API_BASE}/api/file-system/info`)
      const data = await infoResponse.json()
      setNetworkInfo(data)
      if (!data.accessible) {
        setError('Network projects directory is not accessible.')
      }
    } catch (error) {
      console.error('Error checking network access:', error)
      setNetworkAvailable(false)
      setError('Failed to check network directory access: ' + error.message)
      setNetworkInfo({ accessible: false, message: 'Connection failed' })
    }
  }

  // NEW: Enhanced fetch using search engine's cached listing
  const fetchFileSystemItems = async () => {
    setIsLoading(true)
    clearMessages()
    try {
      const result = await searchEngine.listDirectory(currentPath)
      
      if (result.success) {
        setFileSystemItems(result.items)
        setFilteredItems(result.items)
      } else {
        throw new Error('Failed to load directory')
      }
    } catch (error) {
      console.error('Error fetching file system items:', error)
      setError(error.message || 'Failed to load directory contents')
      setFileSystemItems([])
      setFilteredItems([])
    } finally {
      setIsLoading(false)
    }
  }

  // NEW: Ultra-fast search using the search engine
  const handleFastSearch = async (query) => {
    if (!query || query.trim() === '') {
      setFilteredItems(fileSystemItems)
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    clearMessages()
    
    try {
      const startTime = performance.now()
      
      const results = await searchEngine.searchFiles(query, {
        directory: currentPath,
        recursive: true,
        checkPermissions: true,
        limit: 500 // Limit results for performance
      })
      
      const searchTime = performance.now() - startTime
      
      setSearchPerformance({
        time: searchTime,
        indexed: results.indexed,
        cached: results.cached,
        resultCount: results.files.length,
        query: query
      })
      
      setFilteredItems(results.files)
      
      // Show performance message if search was very fast
      if (searchTime < 100 && results.files.length > 0) {
        setSuccess(`⚡ Found ${results.files.length} results in ${searchTime.toFixed(0)}ms ${results.cached ? '(cached)' : results.indexed ? '(indexed)' : ''}`)
      }
    } catch (error) {
      console.error('Search error:', error)
      
      if (error.message.includes('permission denied') || error.message.includes('access denied')) {
        setError(`Access denied: ${error.message}`)
      } else {
        // Fallback to local search
        console.log('Falling back to local search')
        const filtered = fileSystemItems.filter(item =>
          item.displayName.toLowerCase().includes(query.toLowerCase())
        )
        setFilteredItems(filtered)
      }
    } finally {
      setIsSearching(false)
    }
  }

  const navigateToPath = (newPath) => {
    setCurrentPath(newPath)
    setFileManagementSearch('')
    setSelectedItem(null)
    setSearchPerformance(null)
  }

  const handleItemClick = (item) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
    }

    if (lastClickedItemRef.current === item.id) {
      lastClickedItemRef.current = null
      handleItemOpen(item)
    } else {
      lastClickedItemRef.current = item.id
      handleItemSelect(item)

      clickTimerRef.current = setTimeout(() => {
        lastClickedItemRef.current = null
      }, CLICK_DELAY)
    }
  }

  const handleItemSelect = (item) => {
    if (selectedItem === item.id) {
      setSelectedItem(null)
    } else {
      setSelectedItem(item.id)
    }
  }

  const handleItemOpen = async (item) => {
    if (item.type === 'folder') {
      navigateToPath(item.path)
    } else {
      setIsComponentLoading(true)
      setSuccess(`Opening ${item.displayName}...`)

      try {
        await new Promise(resolve => setTimeout(resolve, 300))

        const isElectron = window.electron && window.electron.openFileInApp
        
        if (isElectron) {
          console.log('💻 Running in Electron - using Windows default application')
          
          const pathResponse = await fetch(
            `${API_BASE}/api/file-system/filepath?path=${encodeURIComponent(item.path)}`
          )
          const pathData = await pathResponse.json()
          
          if (!pathData.success) {
            throw new Error(pathData.message || 'Failed to get file path')
          }
          
          console.log('📂 Full path:', pathData.fullPath)
          console.log('📄 File type:', pathData.fileType)
          
          const result = await window.electron.openFileInApp(pathData.fullPath)
          
          if (result.success) {
            console.log('✅ Opened with Windows default application')
            setSuccess(`Opened ${item.displayName}`)
          } else {
            throw new Error(result.error || 'Failed to open file')
          }
        } else {
          console.log('🌐 Running in browser - opening in new tab')
          
          const fileUrl = `${API_BASE}/api/file-system/file?path=${encodeURIComponent(item.path)}`
          const newWindow = window.open(fileUrl, '_blank')
          
          if (!newWindow) {
            throw new Error('Pop-up blocked. Please allow pop-ups for this site.')
          }
          
          newWindow.focus()
          console.log('✅ Opened in browser tab')
          setSuccess(`Opened ${item.displayName} in browser`)
        }

      } catch (error) {
        console.error('❌ Error opening file:', error)
        setError(`Error opening file: ${error.message || 'Failed to open file'}`)
      } finally {
        setIsComponentLoading(false)
      }
    }
  }

  const getBreadcrumbs = () => {
    if (currentPath === '/') return [{ name: 'PROJECTS', path: '/' }]
    const parts = currentPath.split('/').filter(p => p)
    const breadcrumbs = [{ name: 'PROJECTS', path: '/' }]
    let currentBreadcrumbPath = ''
    parts.forEach(part => {
      currentBreadcrumbPath += `/${part}`
      breadcrumbs.push({
        name: part.length > 20 ? part.substring(0, 20) + '...' : part,
        path: currentBreadcrumbPath,
        fullName: part
      })
    })
    return breadcrumbs
  }

  if (!networkAvailable) {
    return <SkeletonLoader type="table" />
  }

  return (
    <div className={`file-management-section ${isComponentLoading ? 'file-opening-cursor' : ''}`}>
      {networkInfo && (
        <div className={`network-status ${networkInfo.accessible ? 'accessible' : 'not-accessible'}`}>
          <span className="status-text">
            {networkInfo.accessible ? 'Network directory accessible' : 'Network directory not accessible'}
          </span>
          <span className="network-path">{networkInfo.path || '\\\\KMTI-NAS\\Shared\\Public\\PROJECTS'}</span>
        </div>
      )}

      <div className="file-nav-controls">
        <div className="breadcrumb-container">
          <nav className="breadcrumb">
            {getBreadcrumbs().map((crumb, index) => (
              <span key={crumb.path} className="breadcrumb-item">
                {index > 0 && <span className="breadcrumb-separator">/</span>}
                <button
                  className={`breadcrumb-link ${index === getBreadcrumbs().length - 1 ? 'active' : ''}`}
                  onClick={() => navigateToPath(crumb.path)}
                  disabled={index === getBreadcrumbs().length - 1}
                  title={crumb.fullName || crumb.name}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </nav>
        </div>

        <div className="file-controls-right">
          <div className="file-search">
            <input
              type="text"
              placeholder="⚡ Ultra-fast search..."
              value={fileManagementSearch}
              onChange={(e) => setFileManagementSearch(e.target.value)}
              className="search-input"
            />
            {fileManagementSearch && (
              <button
                className="search-clear-btn"
                onClick={() => setFileManagementSearch('')}
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* NEW: Search performance indicator */}
      {searchPerformance && (
        <div className="search-performance-bar">
          <span className="perf-badge">
            ⚡ {searchPerformance.time.toFixed(0)}ms
          </span>
          <span className="perf-badge">
            {searchPerformance.cached ? '💾 Cached' : searchPerformance.indexed ? '📇 Indexed' : '🌐 API'}
          </span>
          <span className="perf-badge">
            📊 {searchPerformance.resultCount} results
          </span>
          {engineStats && (
            <span className="perf-badge" title="Cache statistics">
              💿 {engineStats.cache.cacheSize} dirs cached ({engineStats.cache.hitRate} hit rate)
            </span>
          )}
        </div>
      )}

      {/* Messages */}
      {error && (
        <AlertMessage 
          type="error" 
          message={error} 
          onClose={clearMessages}
        />
      )}

      {success && (
        <AlertMessage 
          type="success" 
          message={success} 
          onClose={clearMessages}
        />
      )}

      <div className="file-system-container">
        {isLoading || isSearching ? (
          <SkeletonLoader type="grid" />
        ) : (
          <>
            {isComponentLoading && (
              <div className="component-loading-overlay">
                <SkeletonLoader type="grid" />
              </div>
            )}
            <div className={`files-content ${isComponentLoading ? 'loading' : ''}`}>
              <div className="files-grid">
                {filteredItems.length === 0 && fileManagementSearch ? (
                  <div className="no-results">
                    <p>No files found for "{fileManagementSearch}"</p>
                    <p className="no-results-hint">Try a different search term or check your spelling</p>
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className={`file-item ${item.type} ${selectedItem === item.id ? 'selected' : ''}`}
                      onClick={() => handleItemClick(item)}
                      title={`${item.name}\n1st click: Select\n2nd click: Open`}
                    >
                      <div className="file-icon">
                        <FileIcon
                          fileType={item.fileType}
                          isFolder={item.type === 'folder'}
                          altText={item.type}
                          className="file-icon-img"
                        />
                      </div>
                      <div className="file-info">
                        <div className="file-name" title={item.name}>
                          {item.displayName}
                        </div>
                        {item.parentPath && fileManagementSearch && (
                          <div className="file-location" title={item.parentPath}>
                            📁 {item.parentPath}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default FileManagement
