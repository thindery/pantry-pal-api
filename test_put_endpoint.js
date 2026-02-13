#!/usr/bin/env node
/**
 * Quick test script for PUT /api/items/:id endpoint
 * Tests whether quantity updates are persisting
 */

const http = require('http');

const PORT = 3001;
const HOST = 'localhost';

// Helper to make HTTP requests
function request(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test the PUT endpoint
async function testPutEndpoint() {
  console.log('=== Testing PUT /api/items/:id Endpoint ===\n');

  // 1. Check server health first
  console.log('1. Checking server health...');
  try {
    const health = await request('GET', '/health');
    console.log(`   Status: ${health.status}`);
    console.log(`   Response:`, health.data);
  } catch (err) {
    console.error('   ❌ Server not running. Please start with: npm run dev');
    console.error('   Error:', err.message);
    process.exit(1);
  }

  // Note: We need auth token for the actual tests
  console.log('\n2. To fully test the PUT endpoint, you need:');
  console.log('   - A valid Clerk JWT token');
  console.log('   - The server running (npm run dev)');
  console.log('   - The userId from the token');
  console.log('\n   With valid token, test would do:');
  console.log('   a) POST /api/items - create test item');
  console.log('   b) PUT /api/items/:id - update quantity');
  console.log('   c) GET /api/items/:id - verify persistence');

  console.log('\n=== Recommendations for Frontend Team ===');
  console.log('');
  console.log('The API code has been instrumented with debug logging.');
  console.log('When testing:');
  console.log('1. Watch the server console for these log messages:');
  console.log('   "[PUT /api/items/:id] Request received:"');
  console.log('   "[PUT /api/items/:id] Calling updateItem with:"');
  console.log('   "[DB] updateItem: userId=X, id=Y, changes=Z"');
  console.log('');
  console.log('2. If you DON\'T see these logs:');
  console.log('   - The PUT request isn\'t reaching the server');
  console.log('   - Check CORS, auth middleware, or frontend request');
  console.log('');
  console.log('3. If you see the logs but quantity still not persisting:');
  console.log('   - Check the "changes" count - if 0, the update didn\'t affect rows');
  console.log('   - Verify userId consistency between POST and PUT');
  console.log('   - Check if the item exists before PUT');
  console.log('');

  return true;
}

testPutEndpoint().catch(console.error);
