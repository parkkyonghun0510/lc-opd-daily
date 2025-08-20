#!/usr/bin/env node

/**
 * Production Deployment Verification Script
 * 
 * This script verifies that the Dragonfly-based notification system
 * is properly configured for production deployment.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Production Deployment Verification\n');

// Configuration
const REQUIRED_ENV_VARS = [
  'DRAGONFLY_URL',
  'DRAGONFLY_QUEUE_NAME',
  'DRAGONFLY_QUEUE_URL',
  'DATABASE_URL',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY'
];

const OPTIONAL_ENV_VARS = [
  'VAPID_CONTACT_EMAIL',
  'TELEGRAM_BOT_TOKEN'
];

const REQUIRED_FILES = [
  'dist/workers/dragonfly-worker.js',
  'dist/lib/dragonfly-queue.js',
  'ecosystem.production.config.cjs',
  'scripts/start-pm2.sh'
];

const results = {
  environment: { status: 'pending', details: [] },
  files: { status: 'pending', details: [] },
  configuration: { status: 'pending', details: [] },
  overall: { status: 'pending', message: '' }
};

// 1. Environment Variables Check
console.log('📋 Checking Environment Variables...');
let envCheckPassed = true;

for (const envVar of REQUIRED_ENV_VARS) {
  const value = process.env[envVar];
  if (!value || value.trim() === '') {
    results.environment.details.push(`❌ Missing required: ${envVar}`);
    envCheckPassed = false;
  } else {
    // Mask sensitive values
    const displayValue = envVar.includes('KEY') || envVar.includes('PASSWORD') 
      ? `${value.substring(0, 8)}...` 
      : value;
    results.environment.details.push(`✅ ${envVar}: ${displayValue}`);
  }
}

for (const envVar of OPTIONAL_ENV_VARS) {
  const value = process.env[envVar];
  if (!value || value.trim() === '') {
    results.environment.details.push(`⚠️  Optional missing: ${envVar}`);
  } else {
    results.environment.details.push(`✅ ${envVar}: configured`);
  }
}

results.environment.status = envCheckPassed ? 'passed' : 'failed';

// 2. Required Files Check
console.log('📁 Checking Required Files...');
let fileCheckPassed = true;

for (const file of REQUIRED_FILES) {
  const filePath = resolve(__dirname, file);
  if (existsSync(filePath)) {
    const stats = readFileSync(filePath, 'utf8');
    results.files.details.push(`✅ ${file}: ${(stats.length / 1024).toFixed(1)} KB`);
  } else {
    results.files.details.push(`❌ Missing: ${file}`);
    fileCheckPassed = false;
  }
}

results.files.status = fileCheckPassed ? 'passed' : 'failed';

// 3. Configuration Validation
console.log('⚙️  Validating Configuration...');
let configCheckPassed = true;

try {
  // Check PM2 configuration
  const pm2ConfigPath = resolve(__dirname, 'ecosystem.production.config.cjs');
  if (existsSync(pm2ConfigPath)) {
    const pm2ConfigContent = readFileSync(pm2ConfigPath, 'utf8');
    
    // Simple check for Dragonfly worker configuration
    if (pm2ConfigContent.includes('dist/workers/dragonfly-worker.js')) {
      results.configuration.details.push('✅ PM2 configured for Dragonfly worker');
    } else {
      results.configuration.details.push('❌ PM2 not configured for Dragonfly worker');
      configCheckPassed = false;
    }
  }

  // Validate Dragonfly URL format (if provided)
  const dragonflyUrl = process.env.DRAGONFLY_URL;
  if (dragonflyUrl) {
    const urlPattern = /^redis:\/\/[^:]+:[^@]+@[^:]+:\d+\/\d+$/;
    if (urlPattern.test(dragonflyUrl)) {
      results.configuration.details.push('✅ DRAGONFLY_URL format valid');
    } else {
      results.configuration.details.push('⚠️  DRAGONFLY_URL format may be invalid');
    }
  }

  // Check queue names consistency
  const queueName = process.env.DRAGONFLY_QUEUE_NAME;
  const queueUrl = process.env.DRAGONFLY_QUEUE_URL;
  
  if (queueName && queueUrl) {
    if (queueUrl.includes(queueName)) {
      results.configuration.details.push('✅ Queue configuration consistent');
    } else {
      results.configuration.details.push('⚠️  Queue configuration may be inconsistent');
    }
  }

} catch (error) {
  results.configuration.details.push(`❌ Configuration validation error: ${error.message}`);
  configCheckPassed = false;
}

results.configuration.status = configCheckPassed ? 'passed' : 'failed';

// 4. Overall Assessment
const allPassed = envCheckPassed && fileCheckPassed && configCheckPassed;
results.overall.status = allPassed ? 'ready' : 'needs-fix';

// 5. Display Results
console.log('\n📊 Verification Results:');
console.log('========================');

console.log('\nEnvironment Variables:');
results.environment.details.forEach(detail => console.log(`  ${detail}`));

console.log('\nRequired Files:');
results.files.details.forEach(detail => console.log(`  ${detail}`));

console.log('\nConfiguration:');
results.configuration.details.forEach(detail => console.log(`  ${detail}`));

console.log('\n🎯 Overall Status:', 
  allPassed ? '🟢 READY FOR DEPLOYMENT' : '🔴 NEEDS ATTENTION'
);

// 6. Deployment Recommendations
if (allPassed) {
  console.log('\n✅ Deployment Ready! Next steps:');
  console.log('1. Run: npm run build:production');
  console.log('2. Deploy using: railway up');
  console.log('3. Monitor: pm2 logs notification-worker');
  console.log('4. Verify: redis-cli -u $DRAGONFLY_URL ping');
} else {
  console.log('\n❌ Fix the issues above before deploying');
  console.log('Check DEPLOYMENT_CHECKLIST.md for detailed guidance');
}

// Exit with appropriate code
process.exit(allPassed ? 0 : 1);