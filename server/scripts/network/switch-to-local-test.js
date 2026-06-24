const fs = require('fs');
const path = require('path');

console.log('🔧 Switching File Management to Local Test Mode\n');

const serverPath = path.join(__dirname, 'server.js');
const backupPath = path.join(__dirname, 'server.js.backup');

try {
  // Read current server.js
  let serverContent = fs.readFileSync(serverPath, 'utf8');

  // Create backup if it doesn't exist
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, serverContent);
    console.log('✅ Created backup: server.js.backup');
  }

  // Check if already in test mode
  if (serverContent.includes('test-projects-directory')) {
    console.log('⚠️ Already in local test mode');
    process.exit(0);
  }

  // Create local test directory first
  const testDir = path.join(__dirname, 'test-projects-directory');
  if (!fs.existsSync(testDir)) {
    console.log('📁 Creating local test directory...');
    require('./create-local-test-directory.js');
  }

  // Replace network path with local path
  const networkPathLine = "const networkProjectsPath = '\\\\\\\\KMTI-NAS\\\\Shared\\\\Public\\\\PROJECTS';";
  const localPathLine = `const networkProjectsPath = '${testDir.replace(/\\/g, '\\\\')}';
  console.log('🏠 RUNNING IN LOCAL TEST MODE - Using local directory:', networkProjectsPath);`;

  if (serverContent.includes(networkPathLine)) {
    serverContent = serverContent.replace(networkPathLine, localPathLine);
    fs.writeFileSync(serverPath, serverContent);

    console.log('✅ Modified server.js to use local test directory');
    console.log('📁 Local test path:', testDir);
    console.log('\n🚀 Next steps:');
    console.log('1. Restart your server: npm run dev');
    console.log('2. Go to File Management in the browser');
    console.log('3. You should see test folders and files');
    console.log('\n🔄 To switch back to network mode:');
    console.log('   npm run restore:network-mode');
  } else {
    console.log('⚠️ Could not find network path line to replace');
    console.log('Please manually edit server.js');
    console.log('Looking for:', networkPathLine);
  }

} catch (error) {
  console.error('❌ Error:', error.message);
}
