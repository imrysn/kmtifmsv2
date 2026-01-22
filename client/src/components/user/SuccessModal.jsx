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

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return '#D1FAE5';
      case 'error':
        return '#FEE2E2';
      case 'warning':
        return '#FEF3C7';
      case 'info':
        return '#DBEAFE';
      default:
        return '#D1FAE5';
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return '#34D399';
      case 'error':
        return '#F87171';
      case 'warning':
        return '#FBBF24';
      case 'info':
        return '#60A5FA';
      default:
        return '#34D399';
    }
  };

  const getTextColor = () => {
    switch (type) {
      case 'success':
        return '#065F46';
      case 'error':
        return '#991B1B';
      case 'warning':
        return '#92400E';
      case 'info':
        return '#1E40AF';
      default:
        return '#065F46';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      backgroundColor: getBackgroundColor(),
      border: `1px solid ${getBorderColor()}`,
      borderRadius: '8px',
      padding: '12px 16px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      maxWidth: '400px',
      animation: 'slideIn 0.3s ease-out'
    }}>
      <span style={{ fontSize: '20px' }}>{getIcon()}</span>
      <div style={{ flex: 1 }}>
        {title && <div style={{ fontSize: '14px', fontWeight: '600', color: getTextColor(), marginBottom: '2px' }}>{title}</div>}
        <div style={{ fontSize: '14px', color: getTextColor() }}>{message}</div>
      </div>
      <button 
        onClick={onClose}
        type="button"
        style={{
          background: 'none',
          border: 'none',
          color: getTextColor(),
          fontSize: '20px',
          cursor: 'pointer',
          padding: '0',
          lineHeight: 1
        }}
      >
        ×
      </button>
    </div>
  );
};

export default SuccessModal;
