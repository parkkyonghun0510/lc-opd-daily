import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getNotificationMetrics } from "@/utils/notificationTracking";
import { prisma } from "@/lib/prisma";

/**
 * Get notification metrics and statistics
 * GET /api/notifications/metrics
 */
export async function GET(req: NextRequest) {
  try {
    // Check user session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get metrics from tracking utility
    const metrics = await getNotificationMetrics();

    // Get delivery success rate
    const deliveryStats = await prisma.notificationEvent.groupBy({
      by: ["event"],
      _count: {
        id: true,
      },
    });

    // Calculate delivery rates
    const stats = deliveryStats.reduce(
      (acc, curr) => {
        acc[curr.event.toLowerCase()] = curr._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );

    const totalDeliveryAttempts =
      (stats.sent || 0) + (stats.delivered || 0) + (stats.failed || 0);

    const deliveryRate =
      totalDeliveryAttempts > 0
        ? (stats.delivered || 0) / totalDeliveryAttempts
        : 0;

    // Get notification types breakdown
    const typeBreakdown = await prisma.inAppNotification.groupBy({
      by: ["type"],
      _count: {
        id: true,
      },
      where: {
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      ...metrics,
      deliveryStats: {
        ...stats,
        deliveryRate: parseFloat(deliveryRate.toFixed(2)),
        totalAttempts: totalDeliveryAttempts,
      },
      typeBreakdown: typeBreakdown.map((item) => ({
        type: item.type,
        count: item._count.id,
      })),
    });
  } catch (error) {
    console.error("Error fetching notification metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification metrics" },
      { status: 500 },
    );
  }
}
