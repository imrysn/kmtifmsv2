/**
 * Fast Search Engine Configuration
 * Customize indexing, caching, and security settings
 */

export const SearchEngineConfig = {
  // Cache settings
  cache: {
    // Directory cache TTL in milliseconds (default: 5 minutes)
    directoryTTL: 5 * 60 * 1000,
    
    // Maximum number of cached directories (LRU eviction)
    maxCachedDirectories: 500,
    
    // Query cache TTL in milliseconds (default: 2 minutes)
    queryCacheTTL: 2 * 60 * 1000,
    
    // Maximum number of cached queries
    maxCachedQueries: 100,
  },

  // File size limits
  files: {
    // Maximum file size for reading (default: 50MB)
    maxReadSize: 50 * 1024 * 1024,
    
    // Maximum file size for editing (default: 10MB)
    maxEditSize: 10 * 1024 * 1024,
    
    // Maximum file size for indexing content (default: 1MB)
    maxIndexContentSize: 1 * 1024 * 1024,
  },

  // Indexing settings
  indexing: {
    // Automatically index on startup
    autoIndexOnStartup: true,
    
    // Automatically index search results
    indexSearchResults: true,
    
    // Maximum number of files to index
    maxIndexedFiles: 10000,
    
    // Minimum file size to index (skip empty files)
    minFileSize: 0,
    
    // File types to index content (for full-text search)
    indexContentTypes: ['.txt', '.md', '.json', '.xml', '.csv', '.log'],
  },

  // Search settings
  search: {
    // Use indexed search when this many files are indexed
    minFilesForIndexedSearch: 100,
    
    // Maximum search results to return
    maxSearchResults: 500,
    
    // Enable fuzzy matching
    fuzzyMatching: false,
    
    // Search debounce delay in milliseconds
    debounceDelay: 300,
  },

  // Security settings
  security: {
    // Check permissions before every operation
    enforcePermissions: true,
    
    // Cache permission checks (improves performance)
    cachePermissions: true,
    
    // Permission cache TTL in milliseconds
    permissionCacheTTL: 5 * 60 * 1000,
    
    // Allowed directories (will be merged with defaults)
    customAllowedDirectories: [
      // Add your custom allowed directories here
      // Example: 'D:\\MyProjects',
    ],
    
    // Additional blacklisted paths (will be merged with defaults)
    customBlacklistedPaths: [
      // Add your custom blacklisted paths here
      // Example: 'D:\\Sensitive',
    ],
    
    // Additional unsafe file extensions
    customUnsafeExtensions: [
      // Add your custom unsafe extensions here
      // Example: '.dmg',
    ],
  },

  // Performance settings
  performance: {
    // Enable performance tracking
    trackPerformance: true,
    
    // Show performance metrics in UI
    showPerformanceMetrics: true,
    
    // Log performance statistics to console
    logPerformanceStats: false,
    
    // Performance stats logging interval (milliseconds)
    statsLoggingInterval: 60000, // 1 minute
  },

  // Background operations
  background: {
    // Enable background indexing
    enableBackgroundIndexing: true,
    
    // Directories to prefetch on startup
    prefetchDirectories: [
      // Will use allowed directories by default
    ],
    
    // Background indexing delay (milliseconds)
    indexingDelay: 1000,
  },

  // UI settings
  ui: {
    // Show search performance indicators
    showPerformanceIndicators: true,
    
    // Show cache statistics
    showCacheStats: true,
    
    // Animation duration for performance badges (milliseconds)
    performanceBadgeAnimation: 300,
    
    // Success message duration (milliseconds)
    successMessageDuration: 3000,
  },
};

/**
 * Apply custom configuration
 * @param {Object} customConfig - Custom configuration object
 * @returns {Object} Merged configuration
 */
export function applyCustomConfig(customConfig) {
  return {
    cache: { ...SearchEngineConfig.cache, ...customConfig.cache },
    files: { ...SearchEngineConfig.files, ...customConfig.files },
    indexing: { ...SearchEngineConfig.indexing, ...customConfig.indexing },
    search: { ...SearchEngineConfig.search, ...customConfig.search },
    security: { ...SearchEngineConfig.security, ...customConfig.security },
    performance: { ...SearchEngineConfig.performance, ...customConfig.performance },
    background: { ...SearchEngineConfig.background, ...customConfig.background },
    ui: { ...SearchEngineConfig.ui, ...customConfig.ui },
  };
}

/**
 * Validate configuration
 * @param {Object} config - Configuration object to validate
 * @returns {Object} Validation result
 */
export function validateConfig(config) {
  const errors = [];
  const warnings = [];

  // Validate cache settings
  if (config.cache.directoryTTL < 10000) {
    warnings.push('Directory cache TTL is very low (< 10 seconds). This may impact performance.');
  }
  if (config.cache.maxCachedDirectories < 10) {
    warnings.push('Maximum cached directories is very low. Consider increasing for better performance.');
  }

  // Validate file sizes
  if (config.files.maxEditSize > config.files.maxReadSize) {
    errors.push('maxEditSize cannot be larger than maxReadSize');
  }
  if (config.files.maxReadSize > 100 * 1024 * 1024) {
    warnings.push('maxReadSize is very large (> 100MB). This may cause memory issues.');
  }

  // Validate indexing settings
  if (config.indexing.maxIndexedFiles < 100) {
    warnings.push('maxIndexedFiles is very low. Indexed search may not be effective.');
  }

  // Validate search settings
  if (config.search.debounceDelay < 100) {
    warnings.push('Search debounce delay is very low. This may cause excessive searches.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get default configuration
 * @returns {Object} Default configuration
 */
export function getDefaultConfig() {
  return JSON.parse(JSON.stringify(SearchEngineConfig));
}

/**
 * Export configuration as JSON
 * @param {Object} config - Configuration to export
 * @returns {string} JSON string
 */
export function exportConfig(config) {
  return JSON.stringify(config, null, 2);
}

/**
 * Import configuration from JSON
 * @param {string} jsonString - JSON configuration string
 * @returns {Object} Parsed configuration
 */
export function importConfig(jsonString) {
  try {
    const config = JSON.parse(jsonString);
    const validation = validateConfig(config);
    
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }
    
    return config;
  } catch (error) {
    throw new Error(`Failed to import configuration: ${error.message}`);
  }
}
