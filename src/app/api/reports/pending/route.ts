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
    const reportType = searchParams.get("type") || "actual";

    if (!["plan", "actual"].includes(reportType)) {
      return NextResponse.json(
        { error: "Invalid report type" },
        { status: 400 }
      );
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

    // Get user branch assignments
    const userBranchAssignments = await prisma.$queryRawUnsafe<
      Array<{ branchId: string }>
    >(
      `SELECT "branchId" FROM "UserBranchAssignment" WHERE "userId" = $1`,
      token.id
    );

    const assignedBranchIds = userBranchAssignments.map((uba) => uba.branchId);

    // Get accessible branch IDs based on user role
    const accessibleBranchIds = getAccessibleBranches(
      token.role as UserRole,
      token.branchId as string | null,
      branches,
      assignedBranchIds
    );

    // Admin can see all pending reports, other roles see only their accessible branches
    const whereCondition =
      token.role === UserRole.ADMIN
        ? {
            status: "pending",
            reportType,
          }
        : {
            status: "pending",
            reportType,
            branchId: { in: accessibleBranchIds },
          };

    const pendingReports = await prisma.report.findMany({
      where: whereCondition,
      orderBy: [{ date: "desc" }, { submittedAt: "desc" }],
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ reports: pendingReports });
  } catch (error) {
    console.error("Error fetching pending reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending reports" },
      { status: 500 }
    );
  }
}
