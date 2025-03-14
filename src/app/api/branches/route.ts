import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserFromToken } from "@/lib/jwt";
import { z } from "zod";

const prisma = new PrismaClient();

// Validation schema for branch creation/update
const branchSchema = z.object({
  code: z
    .string()
    .min(2, "Branch code must be at least 2 characters")
    .max(10, "Branch code must be at most 10 characters")
    .regex(
      /^[A-Z0-9-]+$/,
      "Branch code must contain only uppercase letters, numbers, and hyphens"
    ),
  name: z
    .string()
    .min(2, "Branch name must be at least 2 characters")
    .max(100, "Branch name must be at most 100 characters"),
  isActive: z.boolean().optional().default(true),
  parentId: z.string().optional().nullable(),
});

// GET /api/branches - Get all branches with optional filtering
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const active = searchParams.get("active");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.OR = [
        { code: { contains: search.toUpperCase(), mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }

    if (active !== null) {
      where.isActive = active === "true";
    }

    // Get branches with counts and pagination
    const [branches, total] = await Promise.all([
      prisma.branch.findMany({
        where,
        orderBy: [{ isActive: "desc" }, { code: "asc" }],
        include: {
          parent: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          children: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          _count: {
            select: {
              users: true,
              reports: true,
              children: true,
            },
          },
        },
        skip,
        take: limit,
      }),
      prisma.branch.count({ where }),
    ]);

    // If pagination was requested, return meta info
    if (searchParams.has("page")) {
      return NextResponse.json({
        branches,
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      });
    }

    // Otherwise just return the branches
    return NextResponse.json(branches);
  } catch (error) {
    console.error("Error fetching branches:", error);
    return NextResponse.json(
      { error: "Failed to fetch branches" },
      { status: 500 }
    );
  }
}

// POST /api/branches - Create a new branch
export async function POST(request: Request) {
  try {
    // Verify admin permission
    const authUser = await getUserFromToken();
    if (!authUser || authUser.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    const body = await request.json();

    try {
      // Validate input data
      const validatedData = branchSchema.parse(body);

      // Check if branch code already exists
      const existingBranch = await prisma.branch.findUnique({
        where: { code: validatedData.code },
      });

      if (existingBranch) {
        return NextResponse.json(
          { error: "Branch code already exists" },
          { status: 409 }
        );
      }

      // Create the branch
      const branch = await prisma.branch.create({
        data: validatedData,
        include: {
          _count: {
            select: {
              users: true,
              reports: true,
            },
          },
        },
      });

      // Log the activity
      await prisma.activityLog.create({
        data: {
          userId: authUser.userId,
          action: "CREATE_BRANCH",
          details: `Created branch ${branch.code} - ${branch.name}`,
        },
      });

      return NextResponse.json(branch, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation failed", details: error.errors },
          { status: 400 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("Error creating branch:", error);
    return NextResponse.json(
      { error: "Failed to create branch" },
      { status: 500 }
    );
  }
}

// PATCH /api/branches - Update a branch
export async function PATCH(request: Request) {
  try {
    // Verify admin permission
    const authUser = await getUserFromToken();
    if (!authUser || authUser.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Branch ID is required" },
        { status: 400 }
      );
    }

    try {
      // Validate update data
      const validatedData = branchSchema.partial().parse(updateData);

      // Check if branch exists
      const existingBranch = await prisma.branch.findUnique({
        where: { id },
      });

      if (!existingBranch) {
        return NextResponse.json(
          { error: "Branch not found" },
          { status: 404 }
        );
      }

      // If code is being changed, check if it already exists
      if (validatedData.code && validatedData.code !== existingBranch.code) {
        const codeExists = await prisma.branch.findUnique({
          where: { code: validatedData.code },
        });

        if (codeExists) {
          return NextResponse.json(
            { error: "Branch code already exists" },
            { status: 409 }
          );
        }
      }

      // Update the branch
      const branch = await prisma.branch.update({
        where: { id },
        data: validatedData,
        include: {
          _count: {
            select: {
              users: true,
              reports: true,
            },
          },
        },
      });

      // Log the activity
      await prisma.activityLog.create({
        data: {
          userId: authUser.userId,
          action: "UPDATE_BRANCH",
          details: `Updated branch ${branch.code} - ${branch.name}`,
        },
      });

      return NextResponse.json(branch);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation failed", details: error.errors },
          { status: 400 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("Error updating branch:", error);
    return NextResponse.json(
      { error: "Failed to update branch" },
      { status: 500 }
    );
  }
}

// DELETE /api/branches - Delete a branch
export async function DELETE(request: Request) {
  try {
    // Verify admin permission
    const authUser = await getUserFromToken();
    if (!authUser || authUser.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Branch ID is required" },
        { status: 400 }
      );
    }

    // Check if branch exists and has no associated data
    const branch = await prisma.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            reports: true,
            children: true,
          },
        },
      },
    });

    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    // Don't allow deleting if branch has associated users, reports, or child branches
    if (
      branch._count.users > 0 ||
      branch._count.reports > 0 ||
      branch._count.children > 0
    ) {
      return NextResponse.json(
        {
          error:
            "Cannot delete branch with associated users, reports, or child branches",
        },
        { status: 400 }
      );
    }

    // Delete the branch
    await prisma.branch.delete({
      where: { id },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        userId: authUser.userId,
        action: "DELETE_BRANCH",
        details: `Deleted branch ${branch.code} - ${branch.name}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting branch:", error);
    return NextResponse.json(
      { error: "Failed to delete branch" },
      { status: 500 }
    );
  }
}
