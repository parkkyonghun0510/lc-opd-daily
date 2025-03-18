import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/auth/roles";
import { z } from "zod";

const assignmentSchema = z.object({
  branchIds: z.array(z.string()),
});

type BranchAssignmentRequest = z.infer<typeof assignmentSchema>;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    if (token.role !== UserRole.ADMIN && token.id !== params.id) {
      return NextResponse.json(
        { error: "Forbidden - You can only view your own branch assignments" },
        { status: 403 }
      );
    }

    // Get user's branch assignments
    const branchAssignments = await prisma.userBranchAssignment.findMany({
      where: { userId: params.id },
      select: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return NextResponse.json(
      branchAssignments.map((assignment) => assignment.branch)
    );
  } catch (error) {
    console.error("Error fetching branch assignments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    if (token.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const body: BranchAssignmentRequest = await request.json();
    
    // Validate request body
    const validation = assignmentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validation.error.format() },
        { status: 400 }
      );
    }

    const { branchIds } = body;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Delete existing assignments
    await prisma.userBranchAssignment.deleteMany({
      where: { userId: params.id },
    });

    // Create new assignments
    if (branchIds.length > 0) {
      await prisma.userBranchAssignment.createMany({
        data: branchIds.map((branchId) => ({
          userId: params.id,
          branchId,
        })),
      });
    }

    // Get updated assignments
    const updatedAssignments = await prisma.userBranchAssignment.findMany({
      where: { userId: params.id },
      select: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return NextResponse.json(
      updatedAssignments.map((assignment) => assignment.branch)
    );
  } catch (error) {
    console.error("Error updating branch assignments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 