import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import {
  sendNotification,
  getNotificationMetrics,
} from "@/lib/redis/enhancedRedisNotificationService";
import { getRedisLoadBalancer } from "@/lib/redis/redisLoadBalancer";

/**
 * Test Enhanced Redis Notification Service
 *
 * This endpoint tests the enhanced Redis notification service with load balancing.
 * POST /api/test/enhanced-redis
 */
export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    // Parse request body
    const body = await request.json();
    const { message, title, priority = "normal" } = body;

    // Send a test notification
    const notificationId = await sendNotification({
      type: "SYSTEM_NOTIFICATION",
      data: {
        title: title || "Enhanced Redis Test",
        body:
          message ||
          `This is a test notification sent at ${new Date().toLocaleTimeString()} using the enhanced Redis service.`,
        source: "test-api",
        timestamp: new Date().toISOString(),
      },
      userIds: [session.user.id],
      priority: priority as "high" | "normal" | "low",
    });

    // Get metrics
    const metrics = await getNotificationMetrics();

    // Get load balancer stats
    const loadBalancerStats = getRedisLoadBalancer().getStats();

    return NextResponse.json({
      success: true,
      message: "Test notification sent successfully",
      notificationId,
      metrics,
      loadBalancerStats,
    });
  } catch (error) {
    console.error("Error testing enhanced Redis:", error);

    return NextResponse.json(
      {
        error: "Failed to test enhanced Redis",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * Get Enhanced Redis Metrics
 *
 * This endpoint gets metrics about the enhanced Redis notification service.
 * GET /api/test/enhanced-redis
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    // Get metrics
    const metrics = await getNotificationMetrics();

    // Get load balancer stats
    const loadBalancerStats = getRedisLoadBalancer().getStats();

    return NextResponse.json({
      success: true,
      metrics,
      loadBalancerStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting enhanced Redis metrics:", error);

    return NextResponse.json(
      {
        error: "Failed to get enhanced Redis metrics",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
