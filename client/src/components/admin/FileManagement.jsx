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
        item.name.toLowerCase().includes(fileManagementSearch.toLowerCase())
      )
      setFilteredItems(filtered)
    }
  }, [fileSystemItems, fileManagementSearch])

  const fetchFileSystemItems = async () => {
    setIsLoading(true)
    try {
      // Simulate API call with mock file system data
      const mockItems = generateMockFileSystem(currentPath)
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 600))
      setFileSystemItems(mockItems)
      setFilteredItems(mockItems)
    } catch (error) {
      console.error('Error fetching file system items:', error)
      setError('Failed to load file system')
    } finally {
      setIsLoading(false)
    }
  }

  const generateMockFileSystem = (path) => {
    const items = []
    
    // Add parent directory if not at root
    if (path !== '/') {
      items.push({
        id: 'parent',
        name: '..',
        type: 'folder',
        path: getParentPath(path),
        size: null,
        modified: null,
        isParent: true
      })
    }
    
    // Mock folder structure
    const mockStructure = {
      '/': {
        folders: ['Documents', 'Images', 'Projects', 'Archives'],
        files: [
          { name: 'README.txt', size: '2.1 KB', type: 'text' },
          { name: 'system_config.json', size: '1.5 KB', type: 'json' }
        ]
      },
      '/Documents': {
        folders: ['Reports', 'Templates', 'Drafts'],
        files: [
          { name: 'annual_report_2024.pdf', size: '3.2 MB', type: 'pdf' },
          { name: 'meeting_notes.docx', size: '156 KB', type: 'docx' },
          { name: 'budget_analysis.xlsx', size: '892 KB', type: 'xlsx' }
        ]
      },
      '/Images': {
        folders: ['Screenshots', 'Logos', 'Thumbnails'],
        files: [
          { name: 'company_logo.png', size: '245 KB', type: 'png' },
          { name: 'banner_image.jpg', size: '1.8 MB', type: 'jpg' },
          { name: 'profile_pics.zip', size: '5.4 MB', type: 'zip' }
        ]
      },
      '/Projects': {
        folders: ['Active', 'Completed', 'Archive'],
        files: [
          { name: 'project_timeline.pdf', size: '678 KB', type: 'pdf' },
          { name: 'requirements.docx', size: '234 KB', type: 'docx' }
        ]
      }
    }
    
    const currentStructure = mockStructure[path] || { folders: [], files: [] }
    
    // Add folders
    currentStructure.folders.forEach((folderName, index) => {
      items.push({
        id: `folder-${index}`,
        name: folderName,
        type: 'folder',
        path: path === '/' ? `/${folderName}` : `${path}/${folderName}`,
        size: null,
        modified: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        isParent: false
      })
    })
    
    // Add files
    currentStructure.files.forEach((file, index) => {
      items.push({
        id: `file-${index}`,
        name: file.name,
        type: 'file',
        fileType: file.type,
        path: path === '/' ? `/${file.name}` : `${path}/${file.name}`,
        size: file.size,
        modified: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000),
        isParent: false
      })
    })
    
    return items
  }

  const getParentPath = (path) => {
    const parts = path.split('/').filter(p => p)
    if (parts.length <= 1) return '/'
    return '/' + parts.slice(0, -1).join('/')
  }

  const navigateToPath = (newPath) => {
    setCurrentPath(newPath)
    setFileManagementSearch('')
    setSelectedItems([])
  }

  const getBreadcrumbs = () => {
    if (currentPath === '/') return [{ name: 'Root', path: '/' }]
    
    const parts = currentPath.split('/').filter(p => p)
    const breadcrumbs = [{ name: 'Root', path: '/' }]
    
    let currentBreadcrumbPath = ''
    parts.forEach(part => {
      currentBreadcrumbPath += `/${part}`
      breadcrumbs.push({
        name: part,
        path: currentBreadcrumbPath
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
      jpg: '🖼️',
      png: '🖼️',
      zip: '🗜️',
      unknown: '📄'
    }
    return iconMap[fileType] || iconMap.unknown
  }

  return (
    <div className="file-management-section">
      <div className="page-header">
        <h1>File Management</h1>
        <p>Browse and manage files and folders in the system directory</p>
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
            <p>Loading files...</p>
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
                    onDoubleClick={() => item.type === 'file' ? console.log('Open file:', item.name) : null}
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
                        {item.name}
                      </div>
                      {item.size && (
                        <div className="file-size">{item.size}</div>
                      )}
                      {item.modified && (
                        <div className="file-date">
                          {item.modified.toLocaleDateString()}
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
                        onDoubleClick={() => item.type === 'file' ? console.log('Open file:', item.name) : null}
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
                            <span className="file-name">{item.name}</span>
                          </div>
                        </td>
                        <td className="file-size-cell">
                          {item.size || (item.type === 'folder' ? '--' : '')}
                        </td>
                        <td className="file-type-cell">
                          {item.type === 'folder' ? 'Folder' : (item.fileType?.toUpperCase() || 'File')}
                        </td>
                        <td className="file-date-cell">
                          {item.modified ? item.modified.toLocaleString() : '--'}
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
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default FileManagement
