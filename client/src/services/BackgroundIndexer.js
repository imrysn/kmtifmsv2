/**
 * BackgroundIndexer - Progressive file system indexer with persistence
 * Indexes directories in the background without blocking UI
 */
export class BackgroundIndexer {
  constructor(apiBase, persistentIndexManager) {
    this.apiBase = apiBase;
    this.persistentIndexManager = persistentIndexManager;
    
    // Indexing state
    this.isIndexing = false;
    this.isPaused = false;
    this.currentDirectory = null;
    this.indexQueue = [];
    this.processedPaths = new Set();
    this.currentBatch = 0;
    this.totalBatches = 0;
    
    // Progress tracking
    this.progress = {
      totalFiles: 0,
      indexedFiles: 0,
      currentPath: '',
      percentage: 0,
      estimatedTimeRemaining: 0
    };
    
    // Performance settings
    this.batchSize = 50; // Files per batch
    this.batchDelay = 100; // ms between batches (allow UI to breathe)
    this.maxConcurrentRequests = 3;
    this.startTime = null;
    
    // Callbacks
    this.onProgressCallback = null;
    this.onCompleteCallback = null;
    this.onErrorCallback = null;
  }

  /**
   * Start indexing a directory
   */
  async startIndexing(rootDirectory, options = {}) {
    if (this.isIndexing) {
      console.warn('⚠️ Indexing already in progress');
      return;
    }

    console.log(`🚀 Starting background indexing for: ${rootDirectory}`);
    
    this.isIndexing = true;
    this.isPaused = false;
    this.currentDirectory = rootDirectory;
    this.startTime = Date.now();
    this.processedPaths.clear();
    
    // Reset progress
    this.progress = {
      totalFiles: 0,
      indexedFiles: 0,
      currentPath: rootDirectory,
      percentage: 0,
      estimatedTimeRemaining: 0
    };

    try {
      // Check if we have a cached index
      const cachedIndex = await this.persistentIndexManager.loadIndex(rootDirectory);
      
      if (cachedIndex && !options.forceReindex) {
        console.log('📦 Using cached index');
        
        if (this.onCompleteCallback) {
          this.onCompleteCallback({
            success: true,
            fromCache: true,
            fileCount: cachedIndex.fileCount,
            directory: rootDirectory
          });
        }
        
        this.isIndexing = false;
        return cachedIndex.indexData;
      }

      // Start fresh indexing
      const indexData = await this._indexDirectoryRecursive(rootDirectory);
      
      // Save to persistent storage
      await this.persistentIndexManager.saveIndex(rootDirectory, {
        ...indexData,
        fileCount: this.progress.indexedFiles
      });

      console.log(`✅ Indexing complete: ${this.progress.indexedFiles} files in ${this._formatDuration(Date.now() - this.startTime)}`);
      
      if (this.onCompleteCallback) {
        this.onCompleteCallback({
          success: true,
          fromCache: false,
          fileCount: this.progress.indexedFiles,
          duration: Date.now() - this.startTime,
          directory: rootDirectory
        });
      }

      return indexData;
    } catch (error) {
      console.error('❌ Indexing failed:', error);
      
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
      
      throw error;
    } finally {
      this.isIndexing = false;
      this.currentDirectory = null;
    }
  }

  /**
   * Recursively index directory
   */
  async _indexDirectoryRecursive(directoryPath, depth = 0) {
    if (this.isPaused) {
      await this._waitForResume();
    }

    // Prevent infinite loops and limit depth
    if (this.processedPaths.has(directoryPath) || depth > 10) {
      return { files: [], directories: [] };
    }

    this.processedPaths.add(directoryPath);
    this.progress.currentPath = directoryPath;

    try {
      // Fetch directory contents
      const items = await this._fetchDirectory(directoryPath);
      
      const files = [];
      const directories = [];
      const subdirPromises = [];

      // Process items
      for (const item of items) {
        if (item.type === 'folder' || item.type === 'directory') {
          directories.push(item);
          
          // Queue subdirectory for indexing
          subdirPromises.push(
            this._indexDirectoryRecursive(item.path, depth + 1)
          );
        } else {
          files.push({
            id: `file-${this.progress.indexedFiles}`,
            name: item.name || item.displayName,
            path: item.path,
            size: item.size || 0,
            modified: item.modified || Date.now(),
            type: item.fileType || this._getFileType(item.name)
          });
          
          this.progress.indexedFiles++;
        }

        // Update progress after each batch
        if (this.progress.indexedFiles % this.batchSize === 0) {
          this._updateProgress();
          await this._delay(this.batchDelay);
        }
      }

      // Process subdirectories with concurrency control
      const subdirResults = await this._processWithConcurrency(subdirPromises);
      
      // Flatten results
      for (const result of subdirResults) {
        files.push(...result.files);
        directories.push(...result.directories);
      }

      return { files, directories };
    } catch (error) {
      console.error(`Failed to index ${directoryPath}:`, error.message);
      return { files: [], directories: [] };
    }
  }

