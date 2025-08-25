/**
 * Dragonfly Performance Benchmark Suite
 * 
 * Comprehensive benchmarking system to compare Redis vs Dragonfly performance:
 * - Basic operations (GET, SET, DEL)
 * - Complex data structures (Lists, Sets, Hashes, Sorted Sets)
 * - Pub/Sub performance
 * - Pipeline operations
 * - Memory usage analysis
 * - Concurrent operations
 * - Cache hit/miss ratios
 * - Throughput and latency measurements
 */

import { getDragonflyOptimizedClient, executeOptimized, pipelineOptimized } from './dragonflyOptimizedClient';
import { getDragonflyEnhancedCache } from './dragonflyEnhancedCache';
import { getDragonflyPubSub } from './dragonflyPubSub';
import { getRedis } from '../redis';
import Redis from 'ioredis';
import { performance } from 'perf_hooks';

// Benchmark configuration
interface BenchmarkConfig {
  iterations: number;
  concurrency: number;
  dataSize: number;
  keyPrefix: string;
  warmupIterations: number;
  testDuration: number; // in milliseconds
  enableMemoryTracking: boolean;
  enableLatencyHistogram: boolean;
}

// Benchmark result interface
interface BenchmarkResult {
  testName: string;
  implementation: 'redis' | 'dragonfly';
  operations: number;
  duration: number;
  throughput: number; // ops/sec
  averageLatency: number; // ms
  minLatency: number;
  maxLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  memoryUsage?: number;
  cpuUsage?: number;
  metadata?: Record<string, any>;
}

// Comparison result
interface ComparisonResult {
  testName: string;
  redisResult: BenchmarkResult;
  dragonflyResult: BenchmarkResult;
  improvement: {
    throughput: number; // percentage
    latency: number; // percentage
    memory: number; // percentage
  };
  winner: 'redis' | 'dragonfly' | 'tie';
}

// Test operation interface
interface TestOperation {
  name: string;
  setup?: () => Promise<void>;
  execute: (client: Redis, iteration: number) => Promise<any>;
  cleanup?: () => Promise<void>;
  validate?: (result: any) => boolean;
}

export class DragonflyBenchmark {
  private config: BenchmarkConfig;
  private redisClient: Redis | null = null;
  private dragonflyClient: any = null;
  private results: BenchmarkResult[] = [];
  private comparisons: ComparisonResult[] = [];

  constructor(config: Partial<BenchmarkConfig> = {}) {
    this.config = {
      iterations: config.iterations || 10000,
      concurrency: config.concurrency || 10,
      dataSize: config.dataSize || 1024, // 1KB
      keyPrefix: config.keyPrefix || 'benchmark',
      warmupIterations: config.warmupIterations || 1000,
      testDuration: config.testDuration || 60000, // 1 minute
      enableMemoryTracking: config.enableMemoryTracking ?? true,
      enableLatencyHistogram: config.enableLatencyHistogram ?? true
    };
  }

