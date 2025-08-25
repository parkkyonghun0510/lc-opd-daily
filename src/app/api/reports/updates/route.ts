import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import unifiedSSEHandler from "@/lib/sse/unifiedSSEHandler";

export const runtime = "nodejs";

/**
 * Server-Sent Events endpoint for report updates
 *
 * This endpoint provides real-time updates for report-related events
 * including new reports, updates, and deletions.
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const token = await getToken({ req: request });
    if (!token || !token.id) {
      return new Response("Unauthorized: Valid authentication required", {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Bearer'
        }
      });
    }

    const userId = token.id as string;

    // Get client metadata from query parameters
    const url = new URL(request.url);
    const clientType = url.searchParams.get('clientType') || 'browser';
    const role = url.searchParams.get('role') || 'user';

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const clientId = crypto.randomUUID();

        // Create response object that the SSE handler will use
        const response = {
          write: (chunk: string) => controller.enqueue(encoder.encode(chunk)),
        };

        // Register client with the SSE handler
        await unifiedSSEHandler.addClient(clientId, userId!, response, {
          clientType,
          role,
          userAgent: request.headers.get("user-agent") || undefined,
          ip: (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined)
        });

        // Set up ping interval to keep connection alive and track activity
        const pingInterval = setInterval(async () => {
          try {
            await unifiedSSEHandler.sendEventToUser(userId!, "ping", {
              timestamp: Date.now(),
              clientId
            });
            await unifiedSSEHandler.updateClientActivity(clientId);
          } catch (error) {
            console.error(`[SSE Reports] Error sending ping to client ${clientId}:`, error);
          }
        }, 30000); // 30s ping

        // Handle connection close
        request.signal.addEventListener("abort", async () => {
          clearInterval(pingInterval);
          await unifiedSSEHandler.removeClient(clientId);
          controller.close();
        });

        // Send initial connection confirmation
        await unifiedSSEHandler.sendEventToUser(userId!, 'connected', {
          message: 'Report updates SSE connection established',
          timestamp: new Date().toISOString(),
          userId,
          clientId
        });
      }
    });

    // Return the streaming response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // For Nginx
      }
    });
  } catch (error) {
    console.error('[SSE Reports] Error establishing connection:', error);
    
    const errorResponse = {
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  }
}