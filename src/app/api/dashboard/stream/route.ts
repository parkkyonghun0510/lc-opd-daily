import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();

            function send(data: any) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            }

            // Send initial event
            send({ type: "connected", timestamp: Date.now() });

            const intervalId = setInterval(async () => {
                try {
                    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/dashboard/data`, {
                        headers: {
                            "Content-Type": "application/json",
                        },
                        cache: "no-store"
                    });
                    if (!response.ok) {
                        throw new Error("Failed to fetch dashboard data");
                    }
                    const result = await response.json();
                    send({ type: "update", data: result.data });
                } catch (error) {
                    console.error("[SSE Dashboard] Error fetching dashboard data:", error);
                    send({ type: "error", message: "Failed to fetch dashboard data" });
                }
            }, 5000); // every 5 seconds

            req.signal.addEventListener("abort", () => {
                clearInterval(intervalId);
                console.log("[SSE Dashboard] Client disconnected");
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