  /**
   * Initialize benchmark clients
   */
  async initialize(): Promise<void> {
    console.log('[DragonflyBenchmark] Initializing benchmark clients...');
    
    try {
      // Initialize Redis client
      this.redisClient = await getRedis();
      
      // Initialize Dragonfly client
      this.dragonflyClient = await getDragonflyOptimizedClient();
      
      console.log('[DragonflyBenchmark] Clients initialized successfully');
    } catch (error) {
      console.error('[DragonflyBenchmark] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Run comprehensive benchmark suite
   */
  async runFullBenchmark(): Promise<ComparisonResult[]> {
    await this.initialize();
    
    console.log('[DragonflyBenchmark] Starting comprehensive benchmark suite...');
    
    const testSuites = [
      this.getBasicOperationTests(),
      this.getDataStructureTests(),
      this.getPipelineTests(),
      this.getConcurrencyTests(),
      this.getCacheTests(),
      this.getPubSubTests()
    ];
    
    for (const testSuite of testSuites) {
      for (const test of testSuite) {
        await this.runComparison(test);
      }
    }
    
    await this.generateReport();
    return this.comparisons;
  }

  /**
   * Run a single test comparison between Redis and Dragonfly
   */
  async runComparison(test: TestOperation): Promise<ComparisonResult> {
    console.log(`[DragonflyBenchmark] Running test: ${test.name}`);
    
    // Run warmup
    await this.runWarmup(test);
    
    // Run Redis benchmark
    const redisResult = await this.runBenchmark(test, 'redis', this.redisClient!);
    
    // Run Dragonfly benchmark
    const dragonflyResult = await this.runBenchmark(test, 'dragonfly', this.dragonflyClient);
    
    // Calculate comparison
    const comparison = this.calculateComparison(test.name, redisResult, dragonflyResult);
    
    this.results.push(redisResult, dragonflyResult);
    this.comparisons.push(comparison);
    
    console.log(`[DragonflyBenchmark] ${test.name} completed - Winner: ${comparison.winner}`);
    
    return comparison;
  }

  /**
   * Run benchmark for a specific implementation
   */
  private async runBenchmark(
    test: TestOperation, 
    implementation: 'redis' | 'dragonfly', 
    client: Redis
  ): Promise<BenchmarkResult> {
    const latencies: number[] = [];
    let operations = 0;
    let errors = 0;
    
    // Setup
    if (test.setup) {
      await test.setup();
    }
    
    const startTime = performance.now();
    const endTime = startTime + this.config.testDuration;
    
    // Run concurrent operations
    const promises: Promise<{ operations: number; errors: number }>[] = [];
    
    for (let i = 0; i < this.config.concurrency; i++) {
      promises.push(this.runWorker(test, client, latencies, endTime, i));
    }
    
    const workerResults = await Promise.allSettled(promises);
    
    // Count operations and errors
    workerResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        operations += result.value.operations;
        errors += result.value.errors;
      } else {
        console.error(`Worker ${index} failed:`, result.reason);
        errors++;
      }
    });
    
    const actualDuration = performance.now() - startTime;
    
    // Cleanup
    if (test.cleanup) {
      await test.cleanup();
    }
    
    // Calculate statistics
    const sortedLatencies = latencies.sort((a, b) => a - b);
    const throughput = (operations / actualDuration) * 1000; // ops/sec
    
    return {
      testName: test.name,
      implementation,
      operations,
      duration: actualDuration,
      throughput,
      averageLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length || 0,
      minLatency: sortedLatencies[0] || 0,
      maxLatency: sortedLatencies[sortedLatencies.length - 1] || 0,
      p50Latency: this.getPercentile(sortedLatencies, 50),
      p95Latency: this.getPercentile(sortedLatencies, 95),
      p99Latency: this.getPercentile(sortedLatencies, 99),
      errorRate: operations > 0 ? (errors / operations) * 100 : 0,
      memoryUsage: await this.getMemoryUsage(client)
    };
  }

  /**
   * Run a single worker for concurrent testing
   */
  private async runWorker(
    test: TestOperation,
    client: Redis,
    latencies: number[],
    endTime: number,
    workerId: number
  ): Promise<{ operations: number; errors: number }> {
    let operations = 0;
    let errors = 0;
    
    while (performance.now() < endTime) {
      try {
        const startOp = performance.now();
        const result = await test.execute(client, operations);
        const endOp = performance.now();
        
        latencies.push(endOp - startOp);
        
        // Validate result if validator provided
        if (test.validate && !test.validate(result)) {
          errors++;
        }
        
        operations++;
      } catch (error) {
        errors++;
        console.error(`Worker ${workerId} operation failed:`, error);
      }
    }
    
    return { operations, errors };
  }

  /**
   * Run warmup operations
   */
  private async runWarmup(test: TestOperation): Promise<void> {
    console.log(`[DragonflyBenchmark] Warming up ${test.name}...`);
    
    const warmupPromises = [];
    
    for (let i = 0; i < this.config.warmupIterations; i++) {
      warmupPromises.push(
        test.execute(this.redisClient!, i).catch(() => {}),
        test.execute(this.dragonflyClient, i).catch(() => {})
      );
    }
    
    await Promise.allSettled(warmupPromises);
  }

  /**
   * Calculate comparison between Redis and Dragonfly results
   */
  private calculateComparison(
    testName: string,
    redisResult: BenchmarkResult,
    dragonflyResult: BenchmarkResult
  ): ComparisonResult {
    const throughputImprovement = 
      ((dragonflyResult.throughput - redisResult.throughput) / redisResult.throughput) * 100;
    
    const latencyImprovement = 
      ((redisResult.averageLatency - dragonflyResult.averageLatency) / redisResult.averageLatency) * 100;
    
    const memoryImprovement = redisResult.memoryUsage && dragonflyResult.memoryUsage
      ? ((redisResult.memoryUsage - dragonflyResult.memoryUsage) / redisResult.memoryUsage) * 100
      : 0;
    
    // Determine winner based on overall performance
    let winner: 'redis' | 'dragonfly' | 'tie' = 'tie';
    
    const score = (throughputImprovement * 0.4) + (latencyImprovement * 0.4) + (memoryImprovement * 0.2);
    
    if (score > 5) {
      winner = 'dragonfly';
    } else if (score < -5) {
      winner = 'redis';
    }
    
    return {
      testName,
      redisResult,
      dragonflyResult,
      improvement: {
        throughput: throughputImprovement,
        latency: latencyImprovement,
        memory: memoryImprovement
      },
      winner
    };
  }

