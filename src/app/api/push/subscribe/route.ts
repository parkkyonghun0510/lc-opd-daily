import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    console.log('Received push subscription request');
    const subscription = await request.json();
    console.log('Subscription data:', {
      endpoint: subscription.endpoint,
      hasKeys: !!subscription.keys,
      hasP256dh: !!subscription.keys?.p256dh,
      hasAuth: !!subscription.keys?.auth
    });
    
    // Check if subscription already exists
    const existingSubscription = await prisma.pushSubscription.findUnique({
      where: {
        endpoint: subscription.endpoint,
      },
    });

    if (existingSubscription) {
      console.log('Updating existing subscription');
      // Update the existing subscription
      const updatedSubscription = await prisma.pushSubscription.update({
        where: {
          endpoint: subscription.endpoint,
        },
        data: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      });
      console.log('Subscription updated successfully:', updatedSubscription);
      return NextResponse.json({ success: true, updated: true });
    }

    // Create new subscription
    console.log('Creating new subscription');
    const savedSubscription = await prisma.pushSubscription.create({
      data: {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
    console.log('Subscription saved successfully:', savedSubscription);

    return NextResponse.json({ success: true, created: true });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    return NextResponse.json(
      { error: 'Failed to save push subscription', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 