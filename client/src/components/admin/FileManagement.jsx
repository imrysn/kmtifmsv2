import { useState, useEffect } from 'react'
import './FileManagement.css'

const FileManagement = ({ clearMessages, error, success, setError, setSuccess }) => {
  const [currentPath, setCurrentPath] = useState('/')
  const [fileSystemItems, setFileSystemItems] = useState([])
  const [filteredItems, setFilteredItems] = useState([])
  const [fileManagementSearch, setFileManagementSearch] = useState('')
  const [selectedItems, setSelectedItems] = useState([])
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  const [isLoading, setIsLoading] = useState(false)
  const [networkInfo, setNetworkInfo] = useState(null)

  // Check network directory accessibility on component mount
  useEffect(() => {
    checkNetworkAccess()
  }, [])

  // Fetch file system items when path changes
  useEffect(() => {
    fetchFileSystemItems()
  }, [currentPath])

  // Filter items when search query changes
  useEffect(() => {
    if (fileManagementSearch.trim() === '') {
      setFilteredItems(fileSystemItems)
    } else {
      const filtered = fileSystemItems.filter(item => 
        item.displayName.toLowerCase().includes(fileManagementSearch.toLowerCase())
      )
      setFilteredItems(filtered)
    }
  }, [fileSystemItems, fileManagementSearch])

  const checkNetworkAccess = async () => {
    try {
      const response = await fetch('/api/file-system/info')
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        console.error('API returned non-JSON response:', contentType)
        const textResponse = await response.text()
        console.error('Response text:', textResponse.substring(0, 200))
        setError('Server returned invalid response format. Check server logs.')
        setNetworkInfo({ accessible: false, message: 'Invalid server response' })
        return
      }
      
      const data = await response.json()
      setNetworkInfo(data)
      
      if (!data.accessible) {
        setError('Network projects directory is not accessible. Please check VPN connection and permissions.')
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
      const response = await fetch(`/api/file-system/browse?path=${encodeURIComponent(currentPath)}`)
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Browse API returned non-JSON response:', contentType)
        const textResponse = await response.text()
        console.error('Response text:', textResponse.substring(0, 200))
        throw new Error('Server returned invalid response format. Check server logs.')
      }
      
      const data = await response.json()
      
      if (data.success) {
        setFileSystemItems(data.items)
        setFilteredItems(data.items)
        console.log(`Loaded ${data.items.length} items from:`, data.networkPath)
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

  const navigateToPath = (newPath) => {
    setCurrentPath(newPath)
    setFileManagementSearch('')
    setSelectedItems([])
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

  const getFileIcon = (fileType) => {
    const iconMap = {
      pdf: '📄',
      doc: '📝',
      docx: '📝', 
      xls: '📊',
      xlsx: '📊',
      txt: '📄',
      json: '📄',
      js: '📜',
      jsx: '📜',
      ts: '📜',
      tsx: '📜',
      html: '🌐',
      css: '🎨',
      jpg: '🖼️',
      jpeg: '🖼️',
      png: '🖼️',
      gif: '🖼️',
      svg: '🖼️',
      zip: '🗜️',
      rar: '🗜️',
      '7z': '🗜️',
      mp4: '🎥',
      avi: '🎥',
      mov: '🎥',
      mp3: '🎵',
      wav: '🎵',
      exe: '⚙️',
      msi: '⚙️',
      unknown: '📄'
    }
    return iconMap[fileType] || iconMap.unknown
  }

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return '--'
    }
  }

  return (
    <div className="file-management-section">
      <div className="page-header">
        <h1>File Management</h1>
        <p>Browse and manage files in the network projects directory</p>
        {networkInfo && (
          <div className={`network-status ${networkInfo.accessible ? 'accessible' : 'not-accessible'}`}>
            <span className="status-icon">{networkInfo.accessible ? '🟢' : '🔴'}</span>
            <span className="status-text">
              {networkInfo.accessible ? 'Network directory accessible' : 'Network directory not accessible'}
            </span>
            <span className="network-path">\\KMTI-NAS\Shared\Public\PROJECTS</span>
          </div>
        )}
      </div>
      
      {/* Navigation Controls */}
      <div className="file-nav-controls">
        {/* Breadcrumb Navigation */}
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
        
        {/* Search and View Controls */}
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
          
          <div className="view-mode-toggle">
            <button
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              ☰
            </button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              ≡
            </button>
          </div>
          
          <button 
            className="refresh-btn"
            onClick={() => fetchFileSystemItems()}
            disabled={isLoading}
            title="Refresh directory"
          >
            🔄
          </button>
        </div>
      </div>
      
      {/* Messages */}
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
      
      {/* File System Display */}
      <div className="file-system-container">
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading files from network directory...</p>
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="files-grid">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className={`file-item ${item.type} ${selectedItems.includes(item.id) ? 'selected' : ''}`}
                    onClick={() => item.type === 'folder' ? navigateToPath(item.path) : null}
                    title={`${item.name}${item.size ? ` (${item.size})` : ''}${item.modified ? ` - Modified: ${formatDate(item.modified)}` : ''}`}
                  >
                    <div className="file-icon-container">
                      <div className={`file-icon ${item.type === 'folder' ? 'folder-icon' : 'file-icon-' + (item.fileType || 'unknown')}`}>
                        {item.type === 'folder' ? (
                          item.isParent ? '←' : '📁'
                        ) : (
                          getFileIcon(item.fileType)
                        )}
                      </div>
                      {item.type === 'folder' && !item.isParent && (
                        <div className="folder-overlay"></div>
                      )}
                    </div>
                    <div className="file-info">
                      <div className="file-name" title={item.name}>
                        {item.displayName}
                      </div>
                      {item.size && (
                        <div className="file-size">{item.size}</div>
                      )}
                      {item.modified && (
                        <div className="file-date">
                          {formatDate(item.modified)}
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
                      <th>Size</th>
                      <th>Type</th>
                      <th>Modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr
                        key={item.id}
                        className={`file-row ${item.type} ${selectedItems.includes(item.id) ? 'selected' : ''}`}
                        onClick={() => item.type === 'folder' ? navigateToPath(item.path) : null}
                        title={item.name !== item.displayName ? `Full name: ${item.name}` : ''}
                      >
                        <td className="file-name-cell">
                          <div className="file-name-container">
                            <div className={`file-icon-small ${item.type === 'folder' ? 'folder-icon' : 'file-icon-' + (item.fileType || 'unknown')}`}>
                              {item.type === 'folder' ? (
                                item.isParent ? '←' : '📁'
                              ) : (
                                getFileIcon(item.fileType)
                              )}
                            </div>
                            <span className="file-name">{item.displayName}</span>
                            {item.name !== item.displayName && (
                              <span className="truncated-indicator" title={`Full name: ${item.name}`}>*</span>
                            )}
                          </div>
                        </td>
                        <td className="file-size-cell">
                          {item.size || (item.type === 'folder' ? '--' : '')}
                        </td>
                        <td className="file-type-cell">
                          {item.type === 'folder' ? 'Folder' : (item.fileType?.toUpperCase() || 'File')}
                        </td>
                        <td className="file-date-cell">
                          {item.modified ? formatDate(item.modified) : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {!isLoading && filteredItems.length === 0 && (
              <div className="empty-state">
                <h3>No files found</h3>
                <p>This directory is empty or no files match your search criteria.</p>
                {!networkInfo?.accessible && (
                  <div className="network-help">
                    <p><strong>Network Access Issue:</strong></p>
                    <ul>
                      <li>Check VPN connection if working remotely</li>
                      <li>Verify access to \\KMTI-NAS\Shared\Public\PROJECTS</li>
                      <li>Contact IT for network permissions</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default FileManagement
