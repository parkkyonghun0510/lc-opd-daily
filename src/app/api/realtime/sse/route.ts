import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { sseHandler } from '@/lib/realtime/sseHandler';
import { rateLimiter } from '@/lib/realtime/rateLimiter';

export const runtime = 'nodejs';

/**
 * SSE API for real-time updates
 *
 * This endpoint establishes an SSE connection for real-time updates.
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const token = await getToken({ req: request });
    if (!token || !token.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userId = token.id as string;

    // Get client metadata from query parameters
    const url = new URL(request.url);
    const clientType = url.searchParams.get('clientType') || 'unknown';
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
      console.warn(`[SSE] Rate limit exceeded for user ${userId}`);
      return new Response('Too Many Requests', { status: 429 });
    }

    if (ipLimitExceeded) {
      console.warn(`[SSE] Rate limit exceeded for IP ${ip}`);
      return new Response('Too Many Requests', { status: 429 });
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
    console.error('[SSE] Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
