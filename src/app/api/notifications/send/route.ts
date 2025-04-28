import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { NotificationType } from '@/utils/notificationTemplates';
import { getUsersForNotification } from '@/utils/notificationTargeting';
import { sendNotification } from '@/lib/notifications/redisNotificationService';
import { prisma } from '@/lib/prisma';

/**
 * Create in-app notifications in the database
 */
async function createInAppNotifications(
  type: NotificationType,
  data: Record<string, any>,
  userIds: string[]
) {
  // Generate title and body based on notification type
  let title = 'Notification';
  let body = 'You have a new notification';
  let actionUrl = null;

  switch (type) {
    case NotificationType.REPORT_SUBMITTED:
      title = 'New Report Submitted';
      body = `A new report has been submitted by ${data.submitterName || 'a user'} and requires review.`;
      actionUrl = data.reportId ? `/dashboard?viewReport=${data.reportId}` : '/dashboard';
      break;
    case NotificationType.REPORT_APPROVED:
      title = 'Report Approved';
      body = `Your report has been approved by ${data.approverName || 'a manager'}.`;
      actionUrl = data.reportId ? `/dashboard?viewReport=${data.reportId}` : '/dashboard';
      break;
    case NotificationType.REPORT_REJECTED:
      title = 'Report Rejected';
      body = `Your report has been rejected${data.reason ? ` for the following reason: ${data.reason}` : ''}.`;
      actionUrl = data.reportId ? `/dashboard?viewReport=${data.reportId}` : '/dashboard';
      break;
    case NotificationType.REPORT_REMINDER:
      title = 'Report Reminder';
      body = `You have a report due for ${data.date || 'today'}.`;
      actionUrl = '/dashboard?tab=create';
      break;
    case NotificationType.REPORT_OVERDUE:
      title = 'Report Overdue';
      body = `Your report for ${data.date || 'a recent date'} is now overdue.`;
      actionUrl = '/dashboard?tab=create';
      break;
  }

  // Use custom title/body if provided
  if (data.title) title = data.title;
  if (data.body) body = data.body;
  if (data.actionUrl) actionUrl = data.actionUrl;

  // Create notifications for each user
  const notifications = userIds.map(userId => ({
    userId,
    title,
    body,
    type,
    actionUrl,
    isRead: false,
    data: data
  }));

  // Insert in-app notifications in bulk
  if (notifications.length > 0) {
    await prisma.inAppNotification.createMany({
      data: notifications
    });
  }

  return notifications.length;
}

export async function POST(request: Request) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse notification data
    const data = await request.json();

    // Validate notification data
    if (!data.type || !Object.values(NotificationType).includes(data.type)) {
      return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
    }

    // Get target users
    let targetUserIds = data.userIds || [];
    // If specific user IDs are not provided, determine target users based on type and data
    if (!targetUserIds || targetUserIds.length === 0) {
      targetUserIds = await getUsersForNotification(data.type, data.data || {});
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users to notify',
        userCount: 0
      });
    }

    // Send notification using Redis service
    // This will create in-app notifications and send real-time notifications
    const notificationId = await sendNotification({
      type: data.type,
      data: data.data || {},
      userIds: targetUserIds,
      priority: data.priority || 'normal',
      idempotencyKey: data.idempotencyKey
    });

    return NextResponse.json({
      success: true,
      notificationId,
      userCount: targetUserIds.length
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification', message: (error as Error).message },
      { status: 500 }
    );
  }
}