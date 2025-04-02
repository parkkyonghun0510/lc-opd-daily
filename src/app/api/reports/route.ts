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
    const submittedBy = searchParams.get("submittedBy");
    const date = searchParams.get("date");

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

    if (submittedBy) {
      where.submittedBy = submittedBy;
    }

    if (date) {
      // If a specific date is provided, create a range for that day
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      where.date = {
        gte: startOfDay.toISOString(),
        lt: endOfDay.toISOString()
      };
    } else if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        // Ensure startDate is interpreted as the beginning of the day
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        where.date.gte = start.toISOString();
      }
      if (endDate) {
        // Ensure endDate is interpreted as the end of the day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end.toISOString(); // Use lte for endDate
      }
    }

    if (reportType) {
      where.reportType = reportType;
    }

    // Get total count for pagination
    const total = await prisma.report.count({ where });

    // Implement keyset pagination for better performance with large datasets
    let skipTake = {};
    
    if (page && limit) {
      skipTake = {
        skip: (page - 1) * limit,
        take: limit,
      };
    }

    // Get reports with pagination
    const reports = await prisma.report.findMany({
      where,
      include: {
        branch: true,
        planReport: {
          select: {
            id: true,
            writeOffs: true,
            ninetyPlus: true,
          },
        },
        actualReports: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
      ...skipTake,
    });

    // Transform reports data to ensure we have plan data for actual reports
    const transformedReports = reports.map(report => {
      // Create a new object with the original report properties
      const transformed = { 
        ...report,
        // Convert Decimal to number for JSON serialization
        writeOffs: Number(report.writeOffs),
        ninetyPlus: Number(report.ninetyPlus),
      } as any;
      
      // If this is an actual report and has planReport data
      if (report.reportType === 'actual' && report.planReport) {
        transformed.writeOffsPlan = Number(report.planReport.writeOffs) || 0;
        transformed.ninetyPlusPlan = Number(report.planReport.ninetyPlus) || 0;
      }
      
      return transformed;
    });

    return NextResponse.json({
      data: transformedReports,
      pagination: {
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

    // Parse date properly for DateTime field
    const reportDate = new Date(reportData.date);
    
    // Ensure date is valid
    if (isNaN(reportDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    // Check for existing report
    const startOfDay = new Date(reportDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(reportDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const existingReport = await prisma.report.findFirst({
      where: {
        date: {
          gte: startOfDay.toISOString(),
          lt: endOfDay.toISOString(),
        },
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

    // Create the base report data with correct types
    const baseReportData = {
      date: reportDate.toISOString(),
      branchId: reportData.branchId,
      writeOffs: reportData.writeOffs || 0,
      ninetyPlus: reportData.ninetyPlus || 0,
      reportType: reportData.reportType,
      status: reportStatus,
      submittedBy: token.sub as string,
      submittedAt: new Date().toISOString(),
      comments: reportData.comments || null,
    };

    let report;
    // For actual reports, find and validate corresponding plan report
    if (reportData.reportType === "actual") {
      // Find the corresponding plan report for the same day
      const planStartOfDay = new Date(reportDate);
      planStartOfDay.setHours(0, 0, 0, 0);
      const planEndOfDay = new Date(reportDate);
      planEndOfDay.setHours(23, 59, 59, 999);
      
      const planReport = await prisma.report.findFirst({
        where: {
          date: {
            gte: planStartOfDay.toISOString(),
            lt: planEndOfDay.toISOString(),
          },
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
          ...baseReportData,
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
        data: baseReportData,
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
          date: reportDate.toISOString().split('T')[0],
          writeOffs: Number(report.writeOffs),
          ninetyPlus: Number(report.ninetyPlus),
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

    // Convert Decimal to number for JSON serialization
    const serializedReport = {
      ...report,
      writeOffs: Number(report.writeOffs),
      ninetyPlus: Number(report.ninetyPlus),
      // Also handle any nested decimal values
      planReport: report.planReport ? {
        ...report.planReport,
        writeOffs: Number(report.planReport.writeOffs),
        ninetyPlus: Number(report.planReport.ninetyPlus),
      } : null,
    };

    return NextResponse.json({
      message: "Report created successfully",
      data: serializedReport,
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

    // Only allow editing pending or rejected reports
    if (report.status !== "pending" && report.status !== "rejected") {
      return NextResponse.json(
        { error: "Only pending or rejected reports can be edited" },
        { status: 400 }
      );
    }

    // Update the report
    const updatedReport = await prisma.report.update({
      where: { id },
      data: {
        ...updateData,
        // If this is a rejected report being resubmitted and new comments were provided
        ...(report.status === "rejected" && updateData.comments ? {
          comments: `${report.comments ? report.comments + '\n\n' : ''}[RESUBMISSION ${new Date().toISOString().split('T')[0]}]:\n${updateData.comments}`,
          status: "pending_approval" // Change status to pending_approval when resubmitting
        } : {}),
        // If no new comments were provided but updating other fields, preserve existing comments
        ...(report.status === "rejected" && !updateData.comments ? {
          status: "pending_approval" // Still change status to pending_approval when resubmitting
        } : {})
      },
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
