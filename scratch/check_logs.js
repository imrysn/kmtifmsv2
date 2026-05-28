const fs = require('fs');
const path = require('path');

const combinedLogPath = path.join(__dirname, '..', 'logs', 'combined.log');
const errorLogPath = path.join(__dirname, '..', 'logs', 'error.log');

const appDataLogs = path.join(process.env.APPDATA || '', 'KMTI-File-Management', 'logs');
const appDataCombined = path.join(appDataLogs, 'combined.log');
const appDataError = path.join(appDataLogs, 'error.log');

function inspectLog(logPath, name) {
  if (!fs.existsSync(logPath)) {
    console.log(`${name} does not exist at ${logPath}`);
    return;
  }
  const lines = fs.readFileSync(logPath, 'utf8').split('\n');
  const recent = lines.slice(-200);
  console.log(`=== Recent ${name} lines from ${logPath} ===`);
  for (const line of recent) {
    if (line.trim()) {
      console.log(line);
    }
  }
}

inspectLog(combinedLogPath, 'local combined.log');
inspectLog(appDataCombined, 'appdata combined.log');
inspectLog(appDataError, 'appdata error.log');
