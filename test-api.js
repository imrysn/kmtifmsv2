const http = require('http');

// Test the login endpoint
const testLogin = (loginType = 'user') => {
  const testCredentials = {
    user: { email: 'user@example.com', password: 'password123' },
    teamleader_user: { email: 'teamleader@example.com', password: 'password123' },
    teamleader_admin: { email: 'teamleader@example.com', password: 'password123' },
    admin: { email: 'admin@example.com', password: 'password123' }
  };
  
  let credentials;
  let testName;
  
  if (loginType === 'user') {
    credentials = testCredentials.user;
    testName = 'USER via user login';
  } else {
    credentials = testCredentials.admin;
    testName = 'ADMIN via admin login';
  }

  const postData = JSON.stringify({
    email: credentials.email,
    password: credentials.password,
    loginType: loginType
  });

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  console.log(`🧪 Testing ${testName}...`);

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      const response = JSON.parse(data);
      console.log(`${testName} Response:`, response);
      console.log('---\n');
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
  });

  req.write(postData);
  req.end();
};

// Test health endpoint first
const testHealth = () => {
  console.log('🏥 Testing health endpoint...');
  
  http.get('http://localhost:3001/api/health', (res) => {
    console.log(`Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Health Response:', JSON.parse(data));
      
      // If health check passes, test different login scenarios
      if (res.statusCode === 200) {
        console.log('\n📝 Testing Role-Based Authentication...');
        
        setTimeout(() => testLogin('user'), 1000);        // USER via user login
        setTimeout(() => testLogin('admin'), 2000);       // ADMIN via admin login
        
        // Test access violations
        setTimeout(() => {
          console.log('🧪 Testing ACCESS VIOLATIONS...');
          // Test USER trying admin login (should fail)
          const postData = JSON.stringify({
            email: 'user@example.com',
            password: 'password123',
            loginType: 'admin'
          });
          
          const req = http.request({
            hostname: 'localhost',
            port: 3001,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
              const response = JSON.parse(data);
              console.log('USER trying admin login (should fail):', response);
            });
          });
          req.write(postData);
          req.end();
        }, 3000);
        
        setTimeout(() => {
          // Test ADMIN trying user login (should fail)
          const postData = JSON.stringify({
            email: 'admin@example.com',
            password: 'password123',
            loginType: 'user'
          });
          
          const req = http.request({
            hostname: 'localhost',
            port: 3001,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
              const response = JSON.parse(data);
              console.log('ADMIN trying user login (should fail):', response);
            });
          });
          req.write(postData);
          req.end();
        }, 4000);
      }
    });
  }).on('error', (e) => {
    console.error(`Health check failed: ${e.message}`);
    console.log('Make sure the Express server is running on port 3001');
  });
};

// Start tests
testHealth();
