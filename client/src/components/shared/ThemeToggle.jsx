import { memo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Moon, Sun } from 'lucide-react';
import useStore from '../../store/useStore';

const ThemeToggle = memo(({ variant = 'default' }) => {
  const { theme, toggleTheme, setTheme } = useStore();
  const [clickCount, setClickCount] = useState(0);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showCertifiedToast, setShowCertifiedToast] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const lastClickTimeRef = useRef(0);
  const toastTimerRef = useRef(null);

  const isDark = theme === 'dark';
  const isPride = theme === 'pride';

  // Animate toast in then auto-dismiss after 4s
  useEffect(() => {
    if (showCertifiedToast) {
      // Trigger slide-in animation on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setToastVisible(true));
      });
      toastTimerRef.current = setTimeout(() => {
        setToastVisible(false);
        setTimeout(() => setShowCertifiedToast(false), 400);
      }, 4000);
    }
    return () => clearTimeout(toastTimerRef.current);
  }, [showCertifiedToast]);

  const handleToggleClick = () => {
    const now = Date.now();
    const diff = now - lastClickTimeRef.current;
    lastClickTimeRef.current = now;

    // Only count as spam if clicks happen within 600ms of each other (true rapid clicking)
    if (diff < 600) {
      const nextCount = clickCount + 1;
      setClickCount(nextCount);

      if (nextCount >= 49) { // 50th rapid click in a row
        setShowUnlockModal(true);
        setTheme('pride');
        setClickCount(0);
        return;
      }
    } else {
      // Slow click — reset counter entirely, does NOT count toward Gay Mode
      setClickCount(0);
    }

    toggleTheme();
  };

  const handleLetsGo = () => {
    setShowUnlockModal(false);
    setShowCertifiedToast(true);
  };

  return (
    <>
      {variant === 'tl' ? (
        <button type="button" className="tl-nav-item" onClick={handleToggleClick} style={{ marginBottom: '8px', width: '100%', border: '1px solid var(--border-color)', background: 'transparent' }} aria-label="Toggle Theme">
          <div className="tl-nav-icon">
            {isPride ? <span style={{ fontSize: '18px' }}>🏳️‍🌈</span> : (isDark ? <Sun size={20} /> : <Moon size={20} />)}
          </div>
          <span>{isPride ? 'LGBTQ Mode' : (isDark ? 'Light Mode' : 'Dark Mode')}</span>
        </button>
      ) : (
        <button type="button" className="nav-item" onClick={handleToggleClick} style={{ marginBottom: '8px', width: '100%', border: '1px solid var(--border-color)', background: 'transparent' }} aria-label="Toggle Theme">
          <span className="nav-icon">
            {isPride ? <span style={{ fontSize: '18px' }}>🏳️‍🌈</span> : (isDark ? <Sun size={20} /> : <Moon size={20} />)}
          </span>
          <span className="nav-label">
            {isPride ? 'LGBTQ Mode' : (isDark ? 'Light Mode' : 'Dark Mode')}
          </span>
        </button>
      )}

      {/* Unlock Modal */}
      {showUnlockModal && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(10, 5, 20, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '20px'
        }}>
          <div style={{
            background: '#1a0f30',
            border: '2px solid transparent',
            borderImage: 'linear-gradient(135deg, #ff3366, #ff9933, #ca8a04, #16a34a, #2563eb, #9933ff) 1',
            padding: '30px 24px',
            borderRadius: '12px',
            textAlign: 'center',
            maxWidth: '420px',
            width: '100%',
            boxShadow: '0 0 30px rgba(236, 72, 153, 0.4)',
            boxSizing: 'border-box'
          }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🏳️‍🌈</span>
            <h3 style={{
              margin: '0 0 12px',
              fontSize: '22px',
              fontWeight: '800',
              background: 'linear-gradient(to right, #ff3366, #ff9933, #ca8a04, #16a34a, #2563eb, #9933ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
              display: 'inline-block'
            }}>
              Gay Mode Unlocked!
            </h3>
            <p style={{
              color: '#fbcfe8',
              fontSize: '15px',
              lineHeight: '1.6',
              margin: '0 0 24px'
            }}>
              Welcome, you unlocked the Gay Mode!
            </p>
            <button
              onClick={handleLetsGo}
              style={{
                background: 'linear-gradient(90deg, #ff3366, #ff9933, #ca8a04, #16a34a, #2563eb, #9933ff)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'transform 0.15s',
                boxShadow: '0 4px 12px rgba(236, 72, 153, 0.3)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              Let's Go! 🏳️‍🌈
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Certified Gay Toast Banner */}
      {showCertifiedToast && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999999,
          display: 'flex',
          justifyContent: 'center',
          padding: '0',
          pointerEvents: 'none',
          transform: toastVisible ? 'translateY(0)' : 'translateY(-120%)',
          transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          <div style={{
            background: 'linear-gradient(90deg, #ff3366, #ff9933, #ffd700, #16a34a, #2563eb, #9933ff)',
            padding: '3px',
            borderRadius: '0 0 16px 16px',
            boxShadow: '0 8px 32px rgba(236, 72, 153, 0.5)',
            pointerEvents: 'auto',
            maxWidth: '500px',
            width: '90%',
          }}>
            <div style={{
              background: '#0d0720',
              borderRadius: '0 0 13px 13px',
              padding: '14px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <span style={{ fontSize: '28px', flexShrink: 0 }}>🏳️‍🌈</span>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '800',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  background: 'linear-gradient(to right, #ff3366, #ff9933, #ffd700, #16a34a, #2563eb, #9933ff)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  color: 'transparent',
                  marginBottom: '2px',
                }}>
                  🎉 Official Certificate
                </div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#ffffff',
                }}>
                  Congrats, you are certified gay! 🌈
                </div>
              </div>
              <button
                onClick={() => {
                  setToastVisible(false);
                  setTimeout(() => setShowCertifiedToast(false), 400);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fbcfe8',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '4px',
                  lineHeight: 1,
                  flexShrink: 0,
                  opacity: 0.7,
                }}
              >
                ✕
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
});

ThemeToggle.displayName = 'ThemeToggle';
export default ThemeToggle;
