import { NextRequest, NextResponse } from "next/server";
import unifiedSSEHandler from "@/lib/sse/unifiedSSEHandler";

export const runtime = "nodejs";

/**
 * Health check endpoint for SSE handler (unified)
 * Provides status of the unified SSE pipeline
 */
export async function GET(request: NextRequest) {
  try {
    const unified = await unifiedSSEHandler.getStatus();
    const isHealthy = unified.isReady;
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      unified
    }, {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}