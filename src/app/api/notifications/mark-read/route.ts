import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { markNotificationAsRead, markAllNotificationsAsRead } from '@/lib/notifications/redisNotificationService';

/**
 * Mark a notification as read
 * POST /api/notifications/mark-read
 */
export async function POST(req: Request) {
  try {
    // Check user session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const data = await req.json();
    const { notificationId, markAll } = data;

    // Mark all notifications as read
    if (markAll) {
      const count = await markAllNotificationsAsRead(session.user.id);
      return NextResponse.json({
        success: true,
        message: `Marked ${count} notifications as read`,
        count
      });
    }

    // Mark a single notification as read
    if (!notificationId) {
      return NextResponse.json({ error: "Notification ID is required" }, { status: 400 });
    }

    const success = await markNotificationAsRead(notificationId, session.user.id);

    if (success) {
      return NextResponse.json({
        success: true,
        message: "Notification marked as read"
      });
    } else {
      return NextResponse.json({
        success: false,
        message: "Failed to mark notification as read"
      }, { status: 404 });
    }
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
}
