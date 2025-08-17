#!/usr/bin/env node

// Railway Deployment Validation Script
// This script validates that all Railway deployment fixes are properly configured

const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();

console.log('🚂 Railway Deployment Validation');
console.log('================================');

// Check 1: Verify ecosystem.production.config.cjs uses relative paths
function checkEcosystemConfig() {
  const configPath = path.join(projectRoot, 'ecosystem.production.config.cjs');
  
  if (!fs.existsSync(configPath)) {
    console.log('❌ ecosystem.production.config.cjs not found');
    return false;
  }
  
  const configContent = fs.readFileSync(configPath, 'utf8');
  
  // Check for relative paths (should use "." not "/app")
  if (configContent.includes('cwd: "/app"')) {
    console.log('❌ ecosystem.production.config.cjs still uses absolute paths');
    console.log('   Fix: Change cwd: "/app" to cwd: "."');
    return false;
  }
  
  if (configContent.includes('cwd: "."')) {
    console.log('✅ ecosystem.production.config.cjs uses relative paths');
  } else {
    console.log('⚠️  ecosystem.production.config.cjs cwd not found');
  }
  
  // Check for NODE_ENV configuration
  if (configContent.includes('NODE_ENV: "production"')) {
    console.log('✅ NODE_ENV properly set to production');
  } else {
    console.log('❌ NODE_ENV not properly configured');
    return false;
  }
  
  return true;
}

// Check 2: Verify Dockerfile uses proper startup configuration
function checkDockerfile() {
  const dockerfilePath = path.join(projectRoot, 'Dockerfile');
  
  if (!fs.existsSync(dockerfilePath)) {
    console.log('❌ Dockerfile not found');
    return false;
  }
  
  const dockerContent = fs.readFileSync(dockerfilePath, 'utf8');
  
  if (dockerContent.includes('./scripts/start-pm2.sh')) {
    console.log('✅ Dockerfile uses PM2 startup script');
    return true;
  } else if (dockerContent.includes('CMD ["pm2-runtime", "start", "ecosystem.production.config.cjs"]')) {
    console.log('⚠️  Dockerfile uses direct PM2 config (consider using startup script)');
    return true;
  } else if (dockerContent.includes('CMD ["pm2-runtime", "start", "/app/ecosystem.production.config.cjs"]')) {
    console.log('❌ Dockerfile still uses absolute path');
    console.log('   Fix: Change to "ecosystem.production.config.cjs" or use "./scripts/start-pm2.sh"');
    return false;
  } else {
    console.log('❌ Dockerfile does not use proper PM2 configuration');
    console.log('   Expected: "./scripts/start-pm2.sh" or "ecosystem.production.config.cjs"');
    return false;
  }
}

// Check 3: Verify railway.json configuration
function checkRailwayConfig() {
  const railwayPath = path.join(projectRoot, 'railway.json');
  
  if (!fs.existsSync(railwayPath)) {
    console.log('❌ railway.json not found');
    return false;
  }
  
  const railwayContent = fs.readFileSync(railwayPath, 'utf8');
  const config = JSON.parse(railwayContent);
  
  if (config.deploy?.startCommand?.includes('./scripts/start-pm2.sh')) {
    console.log('✅ railway.json uses PM2 startup script');
  } else {
    console.log('❌ railway.json does not use PM2 startup script');
    console.log('   Expected: "./scripts/start-pm2.sh"');
    console.log('   Found:', config.deploy?.startCommand);
    return false;
  }
  
  if (config.deploy?.healthcheckPath === '/api/health') {
    console.log('✅ railway.json health check configured');
  } else {
    console.log('⚠️  railway.json health check not configured');
  }
  
  return true;
}

