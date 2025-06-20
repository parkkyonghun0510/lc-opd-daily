import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { Permission, UserRole, checkPermission } from "@/lib/auth/roles";

export async function GET(request: NextRequest) {
  try {
    // Use NextAuth for authentication
    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has approval permission
    if (!checkPermission(token.role as UserRole, Permission.APPROVE_REPORTS)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get("type");
    const includeRejected = searchParams.get("includeRejected") !== "false";

    // Define statuses to include
    const statuses = ["pending", "pending_approval"];

    // Include rejected reports if requested
    if (includeRejected) {
      statuses.push("rejected");
    }

    // Create base query condition
    let whereCondition: any = {
      status: { in: statuses },
    };

    // Add report type filter if specified
    if (reportType) {
      whereCondition.reportType = reportType;
    }

    // Get all pending and rejected reports
    const reports = await prisma.report.findMany({
      where: whereCondition,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        ReportComment: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        planReport: true,
        actualReports: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Get all unique submitter IDs
    const submitterIds = [
      ...new Set(reports.map((report) => report.submittedBy)),
    ];

    // Fetch all users in a single query for efficiency
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: submitterIds,
        },
      },
      select: {
        id: true,
        name: true,
        username: true,
      },
    });

    // Create a map for quick user lookup
    const userMap = new Map(users.map((user) => [user.id, user]));

    // Transform Decimal fields to numbers for each report and add user data
    const transformedReports = reports.map((report) => {
      // Get user data from the map
      const userData = userMap.get(report.submittedBy) || null;

      return {
        ...report,
        writeOffs: Number(report.writeOffs),
        ninetyPlus: Number(report.ninetyPlus),
        // Format the date as a string for consistent API response
        date: report.date.toISOString().split("T")[0],
        // Add user data to the report
        user: userData,
      };
    });

    return NextResponse.json({ reports: transformedReports });
  } catch (error) {
    console.error("Error fetching pending and rejected reports:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
