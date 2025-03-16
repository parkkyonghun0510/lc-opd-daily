import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/auth";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { getUserFromToken } from "@/lib/jwt";

const prismaClient = new PrismaClient();

// GET /api/users - Get all users with optional filtering
export async function GET(request: NextRequest) {
  try {
    // Verify admin permission using NextAuth
    const token = await getToken({ req: request });

    // Check if user is authenticated and has admin role
    if (!token || token.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status");
    const role = url.searchParams.get("role");
    const branch = url.searchParams.get("branch");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    // Build filter conditions
    const where: Record<string, any> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.isActive = status === "active";
    }

    if (role) {
      where.role = role;
    }

    if (branch) {
      where.branchId = branch;
    }

    // Get users with pagination
    const [users, total] = await Promise.all([
      prismaClient.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          branchId: true,
          branch: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prismaClient.user.count({ where }),
    ]);

    return NextResponse.json({
      users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST /api/users - Create a new user
export async function POST(request: NextRequest) {
  try {
    // Verify admin permission using NextAuth
    const token = await getToken({ req: request });

    // Check if user is authenticated and has admin role
    if (!token || token.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { username, email, name, password, role, branchId, isActive } = body;

    // Validate required fields
    if (!username || !email || !name || !password) {
      return NextResponse.json(
        { error: "Username, email, name, and password are required" },
        { status: 400 }
      );
    }

    // Check if username or email already exists
    const existingUser = await prismaClient.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      if (existingUser.username === username) {
        return NextResponse.json(
          { error: "Username is already taken" },
          { status: 409 }
        );
      }
      if (existingUser.email === email) {
        return NextResponse.json(
          { error: "Email is already registered" },
          { status: 409 }
        );
      }
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Create the user
    const user = await prismaClient.user.create({
      data: {
        username,
        email,
        name,
        password: hashedPassword,
        role: role || "user",
        branchId: branchId || null,
        isActive: isActive !== undefined ? isActive : true,
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        branchId: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}

// PATCH /api/users/:id - Update a user
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin permission using NextAuth
    const token = await getToken({ req: request });

    // Check if user is authenticated and has admin role
    if (!token || token.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    const id = params.id;
    const body = await request.json();
    const { username, email, name, password, role, branchId, isActive } = body;

    // Check if user exists
    const existingUser = await prismaClient.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};
    if (name) updateData.name = name;
    if (role) updateData.role = role;
    if (branchId !== undefined) updateData.branchId = branchId;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Check if username/email is changed and already exists
    if (username && username !== existingUser.username) {
      const usernameExists = await prismaClient.user.findFirst({
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
      const emailExists = await prismaClient.user.findFirst({
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
    const user = await prismaClient.user.update({
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

// DELETE /api/users/:id - Delete a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin permission using NextAuth
    const token = await getToken({ req: request });

    // Check if user is authenticated and has admin role
    if (!token || token.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    const id = params.id;

    // Check if user exists
    const existingUser = await prismaClient.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent self-deletion
    if (token.id === id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 403 }
      );
    }

    // Delete the user
    await prismaClient.user.delete({
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
