// MySQL Database Configuration
// This replaces the SQLite configuration to solve multi-user corruption issues

// Load environment variables from .env file
require('dotenv').config();

const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ============================================================================
// CONFIGURATION
// ============================================================================

// Check if MySQL should be used
const USE_MYSQL = process.env.USE_MYSQL === 'true' || process.env.DB_HOST;

// Environment-based configuration
const isProduction = process.env.NODE_ENV === 'production' || USE_MYSQL;
const isDevelopment = !isProduction;

// MySQL Connection Configuration
const MYSQL_CONFIG = {
  // Read from environment variables
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || (isProduction ? 'kmtifms' : 'kmtifms_dev'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// Current configuration
const currentConfig = MYSQL_CONFIG;

// ============================================================================
// CONNECTION POOL
// ============================================================================

let pool = null;

// Create connection pool
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

// Get connection pool
function getPool() {
  if (!pool) {
    return createPool();
  }
  return pool;
}

// Test database connection
async function testConnection() {
  try {
    const pool = getPool();
    const connection = await pool.getConnection();
    console.log('✅ MySQL connection successful');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MySQL connection failed:', error.message);
    console.error('💡 Please check:');
    console.error('   1. MySQL server is running');
    console.error('   2. Database credentials are correct in .env');
    console.error('   3. Network connectivity to database server');
    console.error('   4. Firewall allows MySQL port (3306)');
    console.error('\n🔍 Current configuration:');
    console.error(`   Host: ${currentConfig.host}`);
    console.error(`   Port: ${currentConfig.port}`);
    console.error(`   Database: ${currentConfig.database}`);
    console.error(`   User: ${currentConfig.user}`);
    return false;
  }
}

// Execute query with error handling
async function query(sql, params = []) {
  const pool = getPool();
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('❌ Query error:', error.message);
    console.error('SQL:', sql);
    throw error;
  }
}

// Execute query and return first result
async function queryOne(sql, params = []) {
  const results = await query(sql, params);
  return results[0] || null;
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

// Close all connections (for graceful shutdown)
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

// Network data path configuration
const networkDataPath = isProduction
  ? '\\\\KMTI-NAS\\Shared\\data'
  : path.join(__dirname, '..', 'local-test', 'data');

const networkProjectsPath = isProduction
  ? '\\\\KMTI-NAS\\Shared\\Public\\PROJECTS'
  : path.join(__dirname, '..', 'local-test', 'PROJECTS');

// Returns a sensible default path suitable for native file pickers.
// Prefer the networkProjectsPath when configured, otherwise fall back to user's Documents or home.
function getDefaultProjectPickerPath() {
  // Prefer the configured NETWORK PROJECTS path first (use the string even if it isn't accessible).
  if (networkProjectsPath) {
    return networkProjectsPath;
  }

  // Then fall back to Documents folder if available
  const home = os.homedir() || '';
  const documents = path.join(home, 'Documents');
  try {
    if (documents && fs.existsSync(documents)) {
      return documents;
    }
  } catch (e) {
    // ignore
  }

  // Final fallback to home or networkDataPath string
  return home || networkDataPath;
}

// Explicit getter for the network PROJECTS path (useful for preload/exposed APIs)
function getNetworkProjectsPath() {
  return networkProjectsPath;
}

// Helper to build options for native file pickers (e.g. Electron dialog.showOpenDialog)
// Pass extra options to merge with the defaults.
function defaultOpenDialogOptions(extra = {}) {
  return Object.assign({
    defaultPath: getDefaultProjectPickerPath()
  }, extra);
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Connection functions
  getPool,
  createPool,
  testConnection,
  closePool,
  
  // Query functions
  query,
  queryOne,
  transaction,
  
  // Configuration
  config: currentConfig,
  networkDataPath,
  networkProjectsPath,
  isProduction,
  isDevelopment,
  // Explicit network projects getter for preload/electron usage
  getNetworkProjectsPath,
  // Helpers for native file pickers
  getDefaultProjectPickerPath,
  defaultOpenDialogOptions,
  
  // Legacy compatibility (for gradual migration)
  // These provide a similar interface to the old SQLite db object
  db: {
    query,
    queryOne,
    transaction
  }
};
