import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getToken } from "next-auth/jwt";
import { UserRole } from "@/lib/auth/roles";

// GET /api/admin/diagnostics/reports - Identify reports with data integrity issues
export async function GET(request: NextRequest) {
  try {
    // Use NextAuth for authentication
    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only allow admins to access this endpoint
    if (token.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Get all reports
    const reports = await prisma.report.findMany({
      select: {
        id: true,
        branchId: true,
        date: true,
        reportType: true,
        status: true,
        submittedBy: true,
        submittedAt: true,
      },
    });

    // Get all valid branch IDs
    const branches = await prisma.branch.findMany({
      select: {
        id: true,
      },
    });
    const validBranchIds = new Set(branches.map((branch) => branch.id));

    // Find reports with invalid branch IDs
    const reportsWithInvalidBranches = reports.filter(
      (report) => !validBranchIds.has(report.branchId),
    );

    // Return diagnostic information
    return NextResponse.json({
      totalReports: reports.length,
      totalBranches: branches.length,
      reportsWithInvalidBranches: reportsWithInvalidBranches,
      invalidBranchCount: reportsWithInvalidBranches.length,
    });
  } catch (error) {
    console.error("Error running report diagnostics:", error);
    return NextResponse.json(
      { error: "Failed to run report diagnostics" },
      { status: 500 },
    );
  }
}

// POST /api/admin/diagnostics/reports/fix - Fix reports with invalid branch references
export async function POST(request: NextRequest) {
  try {
    // Use NextAuth for authentication
    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only allow admins to access this endpoint
    if (token.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { action, targetBranchId, reportIds } = body;

    if (!action || !Array.isArray(reportIds) || reportIds.length === 0) {
      return NextResponse.json(
        { error: "Invalid request parameters" },
        { status: 400 },
      );
    }

    let result;

    // Handle different fix actions
    switch (action) {
      case "reassign":
        // Validate target branch ID
        if (!targetBranchId) {
          return NextResponse.json(
            { error: "Target branch ID is required for reassign action" },
            { status: 400 },
          );
        }

        // Check if target branch exists
        const targetBranch = await prisma.branch.findUnique({
          where: { id: targetBranchId },
        });

        if (!targetBranch) {
          return NextResponse.json(
            { error: "Target branch does not exist" },
            { status: 400 },
          );
        }

        // Reassign reports to the target branch
        result = await prisma.$transaction(
          reportIds.map((id) =>
            prisma.report.update({
              where: { id },
              data: { branchId: targetBranchId },
            }),
          ),
        );

        return NextResponse.json({
          success: true,
          message: `Reassigned ${result.length} reports to branch ${targetBranch.name}`,
          updatedReports: result.length,
        });

      case "delete":
        // Delete the reports
        result = await prisma.report.deleteMany({
          where: { id: { in: reportIds } },
        });

        return NextResponse.json({
          success: true,
          message: `Deleted ${result.count} reports with invalid branch references`,
          deletedReports: result.count,
        });

      default:
        return NextResponse.json(
          { error: "Invalid action specified" },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("Error fixing reports:", error);
    return NextResponse.json(
      { error: "Failed to fix reports" },
      { status: 500 },
    );
  }
}
