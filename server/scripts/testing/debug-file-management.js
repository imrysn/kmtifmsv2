/* eslint-disable no-undef */
// Test file - fetch and global are provided by test environment
const axios = require('axios');
const fs = require('fs');
const path = require('path');

console.log('🔧 DEBUGGING File Management Network Issues\n');

async function debugNetworkIssues() {
  const baseURL = 'http://localhost:3001';

  console.log('🔍 Step 1: Test Basic Server Health');
  try {
    const response = await fetch(`${baseURL}/api/health`);
    const data = await response.json();
    console.log('✅ Server Status:', data.status);
  } catch (error) {
    console.log('❌ Server not responding:', error.message);
    return;
  }

  console.log('\n🔍 Step 2: Check Network Directory Info Endpoint');
  try {
    const response = await fetch(`${baseURL}/api/file-system/info`);
    console.log('Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('Raw Response:');
    console.log(responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''));

    // Try to parse as JSON
    try {
      const data = JSON.parse(responseText);
      console.log('✅ JSON Response:', data);
    } catch (jsonError) {
      console.log('❌ JSON Parse Error:', jsonError.message);
      console.log('🔍 Response appears to be HTML, likely an error page');
    }
  } catch (error) {
    console.log('❌ Network request failed:', error.message);
  }

  console.log('\n🔍 Step 3: Test File Browse Endpoint');
  try {
    const response = await fetch(`${baseURL}/api/file-system/browse?path=${encodeURIComponent('/')}`);
    console.log('Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('Raw Response:');
    console.log(responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''));

    // Try to parse as JSON
    try {
      const data = JSON.parse(responseText);
      console.log('✅ JSON Response:', data);
    } catch (jsonError) {
      console.log('❌ JSON Parse Error:', jsonError.message);
      console.log('🔍 Response appears to be HTML, likely an error page');
    }
  } catch (error) {
    console.log('❌ Network request failed:', error.message);
  }

  console.log('\n🔍 Step 4: Check Network Path Directly');
  const networkPath = '\\\\KMTI-NAS\\Shared\\Public\\PROJECTS';
  console.log('Testing network path:', networkPath);

  try {
    if (fs.existsSync(networkPath)) {
      console.log('✅ Network path exists');
      try {
        const stats = fs.statSync(networkPath);
        console.log('✅ Path is accessible');
        console.log('   Is Directory:', stats.isDirectory());
        console.log('   Modified:', stats.mtime.toISOString());
      } catch (statError) {
        console.log('❌ Cannot stat path:', statError.message);
      }
    } else {
      console.log('❌ Network path does not exist or is not accessible');
      console.log('💡 This could be due to:');
      console.log('   - VPN not connected');
      console.log('   - Network share not mounted');
      console.log('   - Insufficient permissions');
      console.log('   - Incorrect path format');
    }
  } catch (error) {
    console.log('❌ Error checking network path:', error.message);
    console.log('Error code:', error.code);
  }

  console.log('\n🔍 Step 5: Test Alternative Path Formats');
  const alternativePaths = [
    'KMTI-NAS\\Shared\\Public\\PROJECTS',
    '\\\\KMTI-NAS\\Shared\\Public',
    'Z:\\PROJECTS' // If mapped as drive letter
  ];

  alternativePaths.forEach(altPath => {
    try {
      if (fs.existsSync(altPath)) {
        console.log(`✅ Alternative path works: ${altPath}`);
      } else {
        console.log(`❌ Alternative path not accessible: ${altPath}`);
      }
    } catch (error) {
      console.log(`❌ Error with ${altPath}:`, error.message);
    }
  });

  console.log('\n📋 SUMMARY & RECOMMENDATIONS:');
  console.log('1. If network path is not accessible:');
  console.log('   - Check VPN connection');
  console.log('   - Verify \\\\KMTI-NAS\\Shared\\Public\\PROJECTS in Windows Explorer');
  console.log('   - Map network drive if needed');
  console.log('2. If API returns HTML instead of JSON:');
  console.log('   - Check server.js for route conflicts');
  console.log('   - Verify Express middleware order');
  console.log('   - Check for unhandled exceptions in endpoints');
  console.log('3. Check server console for error messages');
}

// Add fetch polyfill for Node.js if needed
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

debugNetworkIssues().catch(console.error);
