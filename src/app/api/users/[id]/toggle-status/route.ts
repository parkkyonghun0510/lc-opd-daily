import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/auth/roles";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req: request });
    const { id } = await params;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    // Only admins or the user themselves can toggle status
    const isAdminUser = token.role === UserRole.ADMIN;
    const isSelfUser = token.id === id;

    if (!isAdminUser && !isSelfUser) {
      return NextResponse.json(
        { error: "Forbidden - You don't have permission to perform this action" },
        { status: 403 }
      );
    }

    // Get the user
    const user = await prisma.user.findUnique({
      where: { id },
      select: { 
        isActive: true,
        role: true 
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Prevent deactivating the last admin user
    if (user.role === UserRole.ADMIN && user.isActive) {
      const adminCount = await prisma.user.count({
        where: { 
          role: UserRole.ADMIN,
          isActive: true 
        },
      });

      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot deactivate the last active admin user" },
          { status: 400 }
        );
      }
    }

    // Toggle the user's active status
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        isActive: !user.isActive,
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        branchId: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error toggling user status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 