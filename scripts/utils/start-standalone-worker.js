#!/usr/bin/env node

/**
 * This script starts the notification worker process
 * It can be run directly from npm scripts:
 * "start:worker": "node scripts/start-standalone-worker.js"
 */

// Load environment variables
import "dotenv/config";

//console.log('Starting notification worker...');
//console.log('AWS Region:', process.env.AWS_REGION);
//console.log('Queue URL:', process.env.AWS_SQS_NOTIFICATION_QUEUE_URL);

// Check for required environment variables
const requiredEnvVars = [
  "AWS_REGION",
  "SQS_AWS_ACCESS_KEY_ID",
  "SQS_AWS_SECRET_ACCESS_KEY",
  "AWS_SQS_NOTIFICATION_QUEUE_URL",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error("Error: Missing required environment variables:");
  missingEnvVars.forEach((envVar) => console.error(`- ${envVar}`));
  process.exit(1);
}

// Import and start the worker
import("../src/workers/standalone-worker.js")
  .then(({ startNotificationWorker }) => {
    //console.log('Worker module loaded, starting worker...');
    return startNotificationWorker();
  })
  .catch((error) => {
    console.error("Failed to start notification worker:", error);
    process.exit(1);
  });
