import { sendToNotificationQueue } from "../src/lib/queue/sqs";
import { prisma } from "../src/lib/prisma";

async function testNotificationFlow() {
  //console.log("=== Testing Notification System ===");

  // 1. Test direct database creation
  try {
    //console.log("\n[1/3] Testing direct database creation...");
    const notification = await prisma.inAppNotification.create({
      data: {
        userId: "user-1", // Replace with a valid user ID from your database
        title: "Test Direct DB Creation",
        body: "This notification was created directly in the database",
        type: "SYSTEM_NOTIFICATION",
        isRead: false,
        data: { source: "test-script", method: "direct" },
      },
    });

    //console.log("✅ Successfully created notification in database:", notification.id);

    // Create event for the notification
    const event = await (prisma as any).notificationEvent.create({
      data: {
        notificationId: notification.id,
        event: "DELIVERED",
        metadata: {
          method: "test-script",
          timestamp: new Date().toISOString(),
        },
      },
    });

    //console.log("✅ Created notification event:", event.id);
  } catch (error) {
    console.error("❌ Failed to create notification in database:", error);
  }

  // 2. Test SQS queue
  try {
    //console.log("\n[2/3] Testing SQS queue...");
    //console.log("Queue URL:", process.env.AWS_SQS_NOTIFICATION_QUEUE_URL);

    const result = await sendToNotificationQueue({
      type: "SYSTEM_NOTIFICATION",
      data: {
        source: "test-script",
        method: "sqs",
      },
      userIds: ["user-1"], // Replace with valid user IDs
      priority: "high",
    });

    //console.log("✅ Successfully sent message to SQS queue:", result);
  } catch (error) {
    console.error("❌ Failed to send message to SQS queue:", error);
    console.error(
      "Error details:",
      error instanceof Error ? error.message : String(error),
    );
  }

  // 3. List recent notifications to verify
  try {
    //console.log("\n[3/3] Listing recent notifications...");

    const recentNotifications = await prisma.inAppNotification.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      include: {
        events: true,
      },
    });

    //console.log(`Found ${recentNotifications.length} recent notifications:`);
    recentNotifications.forEach((notif) => {
      //console.log(`- ID: ${notif.id}, Type: ${notif.type}, Created: ${notif.createdAt}, Events: ${notif.events.length}`);
    });
  } catch (error) {
    console.error("❌ Failed to list recent notifications:", error);
  }

  //console.log("\n=== Test Completed ===");
}

// Run the test function
testNotificationFlow()
  .catch((error) => console.error("Fatal error:", error))
  .finally(() => prisma.$disconnect());
