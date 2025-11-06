const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing Vite Startup Issues...\n');

// Step 1: Check if port 5173 is in use
console.log('1️⃣ Checking if port 5173 is in use...');
try {
  const portCheck = execSync('netstat -ano | findstr :5173', { encoding: 'utf-8' });
  if (portCheck) {
    console.log('   ⚠️ Port 5173 is in use:');
    console.log(portCheck);
    console.log('   💡 Will try to kill the process...');
    
    // Extract PID and kill
    const lines = portCheck.split('\n');
    const pids = new Set();
    lines.forEach(line => {
      const match = line.match(/\s+(\d+)\s*$/);
      if (match) {
        pids.add(match[1]);
      }
    });
    
    pids.forEach(pid => {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'inherit' });
        console.log(`   ✅ Killed process ${pid}`);
      } catch (e) {
        console.log(`   ⚠️ Could not kill process ${pid}`);
      }
    });
  } else {
    console.log('   ✅ Port 5173 is free');
  }
} catch (e) {
  console.log('   ✅ Port 5173 is free');
}

// Step 2: Clear Vite cache
console.log('\n2️⃣ Clearing Vite cache...');
const viteCachePath = path.join(__dirname, 'client', 'node_modules', '.vite');
if (fs.existsSync(viteCachePath)) {
  try {
    fs.rmSync(viteCachePath, { recursive: true, force: true });
    console.log('   ✅ Vite cache cleared');
  } catch (e) {
    console.log('   ⚠️ Could not clear cache:', e.message);
  }
} else {
  console.log('   ℹ️ No cache to clear');
}

// Step 3: Check for syntax errors in recently modified files
console.log('\n3️⃣ Checking for syntax errors...');
const filesToCheck = [
  'client/src/components/user/TasksTab.jsx',
  'client/src/components/user/TasksTab-Enhanced.jsx',
  'client/src/components/user/TasksTab-Enhanced-v2.jsx'
];

let hasErrors = false;
filesToCheck.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      // Basic syntax check - look for common issues
      const issues = [];
      
      // Check for unclosed brackets
      const openBrackets = (content.match(/{/g) || []).length;
      const closeBrackets = (content.match(/}/g) || []).length;
      if (openBrackets !== closeBrackets) {
        issues.push(`Mismatched braces: ${openBrackets} open, ${closeBrackets} close`);
      }
      
      // Check for unclosed parentheses
      const openParens = (content.match(/\(/g) || []).length;
      const closeParens = (content.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        issues.push(`Mismatched parentheses: ${openParens} open, ${closeParens} close`);
      }
      
      if (issues.length > 0) {
        console.log(`   ❌ ${file}:`);
        issues.forEach(issue => console.log(`      ${issue}`));
        hasErrors = true;
      } else {
        console.log(`   ✅ ${file}`);
      }
    } catch (e) {
      console.log(`   ❌ ${file}: ${e.message}`);
      hasErrors = true;
    }
  }
});

if (hasErrors) {
  console.log('\n⚠️ Found syntax errors. Please fix them before starting Vite.');
  process.exit(1);
}

// Step 4: Reinstall dependencies if needed
console.log('\n4️⃣ Checking dependencies...');
const nodeModulesPath = path.join(__dirname, 'client', 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
  console.log('   ⚠️ node_modules not found. Installing...');
  try {
    execSync('cd client && npm install', { stdio: 'inherit' });
    console.log('   ✅ Dependencies installed');
  } catch (e) {
    console.log('   ❌ Failed to install dependencies');
    process.exit(1);
  }
} else {
  console.log('   ✅ Dependencies exist');
}

// Step 5: Update vite.config.js to remove force: true
console.log('\n5️⃣ Optimizing Vite config...');
const viteConfigPath = path.join(__dirname, 'client', 'vite.config.js');
if (fs.existsSync(viteConfigPath)) {
  let viteConfig = fs.readFileSync(viteConfigPath, 'utf-8');
  if (viteConfig.includes('force: true')) {
    viteConfig = viteConfig.replace('force: true,', 'force: false,');
    fs.writeFileSync(viteConfigPath, viteConfig);
    console.log('   ✅ Updated vite.config.js (removed force rebuild)');
  } else {
    console.log('   ✅ Vite config is optimal');
  }
}

console.log('\n✅ All checks passed! You can now start the application.');
console.log('   Run: npm start\n');
