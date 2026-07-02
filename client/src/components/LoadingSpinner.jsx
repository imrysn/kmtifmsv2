import React from 'react'
import '../css/LoadingSpinner.css'

const INFINITY_SQUARE_SNAKE_BLOCKS = ["█", "▓", "▒", "░"];

const LoadingSpinner = ({ size = 'medium', color = 'var(--text-primary)', fullScreen = false, fullPage = false, message = 'Loading...' }) => {
  const sizeMap = {
    small: '1rem',
    medium: '1.5rem',
    large: '2.5rem'
  };
  
  const fontSize = sizeMap[size] || '1.5rem';

  const spinnerContent = (
    <div className={`spinner-container ${fullPage ? 'spinner-fullpage' : ''}`}>
      <span
        role="status"
        className="infinity-snake-container"
        style={{ color: color, fontSize: fontSize }}
      >
        {INFINITY_SQUARE_SNAKE_BLOCKS.map((glyph, index) => (
          <span
            key={`${glyph}-${index}`}
            aria-hidden="true"
            className="infinity-snake-glyph"
            style={{
              animationDelay: `calc(0.1s * -${INFINITY_SQUARE_SNAKE_BLOCKS.length - 1 - index})`,
            }}
          >
            {glyph}
          </span>
        ))}
      </span>
      {message && <p className="spinner-text">{message}</p>}
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
