#!/usr/bin/env node

/**
 * Performance Test Script: Redis vs Dragonfly
 * 
 * This script benchmarks Redis and Dragonfly performance for notification queuing
 * operations to help evaluate migrating from Redis to Dragonfly.
 */

const Redis = require('ioredis');
const { performance } = require('perf_hooks');

// Configuration
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: 0,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true,
};

const DRAGONFLY_CONFIG = {
  host: process.env.DRAGONFLY_HOST || 'localhost',
  port: process.env.DRAGONFLY_PORT || 6380,
  password: process.env.DRAGONFLY_PASSWORD || undefined,
  db: 0,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true,
};

const TEST_CONFIG = {
  warmupOperations: 100,
  testOperations: 1000,
  batchSizes: [1, 10, 50, 100],
  concurrentClients: [1, 5, 10],
  payloadSizes: ['small', 'medium', 'large'],
};

// Sample notification payloads
const NOTIFICATION_PAYLOADS = {
  small: {
    type: 'USER_APPROVED',
    userId: 'user123',
    title: 'Account Approved',
    body: 'Your account has been approved!',
    timestamp: Date.now(),
  },
  medium: {
    type: 'USER_APPROVAL_REQUESTED',
    userId: 'user123',
    title: 'Approval Request',
    body: 'A user has requested account approval. Please review their application and approve or reject as appropriate.',
    url: '/admin/users/pending',
    metadata: {
      branchId: 'branch123',
      requestedBy: 'user456',
      userDetails: {
        name: 'John Doe',
        email: 'john.doe@example.com',
        role: 'VIEWER',
      },
    },
    timestamp: Date.now(),
  },
  large: {
    type: 'REPORT_SUBMITTED',
    userId: 'user123',
    title: 'New Report Submitted',
    body: 'A comprehensive report has been submitted for review. The report contains detailed information about various aspects of the system performance.',
    url: '/reports/12345',
    metadata: {
      reportId: '12345',
      branchId: 'branch123',
      submittedBy: 'user456',
      reportData: {
        sections: Array.from({ length: 20 }, (_, i) => ({
          id: `section-${i}`,
          title: `Section ${i + 1}`,
          content: `This is a detailed section with comprehensive data analysis and insights. ${Array.from({ length: 50 }, () => 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.').join(' ')}`,
          metrics: Array.from({ length: 10 }, (_, j) => ({
            name: `metric-${j}`,
            value: Math.random() * 100,
            unit: 'units',
          })),
        })),
      },
    },
    attachments: Array.from({ length: 5 }, (_, i) => ({
      id: `attachment-${i}`,
      name: `document-${i}.pdf`,
      size: Math.floor(Math.random() * 1000000),
      url: `/uploads/documents/document-${i}.pdf`,
    })),
    timestamp: Date.now(),
  },
};

class PerformanceTester {
  constructor() {
    this.redis = null;
    this.dragonfly = null;
    this.results = {
      redis: {},
      dragonfly: {},
    };
  }

  async initialize() {
    console.log('🚀 Initializing Redis and Dragonfly connections...');

    try {
      this.redis = new Redis(REDIS_CONFIG);
      await this.redis.ping();
      console.log('✅ Redis connection established');
    } catch (error) {
      console.warn('⚠️  Redis connection failed:', error.message);
      this.redis = null;
    }

    try {
      this.dragonfly = new Redis(DRAGONFLY_CONFIG);
      await this.dragonfly.ping();
      console.log('✅ Dragonfly connection established');
    } catch (error) {
      console.warn('⚠️  Dragonfly connection failed:', error.message);
      this.dragonfly = null;
    }

    if (!this.redis && !this.dragonfly) {
      throw new Error('No database connections available');
    }
  }

  async warmup(client, name) {
    console.log(`🔥 Warming up ${name}...`);
    const operations = [];

    for (let i = 0; i < TEST_CONFIG.warmupOperations; i++) {
      operations.push(
        client.lpush('warmup:notifications', JSON.stringify(NOTIFICATION_PAYLOADS.small))
      );
    }

    await Promise.all(operations);
    await client.ltrim('warmup:notifications', 0, 0);
    console.log(`✅ ${name} warmed up`);
  }

  async testSingleOperations(client, name, payloadSize) {
    const payload = NOTIFICATION_PAYLOADS[payloadSize];
    const queueKey = `test:${name.toLowerCase()}:notifications:${payloadSize}`;

    // Test LPUSH operations
    const start = performance.now();
    const operations = [];

    for (let i = 0; i < TEST_CONFIG.testOperations; i++) {
      operations.push(
        client.lpush(queueKey, JSON.stringify({ ...payload, id: `test-${i}` }))
      );
    }

    await Promise.all(operations);
    const pushTime = performance.now() - start;

    // Test BRPOP operations (simulate workers consuming)
    const popStart = performance.now();
    const popOperations = [];

    for (let i = 0; i < TEST_CONFIG.testOperations; i++) {
      popOperations.push(client.brpop(queueKey, 1));
    }

    await Promise.all(popOperations);
    const popTime = performance.now() - popStart;

    // Cleanup
    await client.del(queueKey);

    return {
      pushTime,
      popTime,
      pushOpsPerSec: (TEST_CONFIG.testOperations / pushTime) * 1000,
      popOpsPerSec: (TEST_CONFIG.testOperations / popTime) * 1000,
    };
  }

