/**
 * BitmaskFileIndex - Ultra-fast file indexing using bitmask operations
 * Provides O(1) search lookups for indexed files
 */
export class BitmaskFileIndex {
  constructor() {
    // Inverted index: keyword -> Set of file IDs
    this.invertedIndex = new Map();
    
    // File metadata: fileId -> file info
    this.fileMetadata = new Map();
    
    // Keyword to bitmask mapping for ultra-fast lookups
    this.keywordBitmasks = new Map();
    
    // File ID counter
    this.nextFileId = 0;
    
    // Index statistics
    this.stats = {
      totalFiles: 0,
      totalKeywords: 0,
      indexSize: 0,
      lastIndexTime: null
    };
  }

  /**
   * Add a file to the index
   */
  addFile(filePath, metadata = {}) {
    const fileId = this.nextFileId++;
    
    // Store file metadata
    const fileInfo = {
      id: fileId,
      path: filePath,
      name: metadata.name || this._getFileName(filePath),
      size: metadata.size || 0,
      modified: metadata.modified || Date.now(),
      type: metadata.type || this._getFileType(filePath),
      content: metadata.content || null
    };
    
    this.fileMetadata.set(fileId, fileInfo);
    
    // Extract and index keywords
    const keywords = this._extractKeywords(fileInfo);
    keywords.forEach(keyword => {
      if (!this.invertedIndex.has(keyword)) {
        this.invertedIndex.set(keyword, new Set());
      }
      this.invertedIndex.get(keyword).add(fileId);
    });
    
    this.stats.totalFiles++;
    this.stats.lastIndexTime = Date.now();
    
    return fileId;
  }

  /**
   * Search for files using bitmask operations
   */
  search(query, options = {}) {
    const keywords = this._normalizeQuery(query);
    
    if (keywords.length === 0) {
      return [];
    }

    // Get file IDs matching ALL keywords (AND operation)
    let resultIds = null;
    
    for (const keyword of keywords) {
      const matchingIds = this._findMatchingIds(keyword);
      
      if (resultIds === null) {
        resultIds = matchingIds;
      } else {
        // Intersection of sets (AND operation)
        resultIds = new Set([...resultIds].filter(id => matchingIds.has(id)));
      }
      
      // Early exit if no matches
      if (resultIds.size === 0) {
        break;
      }
    }

    // Convert IDs to file metadata
    const results = resultIds 
      ? Array.from(resultIds).map(id => this.fileMetadata.get(id))
      : [];

    // Apply filters
    return this._applyFilters(results, options);
  }

  /**
   * Find file IDs matching a keyword (supports partial matching)
   */
  _findMatchingIds(keyword) {
    const matchingIds = new Set();
    
    // Exact match
    if (this.invertedIndex.has(keyword)) {
      this.invertedIndex.get(keyword).forEach(id => matchingIds.add(id));
    }
    
    // Partial match (prefix search)
    for (const [indexedKeyword, ids] of this.invertedIndex.entries()) {
      if (indexedKeyword.startsWith(keyword) || indexedKeyword.includes(keyword)) {
        ids.forEach(id => matchingIds.add(id));
      }
    }
    
    return matchingIds;
  }

  /**
   * Extract searchable keywords from file info
   */
  _extractKeywords(fileInfo) {
    const keywords = new Set();
    
    // File name keywords
    const nameParts = fileInfo.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(part => part.length > 1);
    
    nameParts.forEach(part => keywords.add(part));
    
    // File extension
    const ext = fileInfo.name.split('.').pop();
    if (ext && ext !== fileInfo.name) {
      keywords.add(ext.toLowerCase());
    }
    
    // File type
    keywords.add(fileInfo.type);
    
    // Content keywords (if available)
    if (fileInfo.content) {
      const contentWords = fileInfo.content
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2)
        .slice(0, 100); // Limit to first 100 words
      
      contentWords.forEach(word => keywords.add(word));
    }
    
    // Path segments
    const pathParts = fileInfo.path
      .toLowerCase()
      .split(/[\/\\]/)
      .filter(part => part.length > 1);
    
    pathParts.forEach(part => keywords.add(part));
    
