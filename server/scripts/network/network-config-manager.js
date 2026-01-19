const fs = require('fs');
const path = require('path');

console.log('🔧 KMTIFMSV2 Network Configuration Manager\n');

const args = process.argv.slice(2);
const action = args[0];

if (!action || !['status', 'test', 'backup-local'].includes(action)) {
  console.log('Usage: node network-config-manager.js <action>');
  console.log('\nActions:');
  console.log('  status      - Show current network configuration status');
  console.log('  test        - Test network connectivity and permissions');
  console.log('  backup-local - Create local backup of network database');
  console.log('\nExamples:');
  console.log('  node network-config-manager.js status');
  console.log('  node network-config-manager.js test');
  console.log('  node network-config-manager.js backup-local');
  process.exit(1);
}

// Configuration
const networkDataPath = '\\\\KMTI-NAS\\Shared\\data';
const networkDbPath = path.join(networkDataPath, 'database.sqlite');
const networkUploadsDir = path.join(networkDataPath, 'uploads');
const localDbPath = path.join(__dirname, 'database.sqlite');
const localUploadsDir = path.join(__dirname, 'uploads');

switch (action) {
  case 'status':
    showStatus();
    break;
  case 'test':
    runConnectivityTest();
    break;
  case 'backup-local':
    createLocalBackup();
    break;
}

function showStatus() {
  console.log('📊 Current Configuration Status\n');

  console.log('🌐 Network Configuration:');
  console.log(`   Path: ${networkDataPath}`);
  console.log(`   Database: ${networkDbPath}`);
  console.log(`   Uploads: ${networkUploadsDir}\n`);

  // Check network accessibility
  console.log('🔍 Network Access Check:');
  try {
    if (fs.existsSync(networkDataPath)) {
      console.log('   ✅ Network path accessible');

      if (fs.existsSync(networkDbPath)) {
        const dbStats = fs.statSync(networkDbPath);
        console.log(`   ✅ Database found (${(dbStats.size / 1024).toFixed(1)} KB)`);
      } else {
        console.log('   ❌ Database not found');
      }

      if (fs.existsSync(networkUploadsDir)) {
        const uploadFiles = fs.readdirSync(networkUploadsDir);
        console.log(`   ✅ Uploads directory found (${uploadFiles.length} files)`);
      } else {
        console.log('   ⚠️ Uploads directory not found (will be created)');
      }
    } else {
      console.log('   ❌ Network path not accessible');
    }
  } catch (error) {
    console.log('   ❌ Error checking network:', error.message);
  }

  console.log('\n💻 Local Status:');
  console.log(`   Local Database: ${fs.existsSync(localDbPath) ? '✅ Exists' : '❌ Not found'}`);
  console.log(`   Local Uploads: ${fs.existsSync(localUploadsDir) ? '✅ Exists' : '❌ Not found'}`);

  console.log('\n🔧 Server Configuration:');
  console.log('   Mode: Network Database (KMTI-NAS)');
  console.log('   All operations use network storage');
}

