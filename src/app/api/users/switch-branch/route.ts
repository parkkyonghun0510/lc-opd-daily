import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/auth/roles";

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { branchId } = body;

    if (!branchId) {
      return NextResponse.json(
        { error: "Branch ID is required" },
        { status: 400 }
      );
    }

    // Check if user has access to the branch
    const branchAccess = await prisma.branchAccess.findFirst({
      where: {
        userId: token.id,
        branchId: branchId,
      },
    });

    if (!branchAccess) {
      return NextResponse.json(
        { error: "You don't have access to this branch" },
        { status: 403 }
      );
    }

    // Get branch details
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    if (!branch) {
      return NextResponse.json(
        { error: "Branch not found" },
        { status: 404 }
      );
    }

    // Update user's current branch
    await prisma.user.update({
      where: { id: token.id },
      data: {
        branchId: branchId,
      },
    });

    // Log the branch switch
    await prisma.auditLog.create({
      data: {
        userId: token.id,
        action: "SWITCH_BRANCH",
        details: `Switched to branch: ${branch.name}`,
      },
    });

    return NextResponse.json({
      message: "Branch switched successfully",
      branch,
    });
  } catch (error) {
    console.error("Error switching branch:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 