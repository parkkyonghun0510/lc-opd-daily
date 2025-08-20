#!/usr/bin/env node

/**
 * Environment Validation Script
 * 
 * Runs comprehensive environment validation during build/deployment
 * Provides detailed feedback for configuration issues
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function log(message, color = colors.white) {
  console.log(`${color}${message}${colors.reset}`);
}

function error(message) {
  console.error(`${colors.red}❌ ${message}${colors.reset}`);
}

function success(message) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function warning(message) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

function info(message) {
  console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

// Environment validation function
async function validateEnvironment() {
  log('🔍 Starting Environment Validation', colors.bright);
  log('=' .repeat(60));

  const requiredEnvVars = [
    { name: 'DRAGONFLY_URL', description: 'Dragonfly Redis URL for queue functionality', required: false },
    { name: 'DRAGONFLY_QUEUE_NAME', description: 'Queue name for notifications', required: false, default: 'notifications' },
    { name: 'DRAGONFLY_QUEUE_URL', description: 'Dragonfly queue endpoint', required: false },
    { name: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', description: 'VAPID public key for push notifications', required: process.env.NODE_ENV === 'production' },
    { name: 'VAPID_PRIVATE_KEY', description: 'VAPID private key for push notifications', required: process.env.NODE_ENV === 'production' },
    { name: 'VAPID_CONTACT_EMAIL', description: 'Contact email for VAPID notifications', required: process.env.NODE_ENV === 'production' },
  ];

  let hasErrors = false;
  let hasWarnings = false;

  // Check each environment variable
  requiredEnvVars.forEach(envVar => {
    const value = process.env[envVar.name];
    const altValue = envVar.alternative ? process.env[envVar.alternative] : null;

    const isVapid = envVar.name.startsWith('VAPID') || envVar.name === 'NEXT_PUBLIC_VAPID_PUBLIC_KEY';
    const isProd = process.env.NODE_ENV === 'production';
    const required = envVar.required;

    if (!value && !altValue) {
      if (required) {
        // Required in production
        error(`Missing required environment variable: ${envVar.name}`);
        info(`   ${envVar.description}`);
        hasErrors = true;
      } else if (isVapid && !isProd) {
        // VAPID missing in development -> warning
        warning(`${envVar.name} not set; push notifications will be disabled in development`);
        hasWarnings = true;
      } else if (!required) {
        if (envVar.default) {
          warning(`${envVar.name} not set, using default: ${envVar.default}`);
        } else {
          warning(`${envVar.name} not set, ${envVar.description.toLowerCase()}`);
        }
        hasWarnings = true;
      }
      return;
    }

    success(`${envVar.name} is configured`);

    // Validate URL formats
    if ((envVar.name.includes('URL') || envVar.alternative?.includes('URL')) && (value || altValue)) {
      const urlValue = value || altValue;
      try {
        new URL(urlValue);
      } catch {
        error(`Invalid URL format for ${envVar.name}: ${urlValue}`);
        hasErrors = true;
      }
    }

    // Validate email format for VAPID contact
    if (envVar.name === 'VAPID_CONTACT_EMAIL' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        if (isProd) {
          error(`Invalid email format for ${envVar.name}: ${value}`);
          hasErrors = true;
        } else {
          warning(`Invalid email format for ${envVar.name} (development): ${value}`);
          hasWarnings = true;
        }
      }
    }

    // Validate VAPID key formats
    if (isVapid && value) {
      if (value.length < 20) {
        if (isProd) {
          error(`VAPID key appears too short: ${envVar.name}`);
          hasErrors = true;
        } else {
          warning(`VAPID key appears too short (development): ${envVar.name}`);
          hasWarnings = true;
        }
      }
      const base64UrlRegex = /^[A-Za-z0-9_-]+$/;
      if (!base64UrlRegex.test(value)) {
        if (isProd) {
          warning(`VAPID key may not be properly Base64URL encoded: ${envVar.name}`);
          hasWarnings = true;
        } else {
          warning(`VAPID key may not be properly Base64URL encoded (development): ${envVar.name}`);
          hasWarnings = true;
        }
      }
    }
  });

  log('\n' + '=' .repeat(60));
  
  if (hasErrors) {
    error('Environment validation failed! Please fix the errors above.');
    process.exit(1);
  } else if (hasWarnings) {
    warning('Environment validation completed with warnings.');
    warning('The application will start but some features may be limited.');
  } else {
    success('Environment validation passed! All required variables are configured correctly.');
  }
  
  log('=' .repeat(60));
}

// Test Redis/Dragonfly connection
async function testRedisConnection() {
  log('\n🔌 Testing Redis/Dragonfly Connection...', colors.bright);
  
  const redisUrl = process.env.DRAGONFLY_URL;
  
  if (!redisUrl) {
    warning('DRAGONFLY_URL is not set. Queue functionality will be disabled.');
    warning('Set DRAGONFLY_URL to enable queue functionality.');
    return;
  }

  return new Promise((resolve) => {
    const testScript = spawn('node', ['-e', `
      const redis = require('redis');
      const client = redis.createClient({
        url: '${redisUrl}',
        socket: {
          connectTimeout: 5000,
          reconnectStrategy: false
        }
      });

      client.on('connect', () => {
        console.log('✅ Successfully connected to Redis/Dragonfly');
        client.quit();
        process.exit(0);
      });

      client.on('error', (err) => {
        console.error('❌ Redis/Dragonfly connection failed:', err.message);
        process.exit(1);
      });

      client.connect();
    `], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    testScript.on('close', (code) => {
      if (code !== 0) {
        error('Redis/Dragonfly connection test failed');
        process.exit(1);
      }
      resolve();
    });
  });
}

// Main validation function
async function main() {
  try {
    // Load environment variables
    const dotenv = await import('dotenv');
    dotenv.config();
    
    log('🚀 Starting Environment Validation Script', colors.bright);
    log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    log(`Working directory: ${process.cwd()}`);
    log('=' .repeat(60));

    // Validate environment variables
    await validateEnvironment();
    
    // Test Redis connection if URL is provided
    await testRedisConnection();
    
    log('\n🎉 All validation checks completed successfully!');
    
  } catch (error) {
    error(`Validation script failed: ${error.message}`);
    process.exit(1);
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { validateEnvironment, testRedisConnection };