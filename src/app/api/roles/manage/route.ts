import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { SessionUser } from "@/lib/auth/index";
import { Permission, UserRole, hasPermission } from "@/lib/auth/roles";
import { PrismaClient } from "@prisma/client";
import { logUserActivity } from "@/lib/auth/log-user-activity";

const prisma = new PrismaClient();

// GET /api/roles/manage - Get user roles with branch context
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse(null, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!hasPermission(user.role as UserRole, Permission.MANAGE_USERS)) {
      return new NextResponse(null, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    // Get user's roles with branch context
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: true,
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(userRoles);
  } catch (error) {
    console.error("Error fetching user roles:", error);
    return NextResponse.json(
      { error: "Failed to fetch user roles" },
      { status: 500 },
    );
  }
}

// POST /api/roles/manage - Assign role to user with branch context
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse(null, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!hasPermission(user.role as UserRole, Permission.ASSIGN_ROLES)) {
      return new NextResponse(null, { status: 403 });
    }

    const body = await request.json();
    const { userId, roleId, branchId, isDefault } = body;

    // Validate required fields
    if (!userId || !roleId) {
      return NextResponse.json(
        { error: "User ID and Role ID are required" },
        { status: 400 },
      );
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // If branch ID is provided, check if branch exists
    if (branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
      });

      if (!branch) {
        return NextResponse.json(
          { error: "Branch not found" },
          { status: 404 },
        );
      }
    }

    // If isDefault is true, unset any existing default roles for this user
    if (isDefault) {
      await prisma.userRole.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Check if the user already has this role for this branch
    const existingUserRole = await prisma.userRole.findFirst({
      where: {
        userId,
        roleId,
        branchId: branchId || null,
      },
    });

    let userRole;

    if (existingUserRole) {
      // Update existing user role
      userRole = await prisma.userRole.update({
        where: { id: existingUserRole.id },
        data: { isDefault: isDefault || false },
        include: {
          role: true,
          branch: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });
    } else {
      // Create new user role
      userRole = await prisma.userRole.create({
        data: {
          userId,
          roleId,
          branchId: branchId || null,
          isDefault: isDefault || false,
        },
        include: {
          role: true,
          branch: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });
    }

    // If this is the default role, update the user's legacy role field for backward compatibility
    if (isDefault) {
      await prisma.user.update({
        where: { id: userId },
        data: { role: role.name },
      });
    }

    // Log the role assignment
    await logUserActivity(
      user.id,
      "ROLE_ASSIGNMENT",
      {
        targetUserId: userId,
        roleId: roleId,
        roleName: role.name,
        branchId: branchId || null,
        isDefault: isDefault || false,
      },
      {
        ipAddress: "unknown",
        userAgent: "unknown",
      },
    );

    return NextResponse.json(userRole);
  } catch (error) {
    console.error("Error assigning role:", error);
    return NextResponse.json(
      { error: "Failed to assign role" },
      { status: 500 },
    );
  }
}

// DELETE /api/roles/manage - Remove role from user
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse(null, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!hasPermission(user.role as UserRole, Permission.ASSIGN_ROLES)) {
      return new NextResponse(null, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userRoleId = searchParams.get("id");

    if (!userRoleId) {
      return NextResponse.json(
        { error: "User Role ID is required" },
        { status: 400 },
      );
    }

    // Get the user role before deleting it for logging
    const userRole = await prisma.userRole.findUnique({
      where: { id: userRoleId },
      include: { role: true },
    });

    if (!userRole) {
      return NextResponse.json(
        { error: "User Role not found" },
        { status: 404 },
      );
    }

    // Delete the user role
    await prisma.userRole.delete({
      where: { id: userRoleId },
    });

    // If this was the default role, set another role as default if available
    if (userRole.isDefault) {
      const anotherUserRole = await prisma.userRole.findFirst({
        where: { userId: userRole.userId },
        orderBy: { createdAt: "desc" },
      });

      if (anotherUserRole) {
        // Set as default
        await prisma.userRole.update({
          where: { id: anotherUserRole.id },
          data: { isDefault: true },
        });

        // Update user's legacy role field
        const role = await prisma.role.findUnique({
          where: { id: anotherUserRole.roleId },
        });

        if (role) {
          await prisma.user.update({
            where: { id: userRole.userId },
            data: { role: role.name },
          });
        }
      } else {
        // No other roles, set to default user role
        await prisma.user.update({
          where: { id: userRole.userId },
          data: { role: "user" },
        });
      }
    }

    // Log the role removal
    await logUserActivity(
      user.id,
      "ROLE_REMOVAL",
      {
        targetUserId: userRole.userId,
        roleId: userRole.roleId,
        roleName: userRole.role.name,
        branchId: userRole.branchId,
        wasDefault: userRole.isDefault,
      },
      {
        ipAddress: "unknown",
        userAgent: "unknown",
      },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing role:", error);
    return NextResponse.json(
      { error: "Failed to remove role" },
      { status: 500 },
    );
  }
}
