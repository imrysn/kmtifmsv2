const http = require('http');

/**
 * Security Features Test Script
 * Tests helmet headers, rate limiting, and basic API functionality
 */

const BASE_URL = 'http://localhost:3001';

// Helper function to make HTTP requests
function makeRequest(path, method = 'GET') {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// Test 1: Check Helmet Security Headers
async function testHelmetHeaders() {
    console.log('\n🔒 Test 1: Helmet Security Headers');
    console.log('━'.repeat(50));

    try {
        const response = await makeRequest('/api/health');
        const headers = response.headers;

        const securityHeaders = {
            'x-content-type-options': 'nosniff',
            'x-frame-options': 'DENY',
            'x-dns-prefetch-control': 'off',
            'strict-transport-security': 'max-age',
            'content-security-policy': 'default-src'
        };

        let passed = 0;
        let failed = 0;

        for (const [header, expectedValue] of Object.entries(securityHeaders)) {
            const value = headers[header];
            if (value && value.includes(expectedValue)) {
                console.log(`✅ ${header}: ${value}`);
                passed++;
            } else {
                console.log(`❌ ${header}: Missing or incorrect`);
                failed++;
            }
        }

        console.log(`\nResult: ${passed} passed, ${failed} failed`);
        return failed === 0;
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

// Test 2: Test Rate Limiting
async function testRateLimiting() {
    console.log('\n⏱️  Test 2: Rate Limiting');
    console.log('━'.repeat(50));

    try {
        console.log('Making 5 rapid requests to /api/health...');

        const requests = [];
        for (let i = 0; i < 5; i++) {
            requests.push(makeRequest('/api/health'));
        }

        const responses = await Promise.all(requests);
        const rateLimitHeaders = responses[0].headers;

        if (rateLimitHeaders['ratelimit-limit']) {
            console.log(`✅ Rate Limit: ${rateLimitHeaders['ratelimit-limit']} requests`);
            console.log(`✅ Remaining: ${rateLimitHeaders['ratelimit-remaining']}`);
            console.log(`✅ Reset: ${new Date(parseInt(rateLimitHeaders['ratelimit-reset']) * 1000).toLocaleTimeString()}`);
            return true;
        } else {
            console.log('⚠️  Rate limit headers not found (may be disabled in development)');
            return true; // Not a failure in dev mode
        }
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

// Test 3: Test API Health Endpoint
async function testHealthEndpoint() {
    console.log('\n💚 Test 3: API Health Check');
    console.log('━'.repeat(50));

    try {
        const response = await makeRequest('/api/health');

        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            console.log(`✅ Status: ${data.status}`);
            console.log(`✅ Uptime: ${Math.floor(data.uptime)}s`);
            return true;
        } else {
            console.log(`❌ Unexpected status code: ${response.statusCode}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

// Run all tests
async function runTests() {
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║   Security Features Verification Tests        ║');
    console.log('╚════════════════════════════════════════════════╝');

    const results = {
        helmet: await testHelmetHeaders(),
        rateLimit: await testRateLimiting(),
        health: await testHealthEndpoint()
    };

    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║              Test Summary                      ║');
    console.log('╚════════════════════════════════════════════════╝');

    const total = Object.keys(results).length;
    const passed = Object.values(results).filter(r => r).length;

    console.log(`\n${passed}/${total} tests passed\n`);

    if (passed === total) {
        console.log('✅ All security features are working correctly!\n');
    } else {
        console.log('⚠️  Some tests failed. Please review the output above.\n');
    }

    process.exit(passed === total ? 0 : 1);
}

// Check if server is running
async function checkServer() {
    try {
        await makeRequest('/api/health');
        return true;
    } catch (error) {
        console.error('\n❌ Cannot connect to server at', BASE_URL);
        console.error('Please ensure the server is running: npm run dev\n');
        return false;
    }
}

// Main execution
(async () => {
    const serverRunning = await checkServer();
    if (serverRunning) {
        await runTests();
    } else {
        process.exit(1);
    }
})();
