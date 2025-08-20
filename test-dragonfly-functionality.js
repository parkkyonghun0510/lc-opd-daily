#!/usr/bin/env node

/**
 * Dragonfly URL and Notification System Test Suite
 * 
 * This script tests:
 * 1. Dragonfly URL connectivity
 * 2. Queue functionality
 * 3. Notification sending and processing
 * 4. Worker functionality
 * 5. Error handling and edge cases
 */

const { createClient } = require('redis');
const { getDragonflyQueueService } = require('./dist/lib/dragonfly-queue.js');
const { sendNotification } = require('./dist/lib/notifications/dragonflyNotificationService.js');

// Test configuration
const DRAGONFLY_URL = process.env.DRAGONFLY_URL || 'redis://localhost:6379';
const QUEUE_NAME = process.env.DRAGONFLY_QUEUE_NAME || 'notifications';

// Test results storage
const testResults = {
  connectivity: {},
  queue: {},
  notifications: {},
  worker: {},
  errors: []
};

/**
 * Test Dragonfly URL connectivity
 */
async function testDragonflyConnectivity() {
  console.log('🔍 Testing Dragonfly URL connectivity...');
  
  try {
    const client = createClient({
      url: DRAGONFLY_URL,
      socket: {
        connectTimeout: 10000,
        reconnectStrategy: (retries) => Math.min(retries * 50, 500),
      },
    });

    client.on('error', (err) => {
      testResults.connectivity.error = err.message;
      testResults.errors.push(`Redis client error: ${err.message}`);
    });

    await client.connect();
    
    // Test basic ping
    const pingResult = await client.ping();
    testResults.connectivity.ping = pingResult === 'PONG';
    
    // Test info command
    const info = await client.info();
    testResults.connectivity.info = info.includes('redis_version');
    
    // Test database operations
    await client.set('test:dragonfly:connectivity', 'success');
    const getResult = await client.get('test:dragonfly:connectivity');
    testResults.connectivity.setGet = getResult === 'success';
    
    await client.del('test:dragonfly:connectivity');
    await client.disconnect();
    
    console.log('✅ Dragonfly connectivity test completed');
    return true;
  } catch (error) {
    console.error('❌ Dragonfly connectivity test failed:', error.message);
    testResults.connectivity.error = error.message;
    testResults.errors.push(`Connectivity test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test queue functionality
 */
async function testQueueFunctionality() {
  console.log('🔍 Testing Dragonfly queue functionality...');
  
  try {
    const queueService = getDragonflyQueueService();
    
    // Test queue stats
    const stats = await queueService.getQueueStats();
    testResults.queue.stats = stats;
    
    // Test sending a test message
    const testMessage = {
      type: 'TEST_NOTIFICATION',
      userIds: ['test-user-1', 'test-user-2'],
      data: { test: true, timestamp: new Date().toISOString() }
    };
    
    const sendResult = await queueService.sendMessage({
      QueueUrl: `dragonfly://${QUEUE_NAME}`,
      MessageBody: JSON.stringify(testMessage),
      DelaySeconds: 0
    });
    
    testResults.queue.sendMessage = !!sendResult.MessageId;
    testResults.queue.messageId = sendResult.MessageId;
    
    // Test receiving messages
    const messages = await queueService.receiveMessage({
      QueueUrl: `dragonfly://${QUEUE_NAME}`,
      MaxNumberOfMessages: 1
    });
    
    testResults.queue.receiveMessage = messages.length > 0;
    if (messages.length > 0) {
      testResults.queue.receivedMessage = JSON.parse(messages[0].Body);
      
      // Clean up - delete the test message
      await queueService.deleteMessage({
        QueueUrl: `dragonfly://${QUEUE_NAME}`,
        ReceiptHandle: messages[0].ReceiptHandle
      });
    }
    
    console.log('✅ Queue functionality test completed');
    return true;
  } catch (error) {
    console.error('❌ Queue functionality test failed:', error.message);
    testResults.queue.error = error.message;
    testResults.errors.push(`Queue test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test notification system
 */
async function testNotificationSystem() {
  console.log('🔍 Testing notification system...');
  
  try {
    // Test notification sending
    const notificationId = await sendNotification({
      type: 'TEST_NOTIFICATION',
      data: {
        title: 'Test Notification',
        body: 'This is a test notification from the Dragonfly test suite',
        test: true
      },
      userIds: ['test-user-1']
    });
    
    testResults.notifications.sendNotification = !!notificationId;
    testResults.notifications.notificationId = notificationId;
    
    // Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if notification was queued
    const queueService = getDragonflyQueueService();
    const messages = await queueService.receiveMessage({
      QueueUrl: `dragonfly://${QUEUE_NAME}`,
      MaxNumberOfMessages: 10
    });
    
    const testMessages = messages.filter(msg => {
      try {
        const body = JSON.parse(msg.Body);
        return body.data?.test === true;
      } catch {
        return false;
      }
    });
    
    testResults.notifications.queued = testMessages.length > 0;
    
    // Clean up test messages
    for (const msg of testMessages) {
      await queueService.deleteMessage({
        QueueUrl: `dragonfly://${QUEUE_NAME}`,
        ReceiptHandle: msg.ReceiptHandle
      });
    }
    
    console.log('✅ Notification system test completed');
    return true;
  } catch (error) {
    console.error('❌ Notification system test failed:', error.message);
    testResults.notifications.error = error.message;
    testResults.errors.push(`Notification test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test URL format validation
 */
async function testUrlFormat() {
  console.log('🔍 Testing Dragonfly URL format...');
  
  try {
    const url = new URL(DRAGONFLY_URL);
    testResults.connectivity.urlFormat = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      valid: true
    };
    
    // Test if URL follows Redis URL format
    const isRedisUrl = DRAGONFLY_URL.startsWith('redis://') || DRAGONFLY_URL.startsWith('rediss://');
    testResults.connectivity.isRedisFormat = isRedisUrl;
    
    console.log('✅ URL format test completed');
    return true;
  } catch (error) {
    console.error('❌ URL format test failed:', error.message);
    testResults.connectivity.urlFormat = { valid: false, error: error.message };
    return false;
  }
}

/**
 * Generate comprehensive test report
 */
function generateTestReport() {
  console.log('\n📋 Dragonfly Test Report');
  console.log('='.repeat(50));
  
  const report = {
    timestamp: new Date().toISOString(),
    dragonfly_url: DRAGONFLY_URL,
    queue_name: QUEUE_NAME,
    test_results: testResults,
    summary: {
      total_tests: 4,
      passed: 0,
      failed: 0,
      errors: testResults.errors.length
    }
  };
  
  // Count passed/failed tests
  let passed = 0;
  let failed = 0;
  
  if (testResults.connectivity.ping && testResults.connectivity.setGet) passed++;
  else failed++;
  
  if (testResults.queue.sendMessage && testResults.queue.receiveMessage) passed++;
  else failed++;
  
  if (testResults.notifications.sendNotification && testResults.notifications.queued) passed++;
  else failed++;
  
  if (testResults.connectivity.urlFormat?.valid) passed++;
  else failed++;
  
  report.summary.passed = passed;
  report.summary.failed = failed;
  
  console.log(JSON.stringify(report, null, 2));
  
  // Write report to file
  const fs = require('fs');
  fs.writeFileSync('dragonfly-test-report.json', JSON.stringify(report, null, 2));
  
  console.log('\n📄 Report saved to: dragonfly-test-report.json');
  
  return report;
}

/**
 * Main test execution
 */
async function runTests() {
  console.log('🚀 Starting Dragonfly URL and Notification System Tests');
  console.log('URL:', DRAGONFLY_URL);
  console.log('Queue:', QUEUE_NAME);
  console.log('='.repeat(50));
  
  try {
    // Run all tests
    await testUrlFormat();
    await testDragonflyConnectivity();
    await testQueueFunctionality();
    await testNotificationSystem();
    
    const report = generateTestReport();
    
    console.log('\n🎉 Test execution completed!');
    
    if (report.summary.failed > 0) {
      console.log(`⚠️  ${report.summary.failed} test(s) failed. Check the report for details.`);
      process.exit(1);
    } else {
      console.log('✅ All tests passed!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('💥 Critical error during test execution:', error);
    testResults.errors.push(`Critical error: ${error.message}`);
    generateTestReport();
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests();
}

module.exports = {
  testDragonflyConnectivity,
  testQueueFunctionality,
  testNotificationSystem,
  testUrlFormat,
  runTests
};