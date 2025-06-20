import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const subscription = await request.json();

    if (!subscription?.endpoint) {
      return NextResponse.json(
        { error: "Invalid subscription data" },
        { status: 400 },
      );
    }

    // Check if subscription exists first
    const existingSubscription = await prisma.pushSubscription.findUnique({
      where: {
        endpoint: subscription.endpoint,
      },
    });

    // Only delete if it exists
    if (existingSubscription) {
      await prisma.pushSubscription.delete({
        where: {
          endpoint: subscription.endpoint,
        },
      });
      return NextResponse.json({
        success: true,
        message: "Subscription deleted successfully",
      });
    } else {
      // Subscription not found, but we can consider this a success since the end result is the same
      return NextResponse.json({
        success: true,
        message: "No subscription found to delete",
      });
    }
  } catch (error) {
    console.error("Error unsubscribing from push notifications:", error);
    return NextResponse.json(
      {
        error: "Failed to unsubscribe from push notifications",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
