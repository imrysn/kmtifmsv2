/**
 * Diagnostic script to check Vite startup issues
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const VITE_PORT = 5173;

console.log('🔍 Vite Startup Diagnostic Tool\n');
console.log('=' .repeat(50));

// Check 1: Port availability
console.log('\n📋 Step 1: Checking if port 5173 is available...');
checkPort(VITE_PORT).then(inUse => {
  if (inUse) {
    console.log('❌ Port 5173 is IN USE!');
    console.log('💡 Kill the process using:');
    console.log('   netstat -ano | findstr :5173');
    console.log('   taskkill /PID <pid> /F\n');
  } else {
    console.log('✅ Port 5173 is available\n');
  }

  // Check 2: Try to start Vite
  console.log('📋 Step 2: Attempting to start Vite...');
  startVite();
});

function checkPort(port) {
  return new Promise((resolve) => {
    const server = require('net').createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

function startVite() {
  const isWindows = process.platform === 'win32';
  const viteProcess = spawn(isWindows ? 'npm.cmd' : 'npm', ['run', 'dev'], {
    cwd: path.join(__dirname, 'client'),
    stdio: 'pipe',
    shell: true
  });

  let startTime = Date.now();
  let viteReady = false;

  viteProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(output);

    if ((output.includes('Local:') || output.includes('ready in')) && !viteReady) {
      viteReady = true;
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      console.log(`\n✅ Vite started successfully in ${elapsed} seconds!`);
      console.log('=' .repeat(50));
      console.log('✨ Vite is working correctly. You can close this and run: npm start');
      
      setTimeout(() => {
        viteProcess.kill();
        process.exit(0);
      }, 2000);
    }
  });

  viteProcess.stderr.on('data', (data) => {
    const error = data.toString();
    if (!error.includes('DeprecationWarning')) {
      console.error('⚠️  Error:', error);
    }
  });

  viteProcess.on('error', (error) => {
    console.error('\n❌ Failed to start Vite!');
    console.error('Error:', error.message);
    console.error('\n💡 Try:');
    console.error('   cd client');
    console.error('   npm install');
    console.error('   npm run dev');
    process.exit(1);
  });

  // Timeout check
  setTimeout(() => {
    if (!viteReady) {
      console.error('\n❌ Vite did not start within 30 seconds!');
      console.error('\n💡 Troubleshooting steps:');
      console.error('1. Check node_modules: cd client && npm install');
      console.error('2. Clear Vite cache: rm -rf client/node_modules/.vite');
      console.error('3. Check for port conflicts: netstat -ano | findstr :5173');
      console.error('4. Try manual start: cd client && npm run dev');
      viteProcess.kill();
      process.exit(1);
    }
  }, 30000);
}
