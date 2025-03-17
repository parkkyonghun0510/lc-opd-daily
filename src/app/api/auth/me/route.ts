import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getUserData } from "@/lib/db";
import { logUserActivity } from "@/lib/auth/log-user-activity";

// Cache duration in seconds
const CACHE_MAX_AGE = 60; // 1 minute
const STALE_WHILE_REVALIDATE = 600; // 10 minutes

// GET /api/auth/me - Get the current authenticated user with complete profile data
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const userData = await getUserData(userId);

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Format user data with computed fields for client consumption
    const user = {
      id: userData.id,
      name: userData.name || "",
      email: userData.email,
      role: userData.role,
      image: userData.image || undefined,
      username: userData.username || undefined,
      isActive: userData.isActive,
      branch: userData.branch || undefined,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
      computedFields: {
        displayName:
          userData.name || userData.username || userData.email.split("@")[0],
        accessLevel:
          userData.role.charAt(0).toUpperCase() + userData.role.slice(1),
        status: userData.isActive ? "Active" : "Inactive",
        primaryBranch: userData.branch
          ? { name: userData.branch.name, code: userData.branch.code }
          : undefined,
      },
      permissions: {
        canAccessAdmin: userData.role === "admin",
        canViewAnalytics: ["admin", "manager", "analyst"].includes(
          userData.role
        ),
        canViewAuditLogs: ["admin", "manager"].includes(userData.role),
        canCustomizeDashboard: ["admin", "manager", "analyst"].includes(
          userData.role
        ),
        canManageSettings: ["admin", "manager"].includes(userData.role),
      },
      preferences: userData.preferences || {
        notifications: {
          reportUpdates: true,
          reportComments: true,
          reportApprovals: true,
        },
        appearance: {
          compactMode: false,
        },
      },
    };

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

    // Calculate ETag based on user data
    const etag = `"${Buffer.from(
      JSON.stringify({
        id: user.id,
        updatedAt: user.updatedAt,
        role: user.role,
      })
    ).toString("base64")}"`;

    // Check if client has a valid cached version
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "Cache-Control": `public, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`,
          ETag: etag,
        },
      });
    }

    const response = NextResponse.json({ user });

    // Add caching headers
    response.headers.set(
      "Cache-Control",
      `public, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`
    );
    response.headers.set("ETag", etag);

    return response;
  } catch (error) {
    console.error("Error in /api/auth/me:", error);
    return NextResponse.json(
      { error: "Failed to fetch user data" },
      { status: 500 }
    );
  }
}
