import { NextResponse } from "next/server";
import { getCacheStats, resetMetrics } from "@/lib/cache-monitor";

export async function GET() {
  try {
    const stats = await getCacheStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching cache stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch cache statistics" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    await resetMetrics();
    return NextResponse.json({ message: "Cache metrics reset successfully" });
  } catch (error) {
    console.error("Error resetting cache metrics:", error);
    return NextResponse.json(
      { error: "Failed to reset cache metrics" },
      { status: 500 }
    );
  }
}
