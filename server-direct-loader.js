// ALTERNATIVE SERVER STARTUP - Use this if spawn() doesn't work
// This loads the server directly instead of spawning a separate process

const path = require('path');
const fs = require('fs');

let serverStarted = false;

function startServerDirect() {
  if (serverStarted) {
    console.log('⚠️  Server already started');
    return;
  }

  try {
    console.log('🚀 [DIRECT] Starting Express server directly...');
    
    // Try to load server directly
    const serverIndexPath = path.join(__dirname, 'server', 'index.js');
    
    console.log('📂 Server index path:', serverIndexPath);
    console.log('📂 Server exists:', fs.existsSync(serverIndexPath));
    
    if (!fs.existsSync(serverIndexPath)) {
      // Try alternative paths
      const altPath1 = path.join(process.resourcesPath, 'app.asar.unpacked', 'server', 'index.js');
      const altPath2 = path.join(process.resourcesPath, 'server', 'index.js');
      
      console.log('🔍 Trying alternative path 1:', altPath1);
      console.log('🔍 Exists:', fs.existsSync(altPath1));
      
      console.log('🔍 Trying alternative path 2:', altPath2);
      console.log('🔍 Exists:', fs.existsSync(altPath2));
      
      if (fs.existsSync(altPath1)) {
        console.log('✅ Using alternative path 1');
        require(altPath1);
      } else if (fs.existsSync(altPath2)) {
        console.log('✅ Using alternative path 2');
        require(altPath2);
      } else {
        throw new Error('Server files not found in any expected location');
      }
    } else {
      // Load server directly
      require(serverIndexPath);
    }
    
    serverStarted = true;
    console.log('✅ [DIRECT] Server loaded successfully!');
    console.log('🌐 Server should be running on http://localhost:3001');
    
  } catch (error) {
    console.error('❌ [DIRECT] Failed to start server:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

module.exports = { startServerDirect };
