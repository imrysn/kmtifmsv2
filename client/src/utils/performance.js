/**
 * Performance utilities for React components
 * These utilities help reduce unnecessary re-renders and improve app responsiveness
 */

/**
 * Debounce function - delays execution until after wait time has elapsed
 * Perfect for search inputs, form validation
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function - limits execution to once per interval
 * Perfect for scroll events, resize events, mouse move
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit = 100) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Request Animation Frame throttle
 * Perfect for smooth animations and scroll handlers
 * @param {Function} func - Function to throttle
 * @returns {Function} RAF throttled function
 */
export function rafThrottle(func) {
  let rafId = null;
  return function executedFunction(...args) {
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        func(...args);
        rafId = null;
      });
    }
  };
}

/**
 * Lazy load images with Intersection Observer
 * @param {string} selector - CSS selector for images to lazy load
 */
export function setupLazyImages(selector = 'img[data-src]') {
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      });
    });

    document.querySelectorAll(selector).forEach(img => imageObserver.observe(img));
  } else {
    // Fallback for browsers without Intersection Observer
    document.querySelectorAll(selector).forEach(img => {
      img.src = img.dataset.src;
    });
  }
}

/**
 * Memoize expensive function results
 * @param {Function} func - Function to memoize
 * @returns {Function} Memoized function
 */
export function memoize(func) {
  const cache = new Map();
  return function memoized(...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = func(...args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Performance monitor for React components
 */
export class PerformanceMonitor {
  constructor(componentName) {
    this.componentName = componentName;
    this.renders = 0;
    this.startTime = performance.now();
  }

  logRender() {
    this.renders++;
    if (this.renders % 10 === 0) {
      const elapsed = performance.now() - this.startTime;
      console.log(`[${this.componentName}] Renders: ${this.renders}, Time: ${elapsed.toFixed(2)}ms`);
    }
  }
}

/**
 * Check if device has reduced motion preference
 * Use this to disable animations for better performance or accessibility
 */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Virtual scroll helper - calculate visible items
 * @param {number} scrollTop - Current scroll position
 * @param {number} itemHeight - Height of each item
 * @param {number} containerHeight - Height of the container
 * @param {number} totalItems - Total number of items
 * @param {number} overscan - Number of items to render outside viewport
 * @returns {Object} Visible range and offsets
 */
export function calculateVisibleRange(scrollTop, itemHeight, containerHeight, totalItems, overscan = 3) {
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    totalItems - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  return {
    startIndex,
    endIndex,
    offsetY: startIndex * itemHeight,
    visibleItems: endIndex - startIndex + 1
  };
}
