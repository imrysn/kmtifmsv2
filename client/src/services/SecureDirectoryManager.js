/**
 * SecureDirectoryManager - Manages directory permissions and access validation
 * Ensures only allowed directories can be accessed
 */
export class SecureDirectoryManager {
  constructor() {
    this.allowedDirectories = this.loadAllowedDirectories();
    this.blacklistedPaths = this.loadBlacklistedPaths();
    this.permissionCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Check if directory access is allowed
   */
  async checkDirectoryAccess(dirPath) {
    if (!dirPath) {
      throw new Error('Directory path is required');
    }

    const normalizedPath = this._normalizePath(dirPath);

    // Check cache first
    const cached = this.permissionCache.get(normalizedPath);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      if (!cached.allowed) {
        throw new Error(`Directory access denied: ${dirPath}`);
      }
      return true;
    }

    // Validate against allowed directories
    if (!this.isDirectoryAllowed(normalizedPath)) {
      this._cachePermission(normalizedPath, false);
      throw new Error(`Directory access denied: ${dirPath}`);
    }

    // Check if path is blacklisted
    if (this.isBlacklisted(normalizedPath)) {
      this._cachePermission(normalizedPath, false);
      throw new Error(`Directory is blacklisted: ${dirPath}`);
    }

    this._cachePermission(normalizedPath, true);
    return true;
  }

  /**
   * Check if file can be edited
   */
  async checkFileEditAccess(filePath) {
    if (!filePath) {
      throw new Error('File path is required');
    }

    const dirPath = this._getDirectoryPath(filePath);
    
    // Check directory access first
    await this.checkDirectoryAccess(dirPath);

    // Check if file extension is safe
    if (!this.isSafeFileExtension(filePath)) {
      throw new Error(`File type not allowed for editing: ${filePath}`);
    }

    return true;
  }

  /**
   * Check if directory is in allowed list
   */
  isDirectoryAllowed(directoryPath) {
    const normalizedPath = this._normalizePath(directoryPath);

    // Check if path is within any allowed directory
    return this.allowedDirectories.some(allowedDir => {
      const normalizedAllowed = this._normalizePath(allowedDir);
      return normalizedPath.startsWith(normalizedAllowed) || 
             normalizedPath === normalizedAllowed;
    });
  }

  /**
   * Check if directory is blacklisted
   */
  isBlacklisted(directoryPath) {
    const normalizedPath = this._normalizePath(directoryPath);

    return this.blacklistedPaths.some(blacklistedDir => {
      const normalizedBlacklisted = this._normalizePath(blacklistedDir);
      return normalizedPath.startsWith(normalizedBlacklisted) || 
             normalizedPath === normalizedBlacklisted;
    });
  }

  /**
   * Check if file extension is safe for editing
   */
  isSafeFileExtension(filename) {
    const unsafeExtensions = [
      '.exe', '.bat', '.cmd', '.sh', '.bin', '.dll', '.sys',
      '.com', '.scr', '.vbs', '.ps1', '.app', '.deb', '.rpm'
    ];

    const ext = this._getFileExtension(filename).toLowerCase();
    return !unsafeExtensions.includes(ext);
  }

  /**
   * Load allowed directories from configuration
   */
  loadAllowedDirectories() {
    const home = this._getHomeDirectory();
    
    return [
      // User directories
      `${home}`,
      `/`,

      
      // Add any custom allowed directories here
    ].filter(path => path); // Remove any null/undefined paths
  }

  /**
   * Load blacklisted directories
   */
  loadBlacklistedPaths() {
    const home = this._getHomeDirectory();
    
    return [
      // System directories (Windows)
      'C:\\Windows',
      'C:\\Program Files',
      'C:\\Program Files (x86)',
      'C:\\ProgramData',
      
      // System directories (Linux/Mac)
      '/System',
      '/etc',
      '/root',
      '/boot',
      '/proc',
      '/sys',
      '/dev',
      '/var/log',
      
      // Sensitive user directories
      `${home}/.ssh`,
      `${home}/.aws`,
      `${home}/.gnupg`,
      `${home}/AppData/Local`,
      `${home}/AppData/Roaming`,
      `${home}/Library/Keychains`,
      
      // Version control internals
      '.git',
      '.svn',
      '.hg',
      
      // Node modules (too large, not for editing)
      'node_modules',
      
    ].filter(path => path);
  }

  /**
   * Add a directory to allowed list
   */
  addAllowedDirectory(dirPath) {
    const normalizedPath = this._normalizePath(dirPath);
    
    if (!this.allowedDirectories.includes(normalizedPath)) {
      this.allowedDirectories.push(normalizedPath);
      this.permissionCache.clear(); // Clear cache after modification
      return true;
    }
    
    return false;
  }

  /**
   * Remove a directory from allowed list
   */
  removeAllowedDirectory(dirPath) {
    const normalizedPath = this._normalizePath(dirPath);
    const index = this.allowedDirectories.indexOf(normalizedPath);
    
    if (index !== -1) {
      this.allowedDirectories.splice(index, 1);
      this.permissionCache.clear();
      return true;
    }
    
    return false;
  }

  /**
   * Add a directory to blacklist
   */
  addBlacklistedPath(dirPath) {
    const normalizedPath = this._normalizePath(dirPath);
    
    if (!this.blacklistedPaths.includes(normalizedPath)) {
      this.blacklistedPaths.push(normalizedPath);
      this.permissionCache.clear();
      return true;
    }
    
    return false;
  }

  /**
   * Get all allowed directories
   */
  getAllowedDirectories() {
    return [...this.allowedDirectories];
  }

  /**
   * Get all blacklisted paths
   */
  getBlacklistedPaths() {
    return [...this.blacklistedPaths];
  }

  /**
   * Clear permission cache
   */
  clearCache() {
    this.permissionCache.clear();
  }

  /**
   * Cache permission check result
   */
  _cachePermission(path, allowed) {
    this.permissionCache.set(path, {
      allowed,
      timestamp: Date.now()
    });
  }

  /**
   * Normalize path for consistent comparisons
   */
  _normalizePath(path) {
    if (!path) return '';
    
    return path
      .replace(/\\/g, '/')
      .replace(/\/+/g, '/')
      .replace(/\/$/, '')
      .toLowerCase();
  }

  /**
   * Get directory path from file path
   */
  _getDirectoryPath(filePath) {
    const normalized = filePath.replace(/\\/g, '/');
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash !== -1 ? normalized.substring(0, lastSlash) : normalized;
  }

  /**
   * Get file extension
   */
  _getFileExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.substring(lastDot) : '';
  }

  /**
   * Get home directory (platform-independent)
   */
  _getHomeDirectory() {
    // Browser environment - use empty string
    if (typeof process === 'undefined' || !process.env) {
      return '';
    }
    
    // Node environment
    return process.env.HOME || 
           process.env.USERPROFILE || 
           process.env.HOMEPATH || 
           '';
  }

  /**
   * Get permission cache statistics
   */
  getCacheStats() {
    return {
      cacheSize: this.permissionCache.size,
      cacheTimeout: this.cacheTimeout
    };
  }

  /**
   * Export configuration
   */
  export() {
    return {
      allowedDirectories: this.allowedDirectories,
      blacklistedPaths: this.blacklistedPaths
    };
  }

  /**
   * Import configuration
   */
  import(config) {
    if (config.allowedDirectories) {
      this.allowedDirectories = config.allowedDirectories;
    }
    if (config.blacklistedPaths) {
      this.blacklistedPaths = config.blacklistedPaths;
    }
    this.permissionCache.clear();
  }
}
