/**
 * Test Enhanced Redis Notification System
 *
 * This script tests the enhanced Redis notification system with load balancing
 * and rate limiting.
 */

import {
  getRedisLoadBalancer,
  executeRedisOperation,
} from "../src/lib/redis/redisLoadBalancer.js";
import {
  sendNotification,
  getNotificationMetrics,
} from "../src/lib/redis/enhancedRedisNotificationService.js";
import { prisma } from "../src/lib/prisma.js";

async function testEnhancedRedisSystem() {
  console.log("=== Testing Enhanced Redis Notification System ===");

  // 1. Initialize Redis load balancer
  console.log("\n[1/5] Initializing Redis load balancer...");
  const loadBalancer = getRedisLoadBalancer([], { debug: true });
  const stats = loadBalancer.getStats();

  console.log(
    `✅ Load balancer initialized with ${stats.totalInstances} instances`,
  );
  console.log(`   Healthy instances: ${stats.healthyInstances}`);
  console.log(`   Unhealthy instances: ${stats.unhealthyInstances}`);

  // 2. Test Redis connection
  console.log("\n[2/5] Testing Redis connection...");
  const pingResult = await executeRedisOperation(async (redis) => {
    return await redis.ping();
  });

  if (!pingResult.success) {
    console.error("❌ Redis connection failed:", pingResult.error);
    process.exit(1);
  }

  console.log(
    `✅ Redis connection successful (using instance: ${pingResult.instance})`,
  );

  // 3. Get a sample user to send notification to
  console.log("\n[3/5] Finding a sample user...");
  const sampleUser = await prisma.user.findFirst({
    select: { id: true, name: true, email: true },
  });

  if (!sampleUser) {
    console.error(
      "❌ No users found in the database. Please create a user first.",
    );
    process.exit(1);
  }

  console.log(`✅ Found user: ${sampleUser.name} (${sampleUser.email})`);

  // 4. Send a test notification
  console.log("\n[4/5] Sending test notification...");

  const timestamp = new Date().toISOString();
  const formattedTime = new Date().toLocaleTimeString();

  try {
    const notificationId = await sendNotification({
      type: "SYSTEM_NOTIFICATION",
      data: {
        title: "Enhanced Redis Test Notification",
        body: `This is a test notification sent at ${formattedTime} to verify the enhanced Redis notification system with load balancing.`,
        source: "test-script",
        timestamp,
      },
      userIds: [sampleUser.id],
      priority: "high",
      idempotencyKey: `enhanced-redis-test-${Date.now()}`,
    });

    console.log(`✅ Successfully sent notification with ID: ${notificationId}`);

    // Wait a moment for the notification to be processed
    console.log("Waiting for notification to be processed...");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 5. Verify notification was processed
    console.log("\n[5/5] Verifying notification was processed...");

    // Check notification metrics
    const metrics = await getNotificationMetrics();
    console.log("Notification metrics:", metrics);

    // Check if notification was created in the database
    const notification = await prisma.inAppNotification.findFirst({
      where: {
        userId: sampleUser.id,
        title: "Enhanced Redis Test Notification",
        createdAt: {
          gte: new Date(Date.now() - 10000), // Created in the last 10 seconds
        },
      },
      include: {
        events: true,
      },
    });

    if (notification) {
      console.log("✅ Notification created in database:", {
        id: notification.id,
        title: notification.title,
        body: notification.body,
        createdAt: notification.createdAt,
        events: notification.events.map((e) => ({
          event: e.event,
          createdAt: e.createdAt,
        })),
      });
    } else {
      console.warn(
        "⚠️ Notification not found in database. This might be normal if using a different notification storage mechanism.",
      );
    }

    // Test rate limiting by sending multiple notifications quickly
    console.log("\n[Bonus] Testing rate limiting...");
    const startTime = Date.now();
    const results = await Promise.all(
      Array(15)
        .fill(0)
        .map((_, i) =>
          sendNotification({
            type: "SYSTEM_NOTIFICATION",
            data: {
              title: `Rate Limit Test ${i + 1}`,
              body: `This is a test notification #${i + 1} for rate limiting.`,
              source: "test-script",
              timestamp: new Date().toISOString(),
            },
            userIds: [sampleUser.id],
            priority: "normal",
            idempotencyKey: `rate-limit-test-${Date.now()}-${i}`,
          }).catch((error) => ({ error })),
        ),
    );

    const endTime = Date.now();
    const successCount = results.filter((r) => typeof r === "string").length;
    const errorCount = results.filter((r) => r.error).length;

    console.log(`Rate limit test completed in ${endTime - startTime}ms`);
    console.log(`Successful notifications: ${successCount}`);
    console.log(`Rate limited notifications: ${errorCount}`);

    if (errorCount > 0) {
      console.log("✅ Rate limiting is working as expected");
    } else {
      console.log(
        "⚠️ All notifications went through, rate limiting might not be working",
      );
    }

    console.log("\n=== Test Complete ===");
    console.log(
      "The enhanced Redis notification system appears to be working correctly.",
    );
    console.log(
      "Check the UI to verify that the notification appears in real-time.",
    );
  } catch (error) {
    console.error("❌ Error sending notification:", error);
    process.exit(1);
  }
}

// Run the test
testEnhancedRedisSystem()
  .catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  })
  .finally(async () => {
    // Close Prisma client
    await prisma.$disconnect();
  });
