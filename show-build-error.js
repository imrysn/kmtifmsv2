const { spawn } = require('child_process');

console.log('Running electron-builder with full output...\n');
console.log('='.repeat(60));

const child = spawn('npm', ['run', 'electron:pack'], {
  cwd: __dirname,
  shell: true
});

child.stdout.on('data', (data) => {
  process.stdout.write(data.toString());
});

child.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

child.on('close', (code) => {
  console.log('\n' + '='.repeat(60));
  if (code === 0) {
    console.log('✅ Build completed successfully!');
  } else {
    console.log(`❌ Build failed with exit code ${code}`);
  }
  process.exit(code);
});
