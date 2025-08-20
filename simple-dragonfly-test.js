#!/usr/bin/env node

/**
 * Simple Dragonfly URL and Notification Test
 * 
 * This script directly tests:
 * 1. Dragonfly URL connectivity using Redis client
 * 2. Basic queue operations
 * 3. URL format validation
 * 4. Environment variable validation
 */

import { createClient } from 'redis';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

class DragonflyTester {
  constructor() {
    this.dragonflyUrl = process.env.DRAGONFLY_URL;
    this.queueName = process.env.DRAGONFLY_QUEUE_NAME || 'notifications';
    this.results = {
      timestamp: new Date().toISOString(),
      dragonfly_url: this.dragonflyUrl,
      queue_name: this.queueName,
      tests: {},
      errors: []
    };
  }

  async testEnvironmentVariables() {
    console.log('🔍 Testing environment variables...');
    
    this.results.tests.environment = {
      dragonfly_url_provided: !!this.dragonflyUrl,
      queue_name_provided: !!process.env.DRAGONFLY_QUEUE_NAME,
      url_format_valid: false,
      missing_vars: []
    };

    if (!this.dragonflyUrl) {
      this.results.tests.environment.missing_vars.push('DRAGONFLY_URL');
      this.results.errors.push('DRAGONFLY_URL environment variable is not set');
    }

    if (!process.env.DRAGONFLY_QUEUE_NAME) {
      this.results.tests.environment.missing_vars.push('DRAGONFLY_QUEUE_NAME (using default: notifications)');
    }

    try {
      if (this.dragonflyUrl) {
        const url = new URL(this.dragonflyUrl);
        this.results.tests.environment.url_format_valid = true;
        this.results.tests.environment.parsed_url = {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port,
          username: url.username || null,
          password: url.password ? '***' : null
        };
      }
    } catch (error) {
      this.results.tests.environment.url_format_valid = false;
      this.results.errors.push(`Invalid URL format: ${error.message}`);
    }

    console.log(`✅ Environment test completed`);
  }

  async testConnectivity() {
    console.log('🔍 Testing Dragonfly connectivity...');
    
    this.results.tests.connectivity = {
      connection_successful: false,
      ping_response: null,
      basic_operations: false,
      error: null
    };

    if (!this.dragonflyUrl) {
      this.results.tests.connectivity.error = 'No DRAGONFLY_URL provided';
      return false;
    }

    let client;
    try {
      client = createClient({
        url: this.dragonflyUrl,
        socket: {
          connectTimeout: 10000,
          reconnectStrategy: (retries) => Math.min(retries * 50, 500),
        },
      });

      await client.connect();
      
      // Test ping
      const pingResult = await client.ping();
      this.results.tests.connectivity.ping_response = pingResult;
      this.results.tests.connectivity.connection_successful = pingResult === 'PONG';
      
      // Test basic operations
      const testKey = `test:dragonfly:${Date.now()}`;
      await client.set(testKey, 'connectivity_test');
      const getResult = await client.get(testKey);
      await client.del(testKey);
      
      this.results.tests.connectivity.basic_operations = getResult === 'connectivity_test';
      
      await client.disconnect();
      
      console.log('✅ Connectivity test completed');
      return true;
    } catch (error) {
      this.results.tests.connectivity.error = error.message;
      this.results.errors.push(`Connectivity test failed: ${error.message}`);
      console.error('❌ Connectivity test failed:', error.message);
      return false;
    }
  }

  async testQueueOperations() {
    console.log('🔍 Testing queue operations...');
    
    this.results.tests.queue = {
      queue_exists: false,
      send_message: false,
      receive_message: false,
      delete_message: false,
      queue_length: null,
      error: null
    };

    if (!this.dragonflyUrl) {
      this.results.tests.queue.error = 'No DRAGONFLY_URL provided';
      return false;
    }

    let client;
    try {
      client = createClient({
        url: this.dragonflyUrl,
        socket: {
          connectTimeout: 10000,
          reconnectStrategy: (retries) => Math.min(retries * 50, 500),
        },
      });

      await client.connect();
      
      // Check if queue exists (will be created on first use)
      const queueLength = await client.lLen(this.queueName);
      this.results.tests.queue.queue_length = queueLength;
      this.results.tests.queue.queue_exists = true;
      
      // Test sending a message
      const testMessage = {
        id: `test-${Date.now()}`,
        type: 'TEST',
        data: { test: true, timestamp: new Date().toISOString() },
        userIds: ['test-user']
      };
      
      const sendResult = await client.lPush(this.queueName, JSON.stringify(testMessage));
      this.results.tests.queue.send_message = sendResult > 0;
      
      // Test receiving a message
      const receivedMessage = await client.rPop(this.queueName);
      this.results.tests.queue.receive_message = !!receivedMessage;
      
      if (receivedMessage) {
        try {
          const parsed = JSON.parse(receivedMessage);
          this.results.tests.queue.received_data = parsed;
          this.results.tests.queue.delete_message = true; // Successfully processed
        } catch (e) {
          this.results.tests.queue.delete_message = false;
        }
      }
      
      await client.disconnect();
      
      console.log('✅ Queue operations test completed');
      return true;
    } catch (error) {
      this.results.tests.queue.error = error.message;
      this.results.errors.push(`Queue test failed: ${error.message}`);
      console.error('❌ Queue operations test failed:', error.message);
      return false;
    }
  }

