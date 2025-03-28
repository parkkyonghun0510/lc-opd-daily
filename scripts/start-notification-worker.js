#!/usr/bin/env node

/**
 * This script starts the notification worker process
 * It can be run directly from npm scripts:
 * "start-worker": "node scripts/start-notification-worker.js"
 */

// Register tsconfig-paths for path resolution
import { register } from 'tsconfig-paths';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register path mappings from tsconfig.json
register({
  baseUrl: path.join(__dirname, '..'),
  paths: {
    '@/*': ['dist/*']
  }
});

// Load environment variables
import 'dotenv/config';

console.log('Starting notification worker...');
console.log('AWS Region:', process.env.AWS_REGION);
console.log('Queue URL:', process.env.AWS_SQS_NOTIFICATION_QUEUE_URL);

// Check for required environment variables
const requiredEnvVars = [
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SQS_NOTIFICATION_QUEUE_URL',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('Error: Missing required environment variables:');
  missingEnvVars.forEach(envVar => console.error(`- ${envVar}`));
  process.exit(1);
}

// Import and start the worker
// Uses dynamic import because we need to load env vars first
import('../dist/workers/notificationWorker.js')
  .then(({ startNotificationWorker }) => {
    console.log('Worker module loaded, starting worker...');
    return startNotificationWorker();
  })
  .catch(error => {
    console.error('Failed to start notification worker:', error);
    process.exit(1);
  }); 