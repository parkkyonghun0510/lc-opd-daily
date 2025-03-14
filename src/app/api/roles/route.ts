import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, SessionUser } from "@/lib/auth";
import {
  Permission,
  UserRole,
  hasPermission,
  ROLE_PERMISSIONS,
} from "@/lib/auth/roles";
import { PrismaClient } from "@prisma/client";
import { logUserActivity } from "@/lib/auth";

const prisma = new PrismaClient();

// GET /api/roles - List all roles and their permissions
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse(null, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!hasPermission(user.role as UserRole, Permission.MANAGE_USERS)) {
      return new NextResponse(null, { status: 403 });
    }

    const roles = Object.values(UserRole).map((role) => ({
      name: role,
      permissions: getRolePermissions(role),
    }));

    return NextResponse.json(roles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    return NextResponse.json(
      { error: "Failed to fetch roles" },
      { status: 500 }
    );
  }
}

// POST /api/roles/assign - Assign role to user(s)
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
    const isBulkUpdate = Array.isArray(body);

    if (isBulkUpdate) {
      const updates = body as {
        userId: string;
        role: string;
        branchId?: string;
      }[];
      const results = [];

      for (const update of updates) {
        const { userId, role, branchId } = update;

        // Validate role
        if (!Object.values(UserRole).includes(role)) {
          return NextResponse.json(
            { error: `Invalid role: ${role}` },
            { status: 400 }
          );
        }

        // Get target user's current role for audit log
        const targetUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true, branchId: true },
        });

        if (!targetUser) {
          return NextResponse.json(
            { error: `User not found: ${userId}` },
            { status: 404 }
          );
        }

        // Update user's role
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            role,
            branchId: branchId || undefined,
          },
        });

        // Log the role change
        await logUserActivity(user.id, "ROLE_CHANGE", {
          targetUserId: userId,
          oldRole: targetUser.role,
          newRole: role,
          oldBranchId: targetUser.branchId,
          newBranchId: branchId,
        });

        results.push(updatedUser);
      }

      return NextResponse.json(results);
    } else {
      const { userId, role, branchId } = body;

      // Validate role
      if (!Object.values(UserRole).includes(role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }

      // Get target user's current role for audit log
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, branchId: true },
      });

      if (!targetUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Update user's role
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          role,
          branchId: branchId || undefined,
        },
      });

      // Log the role change
      await logUserActivity(user.id, "ROLE_CHANGE", {
        targetUserId: userId,
        oldRole: targetUser.role,
        newRole: role,
        oldBranchId: targetUser.branchId,
        newBranchId: branchId,
      });

      return NextResponse.json(updatedUser);
    }
  } catch (error) {
    console.error("Error assigning role:", error);
    return NextResponse.json(
      { error: "Failed to assign role" },
      { status: 500 }
    );
  }
}

function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}
