import { NextRequest } from "next/server";

/**
 * DEPRECATED: This is an alternative SSE implementation using polling.
 *
 * The recommended implementation is in /api/dashboard/sse/route.ts which uses
 * a proper event-based approach with EventEmitter.
 *
 * This file is kept for reference but should not be used in production.
 */

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    // This endpoint is deprecated - redirect to the new SSE endpoint
    console.log("[SSE Debug] Stream API: Redirecting client to new SSE endpoint");

    // Return a response that redirects to the new endpoint
    return new Response(
        "This endpoint is deprecated. Please use /api/dashboard/sse instead.",
        {
            status: 308, // Permanent Redirect
            headers: {
                "Location": "/api/dashboard/sse",
                "Content-Type": "text/plain"
            }
        }
    );
}