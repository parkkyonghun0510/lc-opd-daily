import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

/**
 * Test endpoint to directly create an in-app notification
 * POST /api/notifications/test-create
 */
export async function POST(req: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const data = await req.json();
    const { title, body, type } = data;

  //   console.log("Creating test notification with data:", {
  //   userId: session.user.id,
  //     title,
  //     body,
  //     type: type || "SYSTEM_NOTIFICATION",
  //       data: data.data || {},
  //         actionUrl: data.actionUrl || null
  // });

  // Simple validation
  if (!title || !body) {
    return NextResponse.json(
      { error: "Title and body are required" },
      { status: 400 }
    );
  }

  // Create an in-app notification directly in the database
  const notification = await prisma.inAppNotification.create({
    data: {
      userId: session.user.id,
      title,
      body,
      type: type || "SYSTEM_NOTIFICATION",
      isRead: false,
      data: data.data || {},
      actionUrl: data.actionUrl || null
    }
  });

  //console.log("Successfully created notification:", notification.id);

  // Also create a notification event for tracking
  if (notification.id) {
    const event = await prisma.notificationEvent.create({
      data: {
        notificationId: notification.id,
        event: 'DELIVERED',
        metadata: {
          method: 'direct-api',
          timestamp: new Date().toISOString()
        }
      }
    });
    //console.log("Created notification event:", event.id);
  }

  return NextResponse.json({
    success: true,
    notification,
    message: "Test notification created successfully"
  });
} catch (error) {
  console.error("Error creating test notification:", error);
  return NextResponse.json(
    { error: "Failed to create test notification", details: error instanceof Error ? error.message : String(error) },
    { status: 500 }
  );
}
} 