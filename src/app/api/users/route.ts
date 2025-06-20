import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { hashPassword } from "@/lib/auth";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/auth/roles";

type SearchField = {
  contains: string;
  mode: Prisma.QueryMode;
};

interface WhereClause {
  OR?: Array<{
    firstName?: SearchField;
    lastName?: SearchField;
    email?: SearchField;
    username?: SearchField;
    name?: SearchField;
  }>;
  isActive?: boolean;
  role?: string;
  branchId?: string;
}

interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  name?: string;
  role?: string;
  branchId?: string;
  isActive?: boolean;
}

interface UpdateUserRequest {
  username?: string;
  email?: string;
  password?: string;
  name?: string;
  role?: string;
  branchId?: string;
  isActive?: boolean;
}

interface UserResponse {
  id: string;
  username: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  branchId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PaginatedUsersResponse {
  users: UserResponse[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// GET /api/users - Get all users with optional filtering
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    if (token.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
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
    const where: WhereClause = {};

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

    // Restrict non-admin users to only see users in their branch
    if (token.role !== UserRole.ADMIN && token.branchId) {
      where.branchId = token.branchId;
    }

    // Get users with pagination
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          branchId: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    const pages = Math.ceil(total / limit);

    const response: PaginatedUsersResponse = {
      users,
      total,
      page,
      limit,
      pages,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/users - Create a new user
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    if (token.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    const body: CreateUserRequest = await request.json();
    const { username, email, password, name, role, branchId, isActive } = body;

    // Validate required fields
    if (!username || !email || !password) {
      return NextResponse.json(
        { error: "Username, email, and password are required" },
        { status: 400 },
      );
    }

    // Check if username or email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Username or email already exists" },
        { status: 400 },
      );
    }

    // Create the user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: await hashPassword(password),
        name: name || username,
        role: role || UserRole.USER,
        isActive: isActive ?? true,
        branchId: branchId || null,
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(user as UserResponse);
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH /api/users/[id] - Update a user
export async function PATCH(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    if (token.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    const body: UpdateUserRequest = await request.json();
    const { username, email, password, name, role, branchId, isActive } = body;
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const id = pathParts[pathParts.length - 1] as string;

    if (!id) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if username/email is changed and already exists
    if (username && username !== existingUser.username) {
      const usernameExists = await prisma.user.findFirst({
        where: { username },
      });

      if (usernameExists) {
        return NextResponse.json(
          { error: "Username already exists" },
          { status: 400 },
        );
      }
    }

    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findFirst({
        where: { email },
      });

      if (emailExists) {
        return NextResponse.json(
          { error: "Email already exists" },
          { status: 400 },
        );
      }
    }

    // Prepare update data
    const updateData: Prisma.UserUpdateInput = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (password) updateData.password = await hashPassword(password);
    if (name) updateData.name = name;
    if (role) updateData.role = role;
    if (branchId !== undefined)
      updateData.branch = { connect: { id: branchId } };
    if (isActive !== undefined) updateData.isActive = isActive;

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
        isActive: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(user as UserResponse);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/users/[id] - Delete a user
export async function DELETE(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    if (token.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const id = url.pathname.split("/").pop();

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent self-deletion
    if (existingUser.id === token.id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 },
      );
    }

    // Delete the user
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "User deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
