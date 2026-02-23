const fs = require('fs').promises;
const { db } = require('../config/database');
const { uploadsDir } = require('../config/middleware');
const fileIndexer = require('../services/fileIndexer');

// Async function to verify network uploads directory access
async function verifyUploadsDirectory() {
  try {
    await fs.access(uploadsDir);
    console.log('✅ Network uploads directory found:', uploadsDir);
  } catch (err) {
    console.log('⚠️  Network uploads directory not found, attempting to create:', uploadsDir);
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      console.log('✅ Created network uploads directory:', uploadsDir);
    } catch (mkdirErr) {
      console.error('❌ Failed to create network uploads directory:', mkdirErr.message);
      console.error('💡 Please ensure network path is accessible and has write permissions');
    }
  }
}

// Initialize database with async operations (MySQL only)
async function initializeDatabase() {
  console.log('🔧 Initializing MySQL database...');

  try {
    const mysqlConfig = require('../../database/config');

    // Test connection
    const connected = await mysqlConfig.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to MySQL database');
    }

    // Check if tables exist
    const tables = await mysqlConfig.query('SHOW TABLES');

    if (tables.length === 0) {
      console.log('⚠️  No tables found. Please run: npm run db:init');
      console.log('   This will create all required tables and initial data.');
    } else {
      console.log(`✅ Found ${tables.length} tables in database`);

      // Verify required tables exist
      const tableNames = tables.map(t => Object.values(t)[0]);
      const requiredTables = ['users', 'teams', 'files', 'file_comments',
        'file_status_history', 'activity_logs'];
      const missingTables = requiredTables.filter(t => !tableNames.includes(t));

      if (missingTables.length > 0) {
        console.log('⚠️  Missing tables:', missingTables.join(', '));
        console.log('   Run: npm run db:init');
      } else {
        console.log('✅ All required tables present');
      }
    }

    console.log('📁 File approval system ready (MySQL)');
    console.log('✅ Database initialized successfully');

    // Initialize file index table
    await fileIndexer.initializeIndexTable();

  } catch (error) {
    console.error('❌ MySQL initialization error:', error.message);
    console.error('💡 Please ensure:');
    console.error('   1. MySQL server is running');
    console.error('   2. Database credentials are correct in database/config.js');
    console.error('   3. Database has been initialized: npm run db:init');
    throw error;
  }
}

module.exports = {
  initializeDatabase,
  verifyUploadsDirectory
};
