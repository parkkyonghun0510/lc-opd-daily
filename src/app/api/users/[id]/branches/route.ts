import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/auth/roles";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = await getToken({ req: request });
    const { id } = await params;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    // Get user with their role and branch assignments
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        branchAssignments: {
          include: {
            branch: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // If user is admin, return all branches
    if (user.role === UserRole.ADMIN) {
      const allBranches = await prisma.branch.findMany({
        select: {
          id: true,
          name: true,
          code: true,
        },
        orderBy: {
          name: "asc",
        },
      });

      return NextResponse.json({ branches: allBranches });
    }

    // For non-admin users, return only assigned branches
    const assignedBranches = user.branchAssignments.map((assignment) => ({
      id: assignment.branch.id,
      name: assignment.branch.name,
      code: assignment.branch.code,
    }));

    // Also include the user's default branch if it exists
    if (user.branchId) {
      const defaultBranch = await prisma.branch.findUnique({
        where: { id: user.branchId },
        select: {
          id: true,
          name: true,
          code: true,
        },
      });

      if (
        defaultBranch &&
        !assignedBranches.some((b) => b.id === defaultBranch.id)
      ) {
        assignedBranches.push(defaultBranch);
      }
    }

    return NextResponse.json({ branches: assignedBranches });
  } catch (error) {
    console.error("Error fetching user branches:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
