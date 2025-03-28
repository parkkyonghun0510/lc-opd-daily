import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getUsersForNotification } from '@/utils/notificationTargeting';
import { NotificationType, generateNotificationContent } from '@/utils/notificationTemplates';
import { sendToNotificationQueue } from '@/lib/queue/sqs';

// Initialize web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

if (!vapidPublicKey || !vapidPrivateKey) {
  console.error('VAPID keys not set');
} else {
  webpush.setVapidDetails(
    'mailto:admin@example.com',
    vapidPublicKey,
    vapidPrivateKey
  );
}

export async function POST(request: Request) {
  try {
    const { type, data, userIds = [] } = await request.json();

    // Validate notification type
    if (!type || typeof type !== 'string') {
      return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
    }

    // Make sure data is provided
    if (!data) {
      return NextResponse.json({ error: 'Notification data is required' }, { status: 400 });
    }

    // Get users that should receive this notification based on type and data
    let targetUserIds = [...userIds];

    // Add users based on role/branch targeting
    if (type) {
      const additionalUserIds = await getUsersForNotification(type as NotificationType, data);
      targetUserIds = [...new Set([...targetUserIds, ...additionalUserIds])];
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({ error: 'No users to notify' }, { status: 400 });
    }

    // Queue the notification for background processing
    const queueResult = await sendToNotificationQueue({
      type,
      data,
      userIds: targetUserIds,
      timestamp: new Date().toISOString(),
    });

    // Create in-app notifications immediately
    const notificationContent = generateNotificationContent(type as NotificationType, data);
    
    // Check if notification model exists in Prisma schema
    const inAppNotifications = await Promise.all(
      targetUserIds.map(userId => 
        prisma.inAppNotification.create({
          data: {
            userId,
            title: notificationContent.title,
            body: notificationContent.body,
            type: type,
            data: data,
            isRead: false,
            actionUrl: notificationContent.url,
          }
        })
      )
    );

    return NextResponse.json({
      success: true,
      message: 'Notification queued successfully',
      messageId: queueResult.MessageId || 'unknown',
      inAppNotificationsCount: inAppNotifications.length,
      targetUsers: targetUserIds.length,
    });
  } catch (error: any) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send notification' },
      { status: 500 }
    );
  }
} 