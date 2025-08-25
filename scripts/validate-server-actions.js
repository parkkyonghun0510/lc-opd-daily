#!/usr/bin/env node

/**
 * Validation script for Next.js Server Actions encryption key
 * Checks if NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is properly configured
 */

import { readFileSync } from 'fs';
import { join } from 'path';

function validateServerActionsKey() {
  console.log('🔍 Validating Server Actions encryption key configuration...\n');
  
  const envFiles = ['.env', '.env.local', '.env.production'];
  const requiredKey = 'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY';
  let found = false;
  
  for (const envFile of envFiles) {
    try {
      const envPath = join(process.cwd(), envFile);
      const content = readFileSync(envPath, 'utf8');
      
      if (content.includes(requiredKey)) {
        const lines = content.split('\n');
        const keyLine = lines.find(line => line.startsWith(requiredKey));
        
        if (keyLine) {
          const keyValue = keyLine.split('=')[1]?.trim();
          
          if (keyValue && keyValue.length > 0 && keyValue !== 'your-generated-32-byte-base64-key-here') {
            console.log(`✅ ${requiredKey} found in ${envFile}`);
            console.log(`   Key: ${keyValue.substring(0, 10)}...`);
            found = true;
          } else {
            console.log(`⚠️  ${requiredKey} placeholder found in ${envFile} - needs real value`);
          }
        }
      }
    } catch (error) {
      // File doesn't exist, skip
    }
  }
  
  if (!found) {
    console.log('❌ Server Actions encryption key not found in any environment file');
    console.log('');
    console.log('💡 To fix this:');
    console.log('   1. Run: npm run generate:server-key');
    console.log('   2. Copy the generated key to your environment files');
    console.log('   3. Restart your application');
    process.exit(1);
  } else {
    console.log('\n✅ Server Actions encryption key validation passed!');
  }
}

validateServerActionsKey();