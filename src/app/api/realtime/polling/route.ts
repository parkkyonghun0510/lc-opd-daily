import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { redisEventEmitter } from '@/lib/realtime/redisEventEmitter';

/**
 * Polling API for real-time updates
 * 
 * This endpoint allows clients to poll for updates when SSE is not available.
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const token = await getToken({ req: request });
    if (!token || !token.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = token.id as string;
    
    // Get the 'since' parameter (timestamp)
    const url = new URL(request.url);
    const sinceParam = url.searchParams.get('since');
    const since = sinceParam ? parseInt(sinceParam, 10) : undefined;
    
    // Get events for this user (Redis-backed, falls back to in-memory if Redis unavailable)
    const events = await redisEventEmitter.getEventsForUser(userId, since);
    
    // Return the events
    return NextResponse.json({
      userId,
      timestamp: Date.now(),
      events
    }, {
      headers: {
        // Prevent caching
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('[Polling] Error:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
