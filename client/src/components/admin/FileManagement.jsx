import { useState, useEffect, useRef } from 'react'
import './FileManagement.css'

const API_BASE = process.env.NODE_ENV === 'development'
  ? 'http://localhost:3001'
  : 'http://localhost:3001'

// Flaticon icon map
const iconMap = {
  folder: "https://cdn-icons-png.flaticon.com/512/12075/12075377.png",
  pdf: "https://cdn-icons-png.flaticon.com/512/337/337946.png",
  doc: "https://cdn-icons-png.flaticon.com/512/337/337932.png",
  docx: "https://cdn-icons-png.flaticon.com/512/337/337932.png",
  xls: "https://cdn-icons-png.flaticon.com/512/337/337958.png",
  xlsx: "https://cdn-icons-png.flaticon.com/512/337/337958.png",
  jpg: "https://cdn-icons-png.flaticon.com/512/337/337940.png",
  jpeg: "https://cdn-icons-png.flaticon.com/512/337/337940.png",
  png: "https://cdn-icons-png.flaticon.com/512/337/337940.png",
  zip: "https://cdn-icons-png.flaticon.com/512/8629/8629976.png",
  rar: "https://cdn-icons-png.flaticon.com/512/8629/8629976.png",
  mp4: "https://cdn-icons-png.flaticon.com/512/8243/8243015.png",
  mov: "https://cdn-icons-png.flaticon.com/512/8243/8243015.png",
  avi: "https://cdn-icons-png.flaticon.com/512/8243/8243015.png",
  mp3: "https://cdn-icons-png.flaticon.com/512/3767/3767196.png",
  wav: "https://cdn-icons-png.flaticon.com/512/3767/3767196.png",
  txt: "https://cdn-icons-png.flaticon.com/512/4248/4248224.png",
  json: "https://cdn-icons-png.flaticon.com/512/11570/11570273.png",
  html: "https://cdn-icons-png.flaticon.com/512/337/337937.png",
  css: "https://cdn-icons-png.flaticon.com/512/8242/8242982.png",
  default: "https://cdn-icons-png.flaticon.com/512/342/342348.png",
  icd: "https://cdn-icons-png.flaticon.com/512/10121/10121902.png",
  sldprt: "https://cdn-icons-png.flaticon.com/512/14421/14421956.png",
  sldasm: "https://cdn-icons-png.flaticon.com/512/14421/14421962.png",
  slddrw: "https://cdn-icons-png.flaticon.com/512/2266/2266786.png",
  dwg: "https://cdn-icons-png.flaticon.com/512/2266/2266786.png",
}

function getIconForFile(item) {
  if (item.type === 'folder') return iconMap.folder
  const ext = item.fileType?.toLowerCase() || ''
  return iconMap[ext] || iconMap.default
}