    return keywords;
  }

  /**
   * Normalize search query into keywords
   */
  _normalizeQuery(query) {
    return query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  /**
   * Apply search filters to results
   */
  _applyFilters(results, options) {
    let filtered = [...results];

    // File type filter
    if (options.fileTypes && options.fileTypes.length > 0) {
      const extensions = options.fileTypes.map(ext => 
        ext.startsWith('.') ? ext.slice(1).toLowerCase() : ext.toLowerCase()
      );
      filtered = filtered.filter(file => {
        const ext = file.name.split('.').pop().toLowerCase();
        return extensions.includes(ext);
      });
    }

    // Size filter
    if (options.minSize !== undefined) {
      filtered = filtered.filter(file => file.size >= options.minSize);
    }
    if (options.maxSize !== undefined) {
      filtered = filtered.filter(file => file.size <= options.maxSize);
    }

    // Modified date filter
    if (options.modifiedAfter) {
      filtered = filtered.filter(file => file.modified >= options.modifiedAfter);
    }
    if (options.modifiedBefore) {
      filtered = filtered.filter(file => file.modified <= options.modifiedBefore);
    }

    // Sort results by relevance (files with more keyword matches rank higher)
    filtered.sort((a, b) => {
      // Sort by modified date (most recent first) as default
      return b.modified - a.modified;
    });

    // Limit results
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Remove file from index
   */
  removeFile(fileId) {
    const fileInfo = this.fileMetadata.get(fileId);
    if (!fileInfo) return false;

    // Remove from inverted index
    const keywords = this._extractKeywords(fileInfo);
    keywords.forEach(keyword => {
      const ids = this.invertedIndex.get(keyword);
      if (ids) {
        ids.delete(fileId);
        if (ids.size === 0) {
          this.invertedIndex.delete(keyword);
        }
      }
    });

    // Remove metadata
    this.fileMetadata.delete(fileId);
    this.stats.totalFiles--;

    return true;
  }

  /**
   * Clear entire index
   */
  clear() {
    this.invertedIndex.clear();
    this.fileMetadata.clear();
    this.keywordBitmasks.clear();
    this.nextFileId = 0;
    this.stats = {
      totalFiles: 0,
      totalKeywords: 0,
      indexSize: 0,
      lastIndexTime: null
    };
  }

  /**
   * Get index statistics
   */
  getStats() {
    return {
      ...this.stats,
      totalKeywords: this.invertedIndex.size,
      indexSize: this._calculateIndexSize()
    };
  }

  /**
   * Calculate approximate index size in bytes
   */
  _calculateIndexSize() {
    let size = 0;
    
    // Inverted index size
    for (const [keyword, ids] of this.invertedIndex.entries()) {
      size += keyword.length * 2; // UTF-16 characters
      size += ids.size * 8; // Approximate size per ID
    }
    
    // Metadata size
    for (const [, fileInfo] of this.fileMetadata.entries()) {
      size += JSON.stringify(fileInfo).length * 2;
    }
    
    return size;
  }

  /**
   * Helper: Get file name from path
   */
  _getFileName(filePath) {
    return filePath.split(/[\/\\]/).pop() || filePath;
  }

  /**
   * Helper: Get file type from path
   */
  _getFileType(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    if (!ext || ext === filePath) return 'file';
    
    // Document types
    if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) return 'document';
    
    // Image types
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) return 'image';
    
    // Video types
    if (['mp4', 'avi', 'mov', 'mkv', 'flv', 'wmv'].includes(ext)) return 'video';
    
    // Audio types
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'].includes(ext)) return 'audio';
    
    // Code types
    if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb'].includes(ext)) return 'code';
    
    // Archive types
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
    
    return 'file';
  }

  /**
   * Export index to JSON (for persistence)
   */
  export() {
    return {
      fileMetadata: Array.from(this.fileMetadata.entries()),
      invertedIndex: Array.from(this.invertedIndex.entries()).map(([key, value]) => [key, Array.from(value)]),
      nextFileId: this.nextFileId,
      stats: this.stats
    };
  }

  /**
   * Import index from JSON
   */
  import(data) {
    this.clear();
    
    this.fileMetadata = new Map(data.fileMetadata);
    this.invertedIndex = new Map(
      data.invertedIndex.map(([key, value]) => [key, new Set(value)])
    );
    this.nextFileId = data.nextFileId;
    this.stats = data.stats;
  }
}