  /**
   * Get basic operation tests
   */
  private getBasicOperationTests(): TestOperation[] {
    const testData = 'x'.repeat(this.config.dataSize);
    
    return [
      {
        name: 'SET Operation',
        execute: async (client: Redis, iteration: number) => {
          const key = `${this.config.keyPrefix}:set:${iteration}`;
          return await client.set(key, testData);
        },
        validate: (result) => result === 'OK'
      },
      {
        name: 'GET Operation',
        setup: async () => {
          // Pre-populate keys for GET test
          const pipeline = this.redisClient!.pipeline();
          for (let i = 0; i < 1000; i++) {
            pipeline.set(`${this.config.keyPrefix}:get:${i}`, testData);
          }
          await pipeline.exec();
        },
        execute: async (client: Redis, iteration: number) => {
          const key = `${this.config.keyPrefix}:get:${iteration % 1000}`;
          return await client.get(key);
        },
        validate: (result) => result === testData
      },
      {
        name: 'DEL Operation',
        setup: async () => {
          // Pre-populate keys for DEL test
          const pipeline = this.redisClient!.pipeline();
          for (let i = 0; i < 10000; i++) {
            pipeline.set(`${this.config.keyPrefix}:del:${i}`, testData);
          }
          await pipeline.exec();
        },
        execute: async (client: Redis, iteration: number) => {
          const key = `${this.config.keyPrefix}:del:${iteration}`;
          return await client.del(key);
        },
        validate: (result) => result === 1
      },
      {
        name: 'INCR Operation',
        execute: async (client: Redis, iteration: number) => {
          const key = `${this.config.keyPrefix}:incr:${iteration % 100}`;
          return await client.incr(key);
        },
        validate: (result) => typeof result === 'number'
      }
    ];
  }

  /**
   * Get data structure operation tests
   */
  private getDataStructureTests(): TestOperation[] {
    return [
      {
        name: 'LPUSH Operation',
        execute: async (client: Redis, iteration: number) => {
          const key = `${this.config.keyPrefix}:list:${iteration % 100}`;
          return await client.lpush(key, `item-${iteration}`);
        },
        validate: (result) => typeof result === 'number'
      },
      {
        name: 'SADD Operation',
        execute: async (client: Redis, iteration: number) => {
          const key = `${this.config.keyPrefix}:set:${iteration % 100}`;
          return await client.sadd(key, `member-${iteration}`);
        },
        validate: (result) => result === 1 || result === 0
      },
      {
        name: 'HSET Operation',
        execute: async (client: Redis, iteration: number) => {
          const key = `${this.config.keyPrefix}:hash:${iteration % 100}`;
          return await client.hset(key, `field-${iteration}`, `value-${iteration}`);
        },
        validate: (result) => result === 1 || result === 0
      },
      {
        name: 'ZADD Operation',
        execute: async (client: Redis, iteration: number) => {
          const key = `${this.config.keyPrefix}:zset:${iteration % 100}`;
          return await client.zadd(key, iteration, `member-${iteration}`);
        },
        validate: (result) => result === 1 || result === 0
      }
    ];
  }

  /**
   * Get pipeline operation tests
   */
  private getPipelineTests(): TestOperation[] {
    return [
      {
        name: 'Pipeline Operations',
        execute: async (client: Redis, iteration: number) => {
          const pipeline = client.pipeline();
          
          for (let i = 0; i < 10; i++) {
            const key = `${this.config.keyPrefix}:pipeline:${iteration}:${i}`;
            pipeline.set(key, `value-${i}`);
            pipeline.get(key);
          }
          
          const results = await pipeline.exec();
          return results;
        },
        validate: (results) => Array.isArray(results) && results.length === 20
      }
    ];
  }

  /**
   * Get concurrency tests
   */
  private getConcurrencyTests(): TestOperation[] {
    return [
      {
        name: 'Concurrent SET/GET',
        execute: async (client: Redis, iteration: number) => {
          const key = `${this.config.keyPrefix}:concurrent:${iteration}`;
          const value = `value-${iteration}`;
          
          await client.set(key, value);
          const result = await client.get(key);
          
          return result;
        },
        validate: (result) => typeof result === 'string'
      }
    ];
  }

