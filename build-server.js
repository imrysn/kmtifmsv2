const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📦 Starting optimized server build...');

const dest = path.join(__dirname, 'dist-server');

// 1. Clean destination
if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true });
    console.log('✅ Cleaned dist-server directory');
}
fs.mkdirSync(dest, { recursive: true });

// 2. Run NCC to bundle server.js (and all its dependencies) into a single file
console.log('📦 Bundling server with NCC (this may take a moment)...');
try {
    // We use npx to ensure ncc is available from devDependencies
    execSync('npx ncc build server.js -o dist-server --minify', { stdio: 'inherit' });
    console.log('✅ Server bundled successfully into dist-server/index.js');
} catch (error) {
    console.error('❌ NCC bundling failed:', error.message);
    process.exit(1);
}

// 3. Copy client/dist to dist-server/client-dist
// This allows the embedded server to serve the React frontend in production
const clientDist = path.join(__dirname, 'client', 'dist');
const clientDest = path.join(dest, 'client-dist');

if (fs.existsSync(clientDist)) {
    console.log('📦 Copying frontend build...');
    fs.cpSync(clientDist, clientDest, { recursive: true });
    console.log('✅ Copied client/dist to dist-server/client-dist');
} else {
    console.warn('⚠️  Warning: client/dist not found. Frontend will not be available in the server build.');
    console.warn('   Run "npm run client:build" first if you need the frontend.');
}

// 4. Verify build size
const stats = fs.statSync(path.join(dest, 'index.js'));
const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
console.log(`\n✨ Build complete!`);
console.log(`📊 Bundled server size: ${sizeMB} MB`);
console.log(`🚀 Ready for Electron packaging\n`);
