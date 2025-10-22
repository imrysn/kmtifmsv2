/**
 * Security Fixes Verification Script
 * Checks that all external resources have been removed
 * 
 * Note: xmlns="http://www.w3.org/2000/svg" in SVG tags is NOT an external resource.
 * It's an XML namespace declaration required for SVG rendering and is safe.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Security Fixes...\n');

let hasErrors = false;

// Files to check
const filesToCheck = [
  {
    path: 'client/src/components/admin/FileIcon.jsx',
    shouldNotContain: [
      'flaticon.com', 
      'cdn-icons', 
      'https://fonts', 
      'https://cdn'
    ],
    description: 'FileIcon component'
  },
  {
    path: 'client/src/css/AdminDashboard.css',
    shouldNotContain: ['@import url', 'fonts.googleapis.com'],
    description: 'AdminDashboard CSS'
  },
  {
    path: 'client/src/css/Login.css',
    shouldNotContain: ['@import url', 'fonts.googleapis.com'],
    description: 'Login CSS'
  },
  {
    path: 'client/index.html',
    shouldContain: ['Content-Security-Policy'],
    description: 'Index HTML (CSP check)'
  },
  {
    path: 'main.js',
    shouldContain: ['disableHardwareAcceleration', 'Content-Security-Policy'],
    description: 'Main Electron file'
  }
];

// Check each file
filesToCheck.forEach(file => {
  const fullPath = path.join(__dirname, file.path);
  
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    
    console.log(`📄 Checking ${file.description}...`);
    
    // Check for strings that should NOT be present
    if (file.shouldNotContain) {
      file.shouldNotContain.forEach(text => {
        if (content.includes(text)) {
          console.log(`   ❌ FAIL: Found "${text}" in ${file.path}`);
          hasErrors = true;
        }
      });
    }
    
    // Check for strings that SHOULD be present
    if (file.shouldContain) {
      file.shouldContain.forEach(text => {
        if (!content.includes(text)) {
          console.log(`   ❌ FAIL: Missing "${text}" in ${file.path}`);
          hasErrors = true;
        } else {
          console.log(`   ✅ Found "${text}"`);
        }
      });
    }
    
    if (!hasErrors) {
      console.log(`   ✅ PASS\n`);
    } else {
      console.log('');
    }
    
  } catch (error) {
    console.log(`   ❌ ERROR: Could not read ${file.path}`);
    console.log(`   ${error.message}\n`);
    hasErrors = true;
  }
});

// Summary
console.log('─'.repeat(50));
if (hasErrors) {
  console.log('❌ VERIFICATION FAILED - Please review the errors above\n');
  process.exit(1);
} else {
  console.log('✅ ALL CHECKS PASSED - Security fixes verified!\n');
  console.log('Next steps:');
  console.log('1. Run: npm run dev');
  console.log('2. Open DevTools and check Console');
  console.log('3. Verify no CSP warnings');
  console.log('4. Check that icons display properly\n');
  process.exit(0);
}
