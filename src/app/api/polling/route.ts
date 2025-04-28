import { NextRequest, NextResponse } from 'next/server';
import { authenticateSSERequest } from '@/lib/sse/sseAuth';
import { rateLimiter } from '@/lib/rate-limit';

/**
 * Polling Fallback API
 * 
 * This endpoint provides a fallback for browsers that don't support SSE.
 * It returns the latest updates for the authenticated user.
 */
export async function GET(req: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await rateLimiter.applyRateLimit(req, {
      identifier: 'polling',
      limit: 30, // Maximum 30 requests per user/IP
      window: 60 // Within a 60-second window
    });
    
    // If rate limited, return the response
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    // Authenticate the request
    const auth = await authenticateSSERequest(req);
    
    // Require authentication
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = auth.userId;
    
    // Get the latest updates for the user
    // This would typically come from a database or cache
    // For now, we'll just return a simple response
    
    return NextResponse.json({
      userId,
      timestamp: Date.now(),
      updates: [
        {
          type: 'notification',
          id: crypto.randomUUID(),
          title: 'Polling Fallback',
          body: 'This is a fallback for browsers that don\'t support SSE',
          timestamp: Date.now()
        }
      ]
    });
  } catch (error) {
    console.error('[Polling] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
