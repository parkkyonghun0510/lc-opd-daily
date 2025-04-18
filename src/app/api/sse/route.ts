import { NextRequest } from "next/server";
import sseHandler from "@/lib/sse/sseHandler";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
        return new Response("Unauthorized", { status: 401 });
    }

    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();

            function send(data: any) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            }

            const clientId = crypto.randomUUID();

            const response = {
                write: (chunk: string) => controller.enqueue(encoder.encode(chunk)),
            };

            sseHandler.addClient(clientId, userId, response);
            //console.log(`[SSE API] Client connected: ${clientId} for user: ${userId}`);

            // Send initial event
            send({ type: "connected", clientId });

            const pingInterval = setInterval(() => {
                const pingData = { type: "ping", timestamp: Date.now() };
                //console.log(`[SSE API] Sending ping to client: ${clientId}`, pingData);
                send(pingData);
            }, 30000);

            req.signal.addEventListener("abort", () => {
                clearInterval(pingInterval);
                sseHandler.removeClient(clientId);
                //console.log(`[SSE API] Client disconnected: ${clientId} for user: ${userId}`);
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