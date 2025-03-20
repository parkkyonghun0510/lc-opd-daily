import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getToken } from "next-auth/jwt";
import {
  BranchHierarchy,
  Permission,
  UserRole,
  hasPermission,
} from "@/lib/auth/roles";
import { getAccessibleBranches } from "@/lib/auth/branch-access";

const prisma = new PrismaClient();

// GET /api/reports/pending - Get reports pending approval
export async function GET(request: NextRequest) {
  try {
    // Use NextAuth for authentication
    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has approval permission
    if (!hasPermission(token.role as UserRole, Permission.APPROVE_REPORTS)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get("type");

    // Create base query condition
    let whereCondition: any = {
      status: "pending",
    };

    // Add reportType filter if provided
    if (reportType && ["plan", "actual"].includes(reportType)) {
      whereCondition.reportType = reportType;
    }

    // Get branches hierarchy for access control
    const branchData = await prisma.branch.findMany({
      select: {
        id: true,
        name: true,
        parentId: true,
      },
    });

    // Transform into BranchHierarchy structure
    const branches: BranchHierarchy[] = branchData.map((branch) => ({
      id: branch.id,
      name: branch.name || "",
      parentId: branch.parentId,
      level: 0, // This would need to be calculated properly
      path: [branch.id], // This would need to be calculated properly
    }));

    // For non-admin users, filter by accessible branches
    if (token.role !== UserRole.ADMIN) {
      // Get user branch assignments
      const userBranchAssignments = await prisma.userBranchAssignment.findMany({
        where: { userId: token.id as string },
        select: { branchId: true },
      });
      
      const assignedBranchIds = userBranchAssignments.map((uba) => uba.branchId);

      // Get accessible branch IDs based on user role
      const accessibleBranchIds = getAccessibleBranches(
        token.role as UserRole,
        token.branchId as string | null,
        branches,
        assignedBranchIds
      );
      
      whereCondition.branchId = { in: accessibleBranchIds };
    }

    // Fetch pending reports
    const pendingReports = await prisma.report.findMany({
      where: whereCondition,
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
    return NextResponse.json(reportsWithUsers);
  } catch (error) {
    console.error("Error fetching pending reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending reports" },
      { status: 500 }
    );
  }
}
