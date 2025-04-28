import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { sendNotification, getNotificationMetrics } from '@/lib/redis/enhancedRedisNotificationService';
import { getRedisLoadBalancer } from '@/lib/redis/redisLoadBalancer';

/**
 * Test Redis Notification Service
 *
 * This endpoint tests the Redis notification service with load balancing.
 * POST /api/test/redis-notification
 */
export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      );
    }

    // Get request body
    const { message, title } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Send a test notification
    const notificationId = await sendNotification({
      type: 'SYSTEM_NOTIFICATION',
      data: {
        title: title || 'Redis Test Notification',
        body: message,
        icon: '/icons/system-notification.png',
        timestamp: new Date().toISOString()
      },
      userIds: [session.user.id],
      priority: 'normal',
      idempotencyKey: `test-${Date.now()}`
    });

    // Get metrics
    const metrics = await getNotificationMetrics();

    return NextResponse.json({
      success: true,
      message: 'Test notification sent successfully',
      notificationId,
      metrics
    });
  } catch (error) {
    console.error('Error testing Redis notification:', error);

    return NextResponse.json(
      { error: 'Failed to test Redis notification', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * Get Redis Notification Metrics
 *
 * This endpoint gets metrics about the Redis notification service.
 * GET /api/test/redis-notification
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      );
    }

    // Get metrics
    const metrics = await getNotificationMetrics();

    // Get recent notifications
    const recentNotifications = await getRecentNotifications();

    return NextResponse.json({
      success: true,
      metrics,
      recentNotifications
    });
  } catch (error) {
    console.error('Error getting Redis metrics:', error);

    return NextResponse.json(
      { error: 'Failed to get Redis metrics', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * Get recent notifications from Redis
 */
async function getRecentNotifications() {
  try {
    const result = await executeRedisOperation(async (redis: any) => {
      const notifications = await redis.lrange('notifications:history', 0, 9);
      return notifications.map((item: string) => JSON.parse(item));
    });

    return result.success ? result.data : [];
  } catch (error) {
    console.error('Error getting recent notifications:', error);
    return [];
  }
}

/**
 * Execute a Redis operation with load balancing
 */
async function executeRedisOperation(operation: (redis: any) => Promise<any>) {
  const loadBalancer = getRedisLoadBalancer();
  return loadBalancer.execute(operation);
}
