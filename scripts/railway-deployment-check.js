#!/usr/bin/env node

/**
 * Railway Deployment Health Check Script
 * 
 * This script validates that the Railway deployment is working correctly
 * by checking critical components and configurations.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('🚀 Railway Deployment Health Check');
console.log('==================================');

// Check 1: Verify critical files exist
const criticalFiles = [
  'ecosystem.production.config.cjs',
  'scripts/redis-standalone-worker-docker.js',
  'package.json',
  'next.config.ts'
];

console.log('\n📁 Checking critical files...');
let filesOk = true;
for (const file of criticalFiles) {
  const filePath = path.join(projectRoot, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    filesOk = false;
  }
}

// Check 2: Verify environment variables
console.log('\n🔧 Checking environment variables...');
const requiredEnvVars = [
  'NODE_ENV',
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL'
];

let envOk = true;
for (const envVar of requiredEnvVars) {
  if (process.env[envVar]) {
    console.log(`✅ ${envVar}`);
  } else {
    console.log(`❌ ${envVar} - NOT SET`);
    envOk = false;
  }
}

// Check 3: Verify Railway-specific configurations
console.log('\n🚂 Checking Railway configurations...');
const railwayConfigPath = path.join(projectRoot, 'railway.json');
let railwayOk = true;

if (fs.existsSync(railwayConfigPath)) {
  console.log('✅ railway.json exists');
  try {
    const railwayConfig = JSON.parse(fs.readFileSync(railwayConfigPath, 'utf8'));
    if (railwayConfig.deploy?.startCommand) {
      console.log(`✅ Start command: ${railwayConfig.deploy.startCommand}`);
    } else {
      console.log('❌ No start command defined');
      railwayOk = false;
    }
    if (railwayConfig.deploy?.healthcheckPath) {
      console.log(`✅ Health check: ${railwayConfig.deploy.healthcheckPath}`);
    }
  } catch (error) {
    console.log('❌ Invalid railway.json format');
    railwayOk = false;
  }
} else {
  console.log('❌ railway.json missing');
  railwayOk = false;
}

// Check 4: Verify PM2 ecosystem configuration
console.log('\n⚙️  Checking PM2 ecosystem configuration...');
const ecosystemPath = path.join(projectRoot, 'ecosystem.production.config.cjs');
let pm2Ok = true;

if (fs.existsSync(ecosystemPath)) {
  console.log('✅ ecosystem.production.config.cjs exists');
  try {
    // Basic validation - check if it's a valid JS file
    const content = fs.readFileSync(ecosystemPath, 'utf8');
    if (content.includes('module.exports') && content.includes('apps')) {
      console.log('✅ Valid PM2 configuration format');
    } else {
      console.log('❌ Invalid PM2 configuration format');
      pm2Ok = false;
    }
  } catch (error) {
    console.log('❌ Cannot read PM2 configuration');
    pm2Ok = false;
  }
} else {
  console.log('❌ ecosystem.production.config.cjs missing');
  pm2Ok = false;
}

// Summary
console.log('\n📊 Health Check Summary');
console.log('======================');
const allChecksPass = filesOk && envOk && railwayOk && pm2Ok;

if (allChecksPass) {
  console.log('🎉 All checks passed! Railway deployment should work correctly.');
  process.exit(0);
} else {
  console.log('⚠️  Some checks failed. Please review the issues above.');
  console.log('\n🔧 Common fixes:');
  if (!filesOk) {
    console.log('   - Ensure all files are committed to your repository');
  }
  if (!envOk) {
    console.log('   - Set missing environment variables in Railway dashboard');
  }
  if (!railwayOk) {
    console.log('   - Check railway.json configuration');
  }
  if (!pm2Ok) {
    console.log('   - Verify PM2 ecosystem configuration syntax');
  }
  process.exit(1);
}