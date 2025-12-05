import { SecureDirectoryManager } from './SecureDirectoryManager';

/**
 * FileEditor - Handles safe file reading, writing, and editing operations
 * Integrated with security manager for permission validation
 */
export class FileEditor {
  constructor(apiBase, directoryManager = null) {
    this.apiBase = apiBase || 'http://localhost:3001';
    this.directoryManager = directoryManager || new SecureDirectoryManager();
    this.maxFileSize = 50 * 1024 * 1024; // 50MB default limit
  }

  /**
   * Read file content with security checks
   */
  async readFile(filePath, options = {}) {
    try {
      // Security check
      const dirPath = this._getDirectoryPath(filePath);
      await this.directoryManager.checkDirectoryAccess(dirPath);

      const maxSize = options.maxSize || this.maxFileSize;

      // Use the API to read file
      const response = await fetch(
        `${this.apiBase}/api/file-system/read-file?path=${encodeURIComponent(filePath)}&maxSize=${maxSize}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to read file: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to read file');
      }

      return {
        success: true,
        content: data.content,
        size: data.size,
        encoding: data.encoding || options.encoding || 'utf-8',
        path: filePath
      };
    } catch (error) {
      console.error('Error reading file:', error);
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * Write/edit file content with security checks and backup
   */
  async editFile(filePath, content, options = {}) {
    try {
      // Security checks
      await this.directoryManager.checkFileEditAccess(filePath);

      // Validate content if validator provided
      if (options.validate && typeof options.validate === 'function') {
        try {
          options.validate(content);
        } catch (validationError) {
          throw new Error(`Content validation failed: ${validationError.message}`);
        }
      }

      // Create backup if requested
      let backupPath = null;
      if (options.backup) {
        try {
          backupPath = await this.createBackup(filePath);
        } catch (backupError) {
          console.warn('Failed to create backup:', backupError);
          // Continue with edit even if backup fails, unless explicitly required
          if (options.requireBackup) {
            throw new Error(`Backup required but failed: ${backupError.message}`);
          }
        }
      }

      // Write file using API
      const response = await fetch(`${this.apiBase}/api/file-system/write-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: filePath,
          content: content,
          encoding: options.encoding || 'utf-8',
          backup: options.backup || false
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to write file: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to write file');
      }

      return {
        success: true,
        path: filePath,
        backupPath: backupPath || data.backupPath,
        bytesWritten: content.length
      };
    } catch (error) {
      console.error('Error editing file:', error);
      throw new Error(`Failed to edit file: ${error.message}`);
    }
  }

  /**
   * Create a backup of a file
   */
  async createBackup(filePath) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${filePath}.backup.${timestamp}`;

      const response = await fetch(`${this.apiBase}/api/file-system/backup-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sourcePath: filePath,
          backupPath: backupPath
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Backup failed');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Backup failed');
      }

      return data.backupPath || backupPath;
    } catch (error) {
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  /**
   * Delete a file with security checks
   */
  async deleteFile(filePath, options = {}) {
    try {
      // Security check
      await this.directoryManager.checkFileEditAccess(filePath);

      // Create backup before deleting if requested
      let backupPath = null;
      if (options.backup) {
        backupPath = await this.createBackup(filePath);
      }

      const response = await fetch(`${this.apiBase}/api/file-system/delete-file`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: filePath
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Delete failed');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Delete failed');
      }

      return {
        success: true,
        path: filePath,
        backupPath
      };
    } catch (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Rename/move a file with security checks
   */
  async renameFile(oldPath, newPath) {
    try {
      // Security checks for both paths
      await this.directoryManager.checkFileEditAccess(oldPath);
      const newDirPath = this._getDirectoryPath(newPath);
      await this.directoryManager.checkDirectoryAccess(newDirPath);

      const response = await fetch(`${this.apiBase}/api/file-system/rename-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          oldPath,
          newPath
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Rename failed');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Rename failed');
      }

      return {
        success: true,
        oldPath,
        newPath
      };
    } catch (error) {
      throw new Error(`Failed to rename file: ${error.message}`);
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(filePath) {
    try {
      const dirPath = this._getDirectoryPath(filePath);
      await this.directoryManager.checkDirectoryAccess(dirPath);

      const response = await fetch(
        `${this.apiBase}/api/file-system/file-info?path=${encodeURIComponent(filePath)}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to get file info');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to get file info');
      }

      return {
        success: true,
        ...data.info
      };
    } catch (error) {
      throw new Error(`Failed to get file info: ${error.message}`);
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    try {
      const info = await this.getFileInfo(filePath);
      return info.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate file size before reading
   */
  async validateFileSize(filePath, maxSize = null) {
    const info = await this.getFileInfo(filePath);
    const limit = maxSize || this.maxFileSize;

    if (info.size > limit) {
      throw new Error(
        `File too large: ${this._formatBytes(info.size)} (max: ${this._formatBytes(limit)})`
      );
    }

    return true;
  }

  /**
   * Set max file size limit
   */
  setMaxFileSize(sizeInBytes) {
    this.maxFileSize = sizeInBytes;
  }

  /**
   * Helper: Get directory path from file path
   */
  _getDirectoryPath(filePath) {
    const normalized = filePath.replace(/\\/g, '/');
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash !== -1 ? normalized.substring(0, lastSlash) : normalized;
  }

  /**
   * Helper: Format bytes to human readable
   */
  _formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Export editor configuration
   */
  export() {
    return {
      apiBase: this.apiBase,
      maxFileSize: this.maxFileSize,
      directoryConfig: this.directoryManager.export()
    };
  }
}
