import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { logUserActivity } from "@/lib/auth";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";

// POST /api/auth/logout - Log out a user
export async function POST(request: NextRequest) {
  try {
    // Get the user from the NextAuth token
    const token = await getToken({ req: request });

    // Clear the NextAuth session cookie
    (await cookies()).delete("next-auth.session-token");
    (await cookies()).delete(".next-auth.session-token"); // for cross-subdomain cookies

    // Get request information for activity logging
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Log the logout activity if we have a user ID
    if (token && token.id) {
      await logUserActivity(
        token.id as string,
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
