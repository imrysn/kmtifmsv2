import { BitmaskFileIndex } from './BitmaskFileIndex';
import { CachedFileSystem } from './CachedFileSystem';
import { SecureDirectoryManager } from './SecureDirectoryManager';
import { FileEditor } from './FileEditor';

/**
 * FastSearchEngine - Main orchestrator for ultra-fast file search
 * Combines indexing, caching, and secure file operations
 */
export class FastSearchEngine {
  constructor(apiBase) {
    this.apiBase = apiBase || 'http://localhost:3001';
    
    // Core components
    this.bitmaskIndex = new BitmaskFileIndex();
    this.fsCache = new CachedFileSystem(5 * 60 * 1000); // 5 min TTL
    this.directoryManager = new SecureDirectoryManager();
    this.fileEditor = new FileEditor(this.apiBase, this.directoryManager);
    
    // Search state
    this.isIndexing = false;
    this.indexProgress = 0;
    this.lastIndexTime = null;
    
    // Performance tracking
    this.searchStats = {
      totalSearches: 0,
      avgSearchTime: 0,
      indexedSearches: 0,
      fallbackSearches: 0
    };
    
    // Query cache for instant repeated searches
    this.queryCache = new Map();
    this.queryCacheSize = 100;
    this.queryCacheTTL = 2 * 60 * 1000; // 2 minutes
  }

  /**
   * Initialize search engine with background indexing
   */
  async initialize() {
    console.log('🚀 Initializing FastSearchEngine...');
    
    try {
      // Start background indexing of common paths
      this._startBackgroundIndexing();
      
      console.log('✅ FastSearchEngine initialized');
    } catch (error) {
      console.error('❌ Failed to initialize FastSearchEngine:', error);
    }
  }

