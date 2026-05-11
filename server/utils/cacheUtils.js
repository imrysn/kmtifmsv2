/**
 * Centralized Performance Cache Utility
 *
 * FIX #5 — Added TTL so the cache auto-expires after 5 minutes.
 * On server restart the cache is empty and isDirty=true. Without a TTL, the
 * first /bulk-performance request after any restart would block for several
 * seconds recalculating everything against NAS MySQL. With the TTL, a stale
 * (but warm) entry is served while a background refresh runs.
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let performanceCache = {
  data:      null,
  timestamp: 0,
  isDirty:   true
};

/**
 * Returns the cached entry if it is fresh and not dirty, null otherwise.
 */
const getCache = () => {
  if (performanceCache.isDirty) return null;
  if (Date.now() - performanceCache.timestamp > CACHE_TTL_MS) {
    // Expired — treat as dirty so next caller triggers a refresh
    performanceCache.isDirty = true;
    return null;
  }
  return performanceCache;
};

const setCache = (data) => {
  performanceCache.data      = data;
  performanceCache.timestamp = Date.now();
  performanceCache.isDirty   = false;
};

/**
 * Call this whenever a performance-impacting event occurs:
 *   - File status change (approved / rejected)
 *   - Assignment submission
 *   - Task creation / deletion
 */
const invalidateCache = () => {
  performanceCache.isDirty = true;
  performanceCache.data    = null;
  console.log('📡 ♻️  Performance Cache Invalidated');
};

module.exports = { getCache, setCache, invalidateCache };
