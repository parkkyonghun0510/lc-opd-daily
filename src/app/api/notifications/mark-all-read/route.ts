import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

// POST /api/notifications/mark-all-read - Mark all user notifications as read
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Find all unread notifications for this user
    const unreadNotifications = await prisma.inAppNotification.findMany({
      where: {
        userId: session.user.id,
        isRead: false
      },
      select: {
        id: true
      }
    });

    if (unreadNotifications.length === 0) {
      return NextResponse.json({
        message: "No unread notifications found",
        count: 0
      });
    }

    const notificationIds = unreadNotifications.map(n => n.id);

    // Update all notifications as read in a single operation
    const updateResult = await prisma.inAppNotification.updateMany({
      where: {
        id: {
          in: notificationIds
        }
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    // Create READ events for all the notifications
    const now = new Date();
    await prisma.notificationEvent.createMany({
      data: notificationIds.map(id => ({
        notificationId: id,
        event: "READ",
        metadata: {
          readAt: now.toISOString(),
          method: "bulk-update"
        }
      }))
    });

    return NextResponse.json({
      success: true,
      count: updateResult.count,
      message: `Marked ${updateResult.count} notifications as read`
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return NextResponse.json(
      { error: "Failed to mark notifications as read" },
      { status: 500 }
    );
  }
} 