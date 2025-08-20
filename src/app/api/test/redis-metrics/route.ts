import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getRedis } from '@/lib/redis';
import { getNotificationMetrics } from '@/lib/notifications/redisNotificationService';

/**
 * Redis Metrics API
 * 
 * This endpoint provides metrics about the Redis notification system.
 * GET /api/test/redis-metrics
 */
export async function GET() {
  try {
    // Get the authenticated user
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      );
    }
    
    // Get Redis metrics
    const metrics = await getNotificationMetrics();
    
    // Get additional Redis info
    const redisClient = await getRedis();
    const redisInfo = {
      // Get notification queue
      queue: await redisClient.lrange('notifications:queue', 0, 5),
      
      // Get notification history
      history: await redisClient.lrange('notifications:history', 0, 5),
      
      // Get error keys
      errorKeys: await redisClient.keys('notifications:errors:*'),
      
      // Get processing keys
      processingKeys: await redisClient.keys('notifications:processing:*'),
    };
    
    // Return metrics and info
    return NextResponse.json({
      success: true,
      metrics,
      redisInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting Redis metrics:', error);
    
    return NextResponse.json(
      { error: 'Failed to get Redis metrics', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
