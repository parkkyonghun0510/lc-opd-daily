/**
 * SSE Load Testing Script
 *
 * This script tests the SSE implementation under load by simulating
 * multiple concurrent connections and measuring performance.
 *
 * Usage:
 * node sse-load-test.js --connections=100 --duration=60 --url=http://localhost:3000/api/sse
 */

const EventSource = require("eventsource");
const { performance } = require("perf_hooks");
const { program } = require("commander");

// Parse command line arguments
program
  .option(
    "-c, --connections <number>",
    "Number of concurrent connections",
    parseInt,
    100,
  )
  .option("-d, --duration <number>", "Test duration in seconds", parseInt, 60)
  .option(
    "-u, --url <string>",
    "SSE endpoint URL",
    "http://localhost:3000/api/sse",
  )
  .option("-t, --token <string>", "Authentication token")
  .option(
    "-i, --interval <number>",
    "Reporting interval in seconds",
    parseInt,
    5,
  )
  .option("-r, --ramp-up <number>", "Ramp-up period in seconds", parseInt, 10)
  .parse(process.argv);

const options = program.opts();

// Test configuration
const config = {
  connections: options.connections,
  duration: options.duration,
  url: options.url,
  token: options.token,
  interval: options.interval,
  rampUp: options.rampUp,
};

console.log("SSE Load Test Configuration:");
console.log(`- Connections: ${config.connections}`);
console.log(`- Duration: ${config.duration} seconds`);
console.log(`- URL: ${config.url}`);
console.log(`- Token: ${config.token ? "********" : "None"}`);
console.log(`- Reporting Interval: ${config.interval} seconds`);
console.log(`- Ramp-up Period: ${config.rampUp} seconds`);
console.log("\n");

// Test metrics
const metrics = {
  activeConnections: 0,
  totalConnections: 0,
  successfulConnections: 0,
  failedConnections: 0,
  totalEvents: 0,
  eventsByType: {},
  errors: 0,
  connectionTimes: [],
  eventLatencies: [],
};

// Active connections
const connections = [];

// Start time
const startTime = performance.now();

// Create a connection
function createConnection(index) {
  const userId = `test-user-${index}`;
  const connectionStartTime = performance.now();

  // Build URL with parameters
  let url = `${config.url}?userId=${userId}`;
  if (config.token) {
    url += `&token=${config.token}`;
  }

  // Create EventSource
  const eventSource = new EventSource(url);

  // Track connection
  metrics.activeConnections++;
  metrics.totalConnections++;

  // Connection opened
  eventSource.onopen = () => {
    const connectionTime = performance.now() - connectionStartTime;
    metrics.connectionTimes.push(connectionTime);
    metrics.successfulConnections++;

    // Log connection
    if (index % 10 === 0) {
      console.log(
        `[${formatElapsedTime(startTime)}] Connection ${index} established in ${connectionTime.toFixed(2)}ms`,
      );
    }
  };

  // Handle messages
  eventSource.onmessage = (event) => {
    try {
      const eventData = JSON.parse(event.data);
      const eventType = eventData.type || "unknown";

      // Track event
      metrics.totalEvents++;
      metrics.eventsByType[eventType] =
        (metrics.eventsByType[eventType] || 0) + 1;

      // Track latency if timestamp is available
      if (eventData.timestamp) {
        const latency = Date.now() - eventData.timestamp;
        metrics.eventLatencies.push(latency);
      }
    } catch (error) {
      console.error(`Error parsing event data: ${error.message}`);
    }
  };

  // Handle specific event types
  ["connected", "notification", "update", "ping"].forEach((eventType) => {
    eventSource.addEventListener(eventType, (event) => {
      try {
        const eventData = JSON.parse(event.data);

        // Track event
        metrics.totalEvents++;
        metrics.eventsByType[eventType] =
          (metrics.eventsByType[eventType] || 0) + 1;

        // Track latency if timestamp is available
        if (eventData.timestamp) {
          const latency = Date.now() - eventData.timestamp;
          metrics.eventLatencies.push(latency);
        }
      } catch (error) {
        console.error(
          `Error parsing ${eventType} event data: ${error.message}`,
        );
      }
    });
  });

  // Handle errors
  eventSource.onerror = (error) => {
    metrics.errors++;
    metrics.failedConnections++;
    metrics.activeConnections--;

    console.error(
      `[${formatElapsedTime(startTime)}] Connection ${index} error:`,
      error,
    );

    // Close connection on error
    eventSource.close();

    // Remove from connections array
    const connectionIndex = connections.findIndex((c) => c.index === index);
    if (connectionIndex !== -1) {
      connections.splice(connectionIndex, 1);
    }
  };

  // Store connection
  connections.push({
    index,
    eventSource,
    userId,
    startTime: connectionStartTime,
  });
}

