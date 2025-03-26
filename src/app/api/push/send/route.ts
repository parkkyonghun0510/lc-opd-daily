import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import webpush from 'web-push';
import { PushSubscription } from '@prisma/client';

// Initialize web-push with VAPID keys
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(request: Request) {
  try {
    const { title, body, data } = await request.json();

    // Get all push subscriptions
    const subscriptions = await prisma.pushSubscription.findMany();

    // Send push notification to all subscribers
    const notifications = subscriptions.map((subscription: PushSubscription) => {
      return webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        JSON.stringify({
          title,
          body,
          data,
        })
      );
    });

    await Promise.all(notifications);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending push notification:', error);
    return NextResponse.json(
      { error: 'Failed to send push notification' },
      { status: 500 }
    );
  }
} 