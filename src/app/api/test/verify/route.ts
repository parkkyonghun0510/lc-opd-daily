import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    // Test token data
    const tokenData = {
      id: token.id,
      role: token.role,
      branchId: token.branchId,
      email: token.email,
      name: token.name,
    };

    // Test role-based permissions
    const permissions = {
      canAccessAdmin: token.role === "admin",
      canManageBranches: ["admin"].includes(token.role),
      canManageUsers: ["admin"].includes(token.role),
      canApproveReports: ["admin", "manager"].includes(token.role),
      canCreateReports: ["admin", "manager", "user"].includes(token.role),
      canViewReports: ["admin", "manager", "user", "readonly"].includes(
        token.role,
      ),
    };

    return NextResponse.json({
      message: "Authentication verification successful",
      token: tokenData,
      permissions,
    });
  } catch (error) {
    console.error("Error verifying authentication:", error);
    return NextResponse.json(
      { error: "Failed to verify authentication" },
      { status: 500 },
    );
  }
}
