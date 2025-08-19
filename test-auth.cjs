#!/usr/bin/env node

/**
 * Authentication Test Script
 * 
 * This script tests authentication and gets a valid JWT token
 * for further testing of SSE and other protected endpoints.
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Simple cookie jar
const cookieMap = new Map();
function mergeCookies(newCookies = []) {
  newCookies.forEach((c) => {
    const [pair] = c.split(';');
    const [name, ...rest] = pair.split('=');
    const value = rest.join('=');
    if (name && value !== undefined) {
      cookieMap.set(name.trim(), value.trim());
    }
  });
}
function getCookieHeader() {
  return Array.from(cookieMap.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function makeRequest(url, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        const cookies = res.headers['set-cookie'] || [];
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: responseData,
          cookies: cookies
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testAuth() {
  console.log('=== Authentication Testing ===\n');

  try {
    // Step 1: Test session endpoint (should return null/empty)
    console.log('1. Testing session endpoint (before auth)...');
    const sessionBefore = await makeRequest(`${BASE_URL}/api/auth/session`);
    console.log(`Status: ${sessionBefore.status}`);
    console.log(`Response: ${sessionBefore.data}\n`);

    // Step 2: Test pre-authentication check
    console.log('2. Testing pre-authentication check...');
    const preAuthResponse = await makeRequest(`${BASE_URL}/api/auth/login`, 'POST', {
      username: 'admin'
    });
    console.log(`Status: ${preAuthResponse.status}`);
    console.log(`Response: ${preAuthResponse.data}\n`);

    // Step 3: Test CSRF token retrieval
    console.log('3. Getting CSRF token...');
    const csrfResponse = await makeRequest(`${BASE_URL}/api/auth/csrf`);
    console.log(`Status: ${csrfResponse.status}`);
    console.log(`Response: ${csrfResponse.data}`);
    // Merge CSRF cookies into jar
    mergeCookies(csrfResponse.cookies);
    
    let csrfToken = '';
    try {
      const csrfData = JSON.parse(csrfResponse.data);
      csrfToken = csrfData.csrfToken;
      console.log(`CSRF Token: ${csrfToken}\n`);
    } catch (e) {
      console.log('Could not parse CSRF response\n');
    }

    // Step 4: Attempt signin with admin credentials
    console.log('4. Attempting authentication...');
    const authData = new URLSearchParams({
      username: 'admin',
      password: 'password123',
      csrfToken: csrfToken,
      callbackUrl: `${BASE_URL}`,
      json: 'true'
    });

    const authResponse = await new Promise((resolve, reject) => {
      const urlObj = new URL(`${BASE_URL}/api/auth/callback/credentials`);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(authData.toString()),
          // Include CSRF cookies
          'Cookie': getCookieHeader()
        }
      };
      const req = http.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          const cookies = res.headers['set-cookie'] || [];
          resolve({ status: res.statusCode, headers: res.headers, data: responseData, cookies });
        });
      });
      req.on('error', reject);
      req.write(authData.toString());
      req.end();
    });

    console.log(`Auth Status: ${authResponse.status}`);
    console.log(`Auth Response: ${authResponse.data}`);
    console.log(`Auth Cookies: ${JSON.stringify(authResponse.cookies, null, 2)}\n`);
    // Merge auth cookies (session token)
    mergeCookies(authResponse.cookies);

    // Step 5: Check session after authentication
    console.log('5. Testing session after auth...');
    const sessionAfter = await makeRequest(`${BASE_URL}/api/auth/session`, 'GET', null, {
      'Cookie': getCookieHeader()
    });
    console.log(`Status: ${sessionAfter.status}`);
    console.log(`Response: ${sessionAfter.data}\n`);

    // Step 6: Test protected endpoint with session
    console.log('6. Testing protected SSE endpoint with session...');
    const sseResponse = await makeRequest(`${BASE_URL}/api/reports/updates`, 'GET', null, {
      'Cookie': getCookieHeader(),
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache'
    });
    console.log(`SSE Status: ${sseResponse.status}`);
    console.log(`SSE Headers: ${JSON.stringify(sseResponse.headers, null, 2)}`);
    console.log(`SSE Response: ${sseResponse.data.substring(0, 200)}...\n`);

  } catch (error) {
    console.error('Error during authentication test:', error);
  }
}

// Run the test
testAuth();