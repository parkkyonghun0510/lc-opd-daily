import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

/**
 * Background notifications sync endpoint used by the Service Worker
 * POST /api/notifications/sync
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Parse request body (optional payload from SW)
    let lastSync: string | null = null;
    try {
      const data = await req.json();
      lastSync = data?.lastSync ?? null;
    } catch (_) {
      // ignore body parsing errors, treat as no payload
    }

    // If user is authenticated, return useful sync info
    if (session?.user?.id) {
      const userId = session.user.id;

      // Compute counts in parallel
      const [unreadCount, newSinceCount] = await Promise.all([
        prisma.inAppNotification.count({
          where: {
            userId,
            isRead: false,
          },
        }),
        lastSync
          ? prisma.inAppNotification.count({
              where: {
                userId,
                createdAt: { gt: new Date(lastSync) },
              },
            })
          : Promise.resolve(0),
      ]);

      return NextResponse.json({
        success: true,
        userId,
        unreadCount,
        newSinceLastSync: newSinceCount,
        serverTime: new Date().toISOString(),
      });
    }

    // Anonymous or no session: still return 200 to keep SW happy
    return NextResponse.json({
      success: true,
      message: "Sync acknowledged",
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in notifications sync:", error);
    return NextResponse.json(
      { error: "Failed to perform notifications sync" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}