const fs = require('fs').promises;
const path = require('path');
const { db } = require('../config/database');

/**
 * File System Indexer Service (MySQL Only)
 * Builds and maintains a searchable index of all files in the root directory
 */

class FileIndexer {
  constructor() {
    this.isIndexing = false;
    this.indexProgress = { current: 0, total: 0, currentPath: '' };
  }

  /**
   * Initialize the file_index table
   */
  async initializeIndexTable() {
    console.log('🔧 Initializing file_index table...');

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS file_index (
        id INT PRIMARY KEY AUTO_INCREMENT,
        file_name VARCHAR(500) NOT NULL,
        file_path TEXT NOT NULL,
        parent_path TEXT NOT NULL,
        full_path TEXT NOT NULL,
        file_type VARCHAR(50),
        is_directory BOOLEAN NOT NULL,
        file_size BIGINT,
        modified_date DATETIME,
        indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_file_name (file_name),
        INDEX idx_parent_path (parent_path(255)),
        INDEX idx_file_type (file_type),
        INDEX idx_is_directory (is_directory)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci
    `;

    await db.query(createTableSQL);
    console.log('✅ MySQL file_index table created/verified');
  }

  /**
   * Clear all entries from the file index
   */
  async clearIndex() {
    console.log('🗑️  Clearing file index...');
    await db.query('DELETE FROM file_index');
    console.log('✅ File index cleared');
  }

  /**
   * Build complete index of the root directory
   */
  async buildIndex(rootDirectory) {
    if (this.isIndexing) {
      throw new Error('Indexing is already in progress');
    }

    this.isIndexing = true;
    this.indexProgress = { current: 0, total: 0, currentPath: '' };

    console.log('📁 Starting file system indexing...');
    console.log('📂 Root directory:', rootDirectory);

    const startTime = Date.now();

    try {
      // Clear existing index
      await this.clearIndex();

      // Count total items first (for progress tracking)
      this.indexProgress.total = await this.countItems(rootDirectory);
      console.log(`📊 Total items to index: ${this.indexProgress.total}`);

      // Build the index
      await this.indexDirectory(rootDirectory, rootDirectory, '/');

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Indexing complete! Indexed ${this.indexProgress.current} items in ${duration}s`);

      return {
        success: true,
        itemsIndexed: this.indexProgress.current,
        duration: duration
      };

    } catch (error) {
      console.error('❌ Error during indexing:', error);
      throw error;
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Count total items in directory (for progress tracking)
   */
  async countItems(dirPath) {
    let count = 0;

    try {
      const items = await fs.readdir(dirPath);
      count += items.length;

      for (const item of items) {
        if (item.startsWith('.')) {
          continue;
        }

        try {
          const fullPath = path.join(dirPath, item);
          const stats = await fs.stat(fullPath);

          if (stats.isDirectory()) {
            count += await this.countItems(fullPath);
          }
        } catch (err) {
          // Skip inaccessible items
        }
      }
    } catch (err) {
      // Skip inaccessible directories
    }

    return count;
  }

  /**
   * Recursively index a directory
   */
  async indexDirectory(rootDirectory, currentPath, relativePath) {
    try {
      const items = await fs.readdir(currentPath);

      for (const item of items) {
        // Skip hidden files
        if (item.startsWith('.')) {
          continue;
        }

        try {
          const fullPath = path.join(currentPath, item);
          const stats = await fs.stat(fullPath);
          const isDirectory = stats.isDirectory();

          // Build relative path
          const itemRelativePath = relativePath === '/' ? `/${item}` : `${relativePath}/${item}`;

          // Insert into database
          await this.insertIndexEntry({
            fileName: item,
            filePath: itemRelativePath,
            parentPath: relativePath,
            fullPath: fullPath,
            fileType: isDirectory ? null : path.extname(item).toLowerCase().slice(1) || 'unknown',
            isDirectory: isDirectory,
            fileSize: isDirectory ? null : stats.size,
            modifiedDate: stats.mtime
          });

          this.indexProgress.current++;
          this.indexProgress.currentPath = itemRelativePath;

          // Log progress every 100 items
          if (this.indexProgress.current % 100 === 0) {
            console.log(`📊 Progress: ${this.indexProgress.current}/${this.indexProgress.total} - ${itemRelativePath}`);
          }

          // Recursively index subdirectories
          if (isDirectory) {
            await this.indexDirectory(rootDirectory, fullPath, itemRelativePath);
          }

        } catch (itemError) {
          console.error(`⚠️  Error indexing ${item}:`, itemError.message);
          // Continue with next item
        }
      }
    } catch (dirError) {
      console.error(`⚠️  Error reading directory ${currentPath}:`, dirError.message);
    }
  }

  /**
   * Insert a single entry into the index
   */
  async insertIndexEntry(entry) {
    await db.query(
      `INSERT INTO file_index 
       (file_name, file_path, parent_path, full_path, file_type, is_directory, file_size, modified_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.fileName,
        entry.filePath,
        entry.parentPath,
        entry.fullPath,
        entry.fileType,
        entry.isDirectory ? 1 : 0,
        entry.fileSize,
        entry.modifiedDate
      ]
    );
  }

  /**
   * Search the index
   */
  async search(searchQuery, searchPath = '/') {
    const results = await db.query(
      `SELECT * FROM file_index 
       WHERE file_name LIKE ?
       AND (parent_path = ? OR parent_path LIKE ?)
       ORDER BY 
         CASE WHEN is_directory = 1 THEN 0 ELSE 1 END,
         file_name
       LIMIT 500`,
      [`%${searchQuery}%`, searchPath, `${searchPath}/%`]
    );
    return results;
  }

  /**
   * Get indexing progress
   */
  getProgress() {
    return {
      isIndexing: this.isIndexing,
      progress: this.indexProgress
    };
  }

  /**
   * Get index statistics
   */
  async getStats() {
    const result = await db.query(
      `SELECT 
         COUNT(*) as total_items,
         SUM(CASE WHEN is_directory = 1 THEN 1 ELSE 0 END) as total_directories,
         SUM(CASE WHEN is_directory = 0 THEN 1 ELSE 0 END) as total_files,
         MAX(indexed_at) as last_indexed
       FROM file_index`
    );
    return result[0];
  }
}

// Export singleton instance
module.exports = new FileIndexer();