import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/auth/roles";

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token || !token.sub) {
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
    const branchAssignment = await prisma.userBranchAssignment.findFirst({
      where: {
        userId: token.sub,
        branchId: branchId,
      },
    });

    if (!branchAssignment) {
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
      where: { id: token.sub },
      data: {
        branchId: branchId,
      },
    });

    // Log the branch switch
    await prisma.userActivity.create({
      data: {
        userId: token.sub,
        action: "SWITCH_BRANCH",
        details: {
          branchId: branch.id,
          branchName: branch.name,
          branchCode: branch.code,
        },
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
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