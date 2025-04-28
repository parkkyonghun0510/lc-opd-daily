import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getRecentNotifications } from '@/lib/notifications/redisNotificationService';

/**
 * Get notification history
 * GET /api/notifications/history
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

    // Get URL parameters
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    
    // Get recent notifications
    const notifications = await getRecentNotifications(limit);

    return NextResponse.json({
      success: true,
      notifications,
      count: notifications.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting notification history:', error);
    return NextResponse.json(
      { error: 'Failed to get notification history' },
      { status: 500 }
    );
  }
}