  async testRedisInfo() {
    console.log('🔍 Testing Redis info and capabilities...');
    
    this.results.tests.redis_info = {
      server_info: null,
      memory_usage: null,
      connected_clients: null,
      version: null,
      error: null
    };

    if (!this.dragonflyUrl) {
      this.results.tests.redis_info.error = 'No DRAGONFLY_URL provided';
      return false;
    }

    let client;
    try {
      client = createClient({
        url: this.dragonflyUrl,
        socket: {
          connectTimeout: 10000,
          reconnectStrategy: (retries) => Math.min(retries * 50, 500),
        },
      });

      await client.connect();
      
      // Get server info
      const info = await client.info();
      this.results.tests.redis_info.server_info = info.substring(0, 500) + '...'; // Truncate for readability
      
      // Parse key info
      const lines = info.split('\r\n');
      for (const line of lines) {
        if (line.startsWith('redis_version:')) {
          this.results.tests.redis_info.version = line.split(':')[1];
        }
        if (line.startsWith('connected_clients:')) {
          this.results.tests.redis_info.connected_clients = parseInt(line.split(':')[1]);
        }
        if (line.startsWith('used_memory_human:')) {
          this.results.tests.redis_info.memory_usage = line.split(':')[1];
        }
      }
      
      await client.disconnect();
      
      console.log('✅ Redis info test completed');
      return true;
    } catch (error) {
      this.results.tests.redis_info.error = error.message;
      this.results.errors.push(`Redis info test failed: ${error.message}`);
      console.error('❌ Redis info test failed:', error.message);
      return false;
    }
  }

  generateReport() {
    console.log('\n📋 Dragonfly Test Report');
    console.log('='.repeat(60));
    
    const passed = Object.values(this.results.tests).filter(test => 
      !test.error && Object.values(test).every(v => v !== false && v !== null)
    ).length;
    
    const failed = Object.values(this.results.tests).filter(test => 
      test.error || Object.values(test).some(v => v === false || v === null)
    ).length;
    
    this.results.summary = {
      total_tests: Object.keys(this.results.tests).length,
      passed,
      failed,
      errors: this.results.errors.length
    };
    
    console.log(JSON.stringify(this.results, null, 2));
    
    // Save to file
    fs.writeFileSync('dragonfly-test-results.json', JSON.stringify(this.results, null, 2));
    
    console.log('\n📄 Detailed report saved to: dragonfly-test-results.json');
    
    return this.results;
  }

  async runAllTests() {
    console.log('🚀 Starting Dragonfly URL and Notification System Tests');
    console.log('URL:', this.dragonflyUrl || 'Not configured');
    console.log('Queue:', this.queueName);
    console.log('='.repeat(60));
    
    try {
      await this.testEnvironmentVariables();
      await this.testConnectivity();
      await this.testQueueOperations();
      await this.testRedisInfo();
      
      const report = this.generateReport();
      
      console.log('\n🎉 Test execution completed!');
      
      if (report.summary.failed > 0 || report.errors.length > 0) {
        console.log(`⚠️  ${report.summary.failed} test(s) failed with ${report.errors.length} error(s)`);
        return 1;
      } else {
        console.log('✅ All tests passed!');
        return 0;
      }
      
    } catch (error) {
      console.error('💥 Critical error during test execution:', error);
      this.results.errors.push(`Critical error: ${error.message}`);
      this.generateReport();
      return 1;
    }
  }
}

// Run tests if called directly
const tester = new DragonflyTester();
tester.runAllTests().then(exitCode => {
  process.exit(exitCode);
});

export default DragonflyTester;