  /**
   * Fetch directory contents from API
   */
  async _fetchDirectory(path) {
    const response = await fetch(
      `${this.apiBase}/api/file-system/browse?path=${encodeURIComponent(path)}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch directory: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Failed to list directory');
    }

    return data.items || [];
  }

  /**
   * Process promises with concurrency limit
   */
  async _processWithConcurrency(promises) {
    const results = [];
    
    for (let i = 0; i < promises.length; i += this.maxConcurrentRequests) {
      const batch = promises.slice(i, i + this.maxConcurrentRequests);
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Update progress and notify listeners
   */
  _updateProgress() {
    const elapsed = Date.now() - this.startTime;
    const filesPerMs = this.progress.indexedFiles / elapsed;
    
    // Calculate percentage (we don't know total in advance, so estimate based on processed paths)
    // For now, just show file count without percentage
    this.progress.percentage = 0; // Will be calculated when we know total
    
    this.progress.estimatedTimeRemaining = 
      this.progress.totalFiles > 0 
        ? Math.round((this.progress.totalFiles - this.progress.indexedFiles) / filesPerMs)
        : 0;

    if (this.onProgressCallback) {
      this.onProgressCallback({ ...this.progress });
    }
  }

  /**
   * Pause indexing
   */
  pause() {
    if (this.isIndexing && !this.isPaused) {
      this.isPaused = true;
      console.log('⏸️ Indexing paused');
    }
  }

  /**
   * Resume indexing
   */
  resume() {
    if (this.isIndexing && this.isPaused) {
      this.isPaused = false;
      console.log('▶️ Indexing resumed');
    }
  }

  /**
   * Cancel indexing
   */
  cancel() {
    if (this.isIndexing) {
      this.isIndexing = false;
      this.isPaused = false;
      console.log('❌ Indexing cancelled');
    }
  }

  /**
   * Wait for resume
   */
  async _waitForResume() {
    while (this.isPaused) {
      await this._delay(100);
    }
  }

  /**
   * Set progress callback
   */
  onProgress(callback) {
    this.onProgressCallback = callback;
  }

  /**
   * Set completion callback
   */
  onComplete(callback) {
    this.onCompleteCallback = callback;
  }

  /**
   * Set error callback
   */
  onError(callback) {
    this.onErrorCallback = callback;
  }

  /**
   * Get current progress
   */
  getProgress() {
    return { ...this.progress };
  }

  /**
   * Check if currently indexing
   */
  isActive() {
    return this.isIndexing;
  }

  /**
   * Helper: Get file type from name
   */
  _getFileType(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    const typeMap = {
      // Documents
      'pdf': 'pdf',
      'doc': 'document',
      'docx': 'document',
      'txt': 'text',
      'rtf': 'document',
      
      // Images
      'jpg': 'image',
      'jpeg': 'image',
      'png': 'image',
      'gif': 'image',
      'svg': 'image',
      'webp': 'image',
      
      // Videos
      'mp4': 'video',
      'avi': 'video',
      'mov': 'video',
      'mkv': 'video',
      
      // Audio
      'mp3': 'audio',
      'wav': 'audio',
      'ogg': 'audio',
      
      // Code
      'js': 'code',
      'jsx': 'code',
      'ts': 'code',
      'tsx': 'code',
      'py': 'code',
      'java': 'code',
      'cpp': 'code',
      'c': 'code',
      'html': 'code',
      'css': 'code',
      
      // Archives
      'zip': 'archive',
      'rar': 'archive',
      '7z': 'archive',
      'tar': 'archive',
      'gz': 'archive'
    };

    return typeMap[ext] || 'file';
  }

  /**
   * Helper: Delay
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper: Format duration
   */
  _formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }
}
