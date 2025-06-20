import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { sseMetrics } from "@/lib/sse/sseMetrics";

/**
 * SSE Metrics API
 *
 * This endpoint provides detailed metrics about SSE connections and events.
 * It requires admin privileges to access.
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate the user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if the user has admin privileges
    const isAdmin =
      session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Admin privileges required" },
        { status: 403 },
      );
    }

    // Get SSE metrics
    const metrics = sseMetrics.getMetrics();

    // Return the metrics
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      metrics,
    });
  } catch (error) {
    console.error("[SSE Metrics] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