  async testBatchOperations(client, name, payloadSize, batchSize) {
    const payload = NOTIFICATION_PAYLOADS[payloadSize];
    const queueKey = `test:${name.toLowerCase()}:batch:${payloadSize}:${batchSize}`;

    const batches = Math.ceil(TEST_CONFIG.testOperations / batchSize);
    const start = performance.now();

    for (let i = 0; i < batches; i++) {
      const batchItems = [];
      for (let j = 0; j < batchSize && (i * batchSize + j) < TEST_CONFIG.testOperations; j++) {
        batchItems.push(JSON.stringify({ ...payload, id: `batch-${i}-${j}` }));
      }
      await client.lpush(queueKey, ...batchItems);
    }

    const batchTime = performance.now() - start;

    // Cleanup
    await client.del(queueKey);

    return {
      batchTime,
      batchOpsPerSec: (TEST_CONFIG.testOperations / batchTime) * 1000,
    };
  }

  async testConcurrentOperations(client, name, payloadSize, concurrentClients) {
    const payload = NOTIFICATION_PAYLOADS[payloadSize];
    const operationsPerClient = Math.floor(TEST_CONFIG.testOperations / concurrentClients);

    const start = performance.now();
    const clientPromises = [];

    for (let clientId = 0; clientId < concurrentClients; clientId++) {
      const queueKey = `test:${name.toLowerCase()}:concurrent:${payloadSize}:${clientId}`;

      const clientPromise = (async () => {
        const operations = [];
        for (let i = 0; i < operationsPerClient; i++) {
          operations.push(
            client.lpush(queueKey, JSON.stringify({ ...payload, id: `concurrent-${clientId}-${i}` }))
          );
        }
        await Promise.all(operations);
        await client.del(queueKey);
      })();

      clientPromises.push(clientPromise);
    }

    await Promise.all(clientPromises);
    const concurrentTime = performance.now() - start;

    return {
      concurrentTime,
      concurrentOpsPerSec: ((operationsPerClient * concurrentClients) / concurrentTime) * 1000,
    };
  }

  async testMemoryUsage(client, name) {
    const initialInfo = await client.memory('usage', 'test:memory');
    const testKey = `test:${name.toLowerCase()}:memory`;

    // Add test data
    const operations = [];
    for (let i = 0; i < 1000; i++) {
      operations.push(
        client.lpush(testKey, JSON.stringify(NOTIFICATION_PAYLOADS.medium))
      );
    }
    await Promise.all(operations);

    const memoryUsage = await client.memory('usage', testKey);
    await client.del(testKey);

    return {
      memoryUsageBytes: memoryUsage,
      memoryUsageMB: (memoryUsage / 1024 / 1024).toFixed(2),
    };
  }

  async runTests() {
    console.log('\n📊 Starting performance tests...\n');

    const clients = [];
    if (this.redis) clients.push({ client: this.redis, name: 'Redis' });
    if (this.dragonfly) clients.push({ client: this.dragonfly, name: 'Dragonfly' });

    for (const { client, name } of clients) {
      console.log(`\n🧪 Testing ${name}...\n`);

      // Warmup
      await this.warmup(client, name);

      this.results[name.toLowerCase()] = {};

      // Test different payload sizes
      for (const payloadSize of TEST_CONFIG.payloadSizes) {
        console.log(`  📦 Testing ${payloadSize} payloads...`);

        this.results[name.toLowerCase()][payloadSize] = {};

        // Single operations test
        const singleResults = await this.testSingleOperations(client, name, payloadSize);
        this.results[name.toLowerCase()][payloadSize].single = singleResults;

        // Batch operations test
        for (const batchSize of TEST_CONFIG.batchSizes) {
          const batchResults = await this.testBatchOperations(client, name, payloadSize, batchSize);
          if (!this.results[name.toLowerCase()][payloadSize].batch) {
            this.results[name.toLowerCase()][payloadSize].batch = {};
          }
          this.results[name.toLowerCase()][payloadSize].batch[batchSize] = batchResults;
        }

        // Concurrent operations test
        for (const concurrentClients of TEST_CONFIG.concurrentClients) {
          const concurrentResults = await this.testConcurrentOperations(client, name, payloadSize, concurrentClients);
          if (!this.results[name.toLowerCase()][payloadSize].concurrent) {
            this.results[name.toLowerCase()][payloadSize].concurrent = {};
          }
          this.results[name.toLowerCase()][payloadSize].concurrent[concurrentClients] = concurrentResults;
        }
      }

      // Memory usage test
      const memoryResults = await this.testMemoryUsage(client, name);
      this.results[name.toLowerCase()].memory = memoryResults;

      console.log(`✅ ${name} tests completed`);
    }
  }

