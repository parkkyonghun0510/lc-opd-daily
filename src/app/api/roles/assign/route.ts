import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import {
  Permission,
  UserRole,
  hasPermission,
} from "@/lib/auth/roles";
import { PrismaClient } from "@prisma/client";
import { logUserActivity } from "@/lib/auth/log-user-activity";

const prisma = new PrismaClient();

// POST /api/roles/assign - Simple role assignment
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse(null, { status: 401 });
    }

    const user = session.user;
    if (!hasPermission(user.role as UserRole, Permission.ASSIGN_ROLES)) {
      return new NextResponse(null, { status: 403 });
    }

    const body = await request.json();
    const { userId, role, branchId } = body;

    // Validate required fields
    if (!userId || !role) {
      return NextResponse.json(
        { error: "User ID and role are required" },
        { status: 400 }
      );
    }

    // Validate role
    if (!Object.values(UserRole).includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, branchId: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // If branch ID is provided, check if branch exists
    if (branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
      });

      if (!branch) {
        return NextResponse.json(
          { error: "Branch not found" },
          { status: 404 }
        );
      }
    }

    // Update user's role
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        role,
        branchId: branchId || null,
      },
    });

    // Get request metadata for logging
    const ip = request.headers.get("x-forwarded-for") || 
               request.headers.get("x-real-ip") || 
               "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Log the role change
    await logUserActivity(
      user.id,
      "ROLE_CHANGE",
      {
        targetUserId: userId,
        oldRole: targetUser.role,
        newRole: role,
        oldBranchId: targetUser.branchId,
        newBranchId: branchId,
      },
      { ipAddress: ip, userAgent }
    );

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error assigning role:", error);
    return NextResponse.json(
      { error: "Failed to assign role" },
      { status: 500 }
    );
  }
} 