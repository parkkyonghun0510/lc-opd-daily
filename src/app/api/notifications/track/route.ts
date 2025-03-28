import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { NotificationEventType } from "@/types/notifications";
import { trackNotificationEvent } from "@/utils/notificationTracking";

/**
 * API endpoint to track notification events (delivered, clicked, closed)
 * POST /api/notifications/track
 */
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { notificationId, event, metadata } = data;

    // Validate required fields
    if (!notificationId || !event) {
      return NextResponse.json(
        { error: "Missing required fields: notificationId and event" },
        { status: 400 }
      );
    }

    // Validate event type
    if (!Object.values(NotificationEventType).includes(event as NotificationEventType)) {
      return NextResponse.json(
        { error: `Invalid event type: ${event}` },
        { status: 400 }
      );
    }

    // Get user session for additional tracking
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // Add user ID to metadata if available
    const enhancedMetadata = {
      ...metadata,
      userId: userId || null,
      userAgent: req.headers.get("user-agent") || null,
      timestamp: new Date().toISOString()
    };

    // Track the notification event
    const success = await trackNotificationEvent(
      notificationId,
      event as NotificationEventType,
      enhancedMetadata
    );

    if (!success) {
      return NextResponse.json(
        { error: "Failed to track notification event" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Notification ${event.toLowerCase()} event tracked successfully`
    });
  } catch (error) {
    console.error("Error tracking notification event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Check if authorized to access this API
 */
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
} 