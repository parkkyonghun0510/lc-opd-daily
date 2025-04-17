import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    console.log("[SSE Dashboard] Client connected at", new Date().toISOString());
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();

            function send(data: any) {
                console.log("[SSE Dashboard] Sending SSE data:", data);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            }

            // Send initial event
            send({ type: "connected", timestamp: Date.now() });

            const intervalId = setInterval(async () => {
                try {
                    const fetchUrl = `${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/dashboard/data`;
                    console.log("[SSE Dashboard] Fetching dashboard data from:", fetchUrl);
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
                    console.log("[SSE Dashboard] /api/dashboard/data result:", result);
                    send({ type: "update", data: result.data });
                } catch (error) {
                    console.error("[SSE Dashboard] Error fetching dashboard data:", error);
                    send({ type: "error", message: "Failed to fetch dashboard data" });
                }
            }, 5000); // every 5 seconds

            req.signal.addEventListener("abort", () => {
                clearInterval(intervalId);
                console.log("[SSE Dashboard] Client disconnected at", new Date().toISOString());
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