  generateReport() {
    console.log('\n📋 PERFORMANCE TEST RESULTS');
    console.log('='.repeat(80));

    const clients = Object.keys(this.results).filter(key => Object.keys(this.results[key]).length > 0);

    // Summary table
    console.log('\n📊 OPERATIONS PER SECOND SUMMARY');
    console.log('-'.repeat(80));
    console.log('| Test Type        | Payload | Redis      | Dragonfly  | Winner     |');
    console.log('|-----------------|---------|------------|------------|------------|');

    for (const payloadSize of TEST_CONFIG.payloadSizes) {
      const redisOps = this.results.redis?.[payloadSize]?.single?.pushOpsPerSec || 0;
      const dragonflyOps = this.results.dragonfly?.[payloadSize]?.single?.pushOpsPerSec || 0;
      const winner = redisOps > dragonflyOps ? 'Redis' : dragonflyOps > redisOps ? 'Dragonfly' : 'Tie';

      console.log(`| Single Push      | ${payloadSize.padEnd(7)} | ${redisOps.toFixed(0).padStart(10)} | ${dragonflyOps.toFixed(0).padStart(10)} | ${winner.padEnd(10)} |`);
    }

    // Detailed results
    for (const client of clients) {
      console.log(`\n🔍 DETAILED RESULTS - ${client.toUpperCase()}`);
      console.log('-'.repeat(50));

      for (const payloadSize of TEST_CONFIG.payloadSizes) {
        const data = this.results[client][payloadSize];
        if (!data) continue;

        console.log(`\n  📦 ${payloadSize.toUpperCase()} Payload Results:`);

        if (data.single) {
          console.log(`    Single Operations:`);
          console.log(`      Push: ${data.single.pushOpsPerSec.toFixed(0)} ops/sec (${data.single.pushTime.toFixed(2)}ms total)`);
          console.log(`      Pop:  ${data.single.popOpsPerSec.toFixed(0)} ops/sec (${data.single.popTime.toFixed(2)}ms total)`);
        }

        if (data.batch) {
          console.log(`    Batch Operations:`);
          for (const [batchSize, result] of Object.entries(data.batch)) {
            console.log(`      Batch ${batchSize}: ${result.batchOpsPerSec.toFixed(0)} ops/sec`);
          }
        }

        if (data.concurrent) {
          console.log(`    Concurrent Operations:`);
          for (const [concurrentClients, result] of Object.entries(data.concurrent)) {
            console.log(`      ${concurrentClients} clients: ${result.concurrentOpsPerSec.toFixed(0)} ops/sec`);
          }
        }
      }

      if (this.results[client].memory) {
        console.log(`\n  💾 Memory Usage: ${this.results[client].memory.memoryUsageMB} MB`);
      }
    }

    // Recommendations
    console.log('\n🎯 RECOMMENDATIONS');
    console.log('-'.repeat(50));

    if (clients.length === 2) {
      const redisAvg = this.calculateAveragePerformance('redis');
      const dragonflyAvg = this.calculateAveragePerformance('dragonfly');

      if (dragonflyAvg > redisAvg * 1.1) {
        console.log('✅ Dragonfly shows significantly better performance (+10% or more)');
        console.log('   Recommendation: Consider migrating to Dragonfly');
      } else if (redisAvg > dragonflyAvg * 1.1) {
        console.log('✅ Redis shows significantly better performance (+10% or more)');
        console.log('   Recommendation: Stay with Redis');
      } else {
        console.log('⚖️  Performance is comparable between Redis and Dragonfly');
        console.log('   Recommendation: Consider other factors like memory usage, features, and cost');
      }
    } else {
      console.log('ℹ️  Only one database was tested. Run with both Redis and Dragonfly for comparison.');
    }

    console.log('\n📝 Test completed at:', new Date().toISOString());
  }

  calculateAveragePerformance(client) {
    const data = this.results[client];
    if (!data) return 0;

    let totalOps = 0;
    let testCount = 0;

    for (const payloadSize of TEST_CONFIG.payloadSizes) {
      if (data[payloadSize]?.single?.pushOpsPerSec) {
        totalOps += data[payloadSize].single.pushOpsPerSec;
        testCount++;
      }
    }

    return testCount > 0 ? totalOps / testCount : 0;
  }

  async cleanup() {
    if (this.redis) {
      await this.redis.disconnect();
    }
    if (this.dragonfly) {
      await this.dragonfly.disconnect();
    }
  }
}

// Main execution
async function main() {
  const tester = new PerformanceTester();

  try {
    await tester.initialize();
    await tester.runTests();
    tester.generateReport();
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n⏹️  Test interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⏹️  Test terminated');
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = { PerformanceTester };