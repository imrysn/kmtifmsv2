// MySQL Database Configuration for Server
// This is a bridge between the main database config and the server

const mysqlConfig = require('../../database/config');

// Re-export MySQL connection functions
const {
  getPool,
  query,
  queryOne,
  transaction,
  testConnection,
  closePool
} = mysqlConfig;

// Network paths (same as before)
const networkDataPath = mysqlConfig.networkDataPath;
const networkProjectsPath = mysqlConfig.networkProjectsPath;

// Database info for logging
const dbInfo = {
  type: 'MySQL',
  host: mysqlConfig.config.host,
  database: mysqlConfig.config.database,
  port: mysqlConfig.config.port
};

console.log('🗄️  Database Type: MySQL');
console.log(`📊 Database: ${dbInfo.database} @ ${dbInfo.host}:${dbInfo.port}`);

// Export for server use
module.exports = {
  // MySQL connection pool
  getPool,
  query,
  queryOne,
  transaction,
  testConnection,
  closePool,

  // Database info
  dbInfo,
  dbPath: `${dbInfo.host}:${dbInfo.port}/${dbInfo.database}`,

  // Network paths
  networkDataPath,
  networkProjectsPath,

  // Helper function for backward compatibility with SQLite code
  // Wraps callback-based code to use promises
  db: {
    run: async (sql, params, callback) => {
      try {
        const result = await query(sql, params || []);
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

    get: async (sql, params, callback) => {
      try {
        const result = await queryOne(sql, params || []);
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
        const results = await query(sql, params || []);
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
    },

    // Transaction support
    transaction
  }
};
