import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { NotificationType } from "@/utils/notificationTemplates";
import { getUsersForNotification } from "@/utils/notificationTargeting";
import { sendToNotificationQueue } from "@/lib/queue/sqs";
import { Permission, UserRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";

/**
 * API Endpoint to test branch hierarchy-based notifications
 * POST /api/push/test-hierarchy
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "You must be logged in to test notifications" },
        { status: 401 },
      );
    }

    // Only admins can test notifications
    const userRoles = await prisma.userRole.findMany({
      where: { userId: session.user.id },
      include: { role: true },
    });

    const isAdmin = userRoles.some(
      (ur) =>
        ur.role.name.toLowerCase() === "admin" ||
        session.user.role === UserRole.ADMIN,
    );

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Only administrators can test notifications" },
        { status: 403 },
      );
    }

    // Parse request data
    const data = await req.json();
    const {
      branchId,
      notificationType,
      includeSubBranches,
      includeParentBranches,
      message,
    } = data;

    if (!branchId) {
      return NextResponse.json(
        { error: "Branch ID is required" },
        { status: 400 },
      );
    }

    if (!notificationType) {
      return NextResponse.json(
        { error: "Notification type is required" },
        { status: 400 },
      );
    }

    // Create notification data
    const notificationData = {
      branchId,
      includeSubBranches: includeSubBranches === true,
      includeParentBranches: includeParentBranches === true,
      title: `Test Notification: ${notificationType}`,
      body: message || `This is a test notification for branch hierarchy.`,
      userId: session.user.id, // The user who initiated the test
      timestamp: new Date().toISOString(),
    };

    // Get target users based on branch hierarchy
    const targetUserIds = await getUsersForNotification(notificationType, {
      branchId,
      includeSubBranches,
      includeParentBranches,
    });

    // Send notifications
    const result = await sendToNotificationQueue({
      type: notificationType,
      data: notificationData,
      userIds: targetUserIds,
      priority: "high",
    });

    // Get branch details
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { name: true, code: true },
    });

    // Return statistics
    return NextResponse.json({
      success: true,
      stats: {
        targetUsers: targetUserIds.length,
        branchName: branch?.name || "Unknown Branch",
        branchCode: branch?.code || "Unknown",
        messageQueued: !!result.MessageId,
        notificationType,
        hierarchySettings: {
          includeSubBranches: includeSubBranches === true,
          includeParentBranches: includeParentBranches === true,
        },
      },
      message: `Test notification sent to ${targetUserIds.length} users`,
    });
  } catch (error) {
    console.error("Error sending test notification:", error);
    return NextResponse.json(
      { error: "Failed to send test notification" },
      { status: 500 },
    );
  }
}
