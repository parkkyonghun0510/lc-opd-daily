import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendToNotificationQueue } from "@/lib/queue/sqs";

export async function GET(req: NextRequest) {
  try {
    // Get a count of all notifications
    const totalCount = await prisma.inAppNotification.count();

    // Get most recent notifications
    const recentNotifications = await prisma.inAppNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        events: true,
      },
    });

    return NextResponse.json({
      success: true,
      totalCount,
      recentNotifications,
    });
  } catch (error) {
    console.error("Error retrieving notifications:", error);
    return NextResponse.json(
      {
        error: "Failed to retrieve notifications",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Create a direct notification (without SQS)

    // First, find a sample user to send to
    const sampleUser = await prisma.user.findFirst({
      select: { id: true },
    });

    if (!sampleUser) {
      return NextResponse.json(
        { error: "No users found in the database" },
        { status: 400 },
      );
    }

    //console.log("Creating direct test notification for user:", sampleUser.id);

    // Create direct notification in database
    const notification = await prisma.inAppNotification.create({
      data: {
        userId: sampleUser.id,
        title: "Debug API Test",
        body: "This notification was created directly through the debug API",
        type: "DEBUG_TEST",
        isRead: false,
        data: {
          source: "debug-api",
          timestamp: new Date().toISOString(),
        },
      },
    });

    //console.log("Successfully created notification:", notification.id);

    // Create notification event
    const event = await prisma.notificationEvent.create({
      data: {
        notificationId: notification.id,
        event: "DELIVERED",
        metadata: {
          method: "debug-api",
          timestamp: new Date().toISOString(),
        },
      },
    });

    // Also test sending via SQS
    let sqsResult = null;
    try {
      sqsResult = await sendToNotificationQueue({
        type: "DEBUG_TEST",
        data: {
          source: "debug-api-sqs",
          timestamp: new Date().toISOString(),
        },
        userIds: [sampleUser.id],
        priority: "high",
      });

      //console.log("Successfully sent to SQS:", sqsResult);
    } catch (sqsError) {
      console.error("Failed to send to SQS:", sqsError);
      sqsResult = {
        error: sqsError instanceof Error ? sqsError.message : String(sqsError),
      };
    }

    return NextResponse.json({
      success: true,
      notification,
      event,
      sqsResult,
      message: "Test notification created successfully",
    });
  } catch (error) {
    console.error("Error creating test notification:", error);
    return NextResponse.json(
      {
        error: "Failed to create test notification",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