// Check 5: Verify PM2 startup script
function checkStartupScript() {
  const scriptPath = path.join(projectRoot, 'scripts/start-pm2.sh');
  
  if (!fs.existsSync(scriptPath)) {
    console.log('❌ PM2 startup script not found');
    return false;
  }
  
  const scriptContent = fs.readFileSync(scriptPath, 'utf8');
  
  if (scriptContent.includes('ecosystem.production.config.cjs')) {
    console.log('✅ Startup script references ecosystem config');
  } else {
    console.log('❌ Startup script does not reference ecosystem config');
    return false;
  }
  
  // Check if script is executable
  try {
    const stats = fs.statSync(scriptPath);
    const isExecutable = !!(stats.mode & parseInt('111', 8));
    if (isExecutable) {
      console.log('✅ Startup script is executable');
    } else {
      console.log('❌ Startup script is not executable');
      console.log('   Fix: Run chmod +x scripts/start-pm2.sh');
      return false;
    }
  } catch (error) {
    console.log('⚠️  Could not check script permissions');
  }
  
  return true;
}

// Check 4: Verify worker script improvements
function checkWorkerScript() {
  const workerPath = path.join(projectRoot, 'scripts/redis-standalone-worker-docker.js');
  
  if (!fs.existsSync(workerPath)) {
    console.log('❌ Worker script not found');
    return false;
  }
  
  const workerContent = fs.readFileSync(workerPath, 'utf8');
  
  if (workerContent.includes('async function initializeWorker()')) {
    console.log('✅ Worker script has Railway initialization');
  } else {
    console.log('❌ Worker script missing Railway initialization');
    return false;
  }
  
  if (workerContent.includes('redisConnected')) {
    console.log('✅ Worker script has Redis connection tracking');
  } else {
    console.log('❌ Worker script missing Redis connection tracking');
    return false;
  }
  
  if (workerContent.includes('NODE_ENV') && workerContent.includes('production')) {
    console.log('✅ Worker script handles NODE_ENV validation');
  } else {
    console.log('⚠️  Worker script NODE_ENV handling not found');
  }
  
  // Check for ES module usage
  if (workerContent.includes('import ') && workerContent.includes('from ')) {
    console.log('⚠️  Worker script uses ES modules');
    console.log('   Ensure package.json has "type": "module" or use .mjs extension');
    
    // Check if package.json has module type
    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageContent = fs.readFileSync(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      if (packageJson.type === 'module') {
        console.log('✅ Package.json configured for ES modules');
      } else {
        console.log('⚠️  Package.json not configured for ES modules');
        console.log('   Worker may fail in Docker container');
      }
    }
  }
  
  return true;
}

// Check 6: Next.js build configuration
function checkNextJSConfig() {
  const nextConfigPath = path.join(projectRoot, 'next.config.cjs');
  
  if (!fs.existsSync(nextConfigPath)) {
    console.log('❌ next.config.cjs not found');
    return false;
  }
  
  const configContent = fs.readFileSync(nextConfigPath, 'utf8');
  
  // Check for standalone output configuration
  if (configContent.includes('output: "standalone"')) {
    console.log('✅ Next.js configured for standalone output');
  } else {
    console.log('❌ Next.js not configured for standalone output');
    console.log('   Fix: Add output: "standalone" to next.config.cjs');
    return false;
  }
  
  // Check for experimental features that might cause build issues
  if (configContent.includes('experimental')) {
    console.log('⚠️  Experimental features detected - monitor for build issues');
  }
  
  return true;
}

// Check 7: PWA and Service Worker configuration
function checkPWAConfig() {
  const manifestPath = path.join(projectRoot, 'public/manifest.json');
  const swPath = path.join(projectRoot, 'public/service-worker.js');
  
  let hasIssues = false;
  
  if (fs.existsSync(manifestPath)) {
    console.log('✅ PWA manifest found');
    
    // Check for VAPID keys in environment
    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageContent = fs.readFileSync(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      
      if (packageContent.includes('web-push') || packageContent.includes('vapid')) {
        console.log('⚠️  PWA push notifications detected');
        console.log('   Ensure VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are set in Railway');
        console.log('   Or disable push notifications to avoid warnings');
      }
    }
  } else {
    console.log('ℹ️  No PWA manifest found (optional)');
  }
  
  if (fs.existsSync(swPath)) {
    console.log('✅ Service worker found');
  } else {
    console.log('ℹ️  No service worker found (optional)');
  }
  
  return !hasIssues;
}

