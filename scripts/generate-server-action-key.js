#!/usr/bin/env node

/**
 * Script to generate a new AES-GCM encryption key for Next.js Server Actions
 * This prevents "Failed to find Server Action" errors between deployments
 * 
 * Usage: node scripts/generate-server-action-key.js
 * 
 * Add the generated key to your environment variables:
 * NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<generated-key>
 */

import crypto from 'crypto';

function generateServerActionKey() {
  // Generate a 32-byte (256-bit) key for AES-GCM encryption
  const key = crypto.randomBytes(32).toString('base64');
  
  console.log('🔐 Generated new Server Actions encryption key:');
  console.log('');
  console.log(`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=${key}`);
  console.log('');
  console.log('💡 Add this to your environment variables:');
  console.log('   - .env.local (for development)');
  console.log('   - .env.production (for production)');
  console.log('   - Railway environment variables (for Railway deployment)');
  console.log('');
  console.log('📖 This key ensures consistent Server Action encryption across deployments');
  console.log('   and prevents "Failed to find Server Action" errors.');
  
  return key;
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateServerActionKey();
}

export { generateServerActionKey };