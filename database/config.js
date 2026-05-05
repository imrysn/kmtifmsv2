// MySQL Database Configuration
// This replaces the SQLite configuration to solve multi-user corruption issues

// ── PACKAGED MODE: inject app-server/node_modules into require search path ──
const _resolveFrom = (() => {
  const _p = require('path');
  const _fs = require('fs');
  const candidates = [
    _p.join(__dirname, '../app-server/node_modules'),
    _p.join(__dirname, '../node_modules'),
    _p.join(__dirname, 'node_modules'),
  ];
  return function(mod) {
    for (const c of candidates) {
      try {
        const full = _p.join(c, mod);
        if (_fs.existsSync(full)) return full;
        return require.resolve(mod, { paths: [c] });
      } catch(_) {}
    }
    return mod;
  };
})();

// Load environment variables
const _fs0 = require('fs');
const _path0 = require('path');
const _envPaths = [
  _path0.join(__dirname, '../.env'),
  _path0.join(__dirname, '../../.env'),
  _path0.join(process.resourcesPath || '', '.env')
];
const _envFile = _envPaths.find(p => { try { return _fs0.existsSync(p); } catch(_){return false;} });
try {
  const _dotenvPaths = [
    _path0.join(__dirname, '../app-server/node_modules/dotenv'),
    _path0.join(__dirname, '../node_modules/dotenv'),
    _path0.join(__dirname, 'node_modules/dotenv'),
    'dotenv'
  ];
  let _dotenv = null;
  for (const _dp of _dotenvPaths) {
    try { _dotenv = require(_dp); break; } catch(_) {}
  }
  if (_dotenv && _envFile) {
    _dotenv.config({ path: _envFile });
  }
} catch (_e) {}

const mysql = require(_resolveFrom('mysql2/promise'));
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
  connectionLimit: 30,         // Increased: NAS needs more headroom for parallel queries
  queueLimit: 100,             // Increased: more requests can wait rather than fail
  connectTimeout: 15000,       // Increased: NAS can be slow to accept connections
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  maxIdle: 10,
  idleTimeout: 60000
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

const networkProjectsPath = isProduction
  ? '\\\\KMTI-NAS\\Shared\\Public\\PROJECTS'
  : path.join(__dirname, '..', 'local-test', 'PROJECTS');

function getDefaultProjectPickerPath() {
  if (networkProjectsPath) return networkProjectsPath;
  const home = os.homedir() || '';
  const documents = path.join(home, 'Documents');
  try {
    if (documents && fs.existsSync(documents)) return documents;
  } catch (e) {}
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
  networkProjectsPath,
  isProduction,
  isDevelopment,
  getNetworkProjectsPath,
  getDefaultProjectPickerPath,
  defaultOpenDialogOptions,
  db: { query, queryOne, transaction }
};
