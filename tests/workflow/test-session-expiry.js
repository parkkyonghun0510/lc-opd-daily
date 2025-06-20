/**
 * Session Expiration Testing Script
 *
 * This script tests token expiration behavior.
 * Run with: node test-session-expiry.js
 *
 * Requirements:
 * - node-fetch: npm install node-fetch
 *
 * Add to package.json:
 * "type": "module"
 */

import fetch from "node-fetch";
import { setTimeout } from "timers/promises";

// Configuration
const BASE_URL = "http://localhost:3000"; // Change to your dev server URL
const TEST_CREDENTIALS = {
  username: "pheakdey", // Replace with valid test username
  password: "12345678", // Replace with valid test password
};

// For testing purposes, you should configure a short session lifetime
// in your NextAuth config: session: { maxAge: 60 } // 60 seconds

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
    // Get CSRF token
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
      },
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

async function testSessionExpiry() {
  //console.log("📝 Testing Session Expiration");
  //console.log("------------------------------------");

  // 1. Login and get token
  //console.log("\n1. Logging in to get session token:");
  const token = await login();

  if (!token) {
    console.error(
      "❌ Failed to get authentication token. Tests cannot continue.",
    );
    return;
  }

  //console.log("✅ Successfully obtained session token");

  // 2. Test with valid token immediately
  //console.log("\n2. Testing protected endpoint with fresh token:");
  const endpoint = "/api/users";
  let result = await testEndpoint(endpoint, token);

  //console.log(`Status: ${result.status} (${result.statusText})`);
  if (result.status >= 200 && result.status < 300) {
    //console.log("✅ Fresh token works as expected");
  } else {
    //console.log("❌ ISSUE: Fresh token was rejected!");
    return;
  }

  // 3. Wait for token to expire
  // Note: You should set the session maxAge to a small value (like 60 seconds)
  // in your NextAuth config for testing purposes
  const waitTime = 65; // seconds (slightly longer than expiry time)
  //console.log(`\n3. Waiting ${waitTime} seconds for token to expire...`);

  for (let i = 0; i < waitTime; i++) {
    process.stdout.write(".");
    await setTimeout(1000);
  }
  //console.log("\nWait complete!");

  // 4. Test with expired token
  //console.log("\n4. Testing protected endpoint with expired token:");
  result = await testEndpoint(endpoint, token);

  //console.log(`Status: ${result.status} (${result.statusText})`);
  if (result.status === 401) {
    //console.log("✅ Expired token correctly rejected");
  } else {
    //console.log("❌ SECURITY ISSUE: Expired token was accepted!");
  }

  // 5. Summary
  //console.log("\n5. Session Expiry Test Summary:");
  //console.log("------------------------------------");
  //console.log("Testing complete. Check the logs above for any issues.");
  //console.log(
  //  "Remember to reset your session maxAge to the appropriate value (e.g., 30 days) after testing."
  //);
}

// Run the tests
testSessionExpiry().catch(console.error);
