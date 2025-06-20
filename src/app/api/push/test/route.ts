import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import webpush from "web-push";

// Initialize web-push with VAPID keys
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function POST() {
  try {
    // Get all push subscriptions
    const subscriptions = await prisma.pushSubscription.findMany();

    if (subscriptions.length === 0) {
      return NextResponse.json(
        {
          error:
            "No active subscriptions found. Please subscribe to push notifications first.",
        },
        { status: 400 },
      );
    }

    const notificationPayload = JSON.stringify({
      title: "Test Notification",
      body: "This is a test push notification from your local development environment!",
      data: {
        url: "/dashboard",
        timestamp: new Date().toISOString(),
      },
    });

    const results = await Promise.allSettled(
      subscriptions.map((subscription) =>
        webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          notificationPayload,
        ),
      ),
    );

    const successCount = results.filter(
      (result) => result.status === "fulfilled",
    ).length;

    return NextResponse.json({
      success: true,
      message: `Test notification sent to ${successCount} subscribers`,
      totalSubscribers: subscriptions.length,
    });
  } catch (error) {
    console.error("Error sending test notification:", error);
    return NextResponse.json(
      {
        error: "Failed to send test notification",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
