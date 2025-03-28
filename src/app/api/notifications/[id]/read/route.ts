import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

// POST /api/notifications/[id]/read - Mark a notification as read
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    
    if (!id) {
      return NextResponse.json(
        { error: "Notification ID is required" },
        { status: 400 }
      );
    }

    // Get the notification to check ownership
    const notification = await prisma.inAppNotification.findUnique({
      where: { id }
    });

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    // Verify notification belongs to the user
    if (notification.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You don't have permission to access this notification" },
        { status: 403 }
      );
    }

    // Already read, no need to update
    if (notification.isRead) {
      return NextResponse.json({
        message: "Notification already marked as read"
      });
    }

    // Update notification status
    const updatedNotification = await prisma.inAppNotification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      }
    });

    // Create a "READ" event for the notification
    await prisma.notificationEvent.create({
      data: {
        notificationId: id,
        event: "READ",
        metadata: {
          readAt: new Date().toISOString(),
          method: "api"
        }
      }
    });

    return NextResponse.json({
      success: true,
      notification: updatedNotification,
      message: "Notification marked as read"
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return NextResponse.json(
      { error: "Failed to mark notification as read" },
      { status: 500 }
    );
  }
}