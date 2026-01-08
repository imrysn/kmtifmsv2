/**
 * Pre-Release Code Validation
 * 
 * Validates codebase is ready for release WITHOUT building.
 * Actual building happens in GitHub Actions.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Pre-Release Code Validation\n');
console.log('=' .repeat(60));

let allChecksPass = true;
const errors = [];
const warnings = [];

// Test 1: Version format
console.log('\n📦 Test 1: Version format');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const version = packageJson.version;
  
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    errors.push(`Invalid version: ${version} (must be X.Y.Z)`);
    console.log(`  ❌ FAIL`);
    allChecksPass = false;
  } else {
    console.log(`  ✅ PASS: ${version}`);
  }
} catch (error) {
  errors.push('Cannot read package.json');
  console.log(`  ❌ FAIL`);
  allChecksPass = false;
}

// Test 2: Required files exist
console.log('\n📁 Test 2: Required files');
const requiredFiles = [
  'main.js',
  'updater.js',
  'updater-window.js',
  'preload.js',
  'updater-preload.js',
  'server.js',
  'package.json',
  '.github/workflows/electron-release.yml'
];

const missingFiles = requiredFiles.filter(f => !fs.existsSync(f));

if (missingFiles.length > 0) {
  errors.push(`Missing files: ${missingFiles.join(', ')}`);
  console.log(`  ❌ FAIL: Missing ${missingFiles.length} files`);
  allChecksPass = false;
} else {
  console.log(`  ✅ PASS: All required files present`);
}

// Test 3: package.json configuration
console.log('\n⚙️  Test 3: package.json configuration');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  // Check build config
  if (!packageJson.build) {
    errors.push('Missing build configuration');
    console.log('  ❌ FAIL: No build config');
    allChecksPass = false;
  } else {
    // Check publish config
    const hasGitHub = packageJson.build.publish?.some(p => p.provider === 'github');
    if (!hasGitHub) {
      errors.push('Missing GitHub publish configuration');
      console.log('  ❌ FAIL: No GitHub publish config');
      allChecksPass = false;
    } else {
      console.log('  ✅ PASS: Build config valid');
    }
  }
  
  // Check dependencies
  if (!packageJson.dependencies['electron-updater']) {
    errors.push('Missing electron-updater dependency');
    console.log('  ❌ FAIL: electron-updater not installed');
    allChecksPass = false;
  }
  
  if (!packageJson.dependencies['electron-log']) {
    warnings.push('electron-log not installed (recommended)');
    console.log('  ⚠️  WARN: electron-log missing');
  }
} catch (error) {
  errors.push('Invalid package.json');
  console.log(`  ❌ FAIL`);
  allChecksPass = false;
}

// Test 4: Updater code validation
console.log('\n🔄 Test 4: Updater system code');
try {
  const updaterCode = fs.readFileSync('updater.js', 'utf8');
  
  const checks = {
    hasAutoUpdater: updaterCode.includes('electron-updater'),
    hasHealthCheck: updaterCode.includes('runHealthCheck'),
    hasStateManager: updaterCode.includes('UpdateStateManager'),
    hasRollbackLogic: updaterCode.includes('rollbackUpdate')
  };
  
  const failed = Object.entries(checks).filter(([k, v]) => !v);
  
  if (failed.length > 0) {
    errors.push(`Updater missing: ${failed.map(([k]) => k).join(', ')}`);
    console.log(`  ❌ FAIL: Missing components`);
    allChecksPass = false;
  } else {
    console.log('  ✅ PASS: Updater code complete');
  }
} catch (error) {
  errors.push('Cannot read updater.js');
  console.log(`  ❌ FAIL`);
  allChecksPass = false;
}

// Test 5: Main process integration
console.log('\n🖥️  Test 5: Main process integration');
try {
  const mainCode = fs.readFileSync('main.js', 'utf8');
  
  if (!mainCode.includes("require('./updater')")) {
    errors.push('Updater not imported in main.js');
    console.log('  ❌ FAIL: Updater not initialized');
    allChecksPass = false;
  } else if (!mainCode.includes('startPeriodicUpdateCheck')) {
    warnings.push('Periodic update checks not started');
    console.log('  ⚠️  WARN: Update checks not enabled');
  } else {
    console.log('  ✅ PASS: Main process configured');
  }
} catch (error) {
  errors.push('Cannot read main.js');
  console.log(`  ❌ FAIL`);
  allChecksPass = false;
}

// Test 6: Server health endpoint
console.log('\n🏥 Test 6: Server health endpoint');
try {
  const serverCode = fs.readFileSync('server/index.js', 'utf8');
  
  if (!serverCode.includes('/api/health')) {
    errors.push('Health endpoint missing');
    console.log('  ❌ FAIL: No health endpoint');
    allChecksPass = false;
  } else if (!serverCode.includes('database')) {
    warnings.push('Health endpoint may not check database');
    console.log('  ⚠️  WARN: Database check unclear');
  } else {
    console.log('  ✅ PASS: Health endpoint exists');
  }
} catch (error) {
  errors.push('Cannot read server/index.js');
  console.log(`  ❌ FAIL`);
  allChecksPass = false;
}

// Test 7: Workflow validation
console.log('\n⚙️  Test 7: GitHub Actions workflow');
try {
  const workflow = fs.readFileSync('.github/workflows/electron-release.yml', 'utf8');
  
  const checks = {
    hasGhToken: workflow.includes('GH_TOKEN'),
    hasClientBuild: workflow.includes('client:build') || workflow.includes('npm run build'),
    hasElectronPack: workflow.includes('electron:pack') || workflow.includes('electron-builder'),
    hasVersionValidation: workflow.includes('Validate version format') || (workflow.includes('version') && workflow.includes('Invalid version'))
  };
  
  const missing = Object.entries(checks).filter(([k, v]) => !v).map(([k]) => k);
  
  if (missing.length > 0) {
    if (missing.includes('hasGhToken')) {
      errors.push('GH_TOKEN not referenced in workflow');
    }
    if (missing.includes('hasClientBuild') || missing.includes('hasElectronPack')) {
      errors.push('Build steps missing in workflow');
    }
    if (missing.includes('hasVersionValidation')) {
      warnings.push('No version validation in workflow');
    }
    
    if (missing.some(m => m.includes('hasGhToken') || m.includes('Build') || m.includes('Pack'))) {
      console.log(`  ❌ FAIL: Workflow incomplete`);
      allChecksPass = false;
    } else {
      console.log(`  ✅ PASS: Workflow configured (with warnings)`);
    }
  } else {
    console.log('  ✅ PASS: Workflow configured');
  }
} catch (error) {
  errors.push('Cannot read workflow file');
  console.log(`  ❌ FAIL`);
  allChecksPass = false;
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 VALIDATION SUMMARY');
console.log('='.repeat(60));

if (errors.length > 0) {
  console.log('\n❌ ERRORS:');
  errors.forEach((error, i) => {
    console.log(`   ${i + 1}. ${error}`);
  });
}

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS:');
  warnings.forEach((warning, i) => {
    console.log(`   ${i + 1}. ${warning}`);
  });
}

if (allChecksPass) {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  console.log('\n✅ ALL CHECKS PASSED!\n');
  console.log('🎉 Your codebase is ready for release!');
  console.log('\nNext steps:');
  console.log('   1. Commit your changes:');
  console.log('      git add .');
  console.log('      git commit -m "chore: prepare release"');
  console.log('      git push origin main');
  console.log('');
  console.log('   2. Create and push version tag:');
  console.log(`      git tag v${packageJson.version}`);
  console.log(`      git push origin v${packageJson.version}`);
  console.log('');
  console.log('   3. Monitor GitHub Actions:');
  console.log('      https://github.com/imrysn/kmtifmsv2/actions');
  console.log('');
  console.log('   GitHub Actions will build and create the release automatically.');
} else {
  console.log('\n❌ VALIDATION FAILED\n');
  console.log('🔧 Fix the errors above in your code before releasing.');
  process.exit(1);
}

console.log('\n' + '='.repeat(60));
