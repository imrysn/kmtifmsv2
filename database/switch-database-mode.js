// Switch Database Mode Script
// Helps toggle between SQLite and MySQL

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

const ENV_FILE = path.join(__dirname, '..', '.env');

async function switchDatabaseMode() {
  console.log('🔄 Database Mode Switcher\n');
  console.log('Current options:');
  console.log('1. MySQL (Recommended for production)');
  console.log('2. SQLite (Development/Legacy)\n');
  
  const choice = await question('Select database type (1 or 2): ');
  
  if (choice === '1') {
    // Switch to MySQL
    console.log('\n📊 Configuring MySQL...\n');
    
    const host = await question('MySQL Host (e.g., KMTI-NAS or localhost): ');
    const port = await question('MySQL Port [3306]: ') || '3306';
    const database = await question('Database Name [kmtifms]: ') || 'kmtifms';
    const user = await question('MySQL User [kmtifms_user]: ') || 'kmtifms_user';
    const password = await question('MySQL Password: ');
    
    const envContent = `# KMTIFMS2 Environment Configuration
# Database Mode: MySQL

# MySQL Configuration
USE_MYSQL=true
DB_HOST=${host}
DB_PORT=${port}
DB_NAME=${database}
DB_USER=${user}
DB_PASSWORD=${password}

# Server Configuration
NODE_ENV=production
SERVER_PORT=3001

# Generated: ${new Date().toISOString()}
`;
    
    fs.writeFileSync(ENV_FILE, envContent);
    
    console.log('\n✅ MySQL configuration saved to .env');
    console.log('\n📋 Next steps:');
    console.log('1. Ensure MySQL server is running');
    console.log('2. Initialize database: npm run db:init');
    console.log('3. Test connection: npm run db:test');
    console.log('4. Start server: npm run server:standalone\n');
    
  } else if (choice === '2') {
    // Switch to SQLite
    console.log('\n📁 Configuring SQLite...\n');
    
    const envContent = `# KMTIFMS2 Environment Configuration
# Database Mode: SQLite

# SQLite Configuration (Legacy)
USE_MYSQL=false

# Server Configuration
NODE_ENV=development
SERVER_PORT=3001

# Generated: ${new Date().toISOString()}

# Note: SQLite is not recommended for production with multiple concurrent users.
# Consider switching to MySQL for better performance and reliability.
`;
    
    fs.writeFileSync(ENV_FILE, envContent);
    
    console.log('✅ SQLite configuration saved to .env');
    console.log('\n⚠️  Warning: SQLite has limitations:');
    console.log('   • Limited to 1-2 concurrent users');
    console.log('   • Risk of corruption over network');
    console.log('   • Not recommended for production');
    console.log('\n📋 Next steps:');
    console.log('1. Start server: npm run server:standalone\n');
    
  } else {
    console.log('\n❌ Invalid choice. Please run the script again.\n');
  }
  
  rl.close();
}

// Check if .env already exists
if (fs.existsSync(ENV_FILE)) {
  question('\n⚠️  .env file already exists. Overwrite? (yes/no): ')
    .then(answer => {
      if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        return switchDatabaseMode();
      } else {
        console.log('\n❌ Operation cancelled. Existing .env preserved.\n');
        rl.close();
      }
    });
} else {
  switchDatabaseMode();
}
