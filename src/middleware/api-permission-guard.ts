import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { Permission, UserRole, checkPermission } from "@/lib/auth/roles";

export interface ApiUser {
  id: string;
  role: string;
  branchId?: string | null;
  email?: string;
  name?: string;
  assignedBranchIds?: string[];
}

interface RouteHandlerContext {
  params: Record<string, string>;
}

interface PermissionGuardOptions {
  requiredPermission?: Permission;
  requiredRole?: UserRole;
  allowSelf?: boolean; // For user-specific endpoints
  allowOwnBranch?: boolean; // For branch-specific endpoints
}

/**
 * Creates a protected API route handler that checks permissions before execution
 * 
 * @param handler The actual route handler function
 * @param options Permission options to enforce
 * @returns A wrapped handler function that includes permission checks
 */
export function withPermissionGuard<T>(
  handler: (
    req: NextRequest, 
    context: RouteHandlerContext, 
    currentUser: ApiUser
  ) => Promise<NextResponse<T>>,
  options: PermissionGuardOptions = {}
) {
  return async (
    req: NextRequest,
    context: RouteHandlerContext
  ): Promise<NextResponse<T>> => {
    try {
      // Get user from NextAuth token
      const token = await getToken({ req });

      if (!token || !token.id) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        ) as NextResponse<T>;
      }

      // Create API user object from token
      const currentUser: ApiUser = {
        id: token.id as string,
        role: token.role as string,
        branchId: token.branchId as string | null,
        email: token.email as string,
        name: token.name as string,
        assignedBranchIds: token.assignedBranchIds as string[] | undefined,
      };

      // Check role requirement
      if (
        options.requiredRole && 
        currentUser.role !== options.requiredRole
      ) {
        return NextResponse.json(
          { error: "Insufficient role permissions" },
          { status: 403 }
        ) as NextResponse<T>;
      }

      // Check permission requirement
      if (
        options.requiredPermission && 
        !checkPermission(currentUser.role, options.requiredPermission)
      ) {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 }
        ) as NextResponse<T>;
      }

      // Self-access check - for user endpoints
      if (options.allowSelf) {
        const { searchParams } = new URL(req.url);
        const targetUserId = searchParams.get("userId") || searchParams.get("id");

        // If not requesting self data, must have proper permissions
        if (
          targetUserId && 
          targetUserId !== currentUser.id && 
          currentUser.role !== UserRole.ADMIN &&
          !checkPermission(currentUser.role, Permission.MANAGE_USERS)
        ) {
          return NextResponse.json(
            { error: "You can only access your own user data" },
            { status: 403 }
          ) as NextResponse<T>;
        }
      }

      // Branch access check - for branch endpoints
      if (options.allowOwnBranch) {
        const { searchParams } = new URL(req.url);
        const targetBranchId = searchParams.get("branchId") || context.params?.branchId;

        // If requesting another branch, must have ADMIN or MANAGE_BRANCHES permission
        if (
          targetBranchId && 
          currentUser.branchId !== targetBranchId && 
          currentUser.role !== UserRole.ADMIN &&
          !checkPermission(currentUser.role, Permission.MANAGE_BRANCHES) &&
          !currentUser.assignedBranchIds?.includes(targetBranchId)
        ) {
          return NextResponse.json(
            { error: "You can only access your own branch data" },
            { status: 403 }
          ) as NextResponse<T>;
        }
      }

      // Pass control to the actual handler
      return handler(req, context, currentUser);
    } catch (error) {
      console.error("Permission guard error:", error);
      return NextResponse.json(
        { error: "Internal server error in permission check" },
        { status: 500 }
      ) as NextResponse<T>;
    }
  };
}

// Usage examples:
/*
export const GET = withPermissionGuard(
  async (req, context, currentUser) => {
    // Your handler logic here
    return NextResponse.json({ data: "Success" });
  },
  { requiredPermission: Permission.VIEW_REPORTS }
);

export const POST = withPermissionGuard(
  async (req, context, currentUser) => {
    // Create report logic
    return NextResponse.json({ success: true });
  },
  { requiredPermission: Permission.CREATE_REPORTS }
);
*/ 