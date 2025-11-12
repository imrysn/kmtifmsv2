/**
 * CachedFileSystem - Fast directory listing with TTL caching
 * Reduces filesystem I/O operations significantly
 */
export class CachedFileSystem {
  constructor(ttlMs = 5 * 60 * 1000) { // 5 minutes default TTL
    this.cache = new Map();
    this.ttl = ttlMs;
    this.stats = {
      hits: 0,
      misses: 0,
      totalQueries: 0
    };
    
    // LRU cache settings
    this.maxCacheSize = 500; // Maximum cached directories
    this.accessOrder = new Map(); // Track access order for LRU
  }

  /**
   * List directory with caching
   */
  async listDirectory(path, fetchFunction) {
    this.stats.totalQueries++;
    
    const cacheKey = this._normalizePath(path);
    const cached = this.cache.get(cacheKey);
    
    // Check if cached and not expired
    if (cached && (Date.now() - cached.timestamp) < this.ttl) {
      this.stats.hits++;
      this._updateAccessOrder(cacheKey);
      return cached.data;
    }

    // Cache miss - fetch from filesystem
    this.stats.misses++;
    
    try {
      const data = await fetchFunction(path);
      this._setCache(cacheKey, data);
      return data;
    } catch (error) {
      // If fetch fails and we have stale cache, return it
      if (cached) {
        console.warn(`Using stale cache for ${path}: ${error.message}`);
        return cached.data;
      }
      throw error;
    }
  }

  /**
   * Prefetch directories in background
   */
  async prefetchDirectories(paths, fetchFunction) {
    const prefetchPromises = paths.map(async (path) => {
      try {
        const cacheKey = this._normalizePath(path);
        if (!this.cache.has(cacheKey)) {
          const data = await fetchFunction(path);
          this._setCache(cacheKey, data);
        }
      } catch (error) {
        console.warn(`Failed to prefetch ${path}:`, error.message);
      }
    });

    await Promise.allSettled(prefetchPromises);
  }

  /**
   * Set cache with LRU eviction
   */
  _setCache(key, data) {
    // Evict oldest entry if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this._getOldestKey();
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.accessOrder.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    this._updateAccessOrder(key);
  }

  /**
   * Update access order for LRU
   */
  _updateAccessOrder(key) {
    this.accessOrder.set(key, Date.now());
  }

  /**
   * Get oldest cache key (least recently used)
   */
  _getOldestKey() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, time] of this.accessOrder.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Invalidate specific path
   */
  invalidate(path) {
    const cacheKey = this._normalizePath(path);
    this.cache.delete(cacheKey);
    this.accessOrder.delete(cacheKey);
  }

  /**
   * Invalidate all paths matching prefix
   */
  invalidatePrefix(prefix) {
    const normalizedPrefix = this._normalizePath(prefix);
    const keysToDelete = [];

    for (const key of this.cache.keys()) {
      if (key.startsWith(normalizedPrefix)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.accessOrder.delete(key);
    });

    return keysToDelete.length;
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.cache.clear();
    this.accessOrder.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      totalQueries: 0
    };
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.totalQueries > 0
      ? (this.stats.hits / this.stats.totalQueries * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize,
      ttlMs: this.ttl
    };
  }

  /**
   * Normalize path for consistent caching
   */
  _normalizePath(path) {
    return path
      .replace(/\\/g, '/')
      .replace(/\/+/g, '/')
      .replace(/\/$/, '')
      .toLowerCase();
  }

  /**
   * Warm up cache with common directories
   */
  async warmup(commonPaths, fetchFunction) {
    console.log('Warming up cache with common directories...');
    await this.prefetchDirectories(commonPaths, fetchFunction);
    console.log(`Cache warmed up. Cached ${this.cache.size} directories.`);
  }

  /**
   * Get all cached paths
   */
  getCachedPaths() {
    return Array.from(this.cache.keys());
  }

  /**
   * Check if path is cached and fresh
   */
  isCached(path) {
    const cacheKey = this._normalizePath(path);
    const cached = this.cache.get(cacheKey);
    
    if (!cached) return false;
    
    const isExpired = (Date.now() - cached.timestamp) >= this.ttl;
    return !isExpired;
  }

  /**
   * Get cache age for a path
   */
  getCacheAge(path) {
    const cacheKey = this._normalizePath(path);
    const cached = this.cache.get(cacheKey);
    
    if (!cached) return null;
    
    return Date.now() - cached.timestamp;
  }

  /**
   * Set TTL for cache
   */
  setTTL(ttlMs) {
    this.ttl = ttlMs;
  }

  /**
   * Set max cache size
   */
  setMaxCacheSize(size) {
    this.maxCacheSize = size;
    
    // Evict if current size exceeds new max
    while (this.cache.size > size) {
      const oldestKey = this._getOldestKey();
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.accessOrder.delete(oldestKey);
      }
    }
  }

  /**
   * Export cache to JSON (for persistence)
   */
  export() {
    return {
      cache: Array.from(this.cache.entries()),
      accessOrder: Array.from(this.accessOrder.entries()),
      stats: this.stats,
      ttl: this.ttl,
      maxCacheSize: this.maxCacheSize
    };
  }

  /**
   * Import cache from JSON
   */
  import(data) {
    this.cache = new Map(data.cache);
    this.accessOrder = new Map(data.accessOrder);
    this.stats = data.stats;
    this.ttl = data.ttl;
    this.maxCacheSize = data.maxCacheSize;
  }
}