// Check 8: Build output validation
function checkBuildOutput() {
  const nextDir = path.join(projectRoot, '.next');
  const standaloneDir = path.join(projectRoot, '.next/standalone');
  
  if (!fs.existsSync(nextDir)) {
    console.log('⚠️  .next directory not found (run build first)');
    return true; // Not an error, just informational
  }
  
  if (fs.existsSync(standaloneDir)) {
    console.log('✅ Standalone build output exists');
    
    // Check for common missing files that cause deployment issues
    const serverDir = path.join(standaloneDir, '.next/server');
    if (fs.existsSync(serverDir)) {
      console.log('✅ Server directory exists in standalone build');
    } else {
      console.log('❌ Server directory missing in standalone build');
      return false;
    }
  } else {
    console.log('⚠️  Standalone build directory not found');
    console.log('   Run: npm run build to generate standalone output');
  }
  
  return true;
}

// Check 9: Redis and monitoring configuration
function checkRedisConfig() {
  // Check for Redis-related files and configurations
  const redisLibPath = path.join(projectRoot, 'src/lib/redis.ts');
  const monitoringPath = path.join(projectRoot, 'src/lib/monitoring');
  
  if (fs.existsSync(redisLibPath)) {
    const redisContent = fs.readFileSync(redisLibPath, 'utf8');
    
    if (redisContent.includes('fallback') || redisContent.includes('in-memory')) {
      console.log('✅ Redis has fallback configuration');
    } else {
      console.log('⚠️  Redis may not have proper fallback handling');
      console.log('   Consider adding in-memory fallback for development');
    }
  }
  
  if (fs.existsSync(monitoringPath)) {
    console.log('✅ Monitoring configuration found');
  }
  
  return true;
}

// Check 10: Environment variables guidance
function checkEnvironmentVariables() {
  console.log('\n📋 Required Environment Variables for Railway:');
  console.log('   (These must be set in Railway dashboard)');
  
  const requiredVars = [
    'NODE_ENV=production',
    'DATABASE_URL=<your-database-url>',
    'NEXTAUTH_SECRET=<your-secret>',
    'NEXTAUTH_URL=<your-app-url>',
    'DRAGONFLY_HOST=<redis-host>',
    'DRAGONFLY_PORT=<redis-port>',
    'DRAGONFLY_USER=<redis-user>',
    'DRAGONFLY_PASSWORD=<redis-password>'
  ];
  
  const optionalVars = [
    'VAPID_PUBLIC_KEY=<vapid-public-key>',
    'VAPID_PRIVATE_KEY=<vapid-private-key>',
    'TELEGRAM_BOT_TOKEN=<telegram-token>',
    'TELEGRAM_CHAT_ID=<telegram-chat-id>'
  ];
  
  console.log('\n   Required:');
  requiredVars.forEach(varName => {
    console.log(`   • ${varName}`);
  });
  
  console.log('\n   Optional (to avoid warnings):');
  optionalVars.forEach(varName => {
    console.log(`   • ${varName}`);
  });
  
  console.log('\n⚠️  Make sure NODE_ENV is set to exactly "production"');
  console.log('   Non-standard values will cause Next.js warnings');
  console.log('\n⚠️  Set VAPID keys or disable push notifications to avoid PWA warnings');
  console.log('   Set Redis credentials or expect in-memory fallback warnings');
  
  return true;
}

