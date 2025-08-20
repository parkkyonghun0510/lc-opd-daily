#!/usr/bin/env node

/**
 * Railway Pre-Deployment Validation Script
 * 
 * Validates that all required environment variables are set before deployment
 * Run this script locally or in CI/CD before deploying to Railway
 */

import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Load environment files in order of precedence
const envFiles = [
  '.env.local',
  '.env.production',
  '.env.railway',
  '.env'
];

let envLoaded = false;
for (const file of envFiles) {
  const envPath = path.join(projectRoot, file);
  if (fs.existsSync(envPath)) {
    config({ path: envPath });
    console.log(`✅ Loaded environment from: ${file}`);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.warn('⚠️  No environment file found. Using system environment variables only.');
}

// Required environment variables for Railway deployment
const requiredEnvVars = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL'
];

// Optional but recommended variables
const recommendedEnvVars = [
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_CONTACT_EMAIL',
  'DRAGONFLY_URL'
];

// Validate environment variables
function validateEnvironment() {
  const errors = [];
  const warnings = [];
  const missing = [];

  console.log('🔍 Railway Pre-Deployment Environment Validation');
  console.log('==============================================');

  // Check required variables
  console.log('\n📋 Required Variables:');
  for (const key of requiredEnvVars) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      errors.push(`❌ ${key} is required but not set`);
      missing.push(key);
    } else {
      console.log(`✅ ${key} is set`);
    }
  }

  // Check recommended variables
  console.log('\n⚡ Recommended Variables:');
  for (const key of recommendedEnvVars) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      warnings.push(`⚠️  ${key} is not set (may cause warnings)`);
      missing.push(key);
    } else {
      console.log(`✅ ${key} is set`);
    }
  }

  // Special validation for VAPID keys
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail = process.env.VAPID_CONTACT_EMAIL;

  console.log('\n🔐 VAPID Configuration:');
  
  if (vapidPublicKey && vapidPrivateKey && vapidEmail) {
    console.log('✅ VAPID keys are configured');
    
    // Validate key formats
    const base64UrlRegex = /^[A-Za-z0-9_-]+$/;
    if (!base64UrlRegex.test(vapidPublicKey) || vapidPublicKey.length < 20) {
      warnings.push('⚠️  NEXT_PUBLIC_VAPID_PUBLIC_KEY appears to be invalid format');
    }
    if (!base64UrlRegex.test(vapidPrivateKey) || vapidPrivateKey.length < 20) {
      warnings.push('⚠️  VAPID_PRIVATE_KEY appears to be invalid format');
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(vapidEmail)) {
      warnings.push('⚠️  VAPID_CONTACT_EMAIL appears to be invalid format');
    }
    
    console.log(`✅ NEXT_PUBLIC_VAPID_PUBLIC_KEY: ${vapidPublicKey.substring(0, 20)}...`);
    console.log(`✅ VAPID_CONTACT_EMAIL: ${vapidEmail}`);
  } else {
    console.log('⚠️  VAPID keys are incomplete - push notifications will be disabled');
    if (!vapidPublicKey) warnings.push('⚠️  NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing');
    if (!vapidPrivateKey) warnings.push('⚠️  VAPID_PRIVATE_KEY is missing');
    if (!vapidEmail) warnings.push('⚠️  VAPID_CONTACT_EMAIL is missing');
  }

  // Check DATABASE_URL format
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && !databaseUrl.startsWith('postgresql://')) {
    warnings.push('⚠️  DATABASE_URL should start with postgresql://');
  }

  // Check NEXTAUTH_URL format
  const nextauthUrl = process.env.NEXTAUTH_URL;
  if (nextauthUrl && !nextauthUrl.startsWith('http')) {
    warnings.push('⚠️  NEXTAUTH_URL should be a valid URL (http:// or https://)');
  }

  console.log('\n📊 Validation Summary:');
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Missing: ${missing.length}`);

  if (errors.length > 0) {
    console.log('\n❌ Errors (Deployment will fail):');
    errors.forEach(error => console.log(`  ${error}`));
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings (App will run with limitations):');
    warnings.forEach(warning => console.log(`  ${warning}`));
  }

  if (missing.length > 0) {
    console.log('\n📝 Missing Variables:');
    missing.forEach(key => {
      if (key.includes('VAPID')) {
        console.log(`  ${key}: Generate with: npx web-push generate-vapid-keys`);
      } else {
        console.log(`  ${key}: Set in Railway Variables tab`);
      }
    });
  }

  console.log('\n🎯 Next Steps:');
  if (errors.length > 0) {
    console.log('1. Fix all errors before deployment');
    console.log('2. Set missing variables in Railway Variables tab');
    console.log('3. Re-run this validation script');
  } else if (warnings.length > 0) {
    console.log('1. Consider setting recommended variables for full functionality');
    console.log('2. Deploy with current configuration (warnings are non-blocking)');
  } else {
    console.log('✅ Environment is ready for deployment!');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    missing
  };
}

// Run validation
const result = validateEnvironment();

// Exit with appropriate code
process.exit(result.isValid ? 0 : 1);