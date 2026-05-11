// Remove loader once React renders
window.addEventListener('DOMContentLoaded', () => {
  // Check if React has rendered
  const checkReactMount = setInterval(() => {
    const root = document.getElementById('root');
    if (root && root.children.length > 0) {
      const loader = document.getElementById('initial-loader');
      if (loader) {
        loader.classList.add('loaded');
        setTimeout(() => loader.remove(), 300);
      }
      clearInterval(checkReactMount);
    }
  }, 100);

  // Fallback: remove after 10 seconds
  setTimeout(() => {
    const loader = document.getElementById('initial-loader');
    if (loader) {
      loader.classList.add('loaded');
      setTimeout(() => loader.remove(), 300);
    }
    clearInterval(checkReactMount);
  }, 10000);
});
