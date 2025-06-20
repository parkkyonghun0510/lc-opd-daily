/**
 * SSE Alerting Background Job
 *
 * This module sets up a background job to check SSE metrics
 * and send alerts if thresholds are exceeded.
 */

import { sseAlertingSystem } from "./alerting";

// Check interval in milliseconds (1 minute)
const CHECK_INTERVAL = 60 * 1000;

// Flag to track if the job is running
let isJobRunning = false;

// Interval ID for the background job
let intervalId: NodeJS.Timeout | null = null;

/**
 * Start the alerting background job
 */
export function startAlertingJob() {
  if (isJobRunning) {
    return;
  }

  console.log("[SSE Alerting] Starting background job");

  // Run the job immediately
  checkMetricsAndAlert();

  // Set up interval for regular checks
  intervalId = setInterval(checkMetricsAndAlert, CHECK_INTERVAL);

  isJobRunning = true;
}

/**
 * Stop the alerting background job
 */
export function stopAlertingJob() {
  if (!isJobRunning || !intervalId) {
    return;
  }

  console.log("[SSE Alerting] Stopping background job");

  clearInterval(intervalId);
  intervalId = null;
  isJobRunning = false;
}

/**
 * Check metrics and send alerts if needed
 */
async function checkMetricsAndAlert() {
  try {
    const alerts = await sseAlertingSystem.checkMetricsAndAlert();

    if (alerts && alerts.length > 0) {
      console.log(`[SSE Alerting] Sent ${alerts.length} alerts`);
    }
  } catch (error) {
    console.error("[SSE Alerting] Error checking metrics:", error);
  }
}

// Start the job when the module is imported
// This ensures the job starts when the server starts
if (
  process.env.NODE_ENV === "production" &&
  process.env.SSE_ALERTS_ENABLED === "true"
) {
  startAlertingJob();
}
