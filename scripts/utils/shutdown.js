const { redis } = require('../../src/lib/redis');

async function gracefulShutdown() {
  console.log('Starting graceful shutdown...');
  try {
    // Close Redis connection
    if (redis.status === 'ready') {
      await redis.quit();
      console.log('Redis connection closed.');
    }

    // Add any other cleanup tasks here

    console.log('Graceful shutdown complete.');
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Trigger shutdown for testing
if (require.main === module) {
  gracefulShutdown();
}

module.exports = { gracefulShutdown };