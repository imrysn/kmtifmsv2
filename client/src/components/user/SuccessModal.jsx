import { useEffect } from 'react';
import './css/SuccessModal.css';

const SuccessModal = ({ isOpen, onClose, title, message, type = 'success' }) => {
  useEffect(() => {
    if (isOpen) {
      // Auto-close after 3 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '✓';
    }
  };

  return (
    <div className="success-modal-overlay">
      <div className={`success-modal success-modal-${type}`}>
        <div className="success-modal-content">
          <div className={`success-icon success-icon-${type}`}>
            {getIcon()}
          </div>
          <div className="success-text">
            {title && <h3 className="success-title">{title}</h3>}
            <p className="success-message">{message}</p>
          </div>
          <button 
            className="success-close" 
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        <div className="success-progress-bar">
          <div className={`success-progress-fill success-progress-${type}`}></div>
        </div>
      </div>
    </div>
  );
};

export default SuccessModal;
