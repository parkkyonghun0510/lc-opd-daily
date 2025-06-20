import { NextRequest } from "next/server";
import { generateSSETokenHandler } from "@/lib/sse/sseAuth";

/**
 * SSE Token Generation Endpoint
 *
 * This endpoint generates a token for authenticating SSE connections.
 * It requires the user to be authenticated via session.
 */
export async function GET(req: NextRequest) {
  return generateSSETokenHandler(req);
}
