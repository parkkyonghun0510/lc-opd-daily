import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getNotificationMetrics } from '@/lib/notifications/redisNotificationService';

/**
 * Get Redis notification metrics
 * GET /api/notifications/metrics/redis
 */
export async function GET(req: Request) {
  try {
    // Check user session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has admin role
    if (session.user.role !== 'ADMIN' && session.user.role !== 'BRANCH_MANAGER') {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Get metrics from Redis notification service
    const metrics = await getNotificationMetrics();

    return NextResponse.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting notification metrics:', error);
    return NextResponse.json(
      { error: 'Failed to get notification metrics' },
      { status: 500 }
    );
  }
}
