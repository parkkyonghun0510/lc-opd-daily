import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/lib/auth/roles";
import {
  DashboardEventTypes,
  createDashboardUpdate,
} from "@/lib/events/dashboard-events";
import { broadcastDashboardUpdate } from "@/lib/events/dashboard-broadcaster";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Check if user has admin access
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user?.role || user.role !== "ADMIN") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Fetch statistics
    const [
      totalUsers,
      adminUsers,
      totalBranches,
      activeUsers,
      pendingReports,
      recentActivityRaw,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          role: "ADMIN",
        },
      }),
      prisma.branch.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.report.count({ where: { status: "pending_approval" } }),
      prisma.activityLog.findMany({
        orderBy: { timestamp: "desc" },
        take: 5,
        select: {
          action: true,
          userId: true,
          timestamp: true,
          details: true,
          user: { select: { username: true, name: true, email: true } },
        },
      }),
    ]);

    // Helper to infer type from action
    const inferType = (action: string) => {
      if (!action) return "user";
      const a = action.toLowerCase();
      if (a.includes("error")) return "error";
      if (a.includes("warning")) return "warning";
      return "user";
    };

    // Map recentActivity to improved shape
    const recentActivity = recentActivityRaw.map((a) => ({
      type: inferType(a.action),
      user: a.user?.name || a.user?.username || a.user?.email || "unknown",
      action: a.action.replace(/_/g, " ").toLowerCase(),
      timestamp: a.timestamp,
      details: a.details || undefined,
    }));

    // Dummy storage usage (replace with real logic if available)
    const storageUsage = {
      used: 2.5 * 1024 * 1024 * 1024,
      total: 10 * 1024 * 1024 * 1024,
    };

    const stats = {
      totalUsers,
      adminUsers,
      totalBranches,
      activeUsers,
      pendingReports,
      recentActivity,
      storageUsage,
      systemStatus: "Active",
    };

    // Broadcast update via SSE (optional: only if you want real-time dashboard updates)
    broadcastDashboardUpdate(
      DashboardEventTypes.DASHBOARD_METRICS_UPDATED,
      stats,
    );

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
