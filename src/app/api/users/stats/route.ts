import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/auth/roles";

export async function GET(request: NextRequest) {
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

    // Get total users count
    const totalUsers = await prisma.user.count();

    // Get active users count
    const activeUsers = await prisma.user.count({
      where: { isActive: true },
    });

    // Get admin users count
    const adminUsers = await prisma.user.count({
      where: { role: UserRole.ADMIN },
    });

    // Get last created user
    const lastCreatedUser = await prisma.user.findFirst({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        name: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      total: totalUsers,
      active: activeUsers,
      admin: adminUsers,
      lastCreated: lastCreatedUser ? {
        id: lastCreatedUser.id,
        username: lastCreatedUser.username,
        name: lastCreatedUser.name,
        createdAt: lastCreatedUser.createdAt,
      } : null,
    });
  } catch (error) {
    console.error("Error fetching user statistics:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 