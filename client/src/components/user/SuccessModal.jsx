import { useEffect } from 'react';
import './css/SuccessModal.css';

const SuccessModal = ({ isOpen, onClose, title, message, type = 'success' }) => {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success': return '✓';
      case 'error':   return '✕';
      case 'warning': return '⚠';
      case 'info':    return 'ℹ';
      default:        return '✓';
    }
  };

  const colors = {
    success: { bg: '#dcfce7', border: '#86efac', icon: '#16a34a', text: '#15803d', progress: '#16a34a' },
    error:   { bg: '#fee2e2', border: '#fca5a5', icon: '#dc2626', text: '#b91c1c', progress: '#dc2626' },
    warning: { bg: '#fef9c3', border: '#fde047', icon: '#ca8a04', text: '#a16207', progress: '#ca8a04' },
    info:    { bg: '#dbeafe', border: '#93c5fd', icon: '#2563eb', text: '#1d4ed8', progress: '#2563eb' },
  };

  const c = colors[type] || colors.success;

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 99999,
      pointerEvents: 'none',
    }}>
      <div style={{
        backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: '10px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
        minWidth: '280px',
        maxWidth: '380px',
        pointerEvents: 'auto',
        overflow: 'hidden',
        animation: 'smSlideIn 0.3s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Content row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 14px',
        }}>
          {/* Icon */}
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            border: `2px solid ${c.icon}`,
            backgroundColor: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: c.icon,
            fontSize: '14px',
            fontWeight: '700',
            flexShrink: 0,
          }}>
            {getIcon()}
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {title && (
              <div style={{ fontSize: '13px', fontWeight: '700', color: c.text, lineHeight: 1.3 }}>
                {title}
              </div>
            )}
            <div style={{ fontSize: '12px', color: c.text, lineHeight: 1.4, marginTop: title ? '2px' : 0 }}>
              {message}
            </div>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            type="button"
            style={{
              background: 'rgba(255,255,255,0.6)',
              border: 'none',
              borderRadius: '50%',
              width: '22px',
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              color: c.text,
              cursor: 'pointer',
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ height: '3px', backgroundColor: 'rgba(255,255,255,0.4)' }}>
          <div style={{
            height: '100%',
            backgroundColor: c.progress,
            animation: 'smProgress 3s linear forwards',
          }} />
        </div>
      </div>
    </div>
  );
};

export default SuccessModal;
