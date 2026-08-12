const fs = require('fs');
const path = require('path');

console.log('🌐 Restoring File Management to Network Mode\n');

const serverPath = path.join(__dirname, 'server.js');
const backupPath = path.join(__dirname, 'server.js.backup');

try {
  if (!fs.existsSync(backupPath)) {
    console.log('❌ No backup file found (server.js.backup)');
    console.log('Manual restore required');
    process.exit(1);
  }

  // Restore from backup
  const backupContent = fs.readFileSync(backupPath, 'utf8');
  fs.writeFileSync(serverPath, backupContent);

  console.log('✅ Restored server.js from backup');
  console.log('🌐 Now using network path: \\\\KMTI-NAS\\Shared\\Public\\PROJECTS');
  console.log('\n🚀 Next steps:');
  console.log('1. Ensure VPN connection (if required)');
  console.log('2. Verify network access to \\\\KMTI-NAS\\Shared\\Public\\PROJECTS');
  console.log('3. Restart your server: npm run dev');
  console.log('4. Test File Management in the browser');

  // Clean up backup
  // fs.unlinkSync(backupPath); // Uncomment if you want to delete backup

} catch (error) {
  console.error('❌ Error:', error.message);
}
