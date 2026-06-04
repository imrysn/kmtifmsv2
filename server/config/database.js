// Database Configuration - MySQL Only
// All users must connect to the MySQL server on the NAS

// Load environment variables FIRST
const _fs0 = require('fs');
const _path0 = require('path');
const _envPaths = [
  _path0.join(__dirname, '../../.env'),
  _path0.join(__dirname, '../../../.env'),
  _path0.join(process.resourcesPath || '', '.env')
];
const _envFile = _envPaths.find(p => { try { return _fs0.existsSync(p); } catch(_){return false;} });
require('dotenv').config({ path: _envFile });

const path = require('path');

// Validate MySQL configuration
if (!process.env.DB_HOST || !process.env.DB_NAME) {
  console.error('❌ MySQL configuration is REQUIRED!');
  console.error('   Set DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD in .env');
  process.exit(1);
}

console.log('🗄️  Initializing MySQL Database Connection...');

// Resolve database/config.js
// NCC will bundle this correctly if it's a static require
const mysqlConfig = require('../../database/config.js');

// Export MySQL functions with backward compatibility for SQLite-style callbacks
const db = {
  query: mysqlConfig.query,
  queryOne: mysqlConfig.queryOne,
  transaction: mysqlConfig.transaction,

  run: async (sql, params, callback) => {
    try {
      const result = await mysqlConfig.query(sql, Array.isArray(params) ? params : []);
      if (callback) {
        const context = {};
        if (result && typeof result.insertId !== 'undefined') context.lastID = result.insertId;
        if (result && typeof result.affectedRows !== 'undefined') context.changes = result.affectedRows;
        callback.call(context, null, result);
      }
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

const dbPath = `${mysqlConfig.config.database} @ ${mysqlConfig.config.host}:${mysqlConfig.config.port}`;
const networkDataPath = mysqlConfig.networkDataPath;
const projectsDataPath = mysqlConfig.projectsDataPath;
const networkProjectsPath = mysqlConfig.networkProjectsPath;

console.log(`📊 MySQL: ${dbPath}`);
console.log(`📁 Network Data: ${networkDataPath}`);
console.log(`📁 Projects Data: ${projectsDataPath}`);
console.log(`📁 Network Projects: ${networkProjectsPath}`);

function closeDatabase() {
  return mysqlConfig.closePool();
}

module.exports = {
  db,
  query: mysqlConfig.query,
  queryOne: mysqlConfig.queryOne,
  queryBatch: mysqlConfig.queryBatch,
  queryOneBatch: mysqlConfig.queryOneBatch,
  transaction: mysqlConfig.transaction,
  dbPath,
  networkDataPath,
  projectsDataPath,
  networkProjectsPath,
  USE_MYSQL: true,
  closeDatabase
};
