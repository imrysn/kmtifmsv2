const fs = require('fs');

const fixFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix setImmediate missing
  if (content.includes(`const { safeDeleteFile, streamCopy } = require('../utils/fileUtils');`) && !content.includes(`const { setImmediate } = require('timers');`)) {
    content = content.replace(
      `const { safeDeleteFile, streamCopy } = require('../utils/fileUtils');`,
      `const { safeDeleteFile, streamCopy } = require('../utils/fileUtils');\nconst { setImmediate } = require('timers');`
    );
  }

  // Safely replace empty catch blocks
  content = content.replace(/catch \([a-zA-Z_0-9]+\)\s*\{\s*\}/g, 'catch { /* ignored */ }');

  // Replace unused `_` variable safely
  content = content.replace(/catch \(_\)\s*\{/g, 'catch {');

  // We know line 1242 has unused `err` but to be safe, I'll just find and replace all `catch (err) {` 
  // ONLY if they don't use `err` inside the block. A safer way is:
  content = content.replace(/catch \(err\)\s*\{\s*return\s+\[\];\s*\}/g, 'catch {\n      return [];\n    }');

  fs.writeFileSync(filePath, content);
};

fixFile('server/services/fileService.js');
console.log('Fixed fileService.js carefully');
