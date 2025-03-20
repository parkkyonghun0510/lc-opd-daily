import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

// GET /api/branches/[id] - Get a specific branch by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Use NextAuth for authentication
    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    const id = params.id;

    // Check if the branch exists
    const branch = await prisma.branch.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        code: true,
        parentId: true,
        isActive: true,
      },
    });

    // Return 404 if branch not found
    if (!branch) {
      return NextResponse.json(
        { error: `Branch with ID ${id} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(branch);
  } catch (error) {
    console.error(`Error fetching branch by ID:`, error);
    return NextResponse.json(
      { error: "Failed to fetch branch" },
      { status: 500 }
    );
  }
} 