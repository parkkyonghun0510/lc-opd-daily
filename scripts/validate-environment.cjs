#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const dotenv = require('dotenv');

function log(message, color = 'reset') {
  const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
  };
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function validateEnvVariable(key, value) {
  if (value) {
    log(`✅ ${key} is set`, 'green');
    return true;
  } else {
    log(`❌ ${key} is not set`, 'red');
    return false;
  }
}

function main() {
  log('🚀 Starting Environment Variable Validation Script', 'bright');
  log('='.repeat(60));

  const envPath = path.join(process.cwd(), '.env.production');
  if (!fs.existsSync(envPath)) {
    log(`❌ .env.production file not found at ${envPath}`, 'red');
    process.exit(1);
  }

  const envConfig = dotenv.parse(fs.readFileSync(envPath));

  const requiredKeys = [
    'DATABASE_URL',
    'DRAGONFLY_URL',
    'DRAGONFLY_QUEUE_NAME',
    'DRAGONFLY_QUEUE_URL',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
    'VAPID_CONTACT_EMAIL',
  ];

  let allKeysValid = true;

  requiredKeys.forEach(key => {
    const value = envConfig[key];
    if (!validateEnvVariable(key, value)) {
      allKeysValid = false;
    }
  });

  log('\n' + '='.repeat(60));
  if (allKeysValid) {
    log('🎉 All required environment variables are set!', 'green');
  } else {
    log('❌ Some required environment variables are missing. Please check your .env.production file.', 'red');
    process.exit(1);
  }
}

main();