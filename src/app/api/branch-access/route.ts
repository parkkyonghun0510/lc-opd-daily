import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/auth/roles";

/**
 * Check if a user has access to a specific branch
 * GET /api/branch-access?branchId=xyz
 */
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    // Get branchId from query parameters
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");

    if (!branchId) {
      return NextResponse.json(
        { error: "Branch ID is required" },
        { status: 400 }
      );
    }

    // Admin users have access to all branches
    if (token.role === UserRole.ADMIN) {
      return NextResponse.json({ hasAccess: true });
    }

    // Check if user has access to the specified branch through UserBranchAssignment
    const branchAssignment = await prisma.userBranchAssignment.findFirst({
      where: {
        userId: token.id,
        branchId: branchId,
      },
    });

    // Also check if this is the user's default branch
    const userDefaultBranch = await prisma.user.findUnique({
      where: { id: token.id },
      select: { branchId: true },
    });

    const hasAccess = !!branchAssignment || userDefaultBranch?.branchId === branchId;

    return NextResponse.json({ hasAccess });
  } catch (error) {
    console.error("Error checking branch access:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