const FileManagement = ({ clearMessages, error, success, setError, setSuccess }) => {
  const [currentPath, setCurrentPath] = useState('/')
  const [fileSystemItems, setFileSystemItems] = useState([])
  const [filteredItems, setFilteredItems] = useState([])
  const [fileManagementSearch, setFileManagementSearch] = useState('')
  const [searchScope, setSearchScope] = useState('folder') // 'folder' or 'global'
  const [isSearching, setIsSearching] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [viewMode, setViewMode] = useState('grid')
  const [isLoading, setIsLoading] = useState(false)
  const [networkInfo, setNetworkInfo] = useState(null)
  
  // For tracking double-clicks
  const clickTimerRef = useRef(null)
  const lastClickedItemRef = useRef(null)
  const CLICK_DELAY = 300 // milliseconds

  useEffect(() => {
    checkNetworkAccess()
  }, [])

  useEffect(() => {
    fetchFileSystemItems()
  }, [currentPath])

  useEffect(() => {
    if (fileManagementSearch.trim() === '') {
      setFilteredItems(fileSystemItems)
      setIsSearching(false)
    } else {
      if (searchScope === 'folder') {
        // Search only in current folder
        const filtered = fileSystemItems.filter(item => 
          item.displayName.toLowerCase().includes(fileManagementSearch.toLowerCase())
        )
        setFilteredItems(filtered)
        setIsSearching(false)
      } else {
        // Global search - search through all folders
        performGlobalSearch(fileManagementSearch)
      }
    }
  }, [fileSystemItems, fileManagementSearch, searchScope])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current)
      }
    }
  }, [])

  const checkNetworkAccess = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/file-system/info`)
      const data = await response.json()
      setNetworkInfo(data)
      if (!data.accessible) {
        setError('Network projects directory is not accessible.')
      }
    } catch (error) {
      console.error('Error checking network access:', error)
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
      const response = await fetch(`${API_BASE}/api/file-system/search?query=${encodeURIComponent(searchQuery)}&path=${encodeURIComponent(currentPath)}`)
      const data = await response.json()
      if (data.success) {
        setFilteredItems(data.results)
      } else {
        throw new Error(data.message || 'Search failed')
      }
    } catch (error) {
      console.error('Error performing global search:', error)
      setError(error.message || 'Failed to search')
      setFilteredItems([])
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

  const handleItemOpen = (item) => {
    if (item.type === 'folder') {
      // Open folder
      navigateToPath(item.path)
    } else {
      // Open file - construct the file URL and open it in new tab
      // Use the file viewer endpoint for proper inline display
      const relativePath = item.path.replace(/^\\/, '').replace(/\\/g, '/');
      const fileUrl = `${API_BASE}/api/file-viewer/view/${encodeURIComponent(relativePath)}`
      
      // Open all files in new tab
      window.open(fileUrl, '_blank')
      setSuccess(`Opening ${item.displayName}`)
      
      console.log('Opening file:', item)
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

  return (
    <div className="file-management-section">
      <div className="page-header">
        <h1>File Management</h1>
        <p>Browse and manage files in the network projects directory</p>
        {networkInfo && (
          <div className={`network-status ${networkInfo.accessible ? 'accessible' : 'not-accessible'}`}>
            <span className="status-text">
              {networkInfo.accessible ? 'Network directory accessible' : 'Network directory not accessible'}
            </span>
            <span className="network-path">{networkInfo.path || '\\\\KMTI-NAS\\Shared\\Public\\PROJECTS'}</span>
          </div>
        )}
      </div>

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
          <div className="search-scope-toggle">
            <button
              className={`scope-btn ${searchScope === 'folder' ? 'active' : ''}`}
              onClick={() => setSearchScope('folder')}
              title="Search in current folder only"
            >
              Current Folder
            </button>
            <button
              className={`scope-btn ${searchScope === 'global' ? 'active' : ''}`}
              onClick={() => setSearchScope('global')}
              title="Search all folders recursively"
            >
              Global Search
            </button>
          </div>
          
          <div className="file-search">
            <input
              type="text"
              placeholder={searchScope === 'folder' ? 'Search in current folder...' : 'Search all folders...'}
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

      {error && (
        <div className="alert alert-error">
          <span className="alert-message">{error}</span>
          <button onClick={clearMessages} className="alert-close">×</button>
        </div>
      )}
      
      {success && (
        <div className="alert alert-success">
          <span className="alert-message">{success}</span>
          <button onClick={clearMessages} className="alert-close">×</button>
        </div>
      )}

      <div className="file-system-container">
        {isLoading || isSearching ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>{isSearching ? 'Searching files...' : 'Loading files from network directory...'}</p>
          </div>
        ) : (
          <>
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
                      <img 
                        src={getIconForFile(item)} 
                        alt={item.type} 
                        className="file-icon-img"
                      />
                    </div>
                    <div className="file-info">
                      <div className="file-name" title={item.name}>
                        {item.displayName}
                      </div>
                      {searchScope === 'global' && item.parentPath && (
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
                            <img 
                              src={getIconForFile(item)} 
                              alt={item.type} 
                              className="file-icon-img-small"
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
          </>
        )}
      </div>
    </div>
  )
}

export default FileManagement
