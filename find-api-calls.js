const fs = require('fs');
const path = require('path');

// Files that have been updated
const updated = new Set([
  'Login.jsx',
  'AdminDashboard.jsx',
  'NotificationContext.jsx',
  'NetworkContext.jsx'
]);

// Search for fetch calls with localhost:3001
function searchDirectory(dir, results = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and dist
      if (file !== 'node_modules' && file !== 'dist') {
        searchDirectory(filePath, results);
      }
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for various patterns of localhost:3001
      if (content.includes('localhost:3001') || 
          content.includes('3001/api') ||
          (content.includes('fetch(') && content.includes('/api/'))) {
        
        const fileName = path.basename(filePath);
        if (!updated.has(fileName)) {
          results.push({
            file: filePath.replace(process.cwd(), '.'),
            name: fileName
          });
        }
      }
    }
  }
  
  return results;
}

const srcPath = path.join(__dirname, 'client', 'src');
const results = searchDirectory(srcPath);

console.log('\n📋 Files that need API URL updates:\n');
if (results.length === 0) {
  console.log('✅ No more files found with hardcoded API URLs!');
} else {
  results.forEach(r => {
    console.log(`   ${r.file}`);
  });
  console.log(`\n📊 Total: ${results.length} files`);
}
