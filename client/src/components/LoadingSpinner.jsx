import React from 'react'
import '../css/LoadingSpinner.css'

const LoadingSpinner = ({ size = 'medium', color = '#4CAF50', fullScreen = false }) => {
  const sizeClasses = {
    small: 'spinner-small',
    medium: 'spinner-medium',
    large: 'spinner-large'
  };

  const spinnerContent = (
    <div className="spinner-container">
      <div 
        className={`spinner ${sizeClasses[size]}`}
        style={{ borderTopColor: color }}
      />
      <p className="spinner-text">Loading...</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="spinner-fullscreen">
        {spinnerContent}
      </div>
    );
  }

  return spinnerContent;
};

export default React.memo(LoadingSpinner);
