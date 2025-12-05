// In-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function setCache(key, value) {
  cache.set(key, { value, timestamp: Date.now() });
}

function getCache(key) {
  const item = cache.get(key);
  if (item && (Date.now() - item.timestamp) < CACHE_TTL) {
    return item.value;
  }
  cache.delete(key);
  return null;
}

function clearCache(key) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

module.exports = {
  setCache,
  getCache,
  clearCache
};
