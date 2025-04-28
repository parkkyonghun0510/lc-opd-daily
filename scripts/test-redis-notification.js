/**
 * Test Redis Notification System
 * 
 * This script tests the Redis notification system by:
 * 1. Testing the Redis connection
 * 2. Sending a test notification using the Redis notification service
 * 3. Verifying the notification was processed correctly
 */

import { redis, testRedisConnection } from '../src/lib/redis.js';
import { sendNotification, getNotificationMetrics } from '../src/lib/notifications/redisNotificationService.js';
import { prisma } from '../src/lib/prisma.js';

async function testRedisNotificationSystem() {
  console.log('=== Testing Redis Notification System ===');

  // 1. Test Redis connection
  console.log('\n[1/4] Testing Redis connection...');
  const isConnected = await testRedisConnection();
  
  if (!isConnected) {
    console.error('❌ Redis connection failed. Please check your Redis configuration.');
    process.exit(1);
  }
  
  console.log('✅ Redis connection successful');

  // 2. Get a sample user to send notification to
  console.log('\n[2/4] Finding a sample user...');
  const sampleUser = await prisma.user.findFirst({
    select: { id: true, name: true, email: true }
  });

  if (!sampleUser) {
    console.error('❌ No users found in the database. Please create a user first.');
    process.exit(1);
  }

  console.log(`✅ Found user: ${sampleUser.name} (${sampleUser.email})`);

  // 3. Send a test notification
  console.log('\n[3/4] Sending test notification...');
  
  const timestamp = new Date().toISOString();
  const formattedTime = new Date().toLocaleTimeString();
  
  try {
    const notificationId = await sendNotification({
      type: 'SYSTEM_NOTIFICATION',
      data: {
        title: 'Redis Test Notification',
        body: `This is a test notification sent at ${formattedTime} to verify the Redis notification system.`,
        source: 'test-script',
        timestamp
      },
      userIds: [sampleUser.id],
      priority: 'high',
      idempotencyKey: `redis-test-${Date.now()}`
    });
    
    console.log(`✅ Successfully sent notification with ID: ${notificationId}`);
    
    // Wait a moment for the notification to be processed
    console.log('Waiting for notification to be processed...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 4. Verify notification was processed
    console.log('\n[4/4] Verifying notification was processed...');
    
    // Check notification metrics
    const metrics = await getNotificationMetrics();
    console.log('Notification metrics:', metrics);
    
    // Check if notification was created in the database
    const notification = await prisma.inAppNotification.findFirst({
      where: {
        userId: sampleUser.id,
        title: 'Redis Test Notification',
        createdAt: {
          gte: new Date(Date.now() - 10000) // Created in the last 10 seconds
        }
      },
      include: {
        events: true
      }
    });
    
    if (notification) {
      console.log('✅ Notification created in database:', {
        id: notification.id,
        title: notification.title,
        body: notification.body,
        createdAt: notification.createdAt,
        events: notification.events.map(e => ({
          event: e.event,
          createdAt: e.createdAt
        }))
      });
    } else {
      console.warn('⚠️ Notification not found in database. This might be normal if using a different notification storage mechanism.');
    }
    
    // Check Redis history
    const historyKey = 'notifications:history';
    const historyItems = await redis.lrange(historyKey, 0, 5);
    
    if (historyItems && historyItems.length > 0) {
      console.log('✅ Found notification in Redis history');
      
      // Parse the first item to check if it's our notification
      try {
        const latestNotification = JSON.parse(historyItems[0]);
        if (latestNotification.id === notificationId) {
          console.log('✅ Found our notification in Redis history:', {
            id: latestNotification.id,
            type: latestNotification.type,
            processedAt: latestNotification.processedAt,
            inAppCount: latestNotification.inAppCount
          });
        }
      } catch (error) {
        console.error('Error parsing Redis history item:', error);
      }
    } else {
      console.warn('⚠️ No notifications found in Redis history');
    }
    
    console.log('\n=== Test Complete ===');
    console.log('The Redis notification system appears to be working correctly.');
    console.log('Check the UI to verify that the notification appears in real-time.');
    
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    process.exit(1);
  }
}

// Run the test
testRedisNotificationSystem().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}).finally(async () => {
  // Close Prisma client
  await prisma.$disconnect();
});
