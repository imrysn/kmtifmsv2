const express = require('express');
const { db, dbPath, networkDataPath, USE_MYSQL, closeDatabase } = require('./config/database');
const { setupMiddleware } = require('./config/middleware');
const { initializeDatabase, verifyUploadsDirectory } = require('./db/initialize');

// Import routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const teamsRoutes = require('./routes/teams');
const activityLogsRoutes = require('./routes/activityLogs');
const fileSystemRoutes = require('./routes/fileSystem');
const filesRoutes = require('./routes/files');

const app = express();
const PORT = process.env.SERVER_PORT || 3001;

// Setup middleware
setupMiddleware(app);

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/activity-logs', activityLogsRoutes);
app.use('/api/file-system', fileSystemRoutes);
app.use('/api/files', filesRoutes);

// Start server
async function startServer() {
  try {
    await verifyUploadsDirectory();
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(70));
      console.log(`🚀 Express server running on http://localhost:${PORT}`);
      console.log(`🗄️  Database Type: ${USE_MYSQL ? 'MySQL' : 'SQLite'}`);
      console.log(`📊 Database: ${dbPath}`);
      console.log(`🌐 Network Data Path: ${networkDataPath}`);
      console.log('='.repeat(70));
      console.log(`
🔄 File Approval Workflow:`);
      console.log(`   1. User uploads file → Pending Team Leader Review`);
      console.log(`   2. Team Leader approves → Pending Admin Review`);
      console.log(`   3. Admin approves → Published to Public Network`);
      console.log(`   ❌ Any stage can reject → Back to User with comments`);
      console.log('='.repeat(70));
      
      if (USE_MYSQL) {
        console.log('\n✨ MySQL Benefits:');
        console.log('   • Supports multiple concurrent users');
        console.log('   • No database corruption over network');
        console.log('   • Better performance and reliability');
        console.log('   • ACID compliant transactions\n');
      } else {
        console.log('\n⚠️  Running with SQLite:');
        console.log('   • Limited to 1-2 concurrent users');
        console.log('   • Risk of corruption over network');
        console.log('   • Recommended: Switch to MySQL for production');
        console.log('   • To enable MySQL: Set USE_MYSQL=true or configure DB_HOST\n');
      }
    });
  } catch (error) {
    console.error('\n❌ Failed to start server:', error.message);
    console.error('Stack trace:', error.stack);
    
    if (USE_MYSQL) {
      console.error('\n💡 MySQL Troubleshooting:');
      console.error('   1. Ensure MySQL server is running');
      console.error('   2. Check credentials in database/config.js');
      console.error('   3. Verify database exists: npm run db:init');
      console.error('   4. Test connection: npm run db:test');
    }
    
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
async function shutdown(signal) {
  console.log(`\n⏹️  Received ${signal}, shutting down gracefully...`);
  
  try {
    // Close database connection
    await closeDatabase();
    console.log('✅ Database connection closed');
    
    // Exit successfully
    console.log('👋 Server stopped\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle various shutdown signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown('UNHANDLED_REJECTION');
});

module.exports = app;
