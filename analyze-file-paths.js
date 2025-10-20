// Script to analyze file paths in database and print results
// This helps troubleshoot file deletion issues

const path = require('path');
const fs = require('fs').promises;
const { db, networkDataPath } = require('./database/config');

const uploadsDir = path.join(networkDataPath, 'uploads');

async function analyzeFilePaths() {
  console.log('🔍 Analyzing file paths in database...');
  console.log(`📁 Uploads directory: ${uploadsDir}`);
  
  try {
    // Get all files from the database
    const files = await db.query('SELECT id, filename, original_name, file_path, username FROM files LIMIT 100');
    
    console.log(`Found ${files.length} files in database`);
    
    let results = {
      total: files.length,
      directExists: 0,
      userDirExists: 0,
      notFound: 0,
      pathTypes: {
        absolute: 0,
        relative: 0,
        uploadsUrl: 0,
        other: 0
      },
      patterns: {}
    };
    
    for (const file of files) {
      if (!file.file_path) continue;
      
      // Analyze path type
      if (file.file_path.startsWith('/uploads/')) {
        results.pathTypes.uploadsUrl++;
      } else if (path.isAbsolute(file.file_path)) {
        results.pathTypes.absolute++;
      } else if (file.file_path.startsWith('./') || file.file_path.startsWith('../')) {
        results.pathTypes.relative++;
      } else {
        results.pathTypes.other++;
      }
      
      // Analyze path pattern
      const pathPattern = file.file_path.startsWith('/uploads/') 
        ? file.file_path.substring('/uploads/'.length).split('/').length > 1 
          ? 'uploads/subdirectory/filename' 
          : 'uploads/filename' 
        : 'other';
      
      if (!results.patterns[pathPattern]) {
        results.patterns[pathPattern] = 1;
      } else {
        results.patterns[pathPattern]++;
      }
      
      // Check file existence - direct in uploads directory
      const directPath = path.join(uploadsDir, path.basename(file.file_path));
      let directExists = false;
      try {
        await fs.access(directPath);
        directExists = true;
        results.directExists++;
      } catch (e) {
        // File not found
      }
      
      // Check file existence - in user directory
      const userDirPath = path.join(uploadsDir, file.username, path.basename(file.file_path));
      let userDirExists = false;
      try {
        await fs.access(userDirPath);
        userDirExists = true;
        results.userDirExists++;
      } catch (e) {
        // File not found
      }
      
      if (!directExists && !userDirExists) {
        results.notFound++;
      }
      
      // Print details for a few example files
      if (files.indexOf(file) < 10) { // Only print details for first 10 files
        console.log(`\n[File ${file.id}: ${file.original_name}]`);
        console.log(`  DB Path: ${file.file_path}`);
        console.log(`  Username: ${file.username}`);
        console.log(`  Direct path: ${directPath} (${directExists ? 'EXISTS' : 'NOT FOUND'})`);
        console.log(`  User directory path: ${userDirPath} (${userDirExists ? 'EXISTS' : 'NOT FOUND'})`);
      }
    }
    
    console.log('\n📊 Analysis Results:');
    console.log(`  Total files: ${results.total}`);
    console.log(`  Files found in root uploads dir: ${results.directExists}`);
    console.log(`  Files found in username subdir: ${results.userDirExists}`);
    console.log(`  Files not found: ${results.notFound}`);
    
    console.log('\n📊 Path Types:');
    for (const [type, count] of Object.entries(results.pathTypes)) {
      console.log(`  ${type}: ${count}`);
    }
    
    console.log('\n📊 Path Patterns:');
    for (const [pattern, count] of Object.entries(results.patterns)) {
      console.log(`  ${pattern}: ${count}`);
    }
    
    console.log('\n🔍 Based on this analysis:');
    if (results.userDirExists > 0 && results.directExists === 0) {
      console.log('  ✓ Files appear to be stored ONLY in username subdirectories');
      console.log('  ✓ File deletion should look in username subdirectories first');
    } else if (results.directExists > 0 && results.userDirExists === 0) {
      console.log('  ✓ Files appear to be stored ONLY in the root uploads directory');
      console.log('  ✓ File deletion should look in the root uploads directory');
    } else {
      console.log('  ⚠️ Files appear to be stored in BOTH root uploads and username subdirectories');
      console.log('  ⚠️ File deletion should check both locations');
    }
  } catch (error) {
    console.error('❌ Error analyzing file paths:', error);
  } finally {
    // Close the database connection
    await db.end();
  }
}

// Run the analysis
analyzeFilePaths().catch(console.error);
