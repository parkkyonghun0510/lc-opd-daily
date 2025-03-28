import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { Permission, UserRole, checkPermission } from "@/lib/auth/roles";
import { getAccessibleBranches } from "@/lib/auth/branch-access";
import { sendToNotificationQueue } from "@/lib/queue/sqs";
import { getUsersForNotification } from "@/utils/notificationTargeting";
import { NotificationType } from "@/utils/notificationTemplates";

interface ReportData {
  branchId: string;
  date: string;
  reportType: "plan" | "actual";
  writeOffs: number;
  ninetyPlus: number;
  comments?: string;
}

interface UpdateReportData {
  id: string;
  writeOffs?: number;
  ninetyPlus?: number;
  comments?: string;
}

// GET /api/reports - List reports with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const branchId = searchParams.get("branchId");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const reportType = searchParams.get("reportType");

    // Get accessible branches for the user
    const accessibleBranches = await getAccessibleBranches(token.sub as string);
    const accessibleBranchIds = accessibleBranches.map(branch => branch.id);

    // Build where clause
    const where: any = {
      branchId: {
        in: accessibleBranchIds
      }
    };

    if (branchId) {
      // If specific branch is requested, verify access
      if (!accessibleBranchIds.includes(branchId)) {
        return NextResponse.json(
          { error: "You don't have access to this branch" },
          { status: 403 }
        );
      }
      where.branchId = branchId;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }

    if (reportType) {
      where.reportType = reportType;
    }

    // Get total count for pagination
    const total = await prisma.report.count({ where });

    // Get reports with pagination
    const reports = await prisma.report.findMany({
      where,
      include: {
        branch: true,
        planReport: true,
        actualReports: true,
      },
      orderBy: {
        date: "desc",
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({
      data: reports,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}

// POST /api/reports - Create a new report
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    // Check if user has permission to create reports
    const userRole = token.role as UserRole;
    if (!checkPermission(userRole, Permission.CREATE_REPORTS)) {
      return NextResponse.json(
        { error: "Forbidden - You don't have permission to create reports" },
        { status: 403 }
      );
    }

    const reportData = await request.json() as ReportData;

    // Validate required fields
    if (!reportData.branchId || !reportData.date || !reportData.reportType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if user has access to the branch
    const accessibleBranches = await getAccessibleBranches(token.sub as string);
    const hasAccess = accessibleBranches.some(branch => branch.id === reportData.branchId);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "You don't have permission to create reports for this branch" },
        { status: 403 }
      );
    }

    // Format date consistently
    const formattedDate = new Date(reportData.date).toISOString().split('T')[0];

    // Check for existing report
    const existingReport = await prisma.report.findFirst({
      where: {
        date: formattedDate,
        branchId: reportData.branchId,
        reportType: reportData.reportType
      },
    });

    if (existingReport) {
      return NextResponse.json(
        { error: "A report already exists for this date, branch, and type" },
        { status: 400 }
      );
    }

    // Get validation rules
    const rules = await prisma.organizationSettings.findFirst({
      where: { organizationId: "default" },
      select: { validationRules: true }
    });

    let reportStatus = "pending";
    if (rules?.validationRules) {
      const validationRules = rules.validationRules as any;
      
      // Check if write-offs or 90+ days require approval
      if ((validationRules.writeOffs?.requireApproval && reportData.writeOffs > 0) || 
          (validationRules.ninetyPlus?.requireApproval && reportData.ninetyPlus > 0)) {
        reportStatus = "pending_approval";
      }
    }

    // Get branch name for notifications
    const branch = await prisma.branch.findUnique({
      where: { id: reportData.branchId },
      select: { name: true, id: true }
    });

    // Get submitter name for notifications
    const submitter = await prisma.user.findUnique({
      where: { id: token.sub as string },
      select: { name: true }
    });

    let report;
    // For actual reports, find and validate corresponding plan report
    if (reportData.reportType === "actual") {
      const planReport = await prisma.report.findFirst({
        where: {
          date: formattedDate,
          branchId: reportData.branchId,
          reportType: "plan"
        }
      });

      if (!planReport) {
        return NextResponse.json(
          { error: "A plan report must exist before submitting an actual report" },
          { status: 400 }
        );
      }

      report = await prisma.report.create({
        data: {
          date: formattedDate,
          branchId: reportData.branchId,
          writeOffs: reportData.writeOffs || 0,
          ninetyPlus: reportData.ninetyPlus || 0,
          reportType: reportData.reportType,
          status: reportStatus,
          submittedBy: token.sub as string,
          submittedAt: new Date().toISOString(),
          comments: reportData.comments || null,
          planReportId: planReport.id
        },
        include: {
          branch: true,
          planReport: true,
          actualReports: true,
        },
      });
    } else {
      report = await prisma.report.create({
        data: {
          date: formattedDate,
          branchId: reportData.branchId,
          writeOffs: reportData.writeOffs || 0,
          ninetyPlus: reportData.ninetyPlus || 0,
          reportType: reportData.reportType,
          status: reportStatus,
          submittedBy: token.sub as string,
          submittedAt: new Date().toISOString(),
          comments: reportData.comments || null
        },
        include: {
          branch: true,
          planReport: true,
          actualReports: true,
        },
      });
    }

    // Send notifications if report needs approval
    if (reportStatus === "pending_approval") {
      try {
        const notificationData = {
          reportId: report.id,
          branchId: report.branchId,
          branchName: branch?.name || "a branch",
          submitterName: submitter?.name || "A user",
          date: formattedDate,
          writeOffs: report.writeOffs,
          ninetyPlus: report.ninetyPlus,
          reportType: report.reportType
        };

        // Get users who should receive this notification
        const targetUsers = await getUsersForNotification(
          NotificationType.REPORT_SUBMITTED,
          notificationData
        );

        if (targetUsers.length > 0) {
          await sendToNotificationQueue({
            type: NotificationType.REPORT_SUBMITTED,
            data: notificationData,
            userIds: targetUsers
          });
        }
      } catch (notificationError) {
        console.error("Error sending notifications (non-critical):", notificationError);
      }
    }

    return NextResponse.json({
      message: "Report created successfully",
      data: report,
      notificationsSent: reportStatus === "pending_approval"
    });
  } catch (error) {
    console.error("Error creating report:", error);
    return NextResponse.json(
      { error: "Failed to create report" },
      { status: 500 }
    );
  }
}

