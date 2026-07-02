import { memo } from 'react';
import { Moon, Sun } from 'lucide-react';
import useStore from '../../store/useStore';

const ThemeToggle = memo(({ variant = 'default' }) => {
  const { theme, toggleTheme } = useStore();
  
  const isDark = theme === 'dark';
  
  if (variant === 'tl') {
    return (
      <button type="button" className="tl-nav-item" onClick={toggleTheme} style={{ marginBottom: '8px', width: '100%', border: '1px solid var(--border-color)', background: 'transparent' }} aria-label="Toggle Theme">
        <div className="tl-nav-icon">
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </div>
        <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
      </button>
    );
  }

  return (
    <button type="button" className="nav-item" onClick={toggleTheme} style={{ marginBottom: '8px', width: '100%', border: '1px solid var(--border-color)', background: 'transparent' }} aria-label="Toggle Theme">
      <span className="nav-icon">
        {isDark ? <Sun size={20} /> : <Moon size={20} />}
      </span>
      <span className="nav-label">
        {isDark ? 'Light Mode' : 'Dark Mode'}
      </span>
    </button>
  );
});

ThemeToggle.displayName = 'ThemeToggle';
export default ThemeToggle;