// Report metrics
function reportMetrics() {
  const elapsedTime = (performance.now() - startTime) / 1000;
  const avgConnectionTime =
    metrics.connectionTimes.length > 0
      ? metrics.connectionTimes.reduce((a, b) => a + b, 0) /
        metrics.connectionTimes.length
      : 0;
  const avgEventLatency =
    metrics.eventLatencies.length > 0
      ? metrics.eventLatencies.reduce((a, b) => a + b, 0) /
        metrics.eventLatencies.length
      : 0;

  console.log(
    `\n[${formatElapsedTime(startTime)}] Test Progress: ${Math.min(100, ((elapsedTime / config.duration) * 100).toFixed(1))}%`,
  );
  console.log(`- Active Connections: ${metrics.activeConnections}`);
  console.log(`- Total Connections: ${metrics.totalConnections}`);
  console.log(`- Successful Connections: ${metrics.successfulConnections}`);
  console.log(`- Failed Connections: ${metrics.failedConnections}`);
  console.log(
    `- Connection Success Rate: ${((metrics.successfulConnections / metrics.totalConnections) * 100).toFixed(1)}%`,
  );
  console.log(`- Average Connection Time: ${avgConnectionTime.toFixed(2)}ms`);
  console.log(`- Total Events Received: ${metrics.totalEvents}`);
  console.log(
    `- Events per Second: ${(metrics.totalEvents / elapsedTime).toFixed(2)}`,
  );
  console.log(`- Average Event Latency: ${avgEventLatency.toFixed(2)}ms`);
  console.log(`- Errors: ${metrics.errors}`);

  // Event types
  console.log("- Events by Type:");
  Object.entries(metrics.eventsByType).forEach(([type, count]) => {
    console.log(`  - ${type}: ${count}`);
  });
}

// Format elapsed time
function formatElapsedTime(startTime) {
  const elapsedSeconds = Math.floor((performance.now() - startTime) / 1000);
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

// Run the test
async function runTest() {
  console.log(`[${formatElapsedTime(startTime)}] Starting SSE load test...`);

  // Set up reporting interval
  const reportingInterval = setInterval(() => {
    reportMetrics();
  }, config.interval * 1000);

  // Create connections with ramp-up
  const connectionsPerSecond = config.connections / config.rampUp;

  for (let i = 0; i < config.rampUp; i++) {
    const batchSize = Math.ceil(connectionsPerSecond);
    const startIndex = i * batchSize;

    console.log(
      `[${formatElapsedTime(startTime)}] Creating batch ${i + 1}/${config.rampUp} (${batchSize} connections)`,
    );

    for (let j = 0; j < batchSize; j++) {
      const connectionIndex = startIndex + j;
      if (connectionIndex < config.connections) {
        createConnection(connectionIndex);
      }
    }

    // Wait 1 second before creating the next batch
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Wait for the test duration
  await new Promise((resolve) =>
    setTimeout(resolve, (config.duration - config.rampUp) * 1000),
  );

  // Clean up
  clearInterval(reportingInterval);

  // Close all connections
  console.log(
    `[${formatElapsedTime(startTime)}] Test complete. Closing connections...`,
  );

  connections.forEach((connection) => {
    connection.eventSource.close();
  });

  // Final report
  console.log("\n=== SSE Load Test Results ===");
  reportMetrics();

  // Additional metrics
  const p95ConnectionTime = calculatePercentile(metrics.connectionTimes, 95);
  const p99ConnectionTime = calculatePercentile(metrics.connectionTimes, 99);
  const p95EventLatency = calculatePercentile(metrics.eventLatencies, 95);
  const p99EventLatency = calculatePercentile(metrics.eventLatencies, 99);

  console.log("\n=== Performance Metrics ===");
  console.log(`- P95 Connection Time: ${p95ConnectionTime.toFixed(2)}ms`);
  console.log(`- P99 Connection Time: ${p99ConnectionTime.toFixed(2)}ms`);
  console.log(`- P95 Event Latency: ${p95EventLatency.toFixed(2)}ms`);
  console.log(`- P99 Event Latency: ${p99EventLatency.toFixed(2)}ms`);

  process.exit(0);
}

// Calculate percentile
function calculatePercentile(values, percentile) {
  if (values.length === 0) return 0;

  // Sort values
  const sortedValues = [...values].sort((a, b) => a - b);

  // Calculate index
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;

  return sortedValues[index];
}

// Handle process termination
process.on("SIGINT", () => {
  console.log("\n\nTest interrupted. Cleaning up...");

  // Close all connections
  connections.forEach((connection) => {
    connection.eventSource.close();
  });

  // Final report
  reportMetrics();

  process.exit(0);
});

// Run the test
runTest().catch((error) => {
  console.error("Error running test:", error);
  process.exit(1);
});
