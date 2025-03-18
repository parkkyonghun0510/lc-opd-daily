import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const searchQuery = url.searchParams.get("search") || "";
    
    // Build the query
    let where: Prisma.BranchWhereInput = {};
    
    if (searchQuery) {
      where = {
        OR: [
          { name: { contains: searchQuery, mode: "insensitive" as Prisma.QueryMode } },
          { code: { contains: searchQuery, mode: "insensitive" as Prisma.QueryMode } },
        ],
      };
    }

    // Fetch branches
    const branches = await prisma.branch.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        parentId: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(branches);
  } catch (error) {
    console.error("Error fetching branches:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
