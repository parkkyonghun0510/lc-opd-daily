import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

// GET /api/notifications - Get user notifications
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get query parameters
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const showAll = url.searchParams.get("all") === "true";
    const unreadOnly = url.searchParams.get("unread") === "true";

    // Create filter based on parameters
    const filter: any = {
      userId: session.user.id,
    };

    if (unreadOnly) {
      filter.isRead = false;
    }

    // Get notifications with pagination
    const notifications = await prisma.inAppNotification.findMany({
      where: filter,
      include: {
        events: {
          orderBy: {
            timestamp: "desc"
          },
          take: 5
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      skip: offset,
      take: limit
    });

    // Count unread notifications
    const unreadCount = await prisma.inAppNotification.count({
      where: {
        userId: session.user.id,
        isRead: false
      }
    });

    // Count total notifications
    const totalCount = await prisma.inAppNotification.count({
      where: {
        userId: session.user.id
      }
    });

    return NextResponse.json({
      notifications,
      unreadCount,
      totalCount,
      pagination: {
        limit,
        offset,
        hasMore: offset + notifications.length < totalCount
      }
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
} 