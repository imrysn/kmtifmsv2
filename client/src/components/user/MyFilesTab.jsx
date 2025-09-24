import FileCard from './FileCard';
import './css/MyFilesTab.css';

const MyFilesTab = ({ 
  filteredFiles,
  isLoading,
  filterStatus,
  setFilterStatus,
  searchQuery,
  setSearchQuery,
  setActiveTab,
  fetchUserFiles,
  formatFileSize,
  openFileModal,
  files
}) => {
  return (
    <div className="my-files-section">
      <div className="page-header">
        <h2>My Files</h2>
        <p>Track the status of all your submitted files through the approval workflow.</p>
      </div>

      {/* Filters and Search */}
      <div className="files-controls">
        <div className="files-filters">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="form-select"
          >
            <option value="all">All Files</option>
            <option value="pending">Under Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          
          <div className="files-search">
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button 
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>
        
        <div className="files-actions">
          <button 
            className="btn btn-primary"
            onClick={() => setActiveTab('upload')}
          >
            Submit New File
          </button>
          <button 
            className="btn btn-secondary"
            onClick={fetchUserFiles}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Files List */}
      <div className="files-container">
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading your files...</p>
          </div>
        ) : filteredFiles.length > 0 ? (
          <div className="files-grid">
            {filteredFiles.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                formatFileSize={formatFileSize}
                onFileClick={openFileModal}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📁</div>
            <h3>No files found</h3>
            <p>
              {files.length === 0 
                ? "You haven't uploaded any files yet." 
                : "No files match your current filter criteria."}
            </p>
            <button 
              className="btn btn-primary"
              onClick={() => setActiveTab('upload')}
            >
              Submit Your First File
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyFilesTab;