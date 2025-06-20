import fetch from "node-fetch";

const BASE_URL = "http://localhost:3000";

async function signIn(username, password) {
  try {
    //console.log(`Attempting to sign in as ${username}...`);

    // First, check account status
    const preCheckResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });

    if (!preCheckResponse.ok) {
      const error = await preCheckResponse.json();
      throw new Error(error.message || "Pre-check failed");
    }
    //console.log("Account pre-check passed");

    // Then attempt sign in with NextAuth
    const csrfResponse = await fetch(`${BASE_URL}/api/auth/csrf`);
    const { csrfToken } = await csrfResponse.json();

    const response = await fetch(`${BASE_URL}/api/auth/signin/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        csrfToken,
        redirect: false,
        callbackUrl: `${BASE_URL}/dashboard`,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Sign in failed: ${response.status} - ${response.statusText}`,
      );
    }

    // Get session token from cookies
    const cookies = response.headers.get("set-cookie");
    if (!cookies) {
      throw new Error("No authentication cookies received");
    }

    const sessionToken = cookies
      .split(";")
      .find((c) => c.trim().startsWith("next-auth.session-token="));

    if (!sessionToken) {
      throw new Error("Session token not found in cookies");
    }

    return sessionToken;
  } catch (error) {
    console.error(`Failed to sign in as ${username}:`, error);
    throw error;
  }
}

async function verifyAuth(sessionToken) {
  try {
    //console.log("Verifying authentication...");

    const response = await fetch(`${BASE_URL}/api/test/verify`, {
      headers: {
        Cookie: sessionToken,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Verification failed: ${response.status} - ${response.statusText}`,
      );
    }

    const data = await response.json();
    //console.log("Verification response:", JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error("Verification failed:", error);
    throw error;
  }
}

async function runTests() {
  try {
    // Test regular user
    //console.log("\n=== Testing Regular User Authentication ===");
    const userCookies = await signIn("test_regular", "Test@123");
    await verifyAuth(userCookies);

    // Test readonly user
    //console.log("\n=== Testing Readonly User Authentication ===");
    const readonlyCookies = await signIn("test_readonly", "Test@123");
    await verifyAuth(readonlyCookies);

    // Test invalid credentials
    //console.log("\n=== Testing Invalid Credentials ===");
    try {
      await signIn("invalid_user", "wrong_password");
    } catch (error) {
      //console.log("Expected error for invalid credentials:", error.message);
    }
  } catch (error) {
    console.error("\nTest suite failed:", error);
    process.exit(1);
  }
}

// Ensure the development server is running
fetch(`${BASE_URL}/api/health`)
  .then(() => {
    //console.log("Development server is running. Starting tests...\n");
    runTests();
  })
  .catch(() => {
    console.error(
      "Error: Development server is not running. Please start the server first.",
    );
    console.error("Run `npm run dev` to start the development server.");
    process.exit(1);
  });
