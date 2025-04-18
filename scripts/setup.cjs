#!/usr/bin/env node

// System Setup Script
// This script helps set up the Daily Reports System with an admin user and default branches

const { execSync } = require("child_process");
const readline = require("readline");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

// CLI Interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Prompt for input
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Mask password input
async function promptPassword(question) {
  //console.log(question);
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const old = stdin.isTTY && stdin.setRawMode(true);
    let password = "";

    const listener = (c) => {
      const char = c.toString();

      // On Enter
      if (char === "\r" || char === "\n") {
        stdin.removeListener("data", listener);
        stdin.isTTY && stdin.setRawMode(old);
        //console.log("");
        resolve(password);
      }
      // On backspace
      else if (char === "\b" || char === "\x7F") {
        if (password.length > 0) {
          process.stdout.write("\b \b");
          password = password.slice(0, -1);
        }
      }
      // On Ctrl+C
      else if (char === "\u0003") {
        process.exit(1);
      }
      // On other characters
      else {
        process.stdout.write("*");
        password += char;
      }
    };

    stdin.on("data", listener);
  });
}

// Generate setup key
function generateSetupKey() {
  return crypto.randomBytes(16).toString("hex");
}

// Write setup key to .env file
function writeSetupKeyToEnv(setupKey) {
  const envPath = path.join(process.cwd(), ".env");
  let envContent = "";

  // Read existing .env file if it exists
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
  }

  // Check if SETUP_SECRET_KEY already exists in the file
  if (envContent.includes("SETUP_SECRET_KEY=")) {
    // Replace existing key
    envContent = envContent.replace(
      /SETUP_SECRET_KEY=.*\n?/,
      `SETUP_SECRET_KEY=${setupKey}\n`
    );
  } else {
    // Add new key
    envContent += `\nSETUP_SECRET_KEY=${setupKey}\n`;
  }

  // Write to .env file
  fs.writeFileSync(envPath, envContent);

  return setupKey;
}

// Main setup function
async function setupSystem() {
  //console.log("\n🚀 Daily Reports System - Setup Script\n");

  try {
    // Generate setup key
    const setupKey = generateSetupKey();

    // Write setup key to .env file
    writeSetupKeyToEnv(setupKey);
    //console.log("✅ Setup key generated and added to .env file");

    // Get admin details
    //console.log("\n--- Admin User Details ---");
    const adminUsername = await prompt("Username: ");
    const adminName = await prompt("Full Name: ");
    const adminEmail = await prompt("Email: ");
    const adminPassword = await promptPassword("Password: ");
    const confirmPassword = await promptPassword("Confirm Password: ");

    if (adminPassword !== confirmPassword) {
      console.error("❌ Passwords do not match. Please try again.");
      process.exit(1);
    }

    // Ask about default branches
    const createDefaultBranchesInput = await prompt(
      "Create default branches (HQ, BR01, BR02)? (Y/n): "
    );
    const createDefaultBranches =
      createDefaultBranchesInput.toLowerCase() !== "n";

    // Prepare setup data
    const setupData = {
      adminUsername,
      adminName,
      adminEmail,
      adminPassword,
      secretKey: setupKey,
      createDefaultBranches,
    };

    //console.log("\n🔄 Setting up the system...");

    // Call setup API endpoint using dynamic import for node-fetch
    const { default: fetch } = await import("node-fetch");
    const serverUrl = "http://localhost:3000";
    const response = await fetch(`${serverUrl}/api/setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(setupData),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to set up system");
    }

    //console.log("\n✅ System setup completed successfully!");
    //console.log(`\n👤 Admin user "${adminUsername}" has been created.`);

    if (createDefaultBranches) {
      //console.log(
        `\n🏢 Default branches have been created: ${result.branches
          .map((b) => b.code)
          .join(", ")}`
      );
    }

    //console.log("\n📝 You can now log in using your admin credentials.");
    //console.log(
      `\n🔒 For security, please delete the setup key from your .env file after setup.`
    );
  } catch (error) {
    console.error(`\n❌ Setup failed: ${error.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run setup
setupSystem();
