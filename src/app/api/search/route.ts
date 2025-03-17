import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json([]);
  }

  try {
    // Search in reports
    const reports = await prisma.report.findMany({
      where: {
        OR: [
          { branch: { name: { contains: query, mode: "insensitive" } } },
          { branch: { code: { contains: query, mode: "insensitive" } } },
          { comments: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        date: true,
        branchId: true,
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        createdAt: true,
      },
      take: 5,
    });

    // Search in branches
    const branches = await prisma.branch.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { code: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        code: true,
        createdAt: true,
      },
      take: 5,
    });

    // Format results
    const results = [
      ...reports.map((report) => ({
        id: report.id,
        title: `${report.branch.name} - ${report.date}`,
        type: "report" as const,
        url: `/dashboard/reports/${report.id}`,
        timestamp: report.createdAt.toISOString(),
        branch: report.branch,
      })),
      ...branches.map((branch) => ({
        id: branch.id,
        title: `${branch.name} (${branch.code})`,
        type: "branch" as const,
        url: `/dashboard/branches/${branch.id}`,
        timestamp: branch.createdAt.toISOString(),
      })),
    ];

    return NextResponse.json(results);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to perform search" },
      { status: 500 }
    );
  }
}
