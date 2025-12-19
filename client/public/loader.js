// Remove loader once React renders
console.log('🔧 Loader script started');
window.addEventListener('DOMContentLoaded', () => {
  console.log('📄 DOM content loaded, starting React check');
  // Check if React has rendered
  const checkReactMount = setInterval(() => {
    const root = document.getElementById('root');
    console.log('🔍 Checking root element:', root ? 'found' : 'not found', root ? `children: ${root.children.length}` : '');
    if (root && root.children.length > 0) {
      console.log('✅ React rendered, hiding loader');
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
    console.log('⏰ Fallback timeout reached, hiding loader');
    const loader = document.getElementById('initial-loader');
    if (loader) {
      loader.classList.add('loaded');
      setTimeout(() => loader.remove(), 300);
    }
    clearInterval(checkReactMount);
  }, 10000);
});
