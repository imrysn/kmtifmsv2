#!/usr/bin/env node
/**
 * Automated API URL Updater
 * Replaces all hardcoded localhost:3001 URLs with getApiUrl() helper
 */

const fs = require('fs');
const path = require('path');

// Files to update with their imports
const filesToUpdate = [
  {
    path: 'client/src/components/admin/UserManagement.jsx',
    hasImport: false,
    importPath: '../../config/api'
  },
  {
    path: 'client/src/components/admin/Settings.jsx',
    hasImport: false,
    importPath: '../../config/api'
  },
  {
    path: 'client/src/components/admin/FileApproval-Optimized.jsx',
    hasImport: false,
    importPath: '../../config/api'
  },
  {
    path: 'client/src/components/admin/FileManagement.jsx',
    hasImport: false,
    importPath: '../../config/api'
  },
  {
    path: 'client/src/components/admin/ActivityLogs.jsx',
    hasImport: false,
    importPath: '../../config/api'
  },
  {
    path: 'client/src/components/admin/TaskManagement.jsx',
    hasImport: false,
    importPath: '../../config/api'
  }
];

function addImportIfNeeded(content, importPath) {
  // Check if import already exists
  if (content.includes("from '../../config/api'") || content.includes('from "../../config/api"')) {
    return content;
  }

  // Find the last import statement
  const lines = content.split('\n');
  let lastImportIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ')) {
      lastImportIndex = i;
    }
  }

  if (lastImportIndex === -1) {
    // No imports found, add at top after any comments
    let insertIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].trim().startsWith('//') && !lines[i].trim().startsWith('/*') && lines[i].trim() !== '') {
        insertIndex = i;
        break;
      }
    }
    lines.splice(insertIndex, 0, `import { getApiUrl } from '${importPath}'`);
  } else {
    // Add after last import
    lines.splice(lastImportIndex + 1, 0, `import { getApiUrl } from '${importPath}'`);
  }

  return lines.join('\n');
}

function replaceApiUrls(content) {
  // Replace all variations of localhost:3001 API calls
  
  // Pattern 1: fetch('http://localhost:3001/api/...')
  content = content.replace(
    /fetch\s*\(\s*['"]http:\/\/localhost:3001\/(api\/[^'"]+)['"]/g,
    "fetch(getApiUrl('$1')"
  );

  // Pattern 2: fetch(`http://localhost:3001/api/...${var}`)
  content = content.replace(
    /fetch\s*\(\s*`http:\/\/localhost:3001\/(api\/[^`]+)`/g,
    "fetch(getApiUrl(`$1`)"
  );

  // Pattern 3: const url = 'http://localhost:3001/api/...'
  content = content.replace(
    /=\s*['"]http:\/\/localhost:3001\/(api\/[^'"]+)['"]/g,
    "= getApiUrl('$1')"
  );

  // Pattern 4: const API_BASE = 'http://localhost:3001'
  content = content.replace(
    /const\s+API_BASE\s*=\s*['"]http:\/\/localhost:3001['"]/g,
    "const API_BASE = 'DEPRECATED_USE_getApiUrl_instead'"
  );

  // Pattern 5: ${API_BASE}/api/...
  content = content.replace(
    /`\$\{API_BASE\}\/(api\/[^`]+)`/g,
    "getApiUrl(`$1`)"
  );

  return content;
}

function updateFile(filePath) {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ File not found: ${filePath}`);
    return false;
  }

  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    const originalContent = content;

    // Add import
    const fileConfig = filesToUpdate.find(f => f.path === filePath);
    if (fileConfig && !fileConfig.hasImport) {
      content = addImportIfNeeded(content, fileConfig.importPath);
    }

    // Replace API URLs
    content = replaceApiUrls(content);

    // Check if anything changed
    if (content === originalContent) {
      console.log(`⏭️  No changes needed: ${filePath}`);
      return false;
    }

    // Write back
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Updated: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
console.log('🚀 Starting API URL migration...\n');

let updatedCount = 0;
let skippedCount = 0;

for (const file of filesToUpdate) {
  if (updateFile(file.path)) {
    updatedCount++;
  } else {
    skippedCount++;
  }
}

console.log(`\n✨ Migration complete!`);
console.log(`   Updated: ${updatedCount} files`);
console.log(`   Skipped: ${skippedCount} files`);
console.log(`\n📝 Next steps:`);
console.log(`   1. Review the changes`);
console.log(`   2. Test the application: npm run dev`);
console.log(`   3. Check for any remaining hardcoded URLs`);
