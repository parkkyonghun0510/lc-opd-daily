import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

/**
 * Get delivery events for a specific notification
 * GET /api/notifications/[id]/events
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Check user session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    
    // Verify notification belongs to user
    const notification = await prisma.inAppNotification.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    });

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    // Fetch notification events
    const events = await prisma.notificationEvent.findMany({
      where: {
        notificationId: id
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Error fetching notification events:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification events" },
      { status: 500 }
    );
  }
} 