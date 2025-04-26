import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getToken } from "next-auth/jwt";
import { Permission, UserRole, checkPermission } from "@/lib/auth/roles";
import { getAccessibleBranches } from "@/lib/auth/branch-access";

// GET /api/reports/pending - Get reports pending approval
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

    // Create base query condition
    let whereCondition: any = {
      status: { in: ["pending", "pending_approval"] },
    };

    // Add reportType filter if provided
    if (reportType && ["plan", "actual"].includes(reportType)) {
      whereCondition.reportType = reportType;
    }

    // Get accessible branches for the user
    const accessibleBranches = await getAccessibleBranches(token.sub as string);
    const accessibleBranchIds = accessibleBranches.map(branch => branch.id);

    // Add branch filter for non-admin users
    if (token.role !== UserRole.ADMIN) {
      whereCondition.branchId = {
        in: accessibleBranchIds
      };
    }

    // Fetch pending reports with a more resilient approach
    try {
      // First, get the report IDs that match our criteria
      const reportIds = await prisma.report.findMany({
        where: whereCondition,
        select: { id: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      });

      // Then fetch each report individually with error handling
      const pendingReportsPromises = reportIds.map(async ({ id }) => {
        try {
          return await prisma.report.findUnique({
            where: { id },
            include: {
              branch: true,
              planReport: true,
              actualReports: true,
            },
          });
        } catch (error) {
          console.error(`Error fetching report ${id}:`, error);
          // Return a minimal report object with the ID
          return { id, error: "Failed to load complete report data" };
        }
      });

      const pendingReportsResults = await Promise.all(pendingReportsPromises);
      // Filter out null results and reports with missing branches
      const pendingReports = pendingReportsResults.filter(
        (report): report is any =>
          report !== null &&
          report.branch !== null &&
          !report.error
      );

      // Manually fetch user data for submitted reports
      const reportsWithUsers = await Promise.all(
        pendingReports.map(async (report) => {
          let userData = null;
          if (report.submittedBy) {
            try {
              const user = await prisma.user.findUnique({
                where: { id: report.submittedBy },
                select: { id: true, name: true, username: true },
              });
              userData = user;
            } catch (e) {
              console.error(`Error fetching user for report ${report.id}:`, e);
            }
          }

          return {
            ...report,
            user: userData,
          };
        })
      );

      // Return simplified array of reports
      return NextResponse.json({ reports: reportsWithUsers });
    } catch (innerError) {
      console.error("Error processing pending reports:", innerError);
      return NextResponse.json(
        { error: "Failed to process pending reports" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error fetching pending reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending reports" },
      { status: 500 }
    );
  }
}