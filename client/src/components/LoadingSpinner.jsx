// LoadingSpinner.jsx
import React from 'react';
import '../css/LoadingSpinner.css'; // Adjust the path if necessary

const LoadingSpinner = ({ size = 'medium', message = '', className = '' }) => {
  const sizeClass = `loading-spinner-${size}`;
  const hasMessage = message ? ' loading-spinner-with-message' : '';

  return (
    <div className={`loading-spinner-container ${className}`}>
      <div className={`loading-spinner ${sizeClass}${hasMessage}`}>
        {/* Use a CSS-based "Pulse Grid" animation */}
        <div className="loading-spinner-css-grid">
          <div className="css-dot"></div>
          <div className="css-dot"></div>
          <div className="css-dot"></div>
        </div>
        {message && <div className="loading-spinner-message">{message}</div>}
      </div>
    </div>
  );
};

export default LoadingSpinner;