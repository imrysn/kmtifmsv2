const fs = require('fs').promises;
const path = require('path');
const { projectsDataPath } = require('../server/config/database');

async function test() {
  console.log('projectsDataPath:', projectsDataPath);
  const targetDir = path.join(projectsDataPath, 'team.leader', 'EFGH');
  console.log('Target directory path:', targetDir);
  
  try {
    await fs.mkdir(targetDir, { recursive: true });
    console.log('✅ Successfully created directory!');
  } catch (error) {
    console.error('❌ Failed to create directory:', error);
  }
  process.exit(0);
}

test();
