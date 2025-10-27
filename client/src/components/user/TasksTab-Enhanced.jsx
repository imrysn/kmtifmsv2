import { useState, useEffect } from 'react';
import './css/TasksTab-Enhanced.css';

const TasksTab = ({ user }) => {
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
    if (assignment.user_status === 'submitted') {
      return { text: 'PENDING', icon: '⏳', class: 'status-pending-review' };
    } else if (isOverdue(assignment.due_date)) {
      return { text: 'OVERDUE', icon: '⚠️', class: 'status-overdue' };
    } else {
      const days = getDaysUntilDue(assignment.due_date);
      if (days !== null && days <= 2) {
        return { text: 'DUE SOON', icon: '🔔', class: 'status-due-soon' };
      }
      return { text: 'PENDING', icon: '⏳', class: 'status-pending' };
    }
  };

  const handleSubmit = (assignment) => {
    setCurrentAssignment(assignment);
    setSelectedFile(null);
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
        setSuccess('Assignment submitted successfully!');
        setShowSubmitModal(false);
        setSelectedFile(null);
        setCurrentAssignment(null);
        fetchAssignments();
        fetchUserFiles();
        
        setTimeout(() => setSuccess(''), 5000);
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

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const pendingAssignments = assignments.filter(assignment => assignment.user_status !== 'submitted');
  const submittedAssignments = assignments.filter(assignment => assignment.user_status === 'submitted');

  return (
    <div className="tasks-container">
      {/* Header */}
      <div className="tasks-header">
        <div className="tasks-header-content">
          <h1>My Tasks</h1>
          <p className="tasks-subtitle">{assignments.length} assignment{assignments.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          className="tasks-refresh-btn"
          onClick={fetchAssignments}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="tasks-alert tasks-alert-error">
          <span>{error}</span>
          <button onClick={clearMessages} className="tasks-alert-close">×</button>
        </div>
      )}
      {success && (
        <div className="tasks-alert tasks-alert-success">
          <span>{success}</span>
          <button onClick={clearMessages} className="tasks-alert-close">×</button>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="tasks-stats">
        <div className="tasks-stat-card tasks-stat-pending">
          <div className="tasks-stat-icon">⏱</div>
          <div className="tasks-stat-info">
            <div className="tasks-stat-number">{pendingAssignments.length}</div>
            <div className="tasks-stat-label">Pending</div>
          </div>
        </div>

        <div className="tasks-stat-card tasks-stat-submitted">
          <div className="tasks-stat-icon">✓</div>
          <div className="tasks-stat-info">
            <div className="tasks-stat-number">{submittedAssignments.length}</div>
            <div className="tasks-stat-label">Submitted</div>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="tasks-loading">
          <div className="tasks-spinner"></div>
          <p>Loading assignments...</p>
        </div>
      ) : assignments.length > 0 ? (
        <div className="tasks-content">
          {/* Pending Assignments */}
          {pendingAssignments.length > 0 && (
            <div className="tasks-section">
              <h2 className="tasks-section-title">Pending Assignments</h2>
              <div className="tasks-list">
                {pendingAssignments.map((assignment) => {
                  const status = getStatusInfo(assignment);
                  const daysLeft = getDaysUntilDue(assignment.due_date);

                  return (
                    <div key={assignment.id} className="tasks-card">
                      <div className="tasks-card-header">
                        <h3 className="tasks-card-title">{assignment.title}</h3>
                        <span className={`tasks-status-badge ${status.class}`}>
                          ⏱ {status.text}
                        </span>
                      </div>

                      {assignment.description && (
                        <p className="tasks-card-description">{assignment.description}</p>
                      )}

                      <div className="tasks-card-details">
                        <div className="tasks-detail-row">
                          <span className="tasks-detail-label">Assigned by:</span>
                          <span className="tasks-detail-value">{assignment.team_leader_username}</span>
                        </div>

                        {assignment.due_date && (
                          <div className="tasks-detail-row">
                            <span className="tasks-detail-label">Due date:</span>
                            <span className="tasks-detail-value">
                              {formatDate(assignment.due_date)}
                              {daysLeft !== null && (
                                <span className={`tasks-days-left ${daysLeft < 0 ? 'overdue' : daysLeft <= 2 ? 'urgent' : ''}`}>
                                  {daysLeft < 0 ? ` (${Math.abs(daysLeft)} days overdue)` : daysLeft === 0 ? ' (Due today!)' : daysLeft === 1 ? ' (Due tomorrow)' : ` (${daysLeft} days left)`}
                                </span>
                              )}
                            </span>
                          </div>
                        )}

                        {assignment.file_type_required && (
                          <div className="tasks-detail-row">
                            <span className="tasks-detail-label">Required type:</span>
                            <span className="tasks-detail-value">{assignment.file_type_required}</span>
                          </div>
                        )}

                        {assignment.max_file_size && (
                          <div className="tasks-detail-row">
                            <span className="tasks-detail-label">Max size:</span>
                            <span className="tasks-detail-value">{formatFileSize(assignment.max_file_size)}</span>
                          </div>
                        )}
                      </div>

                      <div className="tasks-card-footer">
                        <button
                          className="tasks-submit-btn"
                          onClick={() => handleSubmit(assignment)}
                          disabled={userFiles.filter(f => f.status === 'final_approved').length === 0}
                        >
                          Submit Assignment
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
            <div className="tasks-section">
              <h2 className="tasks-section-title">Submitted Assignments</h2>
              <div className="tasks-list">
                {submittedAssignments.map((assignment) => (
                  <div key={assignment.id} className="tasks-card tasks-card-submitted">
                    <div className="tasks-card-header">
                      <h3 className="tasks-card-title">{assignment.title}</h3>
                      <span className="tasks-status-badge status-submitted">
                        ✓ Submitted
                      </span>
                    </div>

                    {assignment.description && (
                      <p className="tasks-card-description">{assignment.description}</p>
                    )}

                    <div className="tasks-card-details">
                      <div className="tasks-detail-row">
                        <span className="tasks-detail-label">Assigned by:</span>
                        <span className="tasks-detail-value">{assignment.team_leader_username}</span>
                      </div>

                      {assignment.user_submitted_at && (
                        <div className="tasks-detail-row">
                          <span className="tasks-detail-label">Submitted:</span>
                          <span className="tasks-detail-value">{formatDate(assignment.user_submitted_at)}</span>
                        </div>
                      )}

                      {assignment.submitted_file_name && (
                        <div className="tasks-detail-row">
                          <span className="tasks-detail-label">File:</span>
                          <span className="tasks-detail-value tasks-file-name">{assignment.submitted_file_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="tasks-empty">
          <div className="tasks-empty-icon">📋</div>
          <h3>No assignments</h3>
          <p>You don't have any assignments at this time.</p>
        </div>
      )}

      {/* Submit Modal */}
      {showSubmitModal && currentAssignment && (
        <div className="tasks-modal-overlay" onClick={() => setShowSubmitModal(false)}>
          <div className="tasks-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tasks-modal-header">
              <h3>Submit Assignment</h3>
              <button className="tasks-modal-close" onClick={() => setShowSubmitModal(false)}>×</button>
            </div>

            <div className="tasks-modal-body">
              {/* Assignment Info */}
              <div className="tasks-assignment-info">
                <h4 className="tasks-assignment-title">{currentAssignment.title}</h4>
                {currentAssignment.description && (
                  <p className="tasks-assignment-description">{currentAssignment.description}</p>
                )}
              </div>

              {/* File Selection */}
              <div className="tasks-file-selection">
                <h4 className="tasks-selection-title">Select a file to submit:</h4>
                {userFiles.filter(f => f.status === 'final_approved').length > 0 ? (
                  <div className="tasks-file-list">
                    {userFiles
                      .filter(f => f.status === 'final_approved')
                      .map((file) => (
                        <div
                          key={file.id}
                          className={`tasks-file-item ${selectedFile?.id === file.id ? 'selected' : ''}`}
                          onClick={() => setSelectedFile(file)}
                        >
                          <div className="tasks-file-details">
                            <div className="tasks-file-name">{file.original_name}</div>
                            <div className="tasks-file-meta">
                              {formatFileSize(file.file_size)} • {formatDate(file.uploaded_at)}
                            </div>
                          </div>
                          <div className="tasks-radio">
                            {selectedFile?.id === file.id && <div className="tasks-radio-dot"></div>}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="tasks-no-files">
                    <p>You need to have approved files to submit assignments.</p>
                    <p>Please upload files and wait for approval first.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="tasks-modal-footer">
              <button
                className="tasks-btn tasks-btn-cancel"
                onClick={() => setShowSubmitModal(false)}
              >
                Cancel
              </button>
              <button
                className="tasks-btn tasks-btn-submit"
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
