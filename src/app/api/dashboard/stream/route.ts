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
    console.log("[SSE Debug] Stream API: Client connected at", new Date().toISOString());
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();

            function send(data: any) {
                console.log("[SSE Debug] Stream API: Sending SSE data:", data);
                // Fix: Add proper event type formatting for SSE
                const eventType = data.type === "update" ? "dashboardUpdate" : data.type;
                controller.enqueue(encoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`));
            }

            // Send initial event
            console.log("[SSE Debug] Stream API: Sending initial connected event");
            send({ type: "connected", timestamp: Date.now() });

            const intervalId = setInterval(async () => {
                try {
                    const fetchUrl = `${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/dashboard/data`;
                    console.log("[SSE Debug] Stream API: Fetching dashboard data from:", fetchUrl);
                    const response = await fetch(fetchUrl, {
                        headers: {
                            "Content-Type": "application/json",
                        },
                        cache: "no-store"
                    });
                    if (!response.ok) {
                        throw new Error("Failed to fetch dashboard data");
                    }
                    const result = await response.json();
                    console.log("[SSE Debug] Stream API: /api/dashboard/data result:", result);
                    // Fix: Use consistent event type naming with the other implementation
                    send({ type: "dashboardUpdate", data: result.data });
                } catch (error) {
                    console.error("[SSE Debug] Stream API: Error fetching dashboard data:", error);
                    send({ type: "error", message: "Failed to fetch dashboard data" });
                }
            }, 5000); // every 5 seconds

            req.signal.addEventListener("abort", () => {
                clearInterval(intervalId);
                console.log("[SSE Debug] Stream API: Client disconnected at", new Date().toISOString());
                controller.close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}