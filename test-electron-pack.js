/**
 * Quick Electron Pack Test
 * Tests just electron-builder without full build
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('Testing Electron Builder...\n');

// Check prerequisites
console.log('1. Checking prerequisites:');

const checks = {
  clientDist: fs.existsSync('client/dist/index.html'),
  distServer: fs.existsSync('dist-server/index.js'),
  envFile: fs.existsSync('.env'),
  database: fs.existsSync('database'),
  icon: fs.existsSync('client/src/assets/fms-icon.ico')
};

Object.entries(checks).forEach(([key, exists]) => {
  console.log(`   ${exists ? '✅' : '❌'} ${key}`);
});

const allPrereqsExist = Object.values(checks).every(v => v);

if (!allPrereqsExist) {
  console.log('\n❌ Missing prerequisites. Run:');
  if (!checks.clientDist) console.log('   npm run client:build');
  if (!checks.distServer) console.log('   npm run build:server');
  if (!checks.envFile) console.log('   cp .env.example .env');
  process.exit(1);
}

console.log('\n2. Running electron-builder...');
try {
  execSync('npx electron-builder --dir', {
    stdio: 'inherit',
    cwd: __dirname
  });
  console.log('\n✅ Electron builder test passed!');
} catch (error) {
  console.log('\n❌ Electron builder failed');
  process.exit(1);
}
