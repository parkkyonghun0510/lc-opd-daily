import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { realtimeMonitor } from "@/lib/realtime/monitor";
import { sseHandler } from "@/lib/realtime/sseHandler";

/**
 * API endpoint for monitoring real-time connections
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const token = await getToken({ req: request });
    if (!token || !token.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is an admin
    const userRole = token.role as string;
    if (userRole.toLowerCase() !== "admin") {
      return NextResponse.json(
        { error: "Only administrators can access monitoring data" },
        { status: 403 },
      );
    }

    // Get monitoring data
    const metrics = realtimeMonitor.getMetrics();
    const allInstancesMetrics = await realtimeMonitor.getAllInstancesMetrics();
    const sseStats = sseHandler.getStats();

    return NextResponse.json({
      metrics,
      allInstancesMetrics,
      sseStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Monitor API] Error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
