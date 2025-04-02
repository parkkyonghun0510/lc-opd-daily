import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/lib/auth/roles";
import { checkPermission } from "@/lib/auth/roles";

/**
 * Get notification statistics and delivery metrics
 * GET /api/notifications/statistics
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission
    const hasPermission = checkPermission(
      session.user.role,
      Permission.MANAGE_SETTINGS
    );
    
    if (!hasPermission) {
      return NextResponse.json(
        { error: "You don't have permission to access notification statistics" },
        { status: 403 }
      );
    }

    // Get date range parameters from query
    const url = new URL(req.url);
    const rangeParam = url.searchParams.get("range") || "7d";
    const branchId = url.searchParams.get("branchId");
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (rangeParam) {
      case "24h":
        startDate.setHours(now.getHours() - 24);
        break;
      case "7d":
        startDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(now.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 7); // Default to 7 days
    }

    // Base query condition for time range
    const dateRangeCondition = {
      createdAt: {
        gte: startDate.toISOString(),
        lte: now.toISOString(),
      },
    };

    // Add branch condition if specified
    const branchCondition = branchId ? {
      user: {
        OR: [
          { branchId },
          {
            branchAssignments: {
              some: { branchId }
            }
          }
        ]
      }
    } : {};

    // Combine conditions
    const queryCondition = {
      ...dateRangeCondition,
      ...branchCondition
    };

    // 1. Total notifications count
    const totalCount = await prisma.inAppNotification.count({
      where: queryCondition
    });

    // 2. Read vs Unread counts
    const readCount = await prisma.inAppNotification.count({
      where: {
        ...queryCondition,
        isRead: true
      }
    });

    // 3. Notification type distribution
    const typeDistribution = await prisma.inAppNotification.groupBy({
      by: ['type'],
      _count: {
        id: true
      },
      where: queryCondition,
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });

    // 4. Daily notification volume
    const dailyVolume = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('day', "createdAt") as date,
        COUNT(*) as count
      FROM "InAppNotification"
      WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${now}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `;

    // 5. Delivery status counts
    const deliveryStatus = await prisma.notificationEvent.groupBy({
      by: ['event'],
      _count: {
        id: true
      },
      where: {
        timestamp: {
          gte: startDate.toISOString(),
          lte: now.toISOString()
        }
      }
    });

    // 6. Average notification engagement rate
    const deliveredCount = deliveryStatus.find(d => d.event === 'DELIVERED')?._count.id || 0;
    const clickedCount = deliveryStatus.find(d => d.event === 'CLICKED')?._count.id || 0;
    const engagementRate = deliveredCount > 0 ? clickedCount / deliveredCount : 0;

    // 7. Branch notification distribution (top 10)
    const branchDistribution = await prisma.inAppNotification.groupBy({
      by: ['userId'],
      _count: {
        id: true
      },
      where: queryCondition,
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 10
    });

    // Get user and branch information for the top branches
    const userIds = branchDistribution.map(item => item.userId);
    const usersWithBranches = await prisma.user.findMany({
      where: {
        id: {
          in: userIds
        }
      },
      select: {
        id: true,
        name: true,
        branch: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    // Map user branch info to distribution data
    const branchStats = branchDistribution.map(item => {
      const user = usersWithBranches.find(u => u.id === item.userId);
      return {
        userId: item.userId,
        userName: user?.name || 'Unknown',
        branchId: user?.branch?.id || 'Unknown',
        branchName: user?.branch?.name || 'Unknown',
        branchCode: user?.branch?.code || 'Unknown',
        count: item._count.id
      };
    });

    // Return statistics
    return NextResponse.json({
      timeRange: {
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        rangeLabel: rangeParam
      },
      summary: {
        total: totalCount,
        read: readCount,
        unread: totalCount - readCount,
        readRate: totalCount > 0 ? readCount / totalCount : 0
      },
      typeDistribution: typeDistribution.map(item => ({
        type: item.type,
        count: item._count.id,
        percentage: totalCount > 0 ? (item._count.id / totalCount) * 100 : 0
      })),
      dailyVolume,
      deliveryStatus: {
        raw: deliveryStatus,
        sent: deliveryStatus.find(d => d.event === 'SENT')?._count.id || 0,
        delivered: deliveredCount,
        clicked: clickedCount,
        failed: deliveryStatus.find(d => d.event === 'FAILED')?._count.id || 0,
        closed: deliveryStatus.find(d => d.event === 'CLOSED')?._count.id || 0,
        engagementRate
      },
      branchDistribution: branchStats
    });
  } catch (error) {
    console.error("Error generating notification statistics:", error);
    return NextResponse.json(
      { error: "Failed to generate notification statistics" },
      { status: 500 }
    );
  }
} 