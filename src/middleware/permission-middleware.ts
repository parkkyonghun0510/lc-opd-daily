import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { Permission, UserRole, hasPermission } from "@/lib/auth/roles";

// Define a proper user type for better TypeScript support
interface AuthUser {
  userId: string;
  id?: string; // Supporting both id formats for compatibility
  role: string;
  branchId?: string;
  // Use more specific types for additional properties
  email?: string;
  name?: string;
  assignedBranchIds?: string[];
  // Alternatively, we could remove the index signature completely if we know all needed properties
}

interface PermissionOptions {
  requiredPermission?: Permission;
  requiredRole?: UserRole;
  allowSelf?: boolean; // For user-specific endpoints
}

export async function withPermission(
  request: NextRequest,
  options: PermissionOptions,
  handler: (req: NextRequest, user: AuthUser) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // Get user from NextAuth token instead of custom JWT
    const token = await getToken({ req: request });

    // Convert NextAuth token to the AuthUser format expected by handlers
    const user = token
      ? {
          userId: token.id as string,
          id: token.id as string,
          role: token.role as string,
          branchId: token.branchId as string | undefined,
        }
      : null;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check role requirement
    if (options.requiredRole && user.role !== options.requiredRole) {
      return NextResponse.json(
        { error: "Insufficient role permissions" },
        { status: 403 }
      );
    }

    // Check permission requirement
    if (
      options.requiredPermission &&
      !hasPermission(user.role as UserRole, options.requiredPermission)
    ) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Handle self-access for user endpoints
    if (options.allowSelf) {
      const { searchParams } = new URL(request.url);
      const targetUserId = searchParams.get("userId") || searchParams.get("id");

      // If not requesting self data and not admin
      if (
        targetUserId &&
        targetUserId !== user.userId &&
        user.role !== UserRole.ADMIN
      ) {
        return NextResponse.json(
          { error: "You can only access your own data" },
          { status: 403 }
        );
      }
    }

    // Pass control to the actual handler
    return handler(request, user as AuthUser);
  } catch (error) {
    console.error("Permission middleware error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
