// LoadingSpinner.jsx
import React from 'react';
import '../css/LoadingSpinner.css';

const LoadingSpinner = ({ size = 'medium', message = '', className = '' }) => {
  const sizeClass = `loading-spinner-${size}`;
  const hasMessage = message ? ' loading-spinner-with-message' : '';

  return (
    <div className={`loading-spinner-container ${className}`}>
      <div className={`loading-spinner ${sizeClass}${hasMessage}`}>
        <div className="loading-spinner-icon"></div>
        {message && <div className="loading-spinner-message">{message}</div>}
      </div>
    </div>
  );
};

export default LoadingSpinner;