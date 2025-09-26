import { useRef } from 'react';
import './css/FileUploadTab.css';

const FileUploadTab = ({ 
  user,
  uploadedFile,
  setUploadedFile,
  description,
  setDescription,
  isUploading,
  handleFileUpload,
  formatFileSize 
}) => {
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (100MB limit)
      if (file.size > 100 * 1024 * 1024) {
        // Handle error - this should be passed as a prop or handled in parent
        return;
      }
      setUploadedFile(file);
    }
  };

  const clearForm = () => {
    setUploadedFile(null);
    setDescription('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="upload-section">
      <div className="page-header">
        <h2>Submit File for Approval</h2>
        <p>Upload your file to begin the approval workflow. Your team leader will review it first, followed by an administrator.</p>
      </div>

      <div className="upload-container">
        <div className="upload-card">
          <form onSubmit={handleFileUpload} className="upload-form">
            <div className="form-group">
              <label className="form-label">Select File</label>
              <div className="file-input-container">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif,.zip"
                  className="file-input"
                  disabled={isUploading}
                />
                <div className="file-input-info">
                  <p>Supported formats: PDF, Word, Excel, Text, Images, ZIP</p>
                  <p>Maximum file size: 100MB</p>
                </div>
              </div>
            </div>

            {uploadedFile && (
              <div className="selected-file-info">
                <h4>Selected File:</h4>
                <div className="file-preview">
                  <div className="file-icon">{uploadedFile.name.split('.').pop().toUpperCase()}</div>
                  <div className="file-details">
                    <div className="file-name">{uploadedFile.name}</div>
                    <div className="file-size">{formatFileSize(uploadedFile.size)}</div>
                    <div className="file-type">{uploadedFile.type || 'Unknown type'}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide a brief description of this file and its purpose..."
                rows="4"
                className="form-textarea"
                disabled={isUploading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Submission Details</label>
              <div className="submission-info">
                <div className="info-item">
                  <span className="info-label">Team:</span>
                  <span className="info-value">{user.team}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Submitted by:</span>
                  <span className="info-value">{user.fullName} ({user.username})</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Will be reviewed by:</span>
                  <span className="info-value">{user.team} Team Leader → Administrator</span>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                disabled={!uploadedFile || isUploading}
                className={`btn btn-primary ${isUploading ? 'loading' : ''}`}
              >
                {isUploading ? 'Uploading...' : 'Submit for Approval'}
              </button>
              <button
                type="button"
                onClick={clearForm}
                disabled={isUploading}
                className="btn btn-secondary"
              >
                Clear
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FileUploadTab;