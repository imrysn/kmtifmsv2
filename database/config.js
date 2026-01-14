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
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Connection timeout settings
  connectTimeout: 10000
};

// Current configuration
const currentConfig = MYSQL_CONFIG;

// ============================================================================
// CONNECTION POOL
// ============================================================================

let pool = null;
let healthCheckInterval = null;

// Periodic health check to keep connections alive
function startHealthCheck() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  
  // Check connection health every 5 minutes
  healthCheckInterval = setInterval(async () => {
    try {
      const currentPool = getPool();
      const connection = await currentPool.getConnection();
      await connection.query('SELECT 1');
      connection.release();
      // console.log('💚 Health check passed');
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      console.log('🔄 Attempting to recreate connection pool...');
      // Try to recreate the pool
      if (pool) {
        try {
          await pool.end();
        } catch (e) {
          // Ignore
        }
      }
      pool = null;
      try {
        createPool();
        console.log('✅ Connection pool recreated successfully');
      } catch (recreateError) {
        console.error('❌ Failed to recreate pool:', recreateError.message);
      }
    }
  }, 5 * 60 * 1000); // 5 minutes
}

// Create connection pool
function createPool() {
  if (!pool) {
    try {
      pool = mysql.createPool(currentConfig);
      console.log(`✅ MySQL pool created`);
      console.log(`📊 Database: ${currentConfig.database} @ ${currentConfig.host}:${currentConfig.port}`);
      
      // Add error handler to pool
      pool.on('error', (err) => {
        console.error('❌ MySQL pool error:', err.message);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
          console.log('🔄 Connection lost, pool will handle reconnection...');
        }
      });
      
      // Start health check
      startHealthCheck();
      
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
async function testConnection(retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const pool = getPool();
      const connection = await pool.getConnection();
      
      // Test a simple query
      await connection.query('SELECT 1 as test');
      
      console.log('✅ MySQL connection successful');
      connection.release();
      return true;
    } catch (error) {
      console.error(`❌ MySQL connection failed (Attempt ${attempt + 1}/${retries}):`, error.message);
      
      if (attempt < retries - 1) {
        console.log(`🔄 Retrying connection in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Try recreating the pool
        if (pool) {
          try {
            await pool.end();
          } catch (e) {
            // Ignore
          }
        }
        pool = null;
        createPool();
      } else {
        console.error('\n💡 Please check:');
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
  }
  return false;
}

// Execute query with error handling and retry logic
async function query(sql, params = [], retries = 3) {
  let lastError;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const pool = getPool();
      const [results] = await pool.execute(sql, params);
      return results;
    } catch (error) {
      lastError = error;
      
      // Check if it's a pool error
      if (error.message && error.message.includes('Pool is closed')) {
        console.log(`🔄 Pool was closed, recreating... (Attempt ${attempt + 1}/${retries})`);
        if (pool) {
          try {
            await pool.end();
          } catch (e) {
            // Ignore errors when closing already-closed pool
          }
        }
        pool = null; // Reset pool
        createPool(); // Recreate pool
        
        if (attempt < retries - 1) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      }
      
      console.error('❌ Query error:', error.message);
      console.error('SQL:', sql);
      
      if (attempt < retries - 1) {
        console.log(`🔄 Retrying query... (Attempt ${attempt + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        throw error;
      }
    }
  }
  
  throw lastError;
}

// Execute query and return first result
async function queryOne(sql, params = []) {
  try {
    const results = await query(sql, params);
    return results[0] || null;
  } catch (error) {
    console.error('❌ QueryOne error:', error.message);
    throw error;
  }
}

// Execute transaction with retry logic
async function transaction(callback, retries = 3) {
  let lastError;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    let connection;
    try {
      const pool = getPool();
      connection = await pool.getConnection();
      
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      lastError = error;
      
      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          console.error('❌ Rollback error:', rollbackError.message);
        }
      }
      
      // Check if it's a pool error
      if (error.message && error.message.includes('Pool is closed')) {
        console.log(`🔄 Pool was closed during transaction, recreating... (Attempt ${attempt + 1}/${retries})`);
        if (pool) {
          try {
            await pool.end();
          } catch (e) {
            // Ignore errors when closing already-closed pool
          }
        }
        pool = null;
        createPool();
        
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      }
      
      console.error('❌ Transaction failed:', error.message);
      
      if (attempt < retries - 1) {
        console.log(`🔄 Retrying transaction... (Attempt ${attempt + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        throw error;
      }
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
  
  throw lastError;
}

// Close all connections (for graceful shutdown)
async function closePool() {
  // Stop health check
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
  
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
