/**
 * PersistentIndexManager - Manages persistent storage of file index
 * Stores index in IndexedDB for fast retrieval across sessions
 */
export class PersistentIndexManager {
  constructor() {
    this.dbName = 'FileIndexDB';
    this.dbVersion = 1;
    this.storeName = 'fileIndex';
    this.db = null;
    this.isInitialized = false;
  }

  /**
   * Initialize IndexedDB
   */
  async initialize() {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('❌ Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('✅ IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object store for file index
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, { keyPath: 'id' });
          
          // Create indexes for efficient querying
          objectStore.createIndex('directory', 'directory', { unique: false });
          objectStore.createIndex('lastIndexed', 'lastIndexed', { unique: false });
          objectStore.createIndex('version', 'version', { unique: false });
        }

        console.log('📦 IndexedDB schema created');
      };
    });
  }

  /**
   * Save index data to IndexedDB
   */
  async saveIndex(directory, indexData) {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const data = {
        id: this._getIndexId(directory),
        directory,
        indexData,
        lastIndexed: Date.now(),
        version: 1, // For future schema migrations
        fileCount: indexData.fileCount || 0
      };

      const request = store.put(data);

      request.onsuccess = () => {
        console.log(`💾 Saved index for ${directory} (${data.fileCount} files)`);
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Failed to save index:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Load index data from IndexedDB
   */
  async loadIndex(directory) {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(this._getIndexId(directory));

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          console.log(`📂 Loaded index for ${directory} (${result.fileCount} files, indexed ${this._formatTimeAgo(result.lastIndexed)})`);
          resolve(result);
        } else {
          console.log(`📂 No cached index found for ${directory}`);
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('❌ Failed to load index:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete index for a specific directory
   */
  async deleteIndex(directory) {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(this._getIndexId(directory));

      request.onsuccess = () => {
        console.log(`🗑️ Deleted index for ${directory}`);
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Failed to delete index:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all stored indexes
   */
  async getAllIndexes() {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('❌ Failed to get all indexes:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clear all stored indexes
   */
  async clearAll() {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('🗑️ Cleared all indexes');
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Failed to clear indexes:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Check if index exists for directory
   */
  async hasIndex(directory) {
    const index = await this.loadIndex(directory);
    return index !== null;
  }

  /**
   * Get storage statistics
   */
  async getStats() {
    await this.ensureInitialized();

    const indexes = await this.getAllIndexes();
    
    const totalFiles = indexes.reduce((sum, idx) => sum + (idx.fileCount || 0), 0);
    const totalSize = await this._estimateStorageSize();

    return {
      indexCount: indexes.length,
      totalFiles,
      directories: indexes.map(idx => ({
        directory: idx.directory,
        fileCount: idx.fileCount,
        lastIndexed: idx.lastIndexed,
        age: Date.now() - idx.lastIndexed
      })),
      estimatedSize: totalSize
    };
  }

  /**
   * Helper: Ensure DB is initialized
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Helper: Generate index ID from directory
   */
  _getIndexId(directory) {
    return `index_${directory.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  /**
   * Helper: Estimate storage size (approximate)
   */
  async _estimateStorageSize() {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        return estimate.usage || 0;
      } catch (error) {
        console.warn('Could not estimate storage:', error);
      }
    }
    return 0;
  }

  /**
   * Helper: Format time ago
   */
  _formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
      console.log('📪 IndexedDB connection closed');
    }
  }
}
