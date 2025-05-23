import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import sseHandler from '@/lib/sse/sseHandler';
import redisSSEHandler from '@/lib/sse/redisSSEHandler';

/**
 * SSE Monitoring API
 * 
 * This endpoint provides statistics about SSE connections for monitoring purposes.
 * It requires admin privileges to access.
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate the user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if the user has admin privileges
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin privileges required' }, { status: 403 });
    }
    
    // Get SSE statistics
    const handler = redisSSEHandler || sseHandler;
    const stats = await handler.getStats();
    
    // Return the statistics
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      stats,
      handlerType: redisSSEHandler ? 'redis' : 'memory'
    });
  } catch (error) {
    console.error('[SSE Monitor] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
