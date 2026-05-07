/**
 * Centralized Performance Cache Utility
 * Prevents unnecessary database sweeps by keeping a snapshot of user metrics.
 */

let performanceCache = {
  data: null,
  timestamp: 0,
  isDirty: true // Start dirty to force first load
};

const getCache = () => {
  if (performanceCache.isDirty) return null;
  return performanceCache;
};

const setCache = (data) => {
  performanceCache.data = data;
  performanceCache.timestamp = Date.now();
  performanceCache.isDirty = false;
};

/**
 * Call this whenever a performance-impacting event occurs:
 * - File status change (approved/rejected)
 * - Assignment submission
 * - Task creation/deletion
 */
const invalidateCache = () => {
  performanceCache.isDirty = true;
  performanceCache.data = null;
  console.log('📡 ♻️  Performance Cache Invalidated');
};

module.exports = {
  getCache,
  setCache,
  invalidateCache
};
