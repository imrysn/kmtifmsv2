/* eslint-disable no-undef */
// Test file - fetch and global are provided by test environment
const axios = require('axios');
const path = require('path');

console.log('🧪 Testing File Management Network Directory API\n');

async function testFileManagementAPI() {
  const baseURL = 'http://localhost:3001';

  console.log('🔍 Testing Network Directory Browsing API...\n');

  // Test 1: Check network directory info
  console.log('Test 1: Network Directory Info');
  try {
    const response = await fetch(`${baseURL}/api/file-system/info`);
    const data = await response.json();

    if (data.success) {
      console.log('✅ PASS - Network directory info retrieved');
      console.log(`   Accessible: ${data.accessible ? '✅' : '❌'}`);
      console.log(`   Path: ${data.path}`);
      console.log(`   Modified: ${data.modified || 'N/A'}`);
    } else {
      console.log('⚠️ WARNING - Network directory not accessible');
      console.log(`   Message: ${data.message}`);
    }
  } catch (error) {
    console.log('❌ FAIL - API request failed:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: Browse root directory
  console.log('Test 2: Browse Root Directory');
  try {
    const response = await fetch(`${baseURL}/api/file-system/browse?path=${encodeURIComponent('/')}`);
    const data = await response.json();

    if (data.success) {
      console.log('✅ PASS - Root directory browsed successfully');
      console.log(`   Items found: ${data.items.length}`);
      console.log(`   Network path: ${data.networkPath}`);

      if (data.items.length > 0) {
        console.log('\n   📁 Directory contents:');
        data.items.forEach(item => {
          const icon = item.type === 'folder' ? '📁' : '📄';
          const size = item.size ? ` (${item.size})` : '';
          const truncated = item.name !== item.displayName ? ' *' : '';
          console.log(`      ${icon} ${item.displayName}${truncated}${size}`);
        });
      }
    } else {
      console.log('❌ FAIL - Could not browse directory');
      console.log(`   Error: ${data.message}`);
      console.log(`   Error code: ${data.error || 'N/A'}`);
    }
  } catch (error) {
    console.log('❌ FAIL - API request failed:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: Test name truncation
  console.log('Test 3: Name Truncation Test');
  try {
    const response = await fetch(`${baseURL}/api/file-system/browse?path=${encodeURIComponent('/')}`);
    const data = await response.json();

    if (data.success) {
      const truncatedItems = data.items.filter(item => item.name !== item.displayName);

      if (truncatedItems.length > 0) {
        console.log('✅ PASS - Found truncated names (prevents UI misalignment)');
        truncatedItems.forEach(item => {
          console.log(`   Original: "${item.name}" (${item.name.length} chars)`);
          console.log(`   Display:  "${item.displayName}" (${item.displayName.length} chars)`);
        });
      } else {
        console.log('ℹ️  INFO - No items required name truncation');
      }

      // Check if any names are too long
      const longNames = data.items.filter(item => item.displayName.length > 50);
      if (longNames.length === 0) {
        console.log('✅ PASS - All display names are within 50 character limit');
      } else {
        console.log('❌ FAIL - Some display names exceed 50 characters');
        longNames.forEach(item => {
          console.log(`   "${item.displayName}" (${item.displayName.length} chars)`);
        });
      }
    } else {
      console.log('⚠️ SKIP - Cannot test truncation (directory not accessible)');
    }
  } catch (error) {
    console.log('❌ FAIL - API request failed:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 4: Test subdirectory navigation (if folders exist)
  console.log('Test 4: Subdirectory Navigation');
  try {
    const response = await fetch(`${baseURL}/api/file-system/browse?path=${encodeURIComponent('/')}`);
    const data = await response.json();

    if (data.success) {
      const folders = data.items.filter(item => item.type === 'folder' && !item.isParent);

      if (folders.length > 0) {
        const firstFolder = folders[0];
        console.log(`Testing navigation to: ${firstFolder.name}`);

        const subResponse = await fetch(`${baseURL}/api/file-system/browse?path=${encodeURIComponent(firstFolder.path)}`);
        const subData = await subResponse.json();

        if (subData.success) {
          console.log('✅ PASS - Subdirectory navigation successful');
          console.log(`   Items in "${firstFolder.name}": ${subData.items.length}`);

          // Check for parent directory (..)
          const hasParent = subData.items.some(item => item.isParent);
          if (hasParent) {
            console.log('✅ PASS - Parent directory (..) link present');
          } else {
            console.log('❌ FAIL - Parent directory (..) link missing');
          }
        } else {
          console.log('❌ FAIL - Could not browse subdirectory');
          console.log(`   Error: ${subData.message}`);
        }
      } else {
        console.log('ℹ️  SKIP - No folders found to test navigation');
      }
    } else {
      console.log('⚠️ SKIP - Cannot test navigation (root directory not accessible)');
    }
  } catch (error) {
    console.log('❌ FAIL - API request failed:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 5: Error handling
  console.log('Test 5: Error Handling');
  try {
    const response = await fetch(`${baseURL}/api/file-system/browse?path=${encodeURIComponent('/nonexistent-folder')}`);
    const data = await response.json();

    if (!data.success && response.status === 404) {
      console.log('✅ PASS - Properly handles non-existent directory (404)');
      console.log(`   Error message: ${data.message}`);
    } else if (data.success) {
      console.log('⚠️ UNEXPECTED - Non-existent directory returned success');
    } else {
      console.log('✅ PASS - Properly handles error');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${data.message}`);
    }
  } catch (error) {
    console.log('❌ FAIL - API request failed:', error.message);
  }

  console.log('\n📋 Test Summary Complete!');
  console.log('💡 If network directory is not accessible, check:');
  console.log('   - VPN connection (if remote)');
  console.log('   - Network share permissions');
  console.log('   - Path: \\\\KMTI-NAS\\Shared\\Public\\PROJECTS');
}

// Check if server is running
async function checkServerHealth() {
  try {
    const response = await fetch('http://localhost:3001/api/health');
    const data = await response.json();

    if (data.status === 'OK') {
      console.log('✅ Server is running - proceeding with tests...\n');
      return true;
    } else {
      console.log('❌ Server health check failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Cannot connect to server. Make sure it\'s running with: npm run dev');
    console.log('   Server should be accessible at: http://localhost:3001\n');
    return false;
  }
}

// Main execution
async function main() {
  const serverOk = await checkServerHealth();
  if (serverOk) {
    await testFileManagementAPI();
  }
}

// Add fetch polyfill for Node.js if needed
if (typeof fetch === 'undefined') {
  console.log('Installing fetch polyfill for Node.js...');
  global.fetch = require('node-fetch');
}

main().catch(console.error);
