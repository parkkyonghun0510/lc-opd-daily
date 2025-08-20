#!/usr/bin/env node

/**
 * Script to update Redis configuration in .env.production file
 * Usage: node scripts/update-redis-config.cjs <redis_url>
 * Example: node scripts/update-redis-config.cjs redis://username:password@host:port
 */

const fs = require('fs');
const path = require('path');

// Get command line arguments
const [,, redisUrl] = process.argv;

if (!redisUrl) {
  console.error('Usage: node scripts/update-redis-config.cjs <redis_url>');
  console.error('Example: node scripts/update-redis-config.cjs redis://username:password@host:port');
  process.exit(1);
}

// Validate Redis URL format
if (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
  console.error('Error: Redis URL must start with redis:// or rediss://');
  process.exit(1);
}

// Define paths for environment files
const envProductionPath = path.join(process.cwd(), '.env.production');

// Function to update or add Redis configuration to an env file
function updateEnvFile(filePath) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`Creating new file: ${filePath}`);
      fs.writeFileSync(filePath, '');
    }

    // Read the current content
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Update or add Redis configuration
    const dragonflyUrlRegex = /^DRAGONFLY_URL=.*/m;
    const dragonflyQueueNameRegex = /^DRAGONFLY_QUEUE_NAME=.*/m;
    const dragonflyQueueUrlRegex = /^DRAGONFLY_QUEUE_URL=.*/m;
    
    if (dragonflyUrlRegex.test(content)) {
      content = content.replace(dragonflyUrlRegex, `DRAGONFLY_URL=${redisUrl}`);
    } else {
      content += `\nDRAGONFLY_URL=${redisUrl}`;
    }
    
    // Add queue name if it doesn't exist
    if (!dragonflyQueueNameRegex.test(content)) {
      content += `\nDRAGONFLY_QUEUE_NAME=notifications`;
    }
    
    // Add queue URL if it doesn't exist (same as DRAGONFLY_URL)
    if (!dragonflyQueueUrlRegex.test(content)) {
      content += `\nDRAGONFLY_QUEUE_URL=${redisUrl}`;
    } else {
      content = content.replace(dragonflyQueueUrlRegex, `DRAGONFLY_QUEUE_URL=${redisUrl}`);
    }
    
    // Write the updated content back to the file
    fs.writeFileSync(filePath, content);
    console.log(`Updated Redis configuration in ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error);
    return false;
  }
}

// Update the file
const productionUpdated = updateEnvFile(envProductionPath);

if (productionUpdated) {
  console.log('Redis configuration successfully updated.');
  console.log('\nRemember to restart your application for the changes to take effect.');
  console.log('\nTo test the Redis connection, you can use:');
  console.log(`redis-cli -u ${redisUrl} ping`);
} else {
  console.error('Failed to update Redis configuration.');
  process.exit(1);
}