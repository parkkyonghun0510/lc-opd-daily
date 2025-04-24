/**
 * Authentication API Testing Script
 *
 * This script tests the authentication aspects of your API routes.
 * Run with: node test-auth-api.js
 *
 * Requirements:
 * - node-fetch: npm install node-fetch
 *
 * Add to package.json:
 * "type": "module"
 */

import fetch from "node-fetch";

// Configuration
const BASE_URL = "http://localhost:3000"; // Change to your dev server URL
const TEST_CREDENTIALS = {
  username: "pheakdey", // Replace with valid test username
  password: "12345678", // Replace with valid test password
};

// Test helper functions
async function testEndpoint(url, token = null) {
  try {
    const headers = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Cookie"] = `next-auth.session-token=${token}`;
    }

    const response = await fetch(`${BASE_URL}${url}`, {
      method: "GET",
      headers,
    });

    return {
      status: response.status,
      statusText: response.statusText,
      body: await response.json().catch(() => null),
    };
  } catch (error) {
    console.error(`Error testing ${url}:`, error.message);
    return { error: error.message };
  }
}

async function login() {
  try {
    // Get CSRF token (if needed)
    const csrfResponse = await fetch(`${BASE_URL}/api/auth/csrf`);
    const { csrfToken } = await csrfResponse.json();

    // Login using credentials
    const loginResponse = await fetch(
      `${BASE_URL}/api/auth/callback/credentials`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...TEST_CREDENTIALS,
          csrfToken,
          callbackUrl: `${BASE_URL}/dashboard`,
        }),
      }
    );

    // Get session token from cookies
    const cookies = loginResponse.headers.get("set-cookie");
    if (!cookies) return null;

    const sessionToken = cookies
      .split(";")
      .find((c) => c.trim().startsWith("next-auth.session-token="));

    return sessionToken ? sessionToken.split("=")[1] : null;
  } catch (error) {
    console.error("Login error:", error.message);
    return null;
  }
}

// Main test runner
async function runTests() {
  //console.log("🔒 Starting API Authentication Tests");
  //console.log("------------------------------------");

  // 1. Test protected endpoints without auth
  //console.log("\n1. Testing protected endpoints WITHOUT authentication:");
  //console.log("----------------------------------------------------");

  const endpointsToTest = [
    "/api/users",
    "/api/branches",
    "/api/reports/pending",
    "/api/reports/consolidated",
  ];

  for (const endpoint of endpointsToTest) {
    //console.log(`\nTesting ${endpoint}:`);
    const result = await testEndpoint(endpoint);
    //console.log(`Status: ${result.status} (${result.statusText})`);
    //console.log(
      "Response:",
      result.body
        ? JSON.stringify(result.body).slice(0, 100) + "..."
        : "No body"
    );

    // Verify unauthorized response
    if (result.status === 401) {
      //console.log("✅ Correctly rejected unauthorized request");
    } else {
      //console.log(
        "❌ SECURITY ISSUE: Endpoint accessible without authentication!"
      );
    }
  }

  // 2. Login and get token
  //console.log("\n\n2. Attempting login to get authentication token:");
  //console.log("----------------------------------------------------");
  const token = await login();

  if (!token) {
    console.error(
      "❌ Failed to get authentication token. Tests cannot continue."
    );
    return;
  }

  //console.log("✅ Successfully obtained authentication token");

  // 3. Test with valid token
  //console.log("\n\n3. Testing protected endpoints WITH authentication:");
  //console.log("----------------------------------------------------");

  for (const endpoint of endpointsToTest) {
    //console.log(`\nTesting ${endpoint}:`);
    const result = await testEndpoint(endpoint, token);
    //console.log(`Status: ${result.status} (${result.statusText})`);
    //console.log(
      "Response:",
      result.body
        ? JSON.stringify(result.body).slice(0, 100) + "..."
        : "No body"
    );

    // Verify authorized response
    if (result.status >= 200 && result.status < 300) {
      //console.log("✅ Correctly allowed authenticated request");
    } else {
      //console.log("❌ ISSUE: Endpoint rejected authenticated request!");
    }
  }

  //console.log("\n\n4. Summary:");
  //console.log("----------------------------------------------------");
  //console.log("All tests completed. Check the logs above for any issues.");
  //console.log("Remember to also test role-based access control manually.");
}

// Run the tests
runTests().catch(console.error);
