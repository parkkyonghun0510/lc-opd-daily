import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import {
  emitNotificationEvent,
  broadcastSystemAlert,
} from "@/lib/sse/event-emitter";

/**
 * Test Notification API
 *
 * This endpoint is used to trigger test notifications for SSE testing.
 */
export async function POST(req: NextRequest) {
  try {
    // Get the authenticated user
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    const userId = session.user.id;

    // Create a test notification
    const notification = {
      id: `notification-${Date.now()}`,
      type: "TEST",
      title: "Test Notification",
      message: `This is a test notification sent at ${new Date().toLocaleTimeString()}`,
      createdAt: new Date().toISOString(),
    };

    // Emit the notification event to the user
    await emitNotificationEvent(userId, notification);

    // Also broadcast a system alert to all users (for demonstration)
    await broadcastSystemAlert("info", "System-wide test alert", {
      triggeredBy: userId,
    });

    // Return success response
    return NextResponse.json({
      success: true,
      message: "Test notification sent",
    });
  } catch (error) {
    console.error("Error sending test notification:", error);

    return NextResponse.json(
      { error: "Failed to send test notification" },
      { status: 500 },
    );
  }
}
