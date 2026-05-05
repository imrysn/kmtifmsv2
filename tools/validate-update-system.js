/**
 * Automatic Update System Validation Script
 * 
 * This script validates that all components of the update system
 * are properly configured and ready for production.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Automatic Update System...\n');

let allChecksPass = true;
const errors = [];
const warnings = [];

// Check 1: Required files exist
console.log('📁 Checking required files...');
const requiredFiles = [
  'updater.js',
  'preload.js',
  'main.js',
  'package.json',
  '.github/workflows/electron-release.yml',
  'client/src/components/updater/UpdateStatusBanner.jsx',
  'AUTOMATIC-UPDATES-DOCUMENTATION.md',
  'GITHUB-SECRETS-SETUP.md',
  'QUICK-START-UPDATES.md'
];

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - MISSING`);
    errors.push(`Missing required file: ${file}`);
    allChecksPass = false;
  }
});

// Check 2: package.json configuration
console.log('\n📦 Checking package.json configuration...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  // Check version format
  if (/^\d+\.\d+\.\d+$/.test(packageJson.version)) {
    console.log(`  ✅ Version format valid: ${packageJson.version}`);
  } else {
    console.log(`  ❌ Invalid version format: ${packageJson.version}`);
    errors.push('Version must follow semantic versioning (e.g., 2.0.0)');
    allChecksPass = false;
  }
  
  // Check electron-updater dependency
  if (packageJson.dependencies && packageJson.dependencies['electron-updater']) {
    console.log(`  ✅ electron-updater dependency found`);
  } else {
    console.log(`  ❌ electron-updater dependency missing`);
    errors.push('Add electron-updater to dependencies');
    allChecksPass = false;
  }
  
  // Check electron-log dependency
  if (packageJson.dependencies && packageJson.dependencies['electron-log']) {
    console.log(`  ✅ electron-log dependency found`);
  } else {
    console.log(`  ⚠️  electron-log dependency missing (optional but recommended)`);
    warnings.push('Consider adding electron-log for better logging');
  }
  
  // Check build configuration
  if (packageJson.build) {
    console.log(`  ✅ Build configuration present`);
    
    // Check publish configuration
    if (packageJson.build.publish && Array.isArray(packageJson.build.publish)) {
      const githubPublish = packageJson.build.publish.find(p => p.provider === 'github');
      if (githubPublish) {
        console.log(`  ✅ GitHub publish configuration found`);
        console.log(`     - Owner: ${githubPublish.owner}`);
        console.log(`     - Repo: ${githubPublish.repo}`);
      } else {
        console.log(`  ❌ GitHub publish configuration missing`);
        errors.push('Add GitHub publish configuration to package.json build section');
        allChecksPass = false;
      }
    } else {
      console.log(`  ❌ Publish configuration missing`);
      errors.push('Add publish configuration to package.json');
      allChecksPass = false;
    }
    
    // Check if updater.js is in files array
    if (packageJson.build.files && packageJson.build.files.includes('updater.js')) {
      console.log(`  ✅ updater.js included in build files`);
    } else {
      console.log(`  ❌ updater.js not in build files array`);
      errors.push('Add "updater.js" to build.files array in package.json');
      allChecksPass = false;
    }
  } else {
    console.log(`  ❌ Build configuration missing`);
    errors.push('Add build configuration to package.json');
    allChecksPass = false;
  }
} catch (error) {
  console.log(`  ❌ Error reading package.json: ${error.message}`);
  errors.push('Failed to parse package.json');
  allChecksPass = false;
}

// Check 3: GitHub workflow configuration
console.log('\n⚙️  Checking GitHub Actions workflow...');
try {
  const workflowPath = '.github/workflows/electron-release.yml';
  if (fs.existsSync(workflowPath)) {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    
    if (workflow.includes('GH_TOKEN')) {
      console.log(`  ✅ GH_TOKEN reference found in workflow`);
    } else {
      console.log(`  ❌ GH_TOKEN not referenced in workflow`);
      warnings.push('Workflow may not have access to GitHub token');
    }
    
    if (workflow.includes('npm run client:build')) {
      console.log(`  ✅ Client build step present`);
    } else {
      console.log(`  ❌ Client build step missing`);
      errors.push('Add client build step to workflow');
      allChecksPass = false;
    }
    
    if (workflow.includes('electron:pack') || workflow.includes('electron-builder')) {
      console.log(`  ✅ Electron packaging step present`);
    } else {
      console.log(`  ❌ Electron packaging step missing`);
      errors.push('Add electron packaging step to workflow');
      allChecksPass = false;
    }
  }
} catch (error) {
  console.log(`  ⚠️  Error reading workflow: ${error.message}`);
  warnings.push('Could not validate GitHub workflow');
}

// Check 4: Updater module configuration
console.log('\n🔄 Checking updater module...');
try {
  const updaterContent = fs.readFileSync('updater.js', 'utf8');
  
  if (updaterContent.includes('electron-updater')) {
    console.log(`  ✅ electron-updater imported`);
  } else {
    console.log(`  ❌ electron-updater not imported`);
    errors.push('Import electron-updater in updater.js');
    allChecksPass = false;
  }
  
  if (updaterContent.includes('autoUpdater.checkForUpdates')) {
    console.log(`  ✅ Update check logic present`);
  } else {
    console.log(`  ❌ Update check logic missing`);
    errors.push('Add update check logic to updater.js');
    allChecksPass = false;
  }
  
  if (updaterContent.includes('quitAndInstall')) {
    console.log(`  ✅ Install logic present`);
  } else {
    console.log(`  ❌ Install logic missing`);
    errors.push('Add install logic to updater.js');
    allChecksPass = false;
  }
  
  if (updaterContent.includes('runHealthCheck')) {
    console.log(`  ✅ Health check system present`);
  } else {
    console.log(`  ⚠️  Health check system missing`);
    warnings.push('Consider adding health check system');
  }
} catch (error) {
  console.log(`  ❌ Error reading updater.js: ${error.message}`);
  errors.push('Failed to read updater.js');
  allChecksPass = false;
}

// Check 5: Main process integration
console.log('\n🖥️  Checking main process integration...');
try {
  const mainContent = fs.readFileSync('main.js', 'utf8');
  
  if (mainContent.includes("require('./updater')")) {
    console.log(`  ✅ Updater module imported`);
  } else {
    console.log(`  ❌ Updater module not imported`);
    errors.push('Import updater in main.js');
    allChecksPass = false;
  }
  
  if (mainContent.includes('updater.setMainWindow') || mainContent.includes('updater.setSplashWindow')) {
    console.log(`  ✅ Window references registered with updater`);
  } else {
    console.log(`  ⚠️  Window references not registered`);
    warnings.push('Register window references with updater for IPC');
  }
  
  if (mainContent.includes('updater.checkStartupHealth')) {
    console.log(`  ✅ Health check on startup`);
  } else {
    console.log(`  ⚠️  No health check on startup`);
    warnings.push('Add health check on app startup');
  }
  
  if (mainContent.includes('updater.startPeriodicUpdateCheck')) {
    console.log(`  ✅ Periodic update checks configured`);
  } else {
    console.log(`  ❌ Periodic update checks not configured`);
    errors.push('Add periodic update check initialization');
    allChecksPass = false;
  }
} catch (error) {
  console.log(`  ❌ Error reading main.js: ${error.message}`);
  errors.push('Failed to read main.js');
  allChecksPass = false;
}

// Check 6: Preload script API
console.log('\n🔌 Checking preload API...');
try {
  const preloadContent = fs.readFileSync('preload.js', 'utf8');
  
  if (preloadContent.includes('window.updater') || preloadContent.includes("'updater'")) {
    console.log(`  ✅ Updater API exposed to renderer`);
  } else {
    console.log(`  ❌ Updater API not exposed`);
    errors.push('Expose updater API in preload.js');
    allChecksPass = false;
  }
  
  if (preloadContent.includes('onStatus')) {
    console.log(`  ✅ Status event listener API present`);
  } else {
    console.log(`  ❌ Status event listener missing`);
    errors.push('Add onStatus listener to updater API');
    allChecksPass = false;
  }
  
  if (preloadContent.includes('restartAndInstall')) {
    console.log(`  ✅ Install trigger API present`);
  } else {
    console.log(`  ❌ Install trigger missing`);
    errors.push('Add restartAndInstall to updater API');
    allChecksPass = false;
  }
} catch (error) {
  console.log(`  ❌ Error reading preload.js: ${error.message}`);
  errors.push('Failed to read preload.js');
  allChecksPass = false;
}

// Check 7: React UI component
console.log('\n🎨 Checking React UI component...');
try {
  const componentPath = 'client/src/components/updater/UpdateStatusBanner.jsx';
  if (fs.existsSync(componentPath)) {
    const componentContent = fs.readFileSync(componentPath, 'utf8');
    
    if (componentContent.includes('window.updater')) {
      console.log(`  ✅ Component uses updater API`);
    } else {
      console.log(`  ❌ Component doesn't use updater API`);
      errors.push('Connect UpdateStatusBanner to window.updater API');
      allChecksPass = false;
    }
    
    if (componentContent.includes('onStatus')) {
      console.log(`  ✅ Component listens to status events`);
    } else {
      console.log(`  ❌ Component doesn't listen to events`);
      errors.push('Add event listener in UpdateStatusBanner');
      allChecksPass = false;
    }
  }
  
  // Check if component is imported in App.jsx
  const appPath = 'client/src/App.jsx';
  if (fs.existsSync(appPath)) {
    const appContent = fs.readFileSync(appPath, 'utf8');
    if (appContent.includes('UpdateStatusBanner')) {
      console.log(`  ✅ Component imported in App.jsx`);
    } else {
      console.log(`  ❌ Component not imported in App.jsx`);
      errors.push('Import UpdateStatusBanner in App.jsx');
      allChecksPass = false;
    }
  }
} catch (error) {
  console.log(`  ⚠️  Error checking React component: ${error.message}`);
  warnings.push('Could not validate React UI component');
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 VALIDATION SUMMARY');
console.log('='.repeat(60));

if (errors.length > 0) {
  console.log('\n❌ ERRORS FOUND:');
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
  console.log('\n✅ ALL CHECKS PASSED!');
  console.log('\n🎉 Your automatic update system is properly configured!');
  console.log('\nNext steps:');
  console.log('   1. Run: npm install');
  console.log('   2. Setup GitHub token (see GITHUB-SECRETS-SETUP.md)');
  console.log('   3. Create a version tag: git tag v2.0.0 && git push origin v2.0.0');
  console.log('   4. Monitor GitHub Actions for build progress');
  console.log('\n📚 Documentation: QUICK-START-UPDATES.md');
} else {
  console.log('\n❌ VALIDATION FAILED');
  console.log('\n🔧 Please fix the errors above before proceeding.');
  console.log('📚 See documentation for help:');
  console.log('   - QUICK-START-UPDATES.md');
  console.log('   - AUTOMATIC-UPDATES-DOCUMENTATION.md');
  process.exit(1);
}

console.log('\n' + '='.repeat(60));
