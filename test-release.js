/**
 * Pre-Release Testing Script
 * 
 * Run this before creating a GitHub release to verify everything is ready.
 * This catches issues locally before they fail in CI/CD.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧪 Pre-Release Testing\n');
console.log('=' .repeat(60));

let allTestsPass = true;
const errors = [];
const warnings = [];

// Test 1: Verify package.json version format
console.log('\n📦 Test 1: Version format validation');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const version = packageJson.version;
  
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    errors.push(`Invalid version format: ${version}`);
    console.log(`  ❌ FAIL: Version must be X.Y.Z format`);
    allTestsPass = false;
  } else {
    console.log(`  ✅ PASS: Version ${version} is valid`);
  }
} catch (error) {
  errors.push('Cannot read package.json');
  console.log(`  ❌ FAIL: ${error.message}`);
  allTestsPass = false;
}

// Test 2: Build React client
console.log('\n⚛️  Test 2: Building React client');
try {
  console.log('  Running: npm run client:build');
  execSync('npm run client:build', { stdio: 'pipe', cwd: __dirname });
  
  if (!fs.existsSync('client/dist/index.html')) {
    errors.push('client/dist/index.html not created');
    console.log('  ❌ FAIL: Build output missing');
    allTestsPass = false;
  } else {
    const fileCount = fs.readdirSync('client/dist', { recursive: true })
      .filter(f => fs.statSync(path.join('client/dist', f)).isFile()).length;
    console.log(`  ✅ PASS: Client built successfully (${fileCount} files)`);
  }
} catch (error) {
  errors.push('Client build failed');
  console.log(`  ❌ FAIL: ${error.message}`);
  allTestsPass = false;
}

// Test 3: Build server bundle
console.log('\n🖥️  Test 3: Building server bundle');
try {
  console.log('  Running: npm run build:server');
  execSync('npm run build:server', { stdio: 'pipe', cwd: __dirname });
  
  if (!fs.existsSync('dist-server/index.js')) {
    errors.push('dist-server/index.js not created');
    console.log('  ❌ FAIL: Server bundle missing');
    allTestsPass = false;
  } else {
    console.log('  ✅ PASS: Server built successfully');
  }
} catch (error) {
  errors.push('Server build failed');
  console.log(`  ❌ FAIL: ${error.message}`);
  allTestsPass = false;
}

// Test 4: Package Electron app
console.log('\n📱 Test 4: Packaging Electron app');
try {
  console.log('  Running: npm run electron:pack');
  const packOutput = execSync('npm run electron:pack', { 
    stdio: 'pipe', 
    cwd: __dirname,
    encoding: 'utf8'
  });
  
  const distFiles = fs.readdirSync('dist');
  const hasExe = distFiles.some(f => f.endsWith('.exe'));
  const hasYml = distFiles.includes('latest.yml');
  
  if (!hasExe) {
    errors.push('No .exe installer found in dist/');
    console.log('  ❌ FAIL: Installer not created');
    allTestsPass = false;
  } else if (!hasYml) {
    errors.push('No latest.yml found - auto-updates will not work!');
    console.log('  ❌ FAIL: Update metadata missing');
    allTestsPass = false;
  } else {
    const exeFile = distFiles.find(f => f.endsWith('.exe'));
    console.log(`  ✅ PASS: Package created (${exeFile})`);
    console.log(`  ✅ PASS: Update metadata present (latest.yml)`);
  }
} catch (error) {
  errors.push('Electron packaging failed');
  console.log(`  ❌ FAIL: Electron packaging failed`);
  
  // Show full error output
  console.log('\n  ===== DETAILED ERROR OUTPUT =====');
  
  if (error.stdout) {
    console.log('\n  STDOUT:');
    console.log(error.stdout.toString().split('\n').map(l => `    ${l}`).join('\n'));
  }
  
  if (error.stderr) {
    console.log('\n  STDERR:');
    console.log(error.stderr.toString().split('\n').map(l => `    ${l}`).join('\n'));
  }
  
  console.log('\n  ================================\n');
  
  allTestsPass = false;
}

// Test 5: Verify required files in package
console.log('\n📂 Test 5: Verifying package contents');
try {
  const requiredFiles = [
    'main.js',
    'updater.js',
    'updater-window.js',
    'preload.js',
    'updater-preload.js'
  ];
  
  const missingFiles = requiredFiles.filter(f => !fs.existsSync(f));
  
  if (missingFiles.length > 0) {
    errors.push(`Missing files: ${missingFiles.join(', ')}`);
    console.log(`  ❌ FAIL: Missing ${missingFiles.length} required files`);
    allTestsPass = false;
  } else {
    console.log(`  ✅ PASS: All required files present`);
  }
} catch (error) {
  errors.push('File verification failed');
  console.log(`  ❌ FAIL: ${error.message}`);
  allTestsPass = false;
}

// Test 6: Check GitHub configuration
console.log('\n🐙 Test 6: GitHub configuration');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  if (!packageJson.build?.publish) {
    warnings.push('No publish configuration in package.json');
    console.log('  ⚠️  WARN: Publish config missing');
  } else {
    const githubPublish = packageJson.build.publish.find(p => p.provider === 'github');
    if (!githubPublish) {
      errors.push('GitHub publish configuration missing');
      console.log('  ❌ FAIL: GitHub provider not configured');
      allTestsPass = false;
    } else {
      console.log(`  ✅ PASS: GitHub publish configured`);
      console.log(`         Owner: ${githubPublish.owner}`);
      console.log(`         Repo: ${githubPublish.repo}`);
    }
  }
} catch (error) {
  errors.push('Cannot verify GitHub config');
  console.log(`  ❌ FAIL: ${error.message}`);
  allTestsPass = false;
}

// Test 7: Check workflow file
console.log('\n⚙️  Test 7: GitHub Actions workflow');
try {
  const workflowPath = '.github/workflows/electron-release.yml';
  if (!fs.existsSync(workflowPath)) {
    errors.push('Workflow file missing');
    console.log('  ❌ FAIL: electron-release.yml not found');
    allTestsPass = false;
  } else {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    
    const hasGhToken = workflow.includes('GH_TOKEN');
    const hasClientBuild = workflow.includes('npm run client:build') || workflow.includes('client:build');
    const hasElectronPack = workflow.includes('electron:pack');
    
    if (!hasGhToken) {
      warnings.push('GH_TOKEN not referenced in workflow');
      console.log('  ⚠️  WARN: GH_TOKEN reference missing');
    }
    if (!hasClientBuild) {
      errors.push('Client build step missing in workflow');
      console.log('  ❌ FAIL: No client build step');
      allTestsPass = false;
    }
    if (!hasElectronPack) {
      errors.push('Electron packaging step missing in workflow');
      console.log('  ❌ FAIL: No packaging step');
      allTestsPass = false;
    }
    
    if (hasGhToken && hasClientBuild && hasElectronPack) {
      console.log('  ✅ PASS: Workflow properly configured');
    }
  }
} catch (error) {
  warnings.push('Cannot verify workflow file');
  console.log(`  ⚠️  WARN: ${error.message}`);
}

// Test 8: Verify updater system
console.log('\n🔄 Test 8: Auto-update system');
try {
  const updaterCode = fs.readFileSync('updater.js', 'utf8');
  const mainCode = fs.readFileSync('main.js', 'utf8');
  
  const hasAutoUpdater = updaterCode.includes('electron-updater');
  const hasHealthCheck = updaterCode.includes('runHealthCheck');
  const hasInitialization = mainCode.includes("require('./updater')");
  
  if (!hasAutoUpdater) {
    errors.push('electron-updater not imported');
    console.log('  ❌ FAIL: electron-updater missing');
    allTestsPass = false;
  }
  if (!hasHealthCheck) {
    warnings.push('Health check system missing');
    console.log('  ⚠️  WARN: No health check');
  }
  if (!hasInitialization) {
    errors.push('Updater not initialized in main.js');
    console.log('  ❌ FAIL: Updater not initialized');
    allTestsPass = false;
  }
  
  if (hasAutoUpdater && hasInitialization) {
    console.log('  ✅ PASS: Update system configured');
  }
} catch (error) {
  errors.push('Cannot verify updater system');
  console.log(`  ❌ FAIL: ${error.message}`);
  allTestsPass = false;
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 TEST SUMMARY');
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

if (allTestsPass) {
  console.log('\n✅ ALL TESTS PASSED!\n');
  console.log('🎉 Your app is ready for release!');
  console.log('\nNext steps:');
  console.log('   1. Verify GH_TOKEN is configured in GitHub secrets');
  console.log('   2. Create and push a version tag:');
  
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log(`      git tag v${packageJson.version}`);
  console.log(`      git push origin v${packageJson.version}`);
  
  console.log('   3. Monitor GitHub Actions for build progress');
  console.log('   4. Test the installer from the release');
  console.log('\n📚 See AUTOMATIC-UPDATES-DOCUMENTATION.md for more info');
} else {
  console.log('\n❌ TESTS FAILED\n');
  console.log('🔧 Please fix the errors above before releasing.');
  console.log('   Some issues may require code changes.');
  console.log('   Run this script again after fixing.');
  process.exit(1);
}

console.log('\n' + '='.repeat(60));