// Check 11: Docker container compatibility
function checkDockerCompatibility() {
  console.log('\n🐳 Checking Docker Container Compatibility:');
  
  // Check if bash is available (required for start-pm2.sh)
  try {
    const { execSync } = require('child_process');
    execSync('which bash', { stdio: 'pipe' });
    console.log('✅ Bash interpreter available');
  } catch (error) {
    console.log('❌ Bash interpreter not found');
    console.log('   This could cause "No such file or directory" errors in containers');
    return false;
  }
  
  // Check startup script format
  const startupScript = path.join(projectRoot, 'scripts/start-pm2.sh');
  if (fs.existsSync(startupScript)) {
    const scriptContent = fs.readFileSync(startupScript, 'utf8');
    
    // Check shebang
    if (scriptContent.startsWith('#!/bin/bash')) {
      console.log('✅ Startup script has correct shebang');
    } else {
      console.log('❌ Startup script missing or incorrect shebang');
      console.log('   Should start with #!/bin/bash');
      return false;
    }
    
    // Check for Windows line endings
    if (scriptContent.includes('\r\n')) {
      console.log('❌ Startup script has Windows line endings (CRLF)');
      console.log('   Convert to Unix line endings (LF) to avoid container errors');
      console.log('   Run: dos2unix scripts/start-pm2.sh');
      return false;
    } else {
      console.log('✅ Startup script has Unix line endings');
    }
  }
  
  // Check Dockerfile PM2 installation
  const dockerfilePath = path.join(projectRoot, 'Dockerfile');
  if (fs.existsSync(dockerfilePath)) {
    const dockerContent = fs.readFileSync(dockerfilePath, 'utf8');
    
    if (dockerContent.includes('npm install -g pm2')) {
      console.log('✅ Dockerfile installs PM2 globally');
    } else {
      console.log('❌ Dockerfile missing PM2 installation');
      console.log('   Add: RUN npm install -g pm2');
      return false;
    }
    
    if (dockerContent.includes('chmod +x ./scripts/start-pm2.sh')) {
      console.log('✅ Dockerfile makes startup script executable');
    } else {
      console.log('❌ Dockerfile missing script permissions');
      console.log('   Add: RUN chmod +x ./scripts/start-pm2.sh');
      return false;
    }
  }
  
  return true;
}

// Run all checks
function runValidation() {
  console.log('Running validation checks...\n');
  
  const checks = [
    { name: 'Ecosystem Config', fn: checkEcosystemConfig },
    { name: 'Dockerfile', fn: checkDockerfile },
    { name: 'Railway Config', fn: checkRailwayConfig },
    { name: 'Startup Script', fn: checkStartupScript },
    { name: 'Worker Script', fn: checkWorkerScript },
    { name: 'Next.js Config', fn: checkNextJSConfig },
    { name: 'PWA Config', fn: checkPWAConfig },
    { name: 'Build Output', fn: checkBuildOutput },
    { name: 'Redis Config', fn: checkRedisConfig },
    { name: 'Docker Compatibility', fn: checkDockerCompatibility }
  ];
  
  let allPassed = true;
  let warningCount = 0;
  
  checks.forEach(check => {
    console.log(`\n🔍 Checking ${check.name}:`);
    const passed = check.fn();
    if (!passed) {
      allPassed = false;
    }
  });
  
  checkEnvironmentVariables();
  
  console.log('\n================================');
  if (allPassed) {
    console.log('🎉 All critical deployment checks passed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Commit and push these changes');
    console.log('   2. Set environment variables in Railway dashboard');
    console.log('   3. Run: npm run build (to verify build works)');
    console.log('   4. Redeploy on Railway');
    console.log('   5. Monitor logs for successful startup');
    console.log('\n💡 Tips for monitoring deployment:');
    console.log('   • Watch for "VAPID keys not set" warnings (set VAPID env vars)');
    console.log('   • Watch for "Redis URL not found" warnings (set DRAGONFLY env vars)');
    console.log('   • Check for "Failed to copy traced files" errors (rebuild if needed)');
  } else {
    console.log('❌ Critical issues found. Please fix them before deploying.');
    console.log('\n🔧 Common fixes:');
    console.log('   • Ensure next.config.cjs has output: "standalone"');
    console.log('   • Verify all PM2 configs use relative paths');
    console.log('   • Run npm run build to test build process');
  }
  
  return allPassed;
}

// Run the validation
if (require.main === module) {
  const success = runValidation();
  process.exit(success ? 0 : 1);
}

module.exports = { runValidation };