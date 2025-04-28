import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import webpush from 'web-push';

export async function POST() {
  try {
    //console.log('Starting cleanup of push subscriptions...');

    // Get all subscriptions
    const subscriptions = await prisma.pushSubscription.findMany();
    //console.log(`Found ${subscriptions.length} subscriptions to check`);

    const validSubscriptions = [];
    const invalidSubscriptions = [];

    // Check each subscription
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify({
            title: 'Test',
            body: 'Testing subscription validity',
            tag: 'subscription-validation',
            silent: true,
            requireInteraction: false,
            data: {
              type: 'validation',
              timestamp: Date.now()
            }
          })
        );
        validSubscriptions.push(subscription.id);
      } catch (error: any) {
        if (error.statusCode === 410) {
          invalidSubscriptions.push(subscription.id);
        }
      }
    }

    // Delete invalid subscriptions
    if (invalidSubscriptions.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: {
          id: {
            in: invalidSubscriptions,
          },
        },
      });
      //console.log(`Deleted ${invalidSubscriptions.length} invalid subscriptions`);
    }

    return NextResponse.json({
      success: true,
      validCount: validSubscriptions.length,
      deletedCount: invalidSubscriptions.length,
    });
  } catch (error) {
    console.error('Error cleaning up push subscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to clean up push subscriptions' },
      { status: 500 }
    );
  }
} 