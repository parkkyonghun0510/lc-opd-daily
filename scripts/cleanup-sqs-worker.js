/**
 * Cleanup SQS and Worker Code
 *
 * This script helps identify and remove unused SQS and worker code
 * after migrating to the Redis notification system.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Files to remove
const filesToRemove = [
  'src/lib/queue/sqs.ts',
  'src/workers/notificationWorker.ts',
  'src/workers/standalone-worker.js',
  'scripts/standalone-worker.js',
  'docs/notification-worker.md',
  'docs/notification-queue.md'
];

// Files to check for SQS and worker references
const filesToCheck = [
  'src/app/api/notifications/send/route.ts',
  'src/app/api/push/send/route.ts',
  'src/lib/sse/event-emitter.ts',
  'src/lib/realtime/redisEventEmitter.ts',
  'src/utils/createDirectNotification.ts'
];

// Get the project root directory (assuming script is in project_root/scripts)
const projectRoot = path.resolve(__dirname, '..');

// Check if files exist
console.log('Checking files to remove...');
const existingFilesToRemove = filesToRemove.filter(file => {
  const filePath = path.join(projectRoot, file);
  const exists = fs.existsSync(filePath);
  console.log(`${file}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
  return exists;
});

// Check for references
console.log('\nChecking for SQS and worker references...');
const filesWithReferences = filesToCheck.filter(file => {
  const filePath = path.join(projectRoot, file);
  if (!fs.existsSync(filePath)) {
    console.log(`${file}: NOT FOUND`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const hasSQSReference = content.includes('sqs') || content.includes('SQS') || content.includes('queue');
  const hasWorkerReference = content.includes('worker') || content.includes('Worker');

  console.log(`${file}: ${hasSQSReference || hasWorkerReference ? 'HAS REFERENCES' : 'NO REFERENCES'}`);

  return hasSQSReference || hasWorkerReference;
});

// Print summary
console.log('\nSummary:');
console.log(`Files to remove: ${existingFilesToRemove.length}`);
console.log(`Files with references: ${filesWithReferences.length}`);

// Ask for confirmation
console.log('\nThis script will not automatically remove files.');
console.log('Please review the files and remove them manually if appropriate.');
console.log('\nFiles to remove:');
existingFilesToRemove.forEach(file => console.log(`- ${file}`));

console.log('\nFiles with references to check:');
filesWithReferences.forEach(file => console.log(`- ${file}`));

// Update package.json
console.log('\nRemember to update package.json to remove worker-related scripts:');
console.log('- "worker:start"');
console.log('- "worker:dev"');
console.log('- "worker:logs"');
console.log('- "worker:stop"');
console.log('- "worker:status"');

// Update environment variables
console.log('\nRemember to update environment variables:');
console.log('- Remove AWS_REGION');
console.log('- Remove AWS_ACCESS_KEY_ID');
console.log('- Remove AWS_SECRET_ACCESS_KEY');
console.log('- Remove AWS_SQS_NOTIFICATION_QUEUE_URL');
