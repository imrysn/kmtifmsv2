const express = require('express');
const path = require('path');
const fs = require('fs');
const { db, dbPath, networkDataPath, USE_MYSQL, closeDatabase } = require('./config/database');
const { setupMiddleware } = require('./config/middleware');
const { initializeDatabase, verifyUploadsDirectory } = require('./db/initialize');
const runMigrations = require('./migrations/runMigrations');

// Import routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const teamsRoutes = require('./routes/teams');
const activityLogsRoutes = require('./routes/activityLogs');
const fileSystemRoutes = require('./routes/fileSystem');
const filesRoutes = require('./routes/files');
const dashboardRoutes = require('./routes/dashboard');
const settingsRoutes = require('./routes/settings');
const fileViewerRoutes = require('./routes/fileViewer');
const { router: notificationsRoutes } = require('./routes/notifications');
const assignmentsRoutes = require('./routes/assignments');

const app = express();
const PORT = process.env.SERVER_PORT || 3001;

// Setup middleware
setupMiddleware(app);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/team-members', usersRoutes); // Alias for team members endpoint
app.use('/api/teams', teamsRoutes);
app.use('/api/activity-logs', activityLogsRoutes);
app.use('/api/file-system', fileSystemRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/file-viewer', fileViewerRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/assignments', assignmentsRoutes);

// Serve static files from the React app build directory
// In bundled mode, client files are in client-dist, otherwise in ../client/dist
const clientBuildPath = path.join(__dirname, 'client-dist');
const fallbackClientPath = path.join(__dirname, '../client/dist');

// Check which path exists (bundled vs development)
const actualClientPath = fs.existsSync(clientBuildPath) ? clientBuildPath : fallbackClientPath;

if (fs.existsSync(actualClientPath)) {
  console.log(`📁 Serving frontend from: ${actualClientPath}`);
  app.use(express.static(actualClientPath));

  // Catch all handler: send back React's index.html file for client-side routing
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(actualClientPath, 'index.html'));
  });
} else {
  console.warn('⚠️  Frontend build not found. Server will only serve API endpoints.');
}

// Start server
async function startServer() {
  try {
    await verifyUploadsDirectory();
    await initializeDatabase();
    
    // Run database migrations
    await runMigrations();
    
    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(70));
      console.log(`🚀 Express server running on http://localhost:${PORT}`);
      console.log(`🗄️  Database Type: ${USE_MYSQL ? 'MySQL' : 'SQLite'}`);
      console.log(`📊 Database: ${dbPath}`);
      console.log(`🌐 Network Data Path: ${networkDataPath}`);
      console.log('='.repeat(70));
      console.log('\n✅ Notifications API routes registered');
      console.log('\n🔄 File Approval Workflow:');
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
