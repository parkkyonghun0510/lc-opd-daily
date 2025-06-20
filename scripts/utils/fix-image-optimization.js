// Script to check and fix image optimization issues

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("🔍 Checking image optimization configuration...");

// Check if sharp is installed correctly
try {
  const sharpVersion = execSync("npm list sharp").toString();
  console.log(`✅ Sharp is installed: ${sharpVersion.split("\n")[1]}`);
} catch (error) {
  console.error("❌ Sharp is not installed correctly");
  console.log("🔧 Installing sharp...");
  try {
    execSync("npm install sharp@latest --save-dev");
    console.log("✅ Sharp installed successfully");
  } catch (installError) {
    console.error("❌ Failed to install sharp:", installError.message);
  }
}

// Check Next.js version
try {
  const nextVersion = execSync("npm list next").toString();
  console.log(`✅ Next.js version: ${nextVersion.split("\n")[1]}`);
} catch (error) {
  console.error("❌ Could not determine Next.js version");
}

// Check if vips is installed in the system (for Docker environments)
if (process.platform === "linux") {
  try {
    execSync("which vips");
    console.log("✅ libvips is installed on the system");
  } catch (error) {
    console.log(
      "ℹ️ libvips is not installed on the system. This is required in Docker environments.",
    );
  }
}

// Check next.config.js for image optimization settings
const nextConfigPath = path.join(process.cwd(), "next.config.cjs");
if (fs.existsSync(nextConfigPath)) {
  const configContent = fs.readFileSync(nextConfigPath, "utf8");
  if (configContent.includes("images:")) {
    console.log("✅ Image configuration found in next.config.cjs");
  } else {
    console.log("⚠️ No image configuration found in next.config.cjs");
  }
} else {
  console.log("⚠️ next.config.cjs not found");
}

// Check for environment variables that might affect image optimization
if (process.env.NODE_ENV === "production") {
  console.log("✅ Running in production mode");
} else {
  console.log(`ℹ️ Running in ${process.env.NODE_ENV || "development"} mode`);
}

if (process.env.SHARP_IGNORE_GLOBAL_LIBVIPS) {
  console.log("✅ SHARP_IGNORE_GLOBAL_LIBVIPS is set");
} else {
  console.log(
    "⚠️ SHARP_IGNORE_GLOBAL_LIBVIPS is not set. This might be needed in Docker environments.",
  );
}

console.log("\n🔧 Image optimization check complete!");
console.log(
  "If you continue to experience issues, please check the Next.js documentation for image optimization:",
);
console.log(
  "https://nextjs.org/docs/pages/building-your-application/optimizing/images",
);
