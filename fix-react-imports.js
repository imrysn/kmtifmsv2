/**
 * Script to find and fix React import issues in JSX files
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'client', 'src');

function getAllJsxFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllJsxFiles(filePath, fileList);
    } else if (file.endsWith('.jsx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function checkReactImport(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  // Check if file uses React.memo, React.lazy, React.Component, etc.
  const usesReactNamespace = /React\.(memo|lazy|Component|PureComponent|Fragment|createContext|forwardRef)/g.test(content);
  
  // Check if React is imported
  const hasReactImport = /^import\s+React/m.test(content);
  const hasReactInDestructure = /^import\s+{[^}]*}\s+from\s+['"]react['"]/m.test(content);
  
  return {
    filePath,
    usesReactNamespace,
    hasReactImport,
    hasReactInDestructure,
    needsFix: usesReactNamespace && !hasReactImport,
    firstLine: lines[0]
  };
}

function fixReactImport(filePath, analysis) {
  if (!analysis.needsFix) return false;
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  // Find the line with react import
  const reactImportIndex = lines.findIndex(line => 
    /^import\s+{[^}]+}\s+from\s+['"]react['"]/.test(line)
  );
  
  if (reactImportIndex >= 0) {
    // Add React to existing import
    const oldLine = lines[reactImportIndex];
    const newLine = oldLine.replace(/^import\s+{/, 'import React, {');
    lines[reactImportIndex] = newLine;
    
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    return true;
  } else {
    // Add React import at the top
    lines.unshift("import React from 'react'");
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    return true;
  }
}

console.log('🔍 Checking all JSX files for React import issues...\n');

const jsxFiles = getAllJsxFiles(srcDir);
console.log(`Found ${jsxFiles.length} JSX files\n`);

let issuesFound = 0;
let issuesFixed = 0;

jsxFiles.forEach(file => {
  const analysis = checkReactImport(file);
  const relativePath = path.relative(__dirname, file);
  
  if (analysis.needsFix) {
    issuesFound++;
    console.log(`❌ ${relativePath}`);
    console.log(`   Uses React namespace but missing import`);
    
    if (fixReactImport(file, analysis)) {
      issuesFixed++;
      console.log(`   ✅ FIXED\n`);
    } else {
      console.log(`   ⚠️  Could not auto-fix\n`);
    }
  }
});

console.log('='.repeat(50));
console.log(`\n📊 Summary:`);
console.log(`   Total JSX files: ${jsxFiles.length}`);
console.log(`   Issues found: ${issuesFound}`);
console.log(`   Issues fixed: ${issuesFixed}`);

if (issuesFound === 0) {
  console.log('\n✅ All JSX files have correct React imports!');
} else if (issuesFixed === issuesFound) {
  console.log('\n✅ All issues have been fixed!');
} else {
  console.log('\n⚠️  Some issues could not be auto-fixed. Please review manually.');
}