// PATCH /api/reports - Update a report
export async function PATCH(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    // Check if user has permission to edit reports
    const userRole = token.role as UserRole;
    if (!checkPermission(userRole, Permission.EDIT_REPORTS)) {
      return NextResponse.json(
        { error: "Forbidden - You don't have permission to edit reports" },
        { status: 403 }
      );
    }

    const { id, ...updateData } = await request.json() as UpdateReportData;

    if (!id) {
      return NextResponse.json(
        { error: "Report ID is required" },
        { status: 400 }
      );
    }

    // Get the report to check access
    const report = await prisma.report.findUnique({
      where: { id },
      include: { branch: true },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    // Check if user has access to the branch
    const accessibleBranches = await getAccessibleBranches(token.sub as string);
    const hasAccess = accessibleBranches.some(branch => branch.id === report.branchId);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "You don't have permission to edit reports for this branch" },
        { status: 403 }
      );
    }

    // Only allow editing pending reports
    if (report.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending reports can be edited" },
        { status: 400 }
      );
    }

    // Update the report
    const updatedReport = await prisma.report.update({
      where: { id },
      data: updateData,
      include: {
        branch: true,
        planReport: true,
        actualReports: true,
      },
    });

    return NextResponse.json({
      message: "Report updated successfully",
      data: updatedReport,
    });
  } catch (error) {
    console.error("Error updating report:", error);
    return NextResponse.json(
      { error: "Failed to update report" },
      { status: 500 }
    );
  }
}
