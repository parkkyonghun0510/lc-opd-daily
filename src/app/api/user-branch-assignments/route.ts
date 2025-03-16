import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Permission, UserRole } from "@/lib/auth/roles";
import { hasPermission } from "@/lib/auth/roles";
import { invalidateUserBranchCaches } from "@/lib/cache/branch-cache";
import {
  createBranchAssignment,
  setDefaultBranchAssignment,
} from "@/lib/branch/user-branch-assignment";

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
        { status: 400 }
      );
    }

    // Only allow users to view their own assignments or if they have permission
    const isOwnAssignments = userId === session.user.id;
    const canManageUsers = hasPermission(
      session.user.role as UserRole,
      Permission.MANAGE_USERS
    );

    if (!isOwnAssignments && !canManageUsers) {
      return NextResponse.json(
        { error: "You do not have permission to view these assignments" },
        { status: 403 }
      );
    }

    // Get user branch assignments
    const assignments = await db.userBranchAssignment.findMany({
      where: {
        userId: userId,
      },
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ data: assignments });
  } catch (error) {
    console.error("Error fetching user branch assignments:", error);
    return NextResponse.json(
      { error: "Failed to fetch user branch assignments" },
      { status: 500 }
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
      Permission.MANAGE_USERS
    );
    if (!canManageUsers) {
      return NextResponse.json(
        { error: "You do not have permission to assign branches" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { userId, branchId, isDefault } = body;

    if (!userId || !branchId) {
      return NextResponse.json(
        { error: "User ID and Branch ID are required" },
        { status: 400 }
      );
    }

    // Check if user and branch exist
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const branch = await db.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    // Check if assignment already exists
    const existingAssignment = await db.userBranchAssignment.findFirst({
      where: { userId, branchId },
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: "User is already assigned to this branch" },
        { status: 400 }
      );
    }

    // Use our utility to create assignment
    const assignment = await createBranchAssignment(
      userId,
      branchId,
      isDefault === true
    );

    // Invalidate user's branch caches
    try {
      await invalidateUserBranchCaches(userId);
    } catch (cacheError) {
      // Log the error but don't fail the request
      console.error("Error invalidating cache (non-critical):", cacheError);
    }

    return NextResponse.json(assignment);
  } catch (error) {
    console.error("Error creating user branch assignment:", error);
    return NextResponse.json(
      { error: "Failed to create user branch assignment" },
      { status: 500 }
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
      Permission.MANAGE_USERS
    );
    if (!canManageUsers) {
      return NextResponse.json(
        { error: "You do not have permission to update branch assignments" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, isDefault } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Assignment ID is required" },
        { status: 400 }
      );
    }

    // Get the assignment to check if it exists and get userId
    const assignment = await db.userBranchAssignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Branch assignment not found" },
        { status: 404 }
      );
    }

    // Handle setting default branch
    if (isDefault === true) {
      // Use our utility to set default and handle constraints
      await setDefaultBranchAssignment(assignment.userId, id);
    } else {
      // Just update the assignment
      await db.userBranchAssignment.update({
        where: { id },
        data: { isDefault: isDefault },
      });
    }

    // Invalidate user's branch caches
    try {
      await invalidateUserBranchCaches(assignment.userId);
    } catch (cacheError) {
      // Log the error but don't fail the request
      console.error("Error invalidating cache (non-critical):", cacheError);
    }

    // Return the updated assignment
    const updatedAssignment = await db.userBranchAssignment.findUnique({
      where: { id },
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(updatedAssignment);
  } catch (error) {
    console.error("Error updating user branch assignment:", error);
    return NextResponse.json(
      { error: "Failed to update user branch assignment" },
      { status: 500 }
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
      Permission.MANAGE_USERS
    );
    if (!canManageUsers) {
      return NextResponse.json(
        { error: "You do not have permission to delete branch assignments" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Assignment ID is required" },
        { status: 400 }
      );
    }

    // Get the assignment to check if it exists and get userId
    const assignment = await db.userBranchAssignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Branch assignment not found" },
        { status: 404 }
      );
    }

    // Cannot delete default assignment
    if (assignment.isDefault) {
      return NextResponse.json(
        {
          error:
            "Cannot delete default branch assignment. Please set another branch as default first.",
        },
        { status: 400 }
      );
    }

    // Delete the assignment
    await db.userBranchAssignment.delete({ where: { id } });

    // Invalidate user's branch caches
    try {
      await invalidateUserBranchCaches(assignment.userId);
    } catch (cacheError) {
      // Log the error but don't fail the request
      console.error("Error invalidating cache (non-critical):", cacheError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user branch assignment:", error);
    return NextResponse.json(
      { error: "Failed to delete user branch assignment" },
      { status: 500 }
    );
  }
}
