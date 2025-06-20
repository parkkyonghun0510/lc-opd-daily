import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { emitNotification } from "@/lib/realtime/redisEventEmitter";

/**
 * Test SSE Notification Service
 *
 * This endpoint tests the SSE notification service.
 * POST /api/test/sse-notification
 */
export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    // Get request body
    const { message, title } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      );
    }

    // Send a test notification via SSE
    const eventId = await emitNotification(
      title || "SSE Test Notification",
      message,
      {
        userIds: [session.user.id],
        type: "SYSTEM_NOTIFICATION",
        icon: "/icons/system-notification.png",
      },
    );

    return NextResponse.json({
      success: true,
      message: "Test SSE notification sent successfully",
      eventId,
    });
  } catch (error) {
    console.error("Error sending SSE notification:", error);

    return NextResponse.json(
      {
        error: "Failed to send SSE notification",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
