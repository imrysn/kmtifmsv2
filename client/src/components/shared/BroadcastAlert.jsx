import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import useStore from '../../store/useStore';
import { apiFetch, API_BASE_URL } from '../../config/api';

const BroadcastAlert = ({ broadcast, onClose, remainingCount = 0 }) => {
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
      backgroundColor: isLight ? 'rgba(0, 0, 0, 0.3)' : 'rgba(15, 23, 42, 0.6)',
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
          background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
          width: '64px',
          height: '64px',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
          boxShadow: '0 8px 24px rgba(249, 115, 22, 0.1)',
          animation: isVisible ? 'pulse 2s infinite' : 'none'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="36" height="36" style={{ animation: 'swing 2s infinite ease-in-out', transformOrigin: 'bottom right' }}>
            <path d="M 75.8,20.4 86.4,12.7 89.2,21.5 Z" fill="#64748b"/>
            <path d="M 85.1,38.9 97.4,32.3 98.4,41.9 Z" fill="#64748b"/>
            <path d="M 86.6,56.8 98.9,56.1 97.1,65.3 Z" fill="#64748b"/>
            <path d="M 78.5,72.4 88.0,79.5 81.3,86.6 Z" fill="#64748b"/>
            <path d="M 33.1,69.5 41.5,89.2 C 43.1,93.0 48.0,91.2 46.5,87.6 L 39.5,71.1 Z" fill="#cbd5e1"/>
            <path d="M 23.3,46.9 C 10.1,51.8 11.4,70.9 25.1,73.1 L 34.0,70.0 L 29.5,45.0 Z" fill="#dc2626"/>
            <path d="M 26.5,45.5 C 38.0,38.0 49.5,25.0 59.8,27.5 C 70.1,30.0 73.1,65.0 63.8,70.5 C 54.5,76.0 42.0,70.0 31.5,71.0 Z" fill="#e2e8f0"/>
            <ellipse cx="61.5" cy="49" rx="11" ry="24" fill="#64748b" transform="rotate(-12 61.5 49)"/>
            <ellipse cx="60" cy="49" rx="5" ry="12" fill="#ffffff" transform="rotate(-12 60 49)"/>
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
        
        <div style={{ 
          margin: '0 0 24px 0', 
          fontSize: '16px', 
          color: isLight ? '#475569' : '#cbd5e1', 
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap',
          width: '100%'
        }}>
          {(() => {
            if (!broadcast.message) return null;
            const rawMessage = broadcast.message;
            const imgRegex = /!\[.*?\]\((.*?)\)/g;
            const parts = [];
            let lastIndex = 0;
            let match;
            
            while ((match = imgRegex.exec(rawMessage)) !== null) {
              if (match.index > lastIndex) {
                parts.push(<span key={`text-${lastIndex}`}>{rawMessage.substring(lastIndex, match.index)}</span>);
              }
              parts.push(
                <div key={`img-${match.index}`} style={{ marginTop: '8px', marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
                  <img 
                    src={match[1].startsWith('/') ? `${API_BASE_URL}${match[1]}` : match[1]} 
                    alt="Attachment" 
                    style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '6px', border: `1px solid ${isLight ? '#e2e8f0' : '#334155'}` }} 
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              );
              lastIndex = imgRegex.lastIndex;
            }
            
            if (lastIndex < rawMessage.length) {
              parts.push(<span key={`text-${lastIndex}`}>{rawMessage.substring(lastIndex)}</span>);
            }
            
            return parts;
          })()}
        </div>

        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
          <button 
            onClick={handleClose}
            style={{
              flex: 1,
              padding: '14px 20px',
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '14px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)',
              transition: 'all 0.2s',
            }}
          >
            {remainingCount > 0 ? `Next (${remainingCount} remaining)` : 'Got it'}
          </button>
        </div>
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
