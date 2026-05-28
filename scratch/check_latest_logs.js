const fs = require('fs');
const path = require('path');

const combinedLogPath = path.join(__dirname, '..', 'logs', 'combined.log');
const appDataLogs = path.join(process.env.APPDATA || '', 'KMTI-File-Management', 'logs', 'combined.log');

function checkFile(logPath) {
  if (!fs.existsSync(logPath)) {
    console.log(`Not found: ${logPath}`);
    return;
  }
  console.log(`Checking ${logPath}...`);
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  const todayLines = lines.filter(l => l.includes('2026-05-28') && (l.includes('provision') || l.includes('assignment') || l.includes('folder') || l.includes('error') || l.includes('Error') || l.includes('Failed') || l.includes('failed')));
  console.log(`Found ${todayLines.length} matched lines from today.`);
  for (const line of todayLines) {
    console.log(line);
  }
}

checkFile(combinedLogPath);
checkFile(appDataLogs);
