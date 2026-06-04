const fs = require('fs');
const path = require('path');

const combinedLogPath = path.join(__dirname, '..', 'logs', 'combined.log');

if (fs.existsSync(combinedLogPath)) {
  const content = fs.readFileSync(combinedLogPath, 'utf8');
  const lines = content.split('\n');
  
  console.log('=== Lines containing "Creating": ===');
  lines.filter(l => l.toLowerCase().includes('creating')).forEach(l => console.log(l));
} else {
  console.log('combined.log not found.');
}
