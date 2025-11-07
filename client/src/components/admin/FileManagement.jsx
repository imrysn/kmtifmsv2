import { useState, useEffect, useRef } from 'react'
import FileIcon from './FileIcon'
import LoadingSpinner from '../LoadingSpinner'
import { SkeletonLoader } from '../common/SkeletonLoader'
import './FileManagement.css'
import { AlertMessage } from './modals'

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
  const [viewMode, setViewMode] = useState('grid')
  const [isLoading, setIsLoading] = useState(false)
  const [isComponentLoading, setIsComponentLoading] = useState(false);
  const [networkInfo, setNetworkInfo] = useState(null)
  const [networkAvailable, setNetworkAvailable] = useState(true)

  const clickTimerRef = useRef(null)
  const lastClickedItemRef = useRef(null)
  const CLICK_DELAY = 300 

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        clearMessages() 
      }, 3000);
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
    const interval = setInterval(checkNetwork, 30000) // Check every 30 seconds
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

  useEffect(() => {
    if (fileManagementSearch.trim() === '') {
      setFilteredItems(fileSystemItems)
      setIsSearching(false)
    } else {
      performGlobalSearch(fileManagementSearch)
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

      // Also check file system info
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

  const fetchFileSystemItems = async () => {
    setIsLoading(true)
    clearMessages()
    try {
      const response = await fetch(`${API_BASE}/api/file-system/browse?path=${encodeURIComponent(currentPath)}`)
      const data = await response.json()
      if (data.success) {
        setFileSystemItems(data.items)
        setFilteredItems(data.items)
      } else {
        throw new Error(data.message || 'Failed to load directory')
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

  const performGlobalSearch = async (searchQuery) => {
    setIsSearching(true)
    clearMessages()
    try {
      const url = `${API_BASE}/api/file-system/search?query=${encodeURIComponent(searchQuery)}&path=${encodeURIComponent(currentPath)}`
      console.log('Search URL:', url)

      const response = await fetch(url)

      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('Search endpoint not available, falling back to local search')
        // Fallback to local filtering
        const filtered = fileSystemItems.filter(item =>
          item.displayName.toLowerCase().includes(searchQuery.toLowerCase())
        )
        setFilteredItems(filtered)
        setIsSearching(false)
        return
      }

      const data = await response.json()
      if (data.success) {
        setFilteredItems(data.results)
      } else {
        throw new Error(data.message || 'Search failed')
      }
    } catch (error) {
      console.error('Error performing global search:', error)
      console.log('Falling back to local search')

      // Fallback to local filtering instead of showing error
      const filtered = fileSystemItems.filter(item =>
        item.displayName.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredItems(filtered)
    } finally {
      setIsSearching(false)
    }
  }

  const navigateToPath = (newPath) => {
    setCurrentPath(newPath)
    setFileManagementSearch('')
    setSelectedItem(null)
  }

  const handleItemClick = (item) => {
    // Clear any existing timer
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
    }

    // Check if this is the second click on the same item
    if (lastClickedItemRef.current === item.id) {
      // Second click - open the item
      lastClickedItemRef.current = null
      handleItemOpen(item)
    } else {
      // First click - select the item
      lastClickedItemRef.current = item.id
      handleItemSelect(item)

      // Reset after delay
      clickTimerRef.current = setTimeout(() => {
        lastClickedItemRef.current = null
      }, CLICK_DELAY)
    }
  }

  const handleItemSelect = (item) => {
    // Set single selection
    if (selectedItem === item.id) {
      setSelectedItem(null) // Deselect if clicking the same item
    } else {
      setSelectedItem(item.id)
    }
  }

  const handleItemOpen = async (item) => {
    if (item.type === 'folder') {
      // Open folder
      navigateToPath(item.path)
    } else {
      // Open file - prioritize desktop app, fallback to browser
      setIsComponentLoading(true);
      setSuccess(`Opening ${item.displayName}...`)

      try {
        // Small delay for UI feedback
        await new Promise(resolve => setTimeout(resolve, 300));

        // Check if running in Electron
        const isElectron = window.electron && window.electron.openFileInApp;
        
        if (isElectron) {
          console.log('💻 Running in Electron - using Windows default application');
          
          // Get full file path from server
          const pathResponse = await fetch(
            `${API_BASE}/api/file-system/filepath?path=${encodeURIComponent(item.path)}`
          );
          const pathData = await pathResponse.json();
          
          if (!pathData.success) {
            throw new Error(pathData.message || 'Failed to get file path');
          }
          
          console.log('📂 Full path:', pathData.fullPath);
          console.log('📄 File type:', pathData.fileType);
          
          const result = await window.electron.openFileInApp(pathData.fullPath);
          
          if (result.success) {
            console.log('✅ Opened with Windows default application');
            setSuccess(`Opened ${item.displayName}`);
          } else {
            throw new Error(result.error || 'Failed to open file');
          }
        } else {
          console.log('🌐 Running in browser - opening in new tab');
          
          // Fallback to browser viewing
          const fileUrl = `${API_BASE}/api/file-system/file?path=${encodeURIComponent(item.path)}`;
          const newWindow = window.open(fileUrl, '_blank');
          
          if (!newWindow) {
            throw new Error('Pop-up blocked. Please allow pop-ups for this site.');
          }
          
          newWindow.focus();
          console.log('✅ Opened in browser tab');
          setSuccess(`Opened ${item.displayName} in browser`);
        }

      } catch (error) {
        console.error('❌ Error opening file:', error);
        setError(`Error opening file: ${error.message || 'Failed to open file'}`);
      } finally {
        setIsComponentLoading(false);
      }
    }
  };

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

  // Show skeleton loader when network is not available
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
              placeholder="Search files and folders..."
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
          <div className="loading-state">
            {/* Use the global LoadingSpinner component for initial load/search */}
            <LoadingSpinner size="large" message={isSearching ? 'Searching through all folders...' : 'Loading files from network directory...'} />
          </div>
        ) : (
          <>
            {/* Show component loading overlay when opening a file */}
            {isComponentLoading && (
              <div className="component-loading-overlay">
                <LoadingSpinner size="large" message="Opening file..." />
              </div>
            )}
            <div className={`files-content ${isComponentLoading ? 'loading' : ''}`}>
              {viewMode === 'grid' ? (
                <div className="files-grid">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className={`file-item ${item.type} ${selectedItem === item.id ? 'selected' : ''}`}
                      onClick={() => handleItemClick(item)}
                      title={`${item.name}\n1st click: Select\n2nd click: Open`}
                    >
                      <div className="file-icon">
                        <FileIcon
                          fileType={item.fileType} // Pass fileType
                          isFolder={item.type === 'folder'} // Pass type
                          altText={item.type}
                          className="file-icon-img" // Pass the existing class if needed
                        />
                      </div>
                      <div className="file-info">
                        <div className="file-name" title={item.name}>
                          {item.displayName}
                        </div>
                        {item.parentPath && fileManagementSearch && (
                          <div className="file-location" title={item.parentPath}>
                            {item.parentPath}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="files-list">
                  <table className="files-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((item) => (
                        <tr
                          key={item.id}
                          className={`file-row ${item.type} ${selectedItem === item.id ? 'selected' : ''}`}
                          onClick={() => handleItemClick(item)}
                          title={`1st click: Select | 2nd click: Open`}
                        >
                          <td className="file-name-cell">
                            <div className="file-name-container">
                               <FileIcon
                                fileType={item.fileType} // Pass fileType
                                isFolder={item.type === 'folder'} // Pass type
                                altText={item.type}
                                className="file-icon-img-small" // Pass the existing class if needed
                              />
                              <span className="file-name">{item.displayName}</span>
                            </div>
                          </td>
                          <td className="file-type-cell">
                            {item.type === 'folder' ? 'Folder' : (item.fileType?.toUpperCase() || 'File')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default FileManagement
