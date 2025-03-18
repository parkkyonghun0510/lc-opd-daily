import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  BranchAccessPermission,
  BranchAccessResult,
} from "@/lib/types/branch";
import {
  getCachedBranchAccessCheck,
  cacheBranchAccessCheck,
  getCachedUserBranchAccess,
  cacheUserBranchAccess,
} from "@/lib/cache/branch-cache";
import { UserRole } from "@/lib/auth/roles";

/**
 * Check if a user has access to a specific branch
 * GET /api/branch-access?branchId=xyz
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get branchId from query params
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");

    if (!branchId) {
      return NextResponse.json(
        { error: "Branch ID is required" },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const userRole = session.user.role as UserRole;

    // Try to get from cache first
    const cachedResult = await getCachedBranchAccessCheck(userId, branchId);
    if (cachedResult !== null) {
      const result: BranchAccessResult = {
        hasAccess: cachedResult,
        permission: cachedResult
          ? determineBranchPermission(userRole)
          : BranchAccessPermission.NONE,
      };

      return NextResponse.json(result);
    }

    // If not in cache, determine access
    // For admin, always grant access
    if (userRole === UserRole.ADMIN) {
      await cacheBranchAccessCheck(userId, branchId, true);
      return NextResponse.json({
        hasAccess: true,
        permission: BranchAccessPermission.ADMIN,
      });
    }

    // For other roles, check user branch assignments
    const userBranch = await db.user.findUnique({
      where: { id: userId },
      select: { branchId: true },
    });

    // If user's direct branch matches, they have access
    if (userBranch?.branchId === branchId) {
      await cacheBranchAccessCheck(userId, branchId, true);
      return NextResponse.json({
        hasAccess: true,
        permission: determineBranchPermission(userRole),
      });
    }

    // Check branch assignments
    const userBranchAssignments = await db.$queryRaw<{ branchId: string }[]>`
      SELECT "branchId" 
      FROM "UserBranchAssignment"
      WHERE "userId" = ${userId}
    `;

    const assignedBranchIds = userBranchAssignments.map((a: { branchId: any; }) => a.branchId);

    // Cache the assigned branch IDs for this user
    await cacheUserBranchAccess(userId, assignedBranchIds);

    // Direct assignment check
    if (assignedBranchIds.includes(branchId)) {
      await cacheBranchAccessCheck(userId, branchId, true);
      return NextResponse.json({
        hasAccess: true,
        permission: determineBranchPermission(userRole),
      });
    }

    // For manager and supervisor roles, check branch hierarchy
    if ([UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR].includes(userRole)) {
      // Get all branches to build hierarchy
      const branches = await db.branch.findMany({
        select: {
          id: true,
          parentId: true,
        },
      });

      // Find all child branches for each assigned branch
      const accessibleBranchIds = new Set<string>();

      // Add directly assigned branches
      assignedBranchIds.forEach((id: string) => accessibleBranchIds.add(id));

      // For managers, add child branches of assigned branches
      if (userRole === UserRole.BRANCH_MANAGER) {
        for (const assignedId of assignedBranchIds) {
          addChildBranches(branches, assignedId, accessibleBranchIds);
        }
      }

      // If the requested branch is accessible, grant access
      const hasAccess = accessibleBranchIds.has(branchId);
      await cacheBranchAccessCheck(userId, branchId, hasAccess);

      return NextResponse.json({
        hasAccess,
        permission: hasAccess
          ? determineBranchPermission(userRole)
          : BranchAccessPermission.NONE,
      });
    }

    // For other roles, no access beyond direct assignments
    await cacheBranchAccessCheck(userId, branchId, false);
    return NextResponse.json({
      hasAccess: false,
      permission: BranchAccessPermission.NONE,
      reason: "User does not have access to this branch",
    });
  } catch (error) {
    console.error("Error checking branch access:", error);
    return NextResponse.json(
      { error: "Failed to check branch access" },
      { status: 500 }
    );
  }
}

/**
 * Recursively add child branches to accessible set
 */
function addChildBranches(
  branches: { id: string; parentId: string | null }[],
  parentId: string,
  accessibleIds: Set<string>
) {
  // Find direct children
  const children = branches.filter((b) => b.parentId === parentId);

  // Add each child and its descendants
  for (const child of children) {
    accessibleIds.add(child.id);
    addChildBranches(branches, child.id, accessibleIds);
  }
}

/**
 * Determine branch permission level based on user role
 */
function determineBranchPermission(role: UserRole): BranchAccessPermission {
  switch (role) {
    case UserRole.ADMIN:
      return BranchAccessPermission.ADMIN;
    case UserRole.BRANCH_MANAGER:
      return BranchAccessPermission.MANAGE;
    case UserRole.SUPERVISOR:
      return BranchAccessPermission.APPROVE;
    case UserRole.USER:
      return BranchAccessPermission.SUBMIT;
    default:
      return BranchAccessPermission.VIEW;
  }
}