  /**
   * Get cache-specific tests
   */
  private getCacheTests(): TestOperation[] {
    return [
      {
        name: 'Cache SET/GET',
        execute: async (client: Redis, iteration: number) => {
          const cache = getDragonflyEnhancedCache();
          const key = `cache-test-${iteration}`;
          const value = { data: `test-data-${iteration}`, timestamp: Date.now() };
          
          await cache.set(key, value, 3600);
          const result = await cache.get(key);
          
          return result;
        },
        validate: (result) => result && typeof result === 'object'
      }
    ];
  }

  /**
   * Get pub/sub tests
   */
  private getPubSubTests(): TestOperation[] {
    return [
      {
        name: 'Pub/Sub Message',
        execute: async (client: Redis, iteration: number) => {
          const pubsub = getDragonflyPubSub();
          const channel = `test-channel-${iteration % 10}`;
          const message = { id: iteration, data: `message-${iteration}` };
          
          return await pubsub.publish(channel, message);
        },
        validate: (result) => typeof result === 'string'
      }
    ];
  }

  /**
   * Get memory usage for a client
   */
  private async getMemoryUsage(client: Redis): Promise<number> {
    try {
      const info = await client.info('memory');
      const match = info.match(/used_memory:(\d+)/);
      return match ? parseInt(match[1]) : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate percentile from sorted array
   */
  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  /**
   * Generate comprehensive benchmark report
   */
  private async generateReport(): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('DRAGONFLY VS REDIS PERFORMANCE BENCHMARK REPORT');
    console.log('='.repeat(80));
    
    console.log(`\nBenchmark Configuration:`);
    console.log(`- Test Duration: ${this.config.testDuration}ms`);
    console.log(`- Concurrency: ${this.config.concurrency}`);
    console.log(`- Data Size: ${this.config.dataSize} bytes`);
    console.log(`- Warmup Iterations: ${this.config.warmupIterations}`);
    
    console.log('\nTest Results Summary:');
    console.log('-'.repeat(80));
    
    let dragonflyWins = 0;
    let redisWins = 0;
    let ties = 0;
    
    for (const comparison of this.comparisons) {
      const { testName, improvement, winner } = comparison;
      
      console.log(`\n${testName}:`);
      console.log(`  Winner: ${winner.toUpperCase()}`);
      console.log(`  Throughput improvement: ${improvement.throughput.toFixed(2)}%`);
      console.log(`  Latency improvement: ${improvement.latency.toFixed(2)}%`);
      console.log(`  Memory improvement: ${improvement.memory.toFixed(2)}%`);
      
      if (winner === 'dragonfly') dragonflyWins++;
      else if (winner === 'redis') redisWins++;
      else ties++;
    }
    
    console.log('\nOverall Summary:');
    console.log('-'.repeat(40));
    console.log(`Dragonfly wins: ${dragonflyWins}`);
    console.log(`Redis wins: ${redisWins}`);
    console.log(`Ties: ${ties}`);
    
    const overallWinner = dragonflyWins > redisWins ? 'DRAGONFLY' : 
                         redisWins > dragonflyWins ? 'REDIS' : 'TIE';
    
    console.log(`\nOVERALL WINNER: ${overallWinner}`);
    console.log('='.repeat(80));
  }

  /**
   * Export results to JSON
   */
  exportResults(): { results: BenchmarkResult[]; comparisons: ComparisonResult[] } {
    return {
      results: this.results,
      comparisons: this.comparisons
    };
  }

  /**
   * Clean up benchmark resources
   */
  async cleanup(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    
    if (this.dragonflyClient && this.dragonflyClient.shutdown) {
      await this.dragonflyClient.shutdown();
    }
    
    console.log('[DragonflyBenchmark] Cleanup completed');
  }
}

// Convenience function to run a quick benchmark
export async function runQuickBenchmark(): Promise<ComparisonResult[]> {
  const benchmark = new DragonflyBenchmark({
    testDuration: 30000, // 30 seconds
    concurrency: 5,
    dataSize: 512
  });
  
  try {
    const results = await benchmark.runFullBenchmark();
    return results;
  } finally {
    await benchmark.cleanup();
  }
}

// Export for use in other modules
export type { BenchmarkConfig, BenchmarkResult, ComparisonResult };