  /**
   * Perform ultra-fast search
   */
  async searchFiles(query, options = {}) {
    const startTime = performance.now();
    this.searchStats.totalSearches++;

    try {
      // Check query cache first
      const cacheKey = this._getQueryCacheKey(query, options);
      const cachedResult = this._getFromQueryCache(cacheKey);
      
      if (cachedResult) {
        console.log('⚡ Cache hit for query:', query);
        return cachedResult;
      }

      // Security validation
      if (options.directory) {
        await this.directoryManager.checkDirectoryAccess(options.directory);
      }

      // Perform hybrid search
      let results;
      const useIndexedSearch = this.bitmaskIndex.getStats().totalFiles > 100;
      
      if (useIndexedSearch && !options.forceAPISearch) {
        // Fast indexed search
        results = await this._indexedSearch(query, options);
        this.searchStats.indexedSearches++;
      } else {
        // Fallback to API search
        results = await this._apiSearch(query, options);
        this.searchStats.fallbackSearches++;
      }

      // Apply security filters
      if (options.checkPermissions !== false) {
        results.files = results.files.filter(file => {
          const dirPath = this._getDirectoryPath(file.path);
          return this.directoryManager.isDirectoryAllowed(dirPath);
        });
      }

      // Calculate search time
      const searchTime = performance.now() - startTime;
      this._updateSearchStats(searchTime);

      const finalResult = {
        ...results,
        searchTime,
        indexed: useIndexedSearch,
        cached: false
      };

      // Cache the result
      this._addToQueryCache(cacheKey, finalResult);

      return finalResult;
    } catch (error) {
      console.error('Search error:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Indexed search using BitmaskFileIndex
   */
  async _indexedSearch(query, options) {
    console.log('🔍 Using indexed search for:', query);
    
    const files = this.bitmaskIndex.search(query, {
      fileTypes: options.fileTypes,
      minSize: options.minSize,
      maxSize: options.maxSize,
      modifiedAfter: options.modifiedAfter,
      modifiedBefore: options.modifiedBefore,
      limit: options.limit || 1000
    });

    return {
      success: true,
      files: files.map(file => ({
        id: `file-${file.id}`,
        name: file.name,
        displayName: file.name,
        path: file.path,
        type: file.type === 'folder' ? 'folder' : 'file',
        fileType: file.type,
        size: file.size,
        modified: file.modified,
        parentPath: this._getDirectoryPath(file.path)
      })),
      total: files.length,
      query
    };
  }

  /**
   * API search fallback
   */
  async _apiSearch(query, options) {
    console.log('🌐 Using API search for:', query);
    
    const searchPath = options.directory || '/';
    const url = `${this.apiBase}/api/file-system/search?query=${encodeURIComponent(query)}&path=${encodeURIComponent(searchPath)}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API search failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'API search failed');
    }

    // Index the results for future searches
    if (data.results && data.results.length > 0) {
      this._indexSearchResults(data.results);
    }

    return {
      success: true,
      files: data.results || [],
      total: data.results?.length || 0,
      query
    };
  }

  /**
   * List directory with caching
   */
  async listDirectory(path, options = {}) {
    try {
      // Security validation
      await this.directoryManager.checkDirectoryAccess(path);

      // Use cached listing
      const files = await this.fsCache.listDirectory(path, async (dirPath) => {
        const response = await fetch(
          `${this.apiBase}/api/file-system/browse?path=${encodeURIComponent(dirPath)}`
        );
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.message || 'Failed to list directory');
        }

        // Index the files
        if (data.items && data.items.length > 0) {
          this._indexSearchResults(data.items);
        }

        return data.items || [];
      });

      // Filter by permissions
      const filteredFiles = files.filter(file => {
        const fileDirPath = file.type === 'folder' ? file.path : this._getDirectoryPath(file.path);
        return this.directoryManager.isDirectoryAllowed(fileDirPath);
      });

      return {
        success: true,
        items: filteredFiles,
        path
      };
    } catch (error) {
      throw new Error(`Failed to list directory: ${error.message}`);
    }
  }

  /**
   * Read file content
   */
  async readFileContent(filePath, options = {}) {
    return await this.fileEditor.readFile(filePath, options);
  }

  /**
   * Update file content
   */
  async updateFileContent(filePath, content, options = {}) {
    const result = await this.fileEditor.editFile(filePath, content, options);
    
    // Invalidate caches
    this._invalidateCachesForPath(filePath);
    
    return result;
  }

  /**
   * Delete file
   */
  async deleteFile(filePath, options = {}) {
    const result = await this.fileEditor.deleteFile(filePath, options);
    
    // Remove from index and invalidate caches
    this._removeFromIndex(filePath);
    this._invalidateCachesForPath(filePath);
    
    return result;
  }

  /**
   * Rename file
   */
  async renameFile(oldPath, newPath) {
    const result = await this.fileEditor.renameFile(oldPath, newPath);
    
    // Update index and caches
    this._removeFromIndex(oldPath);
    this._invalidateCachesForPath(oldPath);
    this._invalidateCachesForPath(newPath);
    
    return result;
  }

  /**
   * Start background indexing
   */
  async _startBackgroundIndexing() {
    if (this.isIndexing) return;
    
    this.isIndexing = true;
    console.log('📇 Starting background indexing...');
    
    try {
      // Get common directories from directory manager
      const allowedDirs = this.directoryManager.getAllowedDirectories();
      const commonDirs = allowedDirs.slice(0, 5); // Limit to first 5 for performance
      
      // Warmup cache
      await this.fsCache.warmup(commonDirs, async (path) => {
        try {
          const response = await fetch(
            `${this.apiBase}/api/file-system/browse?path=${encodeURIComponent(path)}`
          );
          const data = await response.json();
          return data.success ? data.items || [] : [];
        } catch (error) {
          console.warn(`Failed to prefetch ${path}:`, error.message);
          return [];
        }
      });
      
      this.lastIndexTime = Date.now();
      console.log('✅ Background indexing complete');
    } catch (error) {
      console.error('❌ Background indexing failed:', error);
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Index search results
   */
  _indexSearchResults(results) {
    results.forEach(item => {
      this.bitmaskIndex.addFile(item.path, {
        name: item.name || item.displayName,
        size: item.size || 0,
        modified: item.modified || Date.now(),
        type: item.fileType || item.type || 'file'
      });
    });
  }

  /**
   * Remove file from index
   */
  _removeFromIndex(filePath) {
    // Find and remove file from index
    const fileInfo = Array.from(this.bitmaskIndex.fileMetadata.values())
      .find(file => file.path === filePath);
    
    if (fileInfo) {
      this.bitmaskIndex.removeFile(fileInfo.id);
    }
  }

  /**
   * Invalidate all caches for a path
   */
  _invalidateCachesForPath(filePath) {
    const dirPath = this._getDirectoryPath(filePath);
    
    // Invalidate directory cache
    this.fsCache.invalidate(dirPath);
    
    // Clear query cache
    this.queryCache.clear();
  }

  /**
   * Query cache management
   */
  _getQueryCacheKey(query, options) {
    return JSON.stringify({ query: query.toLowerCase(), options });
  }

  _getFromQueryCache(key) {
    const cached = this.queryCache.get(key);
    
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > this.queryCacheTTL) {
      this.queryCache.delete(key);
      return null;
    }
    
    return { ...cached.data, cached: true };
  }

  _addToQueryCache(key, data) {
    // Evict oldest if cache is full
    if (this.queryCache.size >= this.queryCacheSize) {
      const firstKey = this.queryCache.keys().next().value;
      this.queryCache.delete(firstKey);
    }
    
    this.queryCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Update search statistics
   */
  _updateSearchStats(searchTime) {
    const totalSearches = this.searchStats.totalSearches;
    const prevAvg = this.searchStats.avgSearchTime;
    
    this.searchStats.avgSearchTime = 
      (prevAvg * (totalSearches - 1) + searchTime) / totalSearches;
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    return {
      search: this.searchStats,
      index: this.bitmaskIndex.getStats(),
      cache: this.fsCache.getStats(),
      security: {
        allowedDirectories: this.directoryManager.getAllowedDirectories().length,
        blacklistedPaths: this.directoryManager.getBlacklistedPaths().length
      },
      queryCache: {
        size: this.queryCache.size,
        maxSize: this.queryCacheSize
      }
    };
  }

  /**
   * Clear all caches and index
   */
  clearAll() {
    this.bitmaskIndex.clear();
    this.fsCache.clear();
    this.queryCache.clear();
    this.directoryManager.clearCache();
    this.searchStats = {
      totalSearches: 0,
      avgSearchTime: 0,
      indexedSearches: 0,
      fallbackSearches: 0
    };
  }

  /**
   * Helper: Get directory from path
   */
  _getDirectoryPath(filePath) {
    const normalized = filePath.replace(/\\/g, '/');
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash !== -1 ? normalized.substring(0, lastSlash) : '/';
  }

  /**
   * Export all data (for persistence)
   */
  export() {
    return {
      index: this.bitmaskIndex.export(),
      cache: this.fsCache.export(),
      directoryConfig: this.directoryManager.export(),
      stats: this.searchStats,
      lastIndexTime: this.lastIndexTime
    };
  }

  /**
   * Import all data
   */
  import(data) {
    if (data.index) this.bitmaskIndex.import(data.index);
    if (data.cache) this.fsCache.import(data.cache);
    if (data.directoryConfig) this.directoryManager.import(data.directoryConfig);
    if (data.stats) this.searchStats = data.stats;
    if (data.lastIndexTime) this.lastIndexTime = data.lastIndexTime;
  }
}
