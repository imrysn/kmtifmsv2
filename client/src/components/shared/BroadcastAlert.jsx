import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import useStore from '../../store/useStore';

const BroadcastAlert = ({ broadcast, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const { theme } = useStore();
  const isLight = theme === 'light';

  useEffect(() => {
    // Small delay to trigger CSS entrance animation
    setTimeout(() => setIsVisible(true), 10);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for exit animation
  };

  if (!broadcast) return null;

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 100000, // extremely high to be over everything
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isLight ? 'rgba(255, 255, 255, 0.4)' : 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(5px)',
      WebkitBackdropFilter: 'blur(5px)',
      opacity: isVisible ? 1 : 0,
      transition: 'opacity 0.3s ease',
      padding: '24px'
    }}>
      <div 
        style={{
          background: isLight 
            ? 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)' 
            : 'linear-gradient(145deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
          border: isLight ? '1px solid #e2e8f0' : 'none',
          borderRadius: '24px',
          boxShadow: isLight 
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.1), 0 0 40px rgba(249, 115, 22, 0.15)' 
            : '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1) inset, 0 0 40px rgba(249, 115, 22, 0.25)',
          width: '100%',
          maxWidth: '450px',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
          transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
          width: '64px',
          height: '64px',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
          boxShadow: '0 8px 24px rgba(249, 115, 22, 0.4)',
          animation: isVisible ? 'pulse 2s infinite' : 'none'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="32" height="32" style={{ animation: 'swing 2s infinite ease-in-out', transformOrigin: 'top center' }}>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </div>

        <h2 style={{ 
          margin: '0 0 16px 0', 
          fontSize: '24px', 
          fontWeight: '700', 
          color: isLight ? '#0f172a' : '#f8fafc',
          letterSpacing: '-0.02em'
        }}>
          {broadcast.title || 'Announcement'}
        </h2>
        
        <p style={{ 
          margin: '0 0 32px 0', 
          fontSize: '16px', 
          color: isLight ? '#475569' : '#cbd5e1', 
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap'
        }}>
          {broadcast.message}
        </p>
        
        <button 
          onClick={handleClose}
          style={{
            padding: '14px 32px',
            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '14px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)',
            transition: 'all 0.2s',
            width: '100%'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 6px 16px rgba(249, 115, 22, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'none';
            e.target.style.boxShadow = '0 4px 12px rgba(249, 115, 22, 0.3)';
          }}
        >
          Got it
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.7); }
          70% { box-shadow: 0 0 0 15px rgba(249, 115, 22, 0); }
          100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); }
        }
        @keyframes swing {
          0% { transform: rotate(0deg); }
          20% { transform: rotate(15deg); }
          40% { transform: rotate(-10deg); }
          60% { transform: rotate(5deg); }
          80% { transform: rotate(-5deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default BroadcastAlert;
