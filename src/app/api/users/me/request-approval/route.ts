import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications/dragonflyNotificationService";
import { NotificationType } from "@/utils/notificationTemplates";

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    const userId = token.id as string;

    // Get the user's branch and info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        isActive: true,
        branchId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // If already active, no need to request approval
    if (user.isActive) {
      return NextResponse.json({ message: "Your account is already active" }, { status: 200 });
    }

    // Send approval request notification to admins/branch managers
    try {
      await sendNotification({
        type: NotificationType.USER_APPROVAL_REQUESTED,
        userIds: [], // Targeting will compute admins/managers based on branchId
        data: {
          userId: user.id,
          userName: user.name || user.username,
          branchId: user.branchId,
          email: user.email,
        },
        priority: 'high'
      });
    } catch (notificationError) {
      console.error('Failed to queue approval request notification:', notificationError);
      // Still respond success to the user, but include a warning
      return NextResponse.json({
        message: "Approval request submitted, but there was an issue notifying admins.",
        warning: true
      });
    }

    return NextResponse.json({ message: "Approval request submitted" });
  } catch (error) {
    console.error("Error handling approval request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}