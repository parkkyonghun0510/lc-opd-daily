import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { logUserActivity } from "@/lib/auth";
import { clearTokenCookie, getUserFromToken } from "@/lib/jwt";

// POST /api/auth/logout - Log out a user
export async function POST(request: Request) {
  try {
    // Get the user from the JWT token before clearing it
    const user = getUserFromToken();

    // Clear the JWT token cookie
    clearTokenCookie();

    // Get request information for activity logging
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Log the logout activity if we have a user ID
    const userData = await user;
    if (userData && userData.userId) {
      await logUserActivity(
        userData.userId,
        "logout",
        { method: "api" },
        { ipAddress: ip, userAgent }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error during logout:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
