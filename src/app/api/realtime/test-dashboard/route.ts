import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  broadcastDashboardUpdate,
  DashboardEventTypes,
} from "@/lib/events/dashboardEvents";

/**
 * Test API for sending dashboard updates
 *
 * This endpoint allows testing the dashboard real-time functionality.
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const token = await getToken({ req: request });
    if (!token || !token.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only allow admins to send test events
    const userRole = token.role as string;
    if (userRole.toLowerCase() !== "admin") {
      return NextResponse.json(
        { error: "Only administrators can send test events" },
        { status: 403 },
      );
    }

    // Parse the request body
    const body = await request.json();
    const { type = "STATS_UPDATED", data = {} } = body;

    // Generate random dashboard data if not provided
    const dashboardData = data.dashboardData || {
      totalUsers: Math.floor(Math.random() * 100) + 50,
      totalReports: Math.floor(Math.random() * 200) + 100,
      totalAmount: Math.floor(Math.random() * 1000000) + 500000,
      growthRate: Math.random() * 20 - 5, // Between -5% and 15%
    };

    // Create the event data
    const eventData = {
      ...data,
      dashboardData,
      timestamp: Date.now(),
      sender: token.id,
    };

    // Send the dashboard update
    const eventId = broadcastDashboardUpdate(type, eventData);

    return NextResponse.json({
      success: true,
      message: `Dashboard update sent successfully`,
      eventId,
      type,
      data: eventData,
    });
  } catch (error) {
    console.error("[Test Dashboard API] Error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
