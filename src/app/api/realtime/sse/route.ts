import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import sseHandler from '@/lib/sse/sseHandler';

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
        const clientId = crypto.randomUUID();
        sseHandler.addClient(clientId, userId, response, {
          clientType,
          role
        });

        // Keepalive pings and activity updates
        const pingInterval = setInterval(() => {
          try {
            sseHandler.sendEventToUser(userId, 'ping', { timestamp: Date.now(), clientId });
            sseHandler.updateClientActivity(clientId);
          } catch (err) {
            console.error('[SSE] ping error', err);
          }
        }, 30000);

        request.signal.addEventListener('abort', () => {
          clearInterval(pingInterval);
          sseHandler.removeClient(clientId);
          controller.close();
        });

        // Initial event
        sseHandler.sendEventToUser(userId, 'connected', {
          message: 'SSE connection established',
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
        'X-Accel-Buffering': 'no'
      }
    });
  } catch (error) {
    console.error('[SSE] Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
