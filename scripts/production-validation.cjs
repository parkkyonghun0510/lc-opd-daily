#!/usr/bin/env node

/**
 * Production Validation Script for Railway Deployment
 * 
 * Validates critical production services and configurations
 */

// Load environment variables
require('dotenv').config();

async function validateProduction() {
  console.log('🚀 Railway Production Validation');
  console.log('===============================');
  
  const results = {
    environment: false,
    database: false,
    redis: false,
    health: false,
    startup: false
  };
  
  // 1. Environment Variables Validation
  console.log('🌍 Checking environment variables...');
  const requiredEnvVars = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'DRAGONFLY_URL',
    'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY'
  ];
  
  let envMissing = 0;
  requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
      console.log(`❌ Missing: ${envVar}`);
      envMissing++;
    } else {
      console.log(`✅ Found: ${envVar}`);
    }
  });
  
  results.environment = envMissing === 0;
  
  // 2. Database Connection Test
  console.log('\n📊 Testing database connection...');
  try {
    // Dynamic import for ES modules
    const { getPrisma } = await import('../src/lib/prisma-server.js');
    const prisma = await getPrisma();
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');
    results.database = true;
  } catch (error) {
    console.log(`❌ Database connection failed: ${error.message}`);
    results.database = false;
  }
  
  // 3. Redis Connection Test
  console.log('\n🔴 Testing Redis/Dragonfly connection...');
  try {
    // Dynamic import for Redis module
    const redisModule = await import('../src/lib/redis.ts');
    const cacheClient = await redisModule.getRedis();
    await cacheClient.ping();
    console.log('✅ Redis/Dragonfly connection successful');
    results.redis = true;
  } catch (error) {
    console.log(`❌ Redis/Dragonfly connection failed: ${error.message}`);
    results.redis = false;
  }
  
  // 4. Health Endpoint Test
  console.log('\n🏥 Testing health endpoint...');
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('http://localhost:3000/api/health', {
      timeout: 10000
    });
    if (response.ok) {
      console.log('✅ Health endpoint responding');
      results.health = true;
    } else {
      console.log(`❌ Health endpoint returned status: ${response.status}`);
      results.health = false;
    }
  } catch (error) {
    console.log(`❌ Health endpoint test failed: ${error.message}`);
    results.health = false;
  }
  
  // 5. PM2 Process Validation
  console.log('\n⚙️ Checking PM2 processes...');
  try {
    const { execSync } = require('child_process');
    const output = execSync('pm2 list', { encoding: 'utf8' });
    
    if (output.includes('lc-opd-daily') && output.includes('online')) {
      console.log('✅ Main application process running');
      results.startup = true;
    } else {
      console.log('❌ Main application process not found or not running');
      results.startup = false;
    }
    
    if (output.includes('notification-worker')) {
      console.log('✅ Notification worker process detected');
    } else {
      console.log('⚠️ Notification worker process not found');
    }
  } catch (error) {
    console.log(`❌ PM2 process check failed: ${error.message}`);
    results.startup = false;
  }
  
  // Summary
  console.log('\n📋 Validation Summary:');
  console.log('=====================');
  
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test.charAt(0).toUpperCase() + test.slice(1)}: ${passed ? 'PASS' : 'FAIL'}`);
  });
  
  console.log(`\n🎯 Overall: ${passed}/${total} checks passed`);
  
  if (passed === total) {
    console.log('🎉 Production validation successful! All systems operational.');
    process.exit(0);
  } else {
    console.log('⚠️ Production validation failed. Check the failed services above.');
    process.exit(1);
  }
}

// Run validation if called directly
if (require.main === module) {
  validateProduction().catch(error => {
    console.error('❌ Validation script failed:', error);
    process.exit(1);
  });
}

module.exports = { validateProduction };