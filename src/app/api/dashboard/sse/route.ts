import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import sseEmitter from "@/lib/sseEmitter";
import sseHandler from "@/lib/sse/sseHandler";
import {
  DashboardEventType,
  DashboardUpdatePayload,
  createDashboardUpdate,
} from "@/lib/events/dashboard-events";
import { rateLimiter } from "@/lib/rate-limit";

/**
 * Dashboard SSE Endpoint
 *
 * This endpoint provides real-time dashboard updates using Server-Sent Events.
 * It uses the standardized SSE handler for connection management and event formatting.
 *
 * Features:
 * - Secure authentication via session
 * - Standardized event format
 * - Connection monitoring and cleanup
 * - Integration with dashboard event emitter
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting - increased limits for development
  const rateLimitResponse = await rateLimiter.applyRateLimit(request, {
    identifier: "dashboard_sse",
    limit: 10, // Maximum 10 connections per user/IP (increased from 3)
    window: 60, // Within a 60-second window
  });

  // If rate limited, return the response
  if (rateLimitResponse) {
    console.log("[SSE] Rate limit exceeded for dashboard SSE");
    return rateLimitResponse;
  }

  // --- Authentication Check ---
  let userId: string;

  try {
    // Use getServerSession for API routes in Next.js
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      console.log("[SSE] Authentication failed: No valid session");
      return new NextResponse("Unauthorized", { status: 401 });
    }

    userId = session.user.id; // Get user ID from session
  } catch (error) {
    console.error("[SSE] Authentication error:", error);
    return new NextResponse("Authentication error", { status: 500 });
  }

  // Check if user already has too many active connections
  try {
    const stats = sseHandler.getStats(); // Removed await since getStats is not async
    const userConnections = stats.userCounts[userId] || 0;

    // Limit to 5 connections per user (increased from 2)
    if (userConnections >= 5) {
      console.log(
        `[SSE] Too many connections for user ${userId}: ${userConnections}`,
      );
      return new NextResponse("Too many connections for this user", {
        status: 429,
        headers: {
          "Retry-After": "60",
        },
      });
    }
  } catch (error) {
    console.error("[SSE] Error checking user connection count:", error);
  }

  // Set up SSE headers
  const headers = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // Important for Nginx buffering issues
  };

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const clientId = crypto.randomUUID();

      // Create response object that the SSE handler will use
      const response = {
        write: (chunk: string) => controller.enqueue(encoder.encode(chunk)),
      };

      // Register client with the SSE handler
      sseHandler.addClient(clientId, userId, response, {
        type: "dashboard",
        userAgent: request.headers.get("user-agent") || undefined,
        ip: request.headers.get("x-forwarded-for") || undefined,
      });

      // Function to handle dashboard updates from the event emitter
      const handleDashboardUpdate = (payload: DashboardUpdatePayload) => {
        // Send all dashboard updates to this user
        // In a real implementation, you might want to filter based on relevance
        // For example, only send branch updates for branches the user has access to

        // Use the standardized SSE handler to send the event
        sseHandler.sendEventToUser(userId, "dashboardUpdate", {
          type: payload.type,
          data: payload.data,
          timestamp: Date.now(),
        });

        // Update client activity timestamp
        sseHandler.updateClientActivity(clientId);
      };

      // Listen for dashboard updates from the event emitter
      sseEmitter.on("dashboardUpdate", handleDashboardUpdate);

      // Set up ping interval to keep connection alive (increased to 60 seconds to reduce traffic)
      const pingInterval = setInterval(() => {
        try {
          // Send ping and update activity timestamp
          sseHandler.sendEventToUser(userId, "ping", {
            timestamp: Date.now(),
            clientId,
          });
          sseHandler.updateClientActivity(clientId);
        } catch (error) {
          console.error(
            `[SSE] Error sending ping to dashboard client ${clientId}:`,
            error,
          );
        }
      }, 60000); // 60 second ping (reduced frequency)

      // Handle connection close
      request.signal.addEventListener("abort", () => {
        clearInterval(pingInterval);
        sseEmitter.off("dashboardUpdate", handleDashboardUpdate);
        sseHandler.removeClient(clientId);
        controller.close();
      });

      // Send initial connection event with retry parameter
      sseHandler.sendEventToUser(
        userId,
        "connected",
        {
          clientId,
          timestamp: Date.now(),
          message: "Dashboard SSE connection established",
        },
        {
          retry: 10000, // Suggest client to wait 10 seconds before reconnecting
        },
      );
    },
  });

  // Return the SSE response with appropriate headers
  return new NextResponse(stream, { headers });

  // --- Function to Broadcast Updates ---
  // This function would be called from other parts of your backend
  // (e.g., after a report is created, approved, user data changes, etc.)
  // export function broadcastDashboardUpdate(data: any) {
  //   //console.log('[SSE Debug] Broadcasting dashboard update:', data);
  //   emitter.emit('update', data);
  // }
}

// Moved to a separate utility file to avoid Next.js route export errors
// See src/lib/events/dashboard-broadcaster.ts for the implementation

// Example of how to trigger an update (e.g., from another API route or service)
// setTimeout(() => {
//   broadcastDashboardUpdate({ type: 'NEW_REPORT', reportId: '123', branchId: 'branchA' });
// }, 10000);

// setTimeout(() => {
//   broadcastDashboardUpdate({ type: 'USER_PROFILE_UPDATED', userId: 'user_abc' });
// }, 20000);
