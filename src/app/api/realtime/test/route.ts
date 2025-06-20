import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { eventEmitter } from "@/lib/realtime/eventEmitter";
import { sseHandler } from "@/lib/realtime/sseHandler";

/**
 * Test API for sending real-time events
 *
 * This endpoint allows testing the real-time functionality by sending events.
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const token = await getToken({ req: request });
    if (!token || !token.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = token.id as string;

    // Parse the request body
    const body = await request.json();
    const { type = "test", message, target, data = {} } = body;

    // Create the event data
    const eventData = {
      message,
      ...data,
      timestamp: Date.now(),
      sender: userId,
    };

    // Determine how to send the event
    let result;

    if (target === "sse") {
      // Send directly via SSE handler
      result = sseHandler.broadcastEvent(type, eventData);
    } else {
      // Send via event emitter (will be available for polling)
      const eventId = eventEmitter.emit(type, eventData);

      // Also send via SSE for immediate delivery
      result = sseHandler.broadcastEvent(type, eventData);

      return NextResponse.json({
        success: true,
        message: `Event sent successfully`,
        eventId,
        sseRecipients: result,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Event sent to ${result} SSE clients`,
      type,
      data: eventData,
    });
  } catch (error) {
    console.error("[Test API] Error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
