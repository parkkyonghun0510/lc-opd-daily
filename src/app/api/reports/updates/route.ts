import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { sseHandler } from "@/lib/realtime/sseHandler";
import { rateLimiter } from "@/lib/realtime/rateLimiter";

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

    // Get client IP address
    const ip = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Check rate limits
    const [userLimitExceeded, ipLimitExceeded] = await Promise.all([
      rateLimiter.checkUserLimit(userId, 'USER_CONNECTIONS'),
      rateLimiter.checkIpLimit(ip, 'IP_CONNECTIONS')
    ]);

    if (userLimitExceeded) {
      console.warn(`[SSE Reports] Rate limit exceeded for user ${userId}`);
      return new Response('Too Many Requests: User connection limit exceeded', { 
        status: 429,
        headers: {
          'Retry-After': '60'
        }
      });
    }

    if (ipLimitExceeded) {
      console.warn(`[SSE Reports] Rate limit exceeded for IP ${ip}`);
      return new Response('Too Many Requests: IP connection limit exceeded', { 
        status: 429,
        headers: {
          'Retry-After': '60'
        }
      });
    }

    // Create a streaming response
    const stream = new ReadableStream({
      start(controller) {
        // Store the controller for later use
        const response = {
          write: (data: string) => {
            controller.enqueue(new TextEncoder().encode(data));
          },
          close: () => controller.close(),
          error: (err: Error) => controller.error(err)
        };

        // Handle the SSE connection
        sseHandler.handleConnection(request, userId, response, {
          clientType,
          role
        });

        // Send initial connection confirmation
        const connectionEvent = {
          id: crypto.randomUUID(),
          type: 'connected',
          data: {
            message: 'Report updates SSE connection established',
            timestamp: new Date().toISOString(),
            userId
          }
        };

        response.write(`id: ${connectionEvent.id}\n`);
        response.write(`event: ${connectionEvent.type}\n`);
        response.write(`data: ${JSON.stringify(connectionEvent.data)}\n\n`);
      }
    });

    // Return the streaming response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // For Nginx
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true'
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