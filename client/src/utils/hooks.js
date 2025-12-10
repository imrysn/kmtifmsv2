import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { debounce, throttle, rafThrottle } from './performance';

// Re-export from contexts for convenience
export { useAuth } from '../contexts/AuthContext';
export { useNetwork } from '../contexts/NetworkContext';
export { useNotifications } from '../contexts/NotificationContext';

/**
 * Custom hook for debounced values
 * Usage: const debouncedSearch = useDebounce(searchTerm, 500);
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Custom hook for debounced callbacks
 * Usage: const debouncedSearch = useDebouncedCallback((term) => search(term), 500);
 */
export function useDebouncedCallback(callback, delay = 300) {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useMemo(
    () => debounce((...args) => callbackRef.current(...args), delay),
    [delay]
  );
}

/**
 * Custom hook for throttled callbacks
 * Usage: const throttledScroll = useThrottledCallback(handleScroll, 100);
 */
export function useThrottledCallback(callback, limit = 100) {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useMemo(
    () => throttle((...args) => callbackRef.current(...args), limit),
    [limit]
  );
}

/**
 * Custom hook for RAF throttled callbacks
 * Perfect for smooth scroll animations
 */
export function useRAFCallback(callback) {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useMemo(
    () => rafThrottle((...args) => callbackRef.current(...args)),
    []
  );
}

/**
 * Hook to track if component is mounted
 * Prevents state updates on unmounted components
 */
export function useIsMounted() {
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return useCallback(() => isMounted.current, []);
}

/**
 * Hook for intersection observer (lazy loading, infinite scroll)
 */
export function useIntersectionObserver(ref, options = {}) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
      if (entry.isIntersecting) {
        setHasIntersected(true);
      }
    }, options);

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [ref, options]);

  return { isIntersecting, hasIntersected };
}

/**
 * Hook to track previous value
 * Useful for comparing with current value
 */
export function usePrevious(value) {
  const ref = useRef();
  
  useEffect(() => {
    ref.current = value;
  }, [value]);
  
  return ref.current;
}

/**
 * Hook for window size with debouncing
 * Prevents excessive re-renders on resize
 */
export function useWindowSize(debounceTime = 150) {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = debounce(() => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }, debounceTime);

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [debounceTime]);

  return windowSize;
}

/**
 * Hook for local storage with state sync
 */
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error loading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : initialValue;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
}

/**
 * Hook to detect if component is in viewport
 */
export function useOnScreen(ref, rootMargin = '0px') {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return isVisible;
}

/**
 * Hook for async operations with loading/error states
 */
export function useAsync(asyncFunction, immediate = true) {
  const [status, setStatus] = useState('idle');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...params) => {
    setStatus('pending');
    setData(null);
    setError(null);

    try {
      const response = await asyncFunction(...params);
      setData(response);
      setStatus('success');
      return response;
    } catch (error) {
      setError(error);
      setStatus('error');
      throw error;
    }
  }, [asyncFunction]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { execute, status, data, error, isLoading: status === 'pending' };
}

/**
 * Hook for pagination with comprehensive controls
 * Usage: const { currentPage, paginatedItems, nextPage, prevPage } = usePagination(items, 10);
 */
export function usePagination(items = [], itemsPerPage = 10) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = useMemo(() => {
    return Math.ceil(items.length / itemsPerPage);
  }, [items.length, itemsPerPage]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }, [items, currentPage, itemsPerPage]);

  const startIndex = useMemo(() => {
    return (currentPage - 1) * itemsPerPage;
  }, [currentPage, itemsPerPage]);

  const endIndex = useMemo(() => {
    return Math.min(startIndex + itemsPerPage, items.length);
  }, [startIndex, itemsPerPage, items.length]);

  const goToPage = useCallback((page) => {
    const pageNumber = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(pageNumber);
  }, [totalPages]);

  const nextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  }, []);

  const goToFirstPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const goToLastPage = useCallback(() => {
    setCurrentPage(totalPages);
  }, [totalPages]);

  const resetPagination = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const canGoNext = currentPage < totalPages;
  const canGoPrev = currentPage > 1;

  return {
    currentPage,
    totalPages,
    paginatedItems,
    startIndex,
    endIndex,
    itemsPerPage,
    goToPage,
    nextPage,
    prevPage,
    goToFirstPage,
    goToLastPage,
    resetPagination,
    canGoNext,
    canGoPrev
  };
}

/**
 * Hook for optimistic UI updates
 * Immediately updates UI, then syncs with server
 */
export function useOptimisticUpdate(initialData = null) {
  const [data, setData] = useState(initialData);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState(null);

  const updateOptimistically = useCallback(async (
    optimisticUpdate,
    actualUpdate,
    rollbackUpdate = null
  ) => {
    setIsUpdating(true);
    setError(null);

    const previousData = data;

    try {
      // Apply optimistic update immediately
      if (typeof optimisticUpdate === 'function') {
        setData(optimisticUpdate(previousData));
      } else {
        setData(optimisticUpdate);
      }

      // Perform actual update
      const result = await actualUpdate();

      // Update with actual data if provided
      if (result && result.data) {
        setData(result.data);
      }

      return { success: true, data: result };
    } catch (err) {
      console.error('Optimistic update failed:', err);
      setError(err.message || 'Update failed');

      // Rollback to previous state or use custom rollback
      if (rollbackUpdate) {
        if (typeof rollbackUpdate === 'function') {
          setData(rollbackUpdate(previousData));
        } else {
          setData(rollbackUpdate);
        }
      } else {
        setData(previousData);
      }

      return { success: false, error: err };
    } finally {
      setIsUpdating(false);
    }
  }, [data]);

  const setOptimisticData = useCallback((newData) => {
    setData(newData);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    data,
    setData: setOptimisticData,
    isUpdating,
    error,
    updateOptimistically,
    clearError
  };
}
