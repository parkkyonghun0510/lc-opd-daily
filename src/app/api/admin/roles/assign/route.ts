import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/lib/auth/roles";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Check if user has permission to assign roles
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    // Simple permission check - assuming ADMIN role can assign roles
    const isAdmin = currentUser?.userRoles.some(
      (ur) => ur.role.name === "ADMIN",
    );
    if (!isAdmin) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const body = await request.json();
    const { userId, roleName, branchId = null } = body;

    if (!userId || !roleName) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Find the role
    const role = await prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      return new NextResponse(`Role ${roleName} not found`, { status: 404 });
    }

    // Find if user already has this role
    const existingUserRole = await prisma.userRole.findFirst({
      where: {
        userId: userId,
        role: {
          name: roleName,
        },
        branchId: branchId,
      },
    });

    if (existingUserRole) {
      return new NextResponse(`User already has this role assignment`, {
        status: 409,
      });
    }

    // Create new user role
    const userRole = await prisma.userRole.create({
      data: {
        userId: userId,
        roleId: role.id,
        branchId: branchId,
        isDefault: false, // Set default as needed
      },
      include: {
        role: true,
        branch: true,
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: "ASSIGN_ROLE",
        details: `Assigned role ${roleName} to user ${userId}${branchId ? ` for branch ${branchId}` : ""}`,
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
      },
    });

    return NextResponse.json({
      message: "Role assigned successfully",
      userRole: {
        id: userRole.id,
        roleName: userRole.role.name,
        branchName: userRole.branch?.name || null,
      },
    });
  } catch (error) {
    console.error("Error assigning role:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
