
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

console.log('🔍 KMTIFMSV2 Network Connection Verification\n');

// Network configuration
const networkDataPath = '\\\\KMTI-NAS\\Shared\\data';
const dbPath = path.join(networkDataPath, 'database.sqlite');
const uploadsDir = path.join(networkDataPath, 'uploads');

console.log('📋 Network Configuration:');
console.log(`   Data Path: ${networkDataPath}`);
console.log(`   Database:  ${dbPath}`);
console.log(`   Uploads:   ${uploadsDir}\n`);

// Test 1: Check network path accessibility
console.log('🔄 Test 1: Network Path Accessibility');
try {
  if (fs.existsSync(networkDataPath)) {
    console.log('✅ Network data path is accessible');
    
    // List contents
    const contents = fs.readdirSync(networkDataPath);
    console.log(`📁 Directory contents (${contents.length} items):`);
    contents.forEach(item => {
      const itemPath = path.join(networkDataPath, item);
      const stats = fs.statSync(itemPath);
      const type = stats.isDirectory() ? '[DIR]' : '[FILE]';
      const size = stats.isFile() ? ` (${(stats.size / 1024).toFixed(1)} KB)` : '';
      console.log(`   ${type} ${item}${size}`);
    });
  } else {
    console.log('❌ Network data path is NOT accessible');
    console.log('💡 Please check:');
    console.log('   - Network connection to KMTI-NAS');
    console.log('   - Permissions to access \\\\KMTI-NAS\\Shared\\data');
    console.log('   - VPN connection if required');
  }
} catch (error) {
  console.error('❌ Error accessing network path:', error.message);
}

console.log('\n🔄 Test 2: Database File Check');
try {
  if (fs.existsSync(dbPath)) {
    const dbStats = fs.statSync(dbPath);
    console.log('✅ Database file found');
    console.log(`   Size: ${(dbStats.size / 1024).toFixed(1)} KB`);
    console.log(`   Modified: ${dbStats.mtime.toLocaleString()}`);
    
    // Test database connection
    console.log('\n🔄 Test 3: Database Connection');
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.error('❌ Cannot connect to database:', err.message);
      } else {
        console.log('✅ Database connection successful');
        
        // Check tables
        db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
          if (err) {
            console.error('❌ Error reading tables:', err);
          } else {
            console.log(`📋 Database tables found (${tables.length}):`);
            tables.forEach(table => {
              console.log(`   - ${table.name}`);
            });
            
            // Check user count
            db.get('SELECT COUNT(*) as count FROM users', [], (err, result) => {
              if (err) {
                console.error('❌ Error counting users:', err);
              } else {
                console.log(`👥 Users in database: ${result.count}`);
              }
              
              // Check activity logs count
              db.get('SELECT COUNT(*) as count FROM activity_logs', [], (err, result) => {
                if (err) {
                  console.error('❌ Error counting activity logs:', err);
                } else {
                  console.log(`📋 Activity logs: ${result.count}`);
                }
                
                // Check files count
                db.get('SELECT COUNT(*) as count FROM files', [], (err, result) => {
                  if (err) {
                    console.error('❌ Error counting files:', err);
                  } else {
                    console.log(`📁 Files in database: ${result.count}`);
                  }
                  
                  db.close(() => {
                    console.log('\n🔄 Test 4: Uploads Directory Check');
                    checkUploadsDirectory();
                  });
                });
              });
            });
          }
        });
      }
    });
  } else {
    console.log('❌ Database file NOT found at network location');
    console.log('💡 Make sure database.sqlite was moved to:', dbPath);
  }
} catch (error) {
  console.error('❌ Error checking database file:', error.message);
}

function checkUploadsDirectory() {
  try {
    if (fs.existsSync(uploadsDir)) {
      console.log('✅ Uploads directory found');
      
      const uploadContents = fs.readdirSync(uploadsDir);
      console.log(`📂 Upload files (${uploadContents.length}):`);
      
      if (uploadContents.length > 0) {
        uploadContents.slice(0, 10).forEach(file => {  // Show first 10 files
          const filePath = path.join(uploadsDir, file);
          const stats = fs.statSync(filePath);
          console.log(`   📄 ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
        });
        
        if (uploadContents.length > 10) {
          console.log(`   ... and ${uploadContents.length - 10} more files`);
        }
      } else {
        console.log('   📂 Directory is empty');
      }
    } else {
      console.log('❌ Uploads directory NOT found');
      console.log('💡 Will be created when first file is uploaded');
    }
    
    console.log('\n✅ Network verification complete!');
    console.log('\n🚀 Ready to start server with network configuration');                                                                                                                                                                                                                                                                                                                                                        
    console.log('💡 Run: npm run dev');
    
  } catch (error) {
    console.error('❌ Error checking uploads directory:', error.message);
  }
}
