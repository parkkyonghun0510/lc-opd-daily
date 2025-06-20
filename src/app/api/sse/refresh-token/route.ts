import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { generateSSEToken, verifySSEToken } from "@/lib/sse/sseAuth";

/**
 * API route for refreshing SSE tokens
 *
 * This endpoint refreshes an SSE token for the authenticated user.
 * It verifies the old token and generates a new one with updated metadata.
 */
export async function POST(req: NextRequest) {
  try {
    // Get the request body
    const body = await req.json();
    const { oldToken } = body;

    if (!oldToken) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // Verify the old token
    const payload = await verifySSEToken(oldToken);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Get the current session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify that the token belongs to the current user
    if (payload.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Token user mismatch" },
        { status: 403 },
      );
    }

    // Generate a new token with updated metadata
    const newToken = await generateSSEToken(session.user.id, {
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      branchId: session.user.branchId,
      lastActivity: Date.now(),
      tokenCreatedAt: Date.now(),
      refreshedFrom: payload.jti, // Include the ID of the token being refreshed
    });

    // Return the new token with expiration info
    return NextResponse.json({
      token: newToken,
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour from now
      refreshAfter: Date.now() + 45 * 60 * 1000, // 45 minutes from now
    });
  } catch (error) {
    console.error("[SSE Auth] Error refreshing token:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
