const { execSync } = require('child_process');

console.log('Running electron:pack to see detailed error...\n');

try {
  const output = execSync('npm run electron:pack', { 
    cwd: __dirname,
    stdio: 'pipe',
    encoding: 'utf8'
  });
  console.log(output);
} catch (error) {
  console.error('STDOUT:', error.stdout);
  console.error('\nSTDERR:', error.stderr);
  console.error('\nError:', error.message);
}
