import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getAccessibleBranches } from "@/lib/auth/branch-access";

// Get notifications for the current user
export async function GET(request: Request) {
  try {
    // Get the current user from the session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    
    // Parse URL to get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const unreadOnly = searchParams.get("unread") === "true";
    
    // Get accessible branches for the user
    const accessibleBranches = await getAccessibleBranches(userId);
    const accessibleBranchIds = accessibleBranches.map(branch => branch.id);
    
    // Create base filter conditions
    const where = {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
    };
    
    // Get all notifications for the user first
    const allNotifications = await prisma.inAppNotification.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip: offset,
      take: limit,
    });

    // Filter notifications based on branch access
    const filteredNotifications = allNotifications.filter(notification => {
      // Always include system notifications
      if (notification.type === 'SYSTEM_NOTIFICATION') {
        return true;
      }

      // Parse the notification data
      const data = notification.data as any;
      
      // If there's no branchId in the data, include it
      if (!data?.branchId) {
        return true;
      }

      // Check if the branchId is in the accessible branches
      return accessibleBranchIds.includes(data.branchId);
    });
    
    // Get total count for pagination
    const totalCount = await prisma.inAppNotification.count({
      where,
    });
    
    // Count unread for badge
    const unreadCount = await prisma.inAppNotification.count({
      where: {
        userId,
        isRead: false,
      },
    });
    
    return NextResponse.json({
      notifications: filteredNotifications,
      pagination: {
        total: totalCount,
        offset,
        limit,
      },
      unreadCount,
    });
  } catch (error) {
    console.error("Error retrieving notifications:", error);
    return NextResponse.json(
      { error: "Failed to retrieve notifications" },
      { status: 500 }
    );
  }
} 