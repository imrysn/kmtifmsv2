import { useState, useEffect } from 'react';
import './css/TasksTab.css';

const TasksTab = ({ user }) => {
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [userFiles, setUserFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchAssignments();
    fetchUserFiles();
  }, []);

  const fetchAssignments = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`http://localhost:3001/api/assignments/user/${user.id}`);
      const data = await response.json();

      if (data.success) {
        setAssignments(data.assignments || []);
      } else {
        setError('Failed to fetch assignments');
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserFiles = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/files/user/${user.id}`);
      const data = await response.json();

      if (data.success) {
        // Only show files that haven't been submitted for assignments
        const unsubmittedFiles = data.files.filter(file =>
          !assignments.some(assignment => assignment.submitted_file_id === file.id)
        );
        setUserFiles(unsubmittedFiles || []);
      }
    } catch (error) {
      console.error('Error fetching user files:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const getDaysUntilDue = (dueDate) => {
    if (!dueDate) return null;
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusInfo = (assignment) => {
    // Check if file was deleted - assignment shows submitted but file doesn't exist
    if (assignment.user_status === 'submitted' && !assignment.submitted_file_id) {
      return {
        text: 'File Deleted - Resubmit',
        class: 'status-file-deleted',
        icon: '⚠',
        needsResubmit: true
      };
    }
    
    if (assignment.user_status === 'submitted') {
      return {
        text: 'Submitted',
        class: 'status-submitted',
        icon: '✓'
      };
    } else if (isOverdue(assignment.due_date)) {
      return {
        text: 'Overdue',
        class: 'status-overdue',
        icon: '⚠'
      };
    } else {
      const days = getDaysUntilDue(assignment.due_date);
      if (days !== null && days <= 2) {
        return {
          text: 'Due Soon',
          class: 'status-due-soon',
          icon: '🔔'
        };
      }
      return {
        text: 'Pending',
        class: 'status-pending',
        icon: '⏳'
      };
    }
  };

  const handleSubmit = (assignment) => {
    setCurrentAssignment(assignment);
    setShowSubmitModal(true);
  };

  const submitAssignment = async () => {
    if (!currentAssignment || !selectedFile) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('http://localhost:3001/api/assignments/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assignmentId: currentAssignment.id,
          userId: user.id,
          fileId: selectedFile.id
        })
      });

      const data = await response.json();

      if (data.success) {
        setShowSubmitModal(false);
        setSelectedFile(null);
        setCurrentAssignment(null);
        fetchAssignments(); // Refresh assignments to show submitted status
        fetchUserFiles(); // Refresh available files
      } else {
        setError(data.message || 'Failed to submit assignment');
      }
    } catch (error) {
      console.error('Error submitting assignment:', error);
      setError('Failed to submit assignment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const openFile = async (fileId, filePath) => {
    try {
      // Check if running in Electron
      if (window.electron && window.electron.openFileInApp) {
        // In Electron - open file directly from network location
        // Get the actual file path from server
        const response = await fetch(`http://localhost:3001/api/files/${fileId}/path`);
        const data = await response.json();
        
        if (data.success && data.filePath) {
          // Open file with system default application
          const result = await window.electron.openFileInApp(data.filePath);
          
          if (!result.success) {
            alert(result.error || 'Failed to open file with system application');
          }
        } else {
          throw new Error('Could not get file path');
        }
      } else {
        // In browser - just open in new tab
        const fileUrl = `http://localhost:3001${filePath}`;
        window.open(fileUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('Error opening file:', error);
      alert('Failed to open file. Please try again.');
    }
  };

  // Separate assignments - treat file-deleted as pending
  const pendingAssignments = assignments.filter(assignment => 
    assignment.user_status !== 'submitted' || 
    (assignment.user_status === 'submitted' && !assignment.submitted_file_id)
  );
  const submittedAssignments = assignments.filter(assignment => 
    assignment.user_status === 'submitted' && assignment.submitted_file_id
  );

  return (
    <div className="user-tasks-component tasks-wrapper">
      {/* Header */}
      <div className="tasks-header">
        <div className="header-left">
          <h1>My Tasks</h1>
          <p className="header-subtitle">{assignments.length} assignments</p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')} className="error-close">×</button>
        </div>
      )}

      {/* Statistics */}
      <div className="stats-row">
        <div className="stat-box pending-box">
          <div className="stat-icon pending-icon">⏳</div>
          <div className="stat-text">
            <div className="stat-number">{pendingAssignments.length}</div>
            <div className="stat-name">Pending</div>
          </div>
        </div>

        <div className="stat-box submitted-box">
          <div className="stat-icon submitted-icon">✓</div>
          <div className="stat-text">
            <div className="stat-number">{submittedAssignments.length}</div>
            <div className="stat-name">Submitted</div>
          </div>
        </div>
      </div>

      {/* Assignments List */}
      <div className="assignments-section">
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading assignments...</p>
          </div>
        ) : assignments.length > 0 ? (
          <>
            {/* Pending Assignments */}
            {pendingAssignments.length > 0 && (
              <div className="assignments-group">
                <h3 className="group-title">Pending Assignments</h3>
                <div className="assignments-list">
                  {pendingAssignments.map((assignment) => {
                    const status = getStatusInfo(assignment);
                    const daysUntilDue = getDaysUntilDue(assignment.due_date);

                    return (
                      <div key={assignment.id} className={`assignment-card ${status.class}`}>
                        <div className="assignment-header">
                          <h4 className="assignment-title">{assignment.title}</h4>
                          <div className={`status-badge ${status.class}`}>
                            {status.icon} {status.text}
                          </div>
                        </div>

                        <div className="assignment-content">
                          {assignment.description && (
                            <p className="assignment-description">{assignment.description}</p>
                          )}

                          <div className="assignment-meta">
                            <div className="meta-item">
                              <span className="meta-label">Assigned by:</span>
                              <span className="meta-value">{assignment.team_leader_username}</span>
                            </div>

                            {assignment.file_type_required && (
                              <div className="meta-item">
                                <span className="meta-label">Required type:</span>
                                <span className="meta-value">{assignment.file_type_required}</span>
                              </div>
                            )}

                            {assignment.max_file_size && (
                              <div className="meta-item">
                                <span className="meta-label">Max size:</span>
                                <span className="meta-value">{formatFileSize(assignment.max_file_size)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="assignment-actions">
                          {status.needsResubmit && (
                            <div className="warning-banner" style={{
                              backgroundColor: '#FEF3C7',
                              padding: '12px',
                              borderRadius: '6px',
                              marginBottom: '12px',
                              border: '1px solid #F59E0B'
                            }}>
                              <p style={{ margin: 0, color: '#92400E', fontSize: '14px' }}>
                                ⚠️ Your submitted file was deleted. Please upload a new file to resubmit this assignment.
                              </p>
                            </div>
                          )}
                          <button
                            className="btn btn-submit"
                            onClick={() => handleSubmit(assignment)}
                            disabled={userFiles.length === 0}
                          >
                            {status.needsResubmit ? 'Re-submit Assignment' : 'Submit Assignment'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Submitted Assignments */}
            {submittedAssignments.length > 0 && (
              <div className="assignments-group">
                <h3 className="group-title">Submitted Assignments</h3>
                <div className="assignments-list">
                  {submittedAssignments.map((assignment) => (
                    <div key={assignment.id} className="assignment-card status-submitted">
                      <div className="assignment-header">
                        <h4 className="assignment-title">{assignment.title}</h4>
                        <div className="status-badge status-submitted">
                          ✓ Submitted
                        </div>
                      </div>

                      <div className="assignment-content">
                        {assignment.description && (
                          <p className="assignment-description">{assignment.description}</p>
                        )}

                        <div className="assignment-meta">
                          <div className="meta-item">
                            <span className="meta-label">Assigned by:</span>
                            <span className="meta-value">{assignment.team_leader_username}</span>
                          </div>

                          {assignment.user_submitted_at && (
                            <div className="meta-item">
                              <span className="meta-label">Submitted:</span>
                              <span className="meta-value">{formatDate(assignment.user_submitted_at)}</span>
                            </div>
                          )}

                          {assignment.submitted_file_name && assignment.submitted_file_id && (
                            <div className="meta-item">
                              <span className="meta-label">File:</span>
                              <span 
                                className="meta-value file-name clickable-file" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openFile(assignment.submitted_file_id, assignment.submitted_file_path);
                                }}
                                style={{ cursor: 'pointer', color: '#4F46E5', textDecoration: 'underline' }}
                                title="Click to open file"
                              >
                                {assignment.submitted_file_name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No assignments</h3>
            <p>You don't have any assignments at this time.</p>
          </div>
        )}
      </div>

      {/* Submit Assignment Modal */}
      {showSubmitModal && currentAssignment && (
        <div className="modal-overlay" onClick={() => setShowSubmitModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Submit Assignment</h3>
              <button
                className="modal-close"
                onClick={() => setShowSubmitModal(false)}
              >×</button>
            </div>

            <div className="modal-body">
              <div className="assignment-preview">
                <h4>{currentAssignment.title}</h4>
                {currentAssignment.description && (
                  <p>{currentAssignment.description}</p>
                )}
              </div>

              <div className="file-selection">
                <h4>Select a file to submit:</h4>
                {userFiles.filter(f => f.status === 'final_approved').length > 0 ? (
                  <div className="file-options">
                    {userFiles
                      .filter(f => f.status === 'final_approved')
                      .map((file) => (
                        <div
                          key={file.id}
                          className={`file-option ${selectedFile?.id === file.id ? 'selected' : ''}`}
                          onClick={() => setSelectedFile(file)}
                        >
                          <div className="file-info">
                            <div className="file-name">{file.original_name}</div>
                            <div className="file-meta">
                              {formatFileSize(file.file_size)} • {formatDate(file.uploaded_at)}
                            </div>
                          </div>
                          <div className="radio-indicator">
                            {selectedFile?.id === file.id && <div className="radio-selected"></div>}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="no-files-message">
                    <p>You need to have approved files to submit assignments.</p>
                    <p>Please upload files and wait for admin approval first.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-cancel"
                onClick={() => setShowSubmitModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-submit"
                onClick={submitAssignment}
                disabled={!selectedFile || isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksTab;
