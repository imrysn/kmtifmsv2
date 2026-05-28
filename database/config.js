// MySQL Database Configuration
// This replaces the SQLite configuration to solve multi-user corruption issues

// Load environment variables
require('dotenv').config();

const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ============================================================================
// CONFIGURATION
// ============================================================================

const USE_MYSQL = process.env.USE_MYSQL === 'true' || process.env.DB_HOST;
const isProduction = process.env.NODE_ENV === 'production' || USE_MYSQL;
const isDevelopment = !isProduction;

const MYSQL_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || (isProduction ? 'kmtifms' : 'kmtifms_dev'),
  waitForConnections: true,
  connectionLimit: 100,           // Use HEAD: NAS needs more headroom
  queueLimit: 100,              // Use HEAD: More requests can wait
  acquireTimeout: 10000,        // Use Incoming: Max time to get a conn from pool
  connectTimeout: 15000,        // Use HEAD: NAS can be slow to establish handshake
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // Use HEAD: Keep the NAS awake
  charset: 'utf8mb4',           // Use Incoming: Critical for Japanese characters
  maxIdle: 10,                  // Use Incoming: Better resource cleanup
  idleTimeout: 60000            // Use Incoming: Close stale connections after 1m
};

const currentConfig = MYSQL_CONFIG;

// ============================================================================
// CONNECTION POOL
// ============================================================================

let pool = null;

function createPool() {
  if (!pool) {
    try {
      pool = mysql.createPool(currentConfig);
      console.log(`✅ MySQL pool created`);
      console.log(`📊 Database: ${currentConfig.database} @ ${currentConfig.host}:${currentConfig.port}`);
    } catch (error) {
      console.error('❌ Failed to create MySQL pool:', error.message);
      throw error;
    }
  }
  return pool;
}

function getPool() {
  if (!pool) {
    return createPool();
  }
  return pool;
}

async function testConnection() {
  try {
    const pool = getPool();
    const connection = await pool.getConnection();
    console.log('✅ MySQL connection successful');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MySQL connection failed:', error.message);
    console.error(`   Host: ${currentConfig.host}:${currentConfig.port}`);
    console.error(`   Database: ${currentConfig.database}`);
    return false;
  }
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

// Execute a single query using a pooled connection
async function query(sql, params = []) {
  const pool = getPool();
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('❌ Query error:', error.message);
    console.error('❌ Error code:', error.code || 'N/A');
    console.error('❌ SQL state:', error.sqlState || 'N/A');
    console.error('SQL:', sql);
    throw error;
  }
}

// Execute a single query and return the first row
async function queryOne(sql, params = []) {
  const results = await query(sql, params);
  return results[0] || null;
}

/**
 * Run multiple queries on a SINGLE dedicated connection.
 * Use this for dashboard/summary-style handlers that fire many queries at once.
 * Prevents pool exhaustion on slow NAS connections by not competing for slots.
 *
 * Usage:
 *   const [r1, r2, r3] = await queryBatch([
 *     ['SELECT COUNT(*) as total FROM files', []],
 *     ['SELECT COUNT(*) as approved FROM files WHERE status = ?', ['final_approved']],
 *   ]);
 */
async function queryBatch(queries) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const results = [];
    for (const [sql, params = []] of queries) {
      const [rows] = await connection.execute(sql, params);
      results.push(rows);
    }
    return results;
  } finally {
    connection.release();
  }
}

// Same as queryBatch but returns first row of each result
async function queryOneBatch(queries) {
  const rows = await queryBatch(queries);
  return rows.map(r => (Array.isArray(r) ? r[0] || null : r));
}

// Execute transaction
async function transaction(callback) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    console.error('❌ Transaction failed:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

// Close all connections (graceful shutdown)
async function closePool() {
  if (pool) {
    try {
      await pool.end();
      console.log('✅ MySQL pool closed');
      pool = null;
    } catch (error) {
      console.error('❌ Error closing MySQL pool:', error.message);
    }
  }
}

// ============================================================================
// NETWORK PATHS
// ============================================================================

const networkDataPath = isProduction
  ? '\\\\KMTI-NAS\\Shared\\data'
  : path.join(__dirname, '..', 'local-test', 'data');

const projectsDataPath = isProduction
  ? '\\\\KMTI-NAS\\Shared\\data\\projects'
  : path.join(__dirname, '..', 'local-test', 'projects');

const networkProjectsPath = isProduction
  ? '\\\\KMTI-NAS\\Shared\\Public\\PROJECTS'
  : path.join(__dirname, '..', 'local-test', 'PROJECTS');

function getDefaultProjectPickerPath() {
  if (networkProjectsPath) return networkProjectsPath;
  const home = os.homedir() || '';
  const documents = path.join(home, 'Documents');
  try {
    if (documents && fs.existsSync(documents)) return documents;
  } catch (e) { }
  return home || networkDataPath;
}

function getNetworkProjectsPath() {
  return networkProjectsPath;
}

function defaultOpenDialogOptions(extra = {}) {
  return Object.assign({ defaultPath: getDefaultProjectPickerPath() }, extra);
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  getPool,
  createPool,
  testConnection,
  closePool,
  query,
  queryOne,
  queryBatch,
  queryOneBatch,
  transaction,
  config: currentConfig,
  networkDataPath,
  projectsDataPath,
  networkProjectsPath,
  isProduction,
  isDevelopment,
  getNetworkProjectsPath,
  getDefaultProjectPickerPath,
  defaultOpenDialogOptions,
  db: { query, queryOne, transaction }
};
