// Database Configuration - Supports both SQLite and MySQL
// Automatically uses MySQL if configured, falls back to SQLite

// Load environment variables FIRST
require('dotenv').config();

const path = require('path');
const fs = require('fs');

// Check if we should use MySQL
const USE_MYSQL = process.env.USE_MYSQL === 'true' || process.env.DB_HOST;

let db, dbPath, networkDataPath, networkProjectsPath;

if (USE_MYSQL) {
  // ============================================================================
  // MySQL CONFIGURATION (Recommended for production)
  // ============================================================================
  console.log('🗄️  Using MySQL Database');
  
  try {
    const mysqlConfig = require('../../database/config');
    
    // Export MySQL functions
    db = {
      query: mysqlConfig.query,
      queryOne: mysqlConfig.queryOne,
      transaction: mysqlConfig.transaction,
      
      // Backward compatibility with SQLite callback style
      run: async (sql, params, callback) => {
        try {
          const result = await mysqlConfig.query(sql, Array.isArray(params) ? params : []);
          if (callback) callback(null, result);
          return result;
        } catch (error) {
          if (callback) callback(error);
          else throw error;
        }
      },
      
      get: async (sql, params, callback) => {
        try {
          const result = await mysqlConfig.queryOne(sql, Array.isArray(params) ? params : []);
          if (callback) callback(null, result);
          return result;
        } catch (error) {
          if (callback) callback(error);
          else throw error;
        }
      },
      
      all: async (sql, params, callback) => {
        try {
          const results = await mysqlConfig.query(sql, Array.isArray(params) ? params : []);
          if (callback) callback(null, results);
          return results;
        } catch (error) {
          if (callback) callback(error);
          else throw error;
        }
      }
    };
    
    dbPath = `${mysqlConfig.config.host}:${mysqlConfig.config.port}/${mysqlConfig.config.database}`;
    networkDataPath = mysqlConfig.networkDataPath;
    networkProjectsPath = mysqlConfig.networkProjectsPath;
    
    console.log(`📊 MySQL: ${mysqlConfig.config.database} @ ${mysqlConfig.config.host}:${mysqlConfig.config.port}`);
    
  } catch (error) {
    console.error('❌ Failed to load MySQL configuration:', error.message);
    console.error('💡 Falling back to SQLite...\n');
    // Fall back to SQLite
    setupSQLite();
  }
  
} else {
  // ============================================================================
  // SQLITE CONFIGURATION (Legacy/Development)
  // ============================================================================
  setupSQLite();
}

function setupSQLite() {
  console.log('🗄️  Using SQLite Database');
  
  const sqlite3 = require('sqlite3').verbose();
  
  // Check if we should use local storage (for testing/development)
  if (process.env.USE_LOCAL_STORAGE === 'true') {
    // Local Storage Configuration
    const projectRoot = path.join(__dirname, '..', '..');
    networkDataPath = path.join(projectRoot, 'uploads');
    networkProjectsPath = path.join(projectRoot, 'projects');
    dbPath = path.join(projectRoot, 'database.sqlite');
    
    // Create directories if they don't exist
    [networkDataPath, networkProjectsPath, path.join(networkDataPath, 'uploads')].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      }
    });
    
    console.log('🏠 Using LOCAL storage for uploads');
    console.log(`📁 Uploads directory: ${networkDataPath}`);
  }
  // Check if we're in local test mode
  else if (fs.existsSync(path.join(__dirname, '..', '..', 'local-test', 'data'))) {
    const localTestPath = path.join(__dirname, '..', '..', 'local-test', 'data');
    networkDataPath = localTestPath;
    networkProjectsPath = path.join(__dirname, '..', '..', 'local-test', 'PROJECTS');
    dbPath = path.join(networkDataPath, 'filemanagement.db');
    console.log('🏠 Using local test database');
  }
  // Default: Network Database Configuration
  else {
    networkDataPath = '\\\\KMTI-NAS\\Shared\\data';
    networkProjectsPath = '\\\\KMTI-NAS\\Shared\\Public\\PROJECTS';
    dbPath = path.join(networkDataPath, 'filemanagement.db');
  }
  
  // Database setup with WAL mode for better write performance
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ Error opening database:', err.message);
      console.error('💡 Path:', dbPath);
    } else {
      console.log('✅ Connected to SQLite database:', dbPath);
      
      // Enable WAL mode for better concurrency
      db.run('PRAGMA journal_mode = WAL;', (err) => {
        if (err) {
          console.error('❌ Error enabling WAL mode:', err);
        } else {
          console.log('✅ WAL mode enabled');
        }
      });
      
      // Set synchronous mode to NORMAL
      db.run('PRAGMA synchronous = NORMAL;', (err) => {
        if (err) {
          console.error('❌ Error setting synchronous mode:', err);
        } else {
          console.log('✅ Synchronous mode: NORMAL');
        }
      });
    }
  });
}

// Graceful shutdown function
function closeDatabase() {
  if (USE_MYSQL) {
    const mysqlConfig = require('../../database/config');
    return mysqlConfig.closePool();
  } else {
    return new Promise((resolve) => {
      if (db && db.close) {
        db.close((err) => {
          if (err) console.error('Error closing database:', err);
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = {
  db,
  dbPath,
  networkDataPath,
  networkProjectsPath,
  USE_MYSQL,
  closeDatabase
};
