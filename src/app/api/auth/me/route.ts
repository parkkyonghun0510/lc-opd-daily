import { NextResponse } from "next/server";
import { verifyToken, getTokenFromCookies } from "@/lib/jwt";
import { getCurrentUser, logUserActivity } from "@/lib/auth";

// GET /api/auth/me - Get the current authenticated user
export async function GET(request: Request) {
  try {
    // Get the token from cookies
    const token = await getTokenFromCookies();

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Verify the token
    const payload = await verifyToken(token);

    if (!payload || !payload.userId) {
      return NextResponse.json(
        { error: "Invalid authentication token" },
        { status: 401 }
      );
    }

    // Get the user from the database
    const user = await getCurrentUser(payload.userId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Log the activity
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    await logUserActivity(
      user.id,
      "view_profile",
      { method: "api" },
      { ipAddress: ip, userAgent }
    );

    // Return the user
    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        branchId: user.branchId,
      },
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch user profile" },
      { status: 500 }
    );
  }
}
