// Diagnostic script to check upload configuration and network access
const fs = require('fs');
const path = require('path');

console.log('\n🔍 KMTIFMS Upload Diagnostics\n');
console.log('='.repeat(60));

// Check environment configuration
require('dotenv').config();
const USE_MYSQL = process.env.USE_MYSQL === 'true';
const USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE === 'true';

console.log('\n📋 Environment Configuration:');
console.log('  USE_MYSQL:', USE_MYSQL);
console.log('  USE_LOCAL_STORAGE:', USE_LOCAL_STORAGE);
console.log('  NODE_ENV:', process.env.NODE_ENV || 'development');

// Determine upload path based on configuration
let uploadPath;
let networkDataPath;

if (USE_LOCAL_STORAGE) {
  const projectRoot = path.join(__dirname);
  networkDataPath = path.join(projectRoot, 'uploads');
  uploadPath = networkDataPath;
  console.log('\n📂 Using LOCAL storage');
} else {
  networkDataPath = '\\\\KMTI-NAS\\Shared\\data';
  uploadPath = path.join(networkDataPath, 'uploads');
  console.log('\n📂 Using NETWORK storage');
}

console.log('  Network Data Path:', networkDataPath);
console.log('  Upload Path:', uploadPath);

// Test network path access
console.log('\n🔗 Testing Network Access:');
console.log('  Network path:', networkDataPath);

try {
  const exists = fs.existsSync(networkDataPath);
  if (exists) {
    console.log('  ✅ Network path accessible');
    
    // Check if we can read
    try {
      fs.readdirSync(networkDataPath);
      console.log('  ✅ Can read directory');
    } catch (readError) {
      console.log('  ❌ Cannot read directory:', readError.message);
    }
    
    // Check uploads subdirectory
    if (fs.existsSync(uploadPath)) {
      console.log('  ✅ Uploads directory exists');
      
      // Test write permission
      const testFile = path.join(uploadPath, '.test-write-' + Date.now());
      try {
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        console.log('  ✅ Write permissions OK');
      } catch (writeError) {
        console.log('  ❌ Cannot write to uploads directory:', writeError.message);
        console.log('  💡 Check folder permissions on the NAS');
      }
    } else {
      console.log('  ⚠️  Uploads directory does NOT exist');
      console.log('  💡 Attempting to create it...');
      try {
        fs.mkdirSync(uploadPath, { recursive: true });
        console.log('  ✅ Successfully created uploads directory');
      } catch (mkdirError) {
        console.log('  ❌ Failed to create uploads directory:', mkdirError.message);
        console.log('  💡 You may need to create it manually on the NAS');
      }
    }
  } else {
    console.log('  ❌ Network path NOT accessible');
    console.log('  💡 Possible issues:');
    console.log('     - Network drive not connected');
    console.log('     - Incorrect path: ' + networkDataPath);
    console.log('     - Insufficient permissions');
    console.log('     - NAS server offline');
  }
} catch (error) {
  console.log('  ❌ Error checking network path:', error.message);
}

// Recommendations
console.log('\n💡 Recommendations:');
console.log('='.repeat(60));

if (!fs.existsSync(networkDataPath)) {
  console.log('\n❌ ISSUE FOUND: Network path not accessible');
  console.log('\n🔧 SOLUTIONS:');
  console.log('\n1. TEMPORARY FIX - Use local storage:');
  console.log('   Edit .env file and add this line:');
  console.log('   USE_LOCAL_STORAGE=true');
  console.log('   Then restart the server');
  console.log('\n2. FIX NETWORK ACCESS:');
  console.log('   a. Verify network connection to KMTI-NAS');
  console.log('   b. Open File Explorer and try accessing:');
  console.log('      \\\\KMTI-NAS\\Shared\\data');
  console.log('   c. If prompted, enter network credentials');
  console.log('   d. Create "uploads" folder if it doesn\'t exist');
  console.log('   e. Right-click "uploads" folder → Properties → Security');
  console.log('   f. Ensure your user has "Full Control" permissions');
} else if (!fs.existsSync(uploadPath)) {
  console.log('\n⚠️  ISSUE: Uploads folder missing');
  console.log('Creating uploads folder...');
  try {
    fs.mkdirSync(uploadPath, { recursive: true });
    console.log('✅ Uploads folder created successfully!');
    console.log('Try uploading files again.');
  } catch (e) {
    console.log('❌ Could not create uploads folder automatically');
    console.log('Please create it manually on the NAS');
  }
} else {
  // Test actual write
  const testFile = path.join(uploadPath, '.test-write-' + Date.now());
  try {
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log('✅ Upload configuration looks good!');
    console.log('If uploads still fail, check:');
    console.log('  1. Server logs for detailed errors');
    console.log('  2. Browser console for client-side errors');
    console.log('  3. Network connectivity during upload');
  } catch (writeError) {
    console.log('❌ ISSUE: Cannot write to uploads folder');
    console.log('Error:', writeError.message);
    console.log('\n🔧 SOLUTION:');
    console.log('Fix folder permissions on the NAS:');
    console.log('  1. Navigate to: \\\\KMTI-NAS\\Shared\\data\\uploads');
    console.log('  2. Right-click → Properties → Security tab');
    console.log('  3. Ensure your user has "Full Control"');
    console.log('  4. Click "Apply" then "OK"');
  }
}

console.log('\n' + '='.repeat(60));
console.log('✅ Diagnostic complete!\n');