function runConnectivityTest() {
  console.log('🧪 Running Network Connectivity Tests\n');

  let testsPassed = 0;
  let totalTests = 0;

  // Test 1: Network path access
  totalTests++;
  console.log('Test 1: Network Path Access');
  try {
    if (fs.existsSync(networkDataPath)) {
      console.log('   ✅ PASS - Network path accessible');
      testsPassed++;
    } else {
      console.log('   ❌ FAIL - Network path not accessible');
    }
  } catch (error) {
    console.log('   ❌ FAIL - Error:', error.message);
  }

  // Test 2: Database file access
  totalTests++;
  console.log('\\nTest 2: Database File Access');
  try {
    if (fs.existsSync(networkDbPath)) {
      // Test read access
      const stats = fs.statSync(networkDbPath);
      console.log('   ✅ PASS - Database file readable');

      // Test write access by checking directory permissions
      try {
        fs.accessSync(networkDataPath, fs.constants.W_OK);
        console.log('   ✅ PASS - Directory has write permissions');
        testsPassed++;
      } catch (err) {
        console.log('   ❌ FAIL - No write permissions');
      }
    } else {
      console.log('   ❌ FAIL - Database file not found');
    }
  } catch (error) {
    console.log('   ❌ FAIL - Error:', error.message);
  }

  // Test 3: Uploads directory access
  totalTests++;
  console.log('\\nTest 3: Uploads Directory Access');
  try {
    if (!fs.existsSync(networkUploadsDir)) {
      // Try to create it
      fs.mkdirSync(networkUploadsDir, { recursive: true });
      console.log('   ✅ PASS - Created uploads directory');
    }

    if (fs.existsSync(networkUploadsDir)) {
      // Test write by creating a temporary file
      const testFile = path.join(networkUploadsDir, 'test-write-permission.tmp');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      console.log('   ✅ PASS - Uploads directory writable');
      testsPassed++;
    }
  } catch (error) {
    console.log('   ❌ FAIL - Cannot write to uploads directory:', error.message);
  }

  // Test 4: Database connectivity
  totalTests++;
  console.log('\\nTest 4: Database Connection');
  try {
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(networkDbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        console.log('   ❌ FAIL - Cannot connect:', err.message);
      } else {
        console.log('   ✅ PASS - Database connection successful');
        testsPassed++;

        // Quick table check
        db.get("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'", [], (err, result) => {
          if (err) {
            console.log('   ⚠️ Warning - Could not read tables');
          } else {
            console.log(`   ℹ️ Found ${result.count} tables in database`);
          }
          db.close();

          // Show results
          console.log(`\\n📊 Test Results: ${testsPassed}/${totalTests} tests passed`);
          if (testsPassed === totalTests) {
            console.log('✅ All tests passed! Network configuration is working correctly.');
          } else {
            console.log('❌ Some tests failed. Check network access and permissions.');
          }
        });
      }
    });
  } catch (error) {
    console.log('   ❌ FAIL - Error loading database module:', error.message);
    console.log(`\\n📊 Test Results: ${testsPassed}/${totalTests} tests passed`);
  }
}

function createLocalBackup() {
  console.log('💾 Creating Local Backup of Network Database\\n');

  try {
    if (!fs.existsSync(networkDbPath)) {
      console.log('❌ Network database not found. Cannot create backup.');
      return;
    }

    // Create backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupDbPath = path.join(__dirname, `database-backup-${timestamp}.sqlite`);

    // Copy database file
    console.log('🔄 Copying database file...');
    fs.copyFileSync(networkDbPath, backupDbPath);
    console.log(`✅ Database backup created: ${backupDbPath}`);

    // Copy uploads folder if it exists
    if (fs.existsSync(networkUploadsDir)) {
      const backupUploadsDir = path.join(__dirname, `uploads-backup-${timestamp}`);
      console.log('🔄 Copying uploads directory...');

      fs.mkdirSync(backupUploadsDir, { recursive: true });
      const uploadFiles = fs.readdirSync(networkUploadsDir);

      uploadFiles.forEach(file => {
        const srcPath = path.join(networkUploadsDir, file);
        const destPath = path.join(backupUploadsDir, file);
        if (fs.statSync(srcPath).isFile()) {
          fs.copyFileSync(srcPath, destPath);
        }
      });

      console.log(`✅ Uploads backup created: ${backupUploadsDir} (${uploadFiles.length} files)`);
    } else {
      console.log('⚠️ No uploads directory found to backup');
    }

    // Show backup info
    const backupStats = fs.statSync(backupDbPath);
    console.log('\\n📊 Backup Summary:');
    console.log(`   Database Size: ${(backupStats.size / 1024).toFixed(1)} KB`);
    console.log(`   Created: ${backupStats.ctime.toLocaleString()}`);
    console.log('\\n💡 To use this backup:');
    console.log('   1. Stop the server');
    console.log('   2. Copy backup files to desired location');
    console.log('   3. Update server configuration if needed');
    console.log('   4. Restart the server');

  } catch (error) {
    console.error('❌ Error creating backup:', error.message);
  }
}
