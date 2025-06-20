import { NextRequest } from "next/server";
import sseHandler from "@/lib/sse/sseHandler";
import redisSSEHandler from "@/lib/sse/redisSSEHandler";
import { rateLimiter } from "@/lib/rate-limit";
import { authenticateSSERequest } from "@/lib/sse/sseAuth";

export const runtime = "nodejs";

// Use Redis-backed SSE handler if available
const handler = redisSSEHandler || sseHandler;

/**
 * Server-Sent Events (SSE) endpoint
 *
 * This endpoint establishes a persistent connection with the client
 * for real-time updates using the SSE protocol.
 *
 * Authentication is required via session or userId parameter.
 */
export async function GET(req: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimiter.applyRateLimit(req, {
    identifier: "sse",
    limit: 5, // Maximum 5 connections per user/IP
    window: 60, // Within a 60-second window
  });

  // If rate limited, return the response
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Authenticate the request using multiple methods
  const auth = await authenticateSSERequest(req);

  // Require authentication
  if (!auth.authenticated || !auth.userId) {
    return new Response("Unauthorized: Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": "Bearer",
      },
    });
  }

  const userId = auth.userId;

  // Log authentication method
  console.log(`[SSE] User ${userId} authenticated via ${auth.method}`);

  // Check if user already has too many active connections
  try {
    const stats = await handler.getStats();

    // Get user connections based on handler type
    let userConnections = 0;

    if ("localUserCounts" in stats) {
      // Redis handler
      userConnections = stats.localUserCounts[userId] || 0;
    } else {
      // Memory handler
      userConnections = stats.userCounts[userId] || 0;
    }

    // Limit to 3 connections per user per instance
    if (userConnections >= 3) {
      return new Response("Too many connections for this user", {
        status: 429,
        headers: {
          "Retry-After": "60",
        },
      });
    }
  } catch (error) {
    console.error("[SSE] Error checking user connection count:", error);
  }

  // Get client metadata from query parameters
  const { searchParams } = new URL(req.url);
  const clientType = searchParams.get("clientType") || "browser";
  const clientInfo = searchParams.get("clientInfo") || navigator.userAgent;

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
      handler.addClient(clientId, userId!, response, {
        clientType,
        clientInfo,
        userAgent: req.headers.get("user-agent") || undefined,
        ip: req.headers.get("x-forwarded-for") || undefined,
      });

      // Set up ping interval to keep connection alive
      const pingInterval = setInterval(() => {
        try {
          // Send ping and update activity timestamp
          handler.sendEventToUser(userId!, "ping", {
            timestamp: Date.now(),
            clientId,
          });
          handler.updateClientActivity(clientId);
        } catch (error) {
          console.error(
            `[SSE] Error sending ping to client ${clientId}:`,
            error,
          );
        }
      }, 30000); // 30 second ping

      // Handle connection close
      req.signal.addEventListener("abort", () => {
        clearInterval(pingInterval);
        handler.removeClient(clientId);
        controller.close();
      });

      // Send initial connection event
      handler.sendEventToUser(userId!, "connected", {
        clientId,
        timestamp: Date.now(),
        message: "SSE connection established",
      });
    },
  });

  // Return the SSE response with appropriate headers
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Important for Nginx
    },
  });
}
