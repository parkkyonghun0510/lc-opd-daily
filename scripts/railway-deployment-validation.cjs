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

// Check 2: Verify Dockerfile uses relative path
function checkDockerfile() {
  const dockerfilePath = path.join(projectRoot, 'Dockerfile');
  
  if (!fs.existsSync(dockerfilePath)) {
    console.log('❌ Dockerfile not found');
    return false;
  }
  
  const dockerContent = fs.readFileSync(dockerfilePath, 'utf8');
  
  if (dockerContent.includes('CMD ["pm2-runtime", "start", "ecosystem.production.config.cjs"]')) {
    console.log('✅ Dockerfile uses relative path for PM2 config');
    return true;
  } else if (dockerContent.includes('CMD ["pm2-runtime", "start", "/app/ecosystem.production.config.cjs"]')) {
    console.log('❌ Dockerfile still uses absolute path');
    console.log('   Fix: Change to "ecosystem.production.config.cjs"');
    return false;
  } else {
    console.log('⚠️  Dockerfile CMD not found or different format');
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
  
  if (config.deploy?.startCommand === 'pm2-runtime ecosystem.production.config.cjs') {
    console.log('✅ railway.json startCommand uses relative path');
  } else {
    console.log('❌ railway.json startCommand incorrect');
    console.log('   Expected: "pm2-runtime ecosystem.production.config.cjs"');
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
  
  return true;
}

// Check 5: Environment variables guidance
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
  
  requiredVars.forEach(varName => {
    console.log(`   • ${varName}`);
  });
  
  console.log('\n⚠️  Make sure NODE_ENV is set to exactly "production"');
  console.log('   Non-standard values will cause Next.js warnings');
  
  return true;
}

// Run all checks
function runValidation() {
  console.log('Running validation checks...\n');
  
  const checks = [
    { name: 'Ecosystem Config', fn: checkEcosystemConfig },
    { name: 'Dockerfile', fn: checkDockerfile },
    { name: 'Railway Config', fn: checkRailwayConfig },
    { name: 'Worker Script', fn: checkWorkerScript }
  ];
  
  let allPassed = true;
  
  checks.forEach(check => {
    console.log(`\n🔍 Checking ${check.name}:`);
    const passed = check.fn();
    if (!passed) allPassed = false;
  });
  
  checkEnvironmentVariables();
  
  console.log('\n================================');
  if (allPassed) {
    console.log('🎉 All deployment fixes validated successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Commit and push these changes');
    console.log('   2. Set environment variables in Railway dashboard');
    console.log('   3. Redeploy on Railway');
    console.log('   4. Monitor logs for successful startup');
  } else {
    console.log('❌ Some issues found. Please fix them before deploying.');
  }
  
  return allPassed;
}

// Run the validation
if (require.main === module) {
  const success = runValidation();
  process.exit(success ? 0 : 1);
}

module.exports = { runValidation };