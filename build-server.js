const fs = require('fs');
const path = require('path');

console.log('📦 Building server files...');

const src = path.join(__dirname, 'server');
const dest = path.join(__dirname, 'dist-server');

// Clean destination
if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true });
    console.log('✅ Cleaned dist-server directory');
}

// Create destination
fs.mkdirSync(dest, { recursive: true });

// Copy server directory
fs.cpSync(src, dest, { recursive: true });
console.log('✅ Copied server files');

// Copy root server.js
fs.cpSync(path.join(__dirname, 'server.js'), path.join(dest, 'server.js'));
console.log('✅ Copied server.js');

// Copy package.json
fs.cpSync(path.join(__dirname, 'package.json'), path.join(dest, 'package.json'));
console.log('✅ Copied package.json');

// Copy node_modules (only production dependencies)
console.log('📦 Copying node_modules (this may take a moment)...');
const nodeModulesSrc = path.join(__dirname, 'node_modules');
const nodeModulesDest = path.join(dest, 'node_modules');
if (fs.existsSync(nodeModulesSrc)) {
    fs.cpSync(nodeModulesSrc, nodeModulesDest, { recursive: true });
    console.log('✅ Copied node_modules');
}

console.log('✅ Server build complete!');
