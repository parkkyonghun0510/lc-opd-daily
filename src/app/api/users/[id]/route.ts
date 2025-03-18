import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/auth";
import { getToken } from "next-auth/jwt";

const prisma = new PrismaClient();

// GET /api/users/[id] - Get a single user by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin permission using NextAuth
    const token = await getToken({ req: request });

    // Check if user is authenticated and has admin role
    if (!token || token.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    const id = params.id;

    // Get user with branch information using correct field names from schema
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        branchAssignments: {
          include: {
            branch: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

// PATCH /api/users/[id] - Update a user
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin permission using NextAuth
    const token = await getToken({ req: request });

    // Check if user is authenticated and has admin role
    if (!token || token.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    const id = params.id;
    const body = await request.json();
    const { username, email, name, password, role, branchId, isActive } = body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (role) updateData.role = role;
    if (branchId !== undefined) updateData.branchId = branchId;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Check if username/email is changed and already exists
    if (username && username !== existingUser.username) {
      const usernameExists = await prisma.user.findFirst({
        where: { username },
      });
      if (usernameExists) {
        return NextResponse.json(
          { error: "Username is already taken" },
          { status: 409 }
        );
      }
      updateData.username = username;
    }

    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findFirst({
        where: { email },
      });
      if (emailExists) {
        return NextResponse.json(
          { error: "Email is already registered" },
          { status: 409 }
        );
      }
      updateData.email = email;
    }

    // Hash the password if provided
    if (password) {
      updateData.password = await hashPassword(password);
    }

    // Update the user
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        branchId: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Delete a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin permission using NextAuth
    const token = await getToken({ req: request });

    // Check if user is authenticated and has admin role
    if (!token || token.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    const id = params.id;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent self-deletion
    if (token.userId === id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 403 }
      );
    }

    // Delete the user
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
