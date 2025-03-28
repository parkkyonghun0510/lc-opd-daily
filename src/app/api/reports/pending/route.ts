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

    // Fetch pending reports
    const pendingReports = await prisma.report.findMany({
      where: whereCondition,
      include: {
        branch: true,
        planReport: true,
        actualReports: true,
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

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
  } catch (error) {
    console.error("Error fetching pending reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending reports" },
      { status: 500 }
    );
  }
}
