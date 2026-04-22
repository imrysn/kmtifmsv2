// Database Configuration - MySQL Only
// All users must connect to the MySQL server on the NAS

// Load environment variables FIRST
// In packaged Electron app, .env is in resources/ (two levels up from app-server/config/)
// In dev, .env is at the project root (two levels up from server/config/)
const _fs0 = require('fs');
const _path0 = require('path');
const _envPaths = [
  _path0.join(__dirname, '../../.env'),          // dev: project root
  _path0.join(__dirname, '../../../.env'),        // packaged: resources/
  _path0.join(process.resourcesPath || '', '.env') // packaged: explicit resourcesPath
];
const _envFile = _envPaths.find(p => { try { return _fs0.existsSync(p); } catch(_){return false;} });
require('dotenv').config({ path: _envFile });

const path = require('path');

// Validate MySQL configuration
if (!process.env.DB_HOST || !process.env.DB_NAME) {
  console.error('❌ MySQL configuration is REQUIRED!');
  console.error('💡 Please configure the following environment variables:');
  console.error('   - DB_HOST (MySQL server hostname/IP)');
  console.error('   - DB_PORT (MySQL server port, default: 3306)');
  console.error('   - DB_NAME (Database name)');
  console.error('   - DB_USER (Database user)');
  console.error('   - DB_PASSWORD (Database password)');
  console.error('\\n   Example:');
  console.error('   DB_HOST=KMTI-NAS');
  console.error('   DB_PORT=3306');
  console.error('   DB_NAME=kmtifms');
  console.error('   DB_USER=kmtifms_user');
  console.error('   DB_PASSWORD=your-password\\n');
  process.exit(1);
}

console.log('🗄️  Initializing MySQL Database Connection...');

// Load MySQL configuration.
// In the packaged Electron app, database/ is copied inside app-server/ (one level up).
// In development, database/ lives at the project root (two levels up from server/config/).
const _packagedDbConfig = require('path').join(__dirname, '../database/config.js');
const _devDbConfig = require('path').join(__dirname, '../../database/config.js');
const _dbConfigPath = require('fs').existsSync(_packagedDbConfig) ? _packagedDbConfig : _devDbConfig;
const mysqlConfig = require(_dbConfigPath);

// Export MySQL functions with backward compatibility for SQLite-style callbacks
const db = {
  query: mysqlConfig.query,
  queryOne: mysqlConfig.queryOne,
  transaction: mysqlConfig.transaction,

  // Backward compatibility with SQLite callback style
  run: async (sql, params, callback) => {
    try {
      const result = await mysqlConfig.query(sql, Array.isArray(params) ? params : []);
      if (callback) {
        // Call callback with this context having lastID for INSERT operations
        const context = {};
        if (result && typeof result.insertId !== 'undefined') {
          context.lastID = result.insertId;
        }
        if (result && typeof result.affectedRows !== 'undefined') {
          context.changes = result.affectedRows;
        }
        callback.call(context, null, result);
      }
      return result;
    } catch (error) {
      if (callback) {
        callback(error);
      } else {
        throw error;
      }
    }
  },

  get: async (sql, params, callback) => {
    try {
      const result = await mysqlConfig.queryOne(sql, Array.isArray(params) ? params : []);
      if (callback) {
        callback(null, result);
      }
      return result;
    } catch (error) {
      if (callback) {
        callback(error);
      } else {
        throw error;
      }
    }
  },

  all: async (sql, params, callback) => {
    try {
      const results = await mysqlConfig.query(sql, Array.isArray(params) ? params : []);
      if (callback) {
        callback(null, results);
      }
      return results;
    } catch (error) {
      if (callback) {
        callback(error);
      } else {
        throw error;
      }
    }
  }
};

// Database path string for logging
const dbPath = `${mysqlConfig.config.database} @ ${mysqlConfig.config.host}:${mysqlConfig.config.port}`;

// Network paths from MySQL config
const networkDataPath = mysqlConfig.networkDataPath;
const networkProjectsPath = mysqlConfig.networkProjectsPath;

console.log(`📊 MySQL: ${dbPath}`);
console.log(`📁 Network Data: ${networkDataPath}`);
console.log(`📁 Network Projects: ${networkProjectsPath}`);

// Graceful shutdown function
function closeDatabase() {
  return mysqlConfig.closePool();
}

module.exports = {
  db,
  dbPath,
  networkDataPath,
  networkProjectsPath,
  USE_MYSQL: true, // Always true now - kept for backward compatibility
  closeDatabase
};
