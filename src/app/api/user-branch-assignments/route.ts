import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Permission, UserRole } from "@/lib/auth/roles";
import { hasPermission } from "@/lib/auth/roles";
import { invalidateUserBranchCaches } from "@/lib/cache/branch-cache";
import {
  createBranchAssignment,
  setDefaultBranchAssignment,
} from "@/lib/branch/user-branch-assignment";
import { z } from "zod";

// Validation schemas
const createAssignmentSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  branchId: z.string().min(1, "Branch ID is required"),
  isDefault: z.boolean().optional(),
});

const updateAssignmentSchema = z.object({
  id: z.string().min(1, "Assignment ID is required"),
  isDefault: z.boolean().optional(),
});

// Helper function to check if user has access to branch
async function checkBranchAccess(
  userId: string,
  branchId: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      branchAssignments: {
        include: {
          branch: true,
        },
      },
    },
  });

  if (!user) return false;

  // Check if user is assigned to the branch or its parent
  return user.branchAssignments.some((assignment) => {
    const branch = assignment.branch;
    return branch.id === branchId || branch.parentId === branchId;
  });
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    // If no userId provided, return error
    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    // Only allow users to view their own assignments or if they have permission
    const isOwnAssignments = userId === session.user.id;
    const canManageUsers = hasPermission(
      session.user.role as UserRole,
      Permission.MANAGE_USERS,
    );

    if (!isOwnAssignments && !canManageUsers) {
      return NextResponse.json(
        { error: "You do not have permission to view these assignments" },
        { status: 403 },
      );
    }

    // Get user branch assignments with additional branch info
    const assignments = await prisma.userBranchAssignment.findMany({
      where: {
        userId: userId,
      },
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
            parentId: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({
      data: assignments,
      total: assignments.length,
      defaultAssignment: assignments.find((a) => a.isDefault),
    });
  } catch (error) {
    console.error("Error fetching user branch assignments:", error);
    return NextResponse.json(
      { error: "Failed to fetch user branch assignments" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission
    const canManageUsers = hasPermission(
      session.user.role as UserRole,
      Permission.MANAGE_USERS,
    );
    if (!canManageUsers) {
      return NextResponse.json(
        { error: "You do not have permission to assign branches" },
        { status: 403 },
      );
    }

    const body = await req.json();

    // Validate input
    const result = createAssignmentSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.flatten() },
        { status: 400 },
      );
    }

    const { userId, branchId, isDefault } = result.data;

    // Check if user and branch exist
    const [user, branch] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.branch.findUnique({ where: { id: branchId } }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    if (!branch.isActive) {
      return NextResponse.json(
        { error: "Cannot assign user to an inactive branch" },
        { status: 400 },
      );
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.userBranchAssignment.findFirst({
      where: { userId, branchId },
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: "User is already assigned to this branch" },
        { status: 400 },
      );
    }

    // Use our utility to create assignment
    const assignment = await createBranchAssignment(
      userId,
      branchId,
      isDefault === true,
    );

    // Invalidate user's branch caches
    try {
      await invalidateUserBranchCaches(userId);
    } catch (cacheError) {
      console.error("Error invalidating cache (non-critical):", cacheError);
    }

    // Return the created assignment with branch details
    const createdAssignment = await prisma.userBranchAssignment.findUnique({
      where: { id: assignment.id },
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
            parentId: true,
            isActive: true,
          },
        },
      },
    });

    return NextResponse.json(createdAssignment);
  } catch (error) {
    console.error("Error creating user branch assignment:", error);
    return NextResponse.json(
      { error: "Failed to create user branch assignment" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission
    const canManageUsers = hasPermission(
      session.user.role as UserRole,
      Permission.MANAGE_USERS,
    );
    if (!canManageUsers) {
      return NextResponse.json(
        { error: "You do not have permission to update branch assignments" },
        { status: 403 },
      );
    }

    const body = await req.json();

    // Validate input
    const result = updateAssignmentSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.flatten() },
        { status: 400 },
      );
    }

    const { id, isDefault } = result.data;

    // Get the assignment to check if it exists and get userId
    const assignment = await prisma.userBranchAssignment.findUnique({
      where: { id },
      include: {
        branch: true,
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Branch assignment not found" },
        { status: 404 },
      );
    }

    // Check if branch is active
    if (!assignment.branch.isActive) {
      return NextResponse.json(
        { error: "Cannot update assignment for an inactive branch" },
        { status: 400 },
      );
    }

    // Handle setting default branch
    if (isDefault === true) {
      // Use our utility to set default and handle constraints
      await setDefaultBranchAssignment(assignment.userId, id);
    } else {
      // Just update the assignment
      await prisma.userBranchAssignment.update({
        where: { id },
        data: { isDefault: isDefault },
      });
    }

    // Invalidate user's branch caches
    try {
      await invalidateUserBranchCaches(assignment.userId);
    } catch (cacheError) {
      console.error("Error invalidating cache (non-critical):", cacheError);
    }

    // Return the updated assignment
    const updatedAssignment = await prisma.userBranchAssignment.findUnique({
      where: { id },
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
            parentId: true,
            isActive: true,
          },
        },
      },
    });

    return NextResponse.json(updatedAssignment);
  } catch (error) {
    console.error("Error updating user branch assignment:", error);
    return NextResponse.json(
      { error: "Failed to update user branch assignment" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission
    const canManageUsers = hasPermission(
      session.user.role as UserRole,
      Permission.MANAGE_USERS,
    );
    if (!canManageUsers) {
      return NextResponse.json(
        { error: "You do not have permission to delete branch assignments" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Assignment ID is required" },
        { status: 400 },
      );
    }

    // Get the assignment to check if it exists and get userId
    const assignment = await prisma.userBranchAssignment.findUnique({
      where: { id },
      include: {
        branch: true,
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Branch assignment not found" },
        { status: 404 },
      );
    }

    // Cannot delete default assignment
    if (assignment.isDefault) {
      return NextResponse.json(
        {
          error:
            "Cannot delete default branch assignment. Please set another branch as default first.",
        },
        { status: 400 },
      );
    }

    // Delete the assignment
    await prisma.userBranchAssignment.delete({
      where: { id },
    });

    // Invalidate user's branch caches
    try {
      await invalidateUserBranchCaches(assignment.userId);
    } catch (cacheError) {
      console.error("Error invalidating cache (non-critical):", cacheError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user branch assignment:", error);
    return NextResponse.json(
      { error: "Failed to delete user branch assignment" },
      { status: 500 },
    );
  }
}
