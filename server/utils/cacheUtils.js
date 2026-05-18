/**
 * Centralized Performance Cache Utility
 * Prevents unnecessary database sweeps by keeping a snapshot of user metrics.
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — serve stale data instantly, recompute in background

let performanceCache = {
  data: null,
  timestamp: 0,
  isDirty: true // Start dirty to force first load
};

// In-flight recompute promise — prevents simultaneous duplicate calls
let recomputePromise = null;

const getCache = () => {
  // Serve cached data if it exists and is within TTL, even if marked dirty.
  // Stale-while-revalidate: the caller sees instant data; background recompute updates it.
  if (performanceCache.data && (Date.now() - performanceCache.timestamp) < CACHE_TTL_MS) {
    return performanceCache;
  }
  if (performanceCache.isDirty) return null;
  return performanceCache;
};

const setCache = (data) => {
  performanceCache.data = data;
  performanceCache.timestamp = Date.now();
  performanceCache.isDirty = false;
  recomputePromise = null; // clear in-flight tracker
};

/**
 * Returns the in-flight recompute promise if one is already running,
 * so callers don't spawn duplicate calculateAllUserPerformance() calls.
 */
const getRecomputePromise = () => recomputePromise;
const setRecomputePromise = (p) => { recomputePromise = p; };

/**
 * Call this whenever a performance-impacting event occurs:
 * - File status change (approved/rejected)
 * - Assignment submission
 * - Task creation/deletion
 */
const invalidateCache = () => {
  performanceCache.isDirty = true;
  // Do NOT clear performanceCache.data — we keep it for stale-while-revalidate.
  // Old data is still served within TTL; after TTL it won't be served.
  console.log('📡 ♻️  Performance Cache Invalidated (stale-while-revalidate)');
};

module.exports = {
  getCache,
  setCache,
  invalidateCache,
  getRecomputePromise,
  setRecomputePromise,
};
