import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

// GET /api/notifications/unread-count - Get count of unread notifications
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Count unread notifications for the current user
    const count = await prisma.inAppNotification.count({
      where: {
        userId: session.user.id,
        isRead: false
      }
    });

    return NextResponse.json({
      count
    });
  } catch (error) {
    console.error("Error getting unread notification count:", error);
    return NextResponse.json(
      { error: "Failed to get notification count" },
      { status: 500 }
    );
  }
} 