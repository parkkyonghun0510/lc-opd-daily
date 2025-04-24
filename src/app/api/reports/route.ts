import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { Permission, UserRole, checkPermission } from "@/lib/auth/roles";
import { getAccessibleBranches } from "@/lib/auth/branch-access";
import { sendToNotificationQueue } from "@/lib/queue/sqs";
import { getUsersForNotification } from "@/utils/notificationTargeting";
import { NotificationType } from "@/utils/notificationTemplates";
// Import the broadcast function
import { broadcastDashboardUpdate } from "@/app/api/dashboard/sse/route";
import { DashboardEventTypes } from "@/lib/events/dashboard-events";

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
  status?: string; // Add optional status field
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
      const targetDate = new Date(date);
      const reportDate = targetDate.toISOString().split('T')[0]; // 'YYYY-MM-DD'
      const reportDateISO = `${reportDate}T00:00:00.000Z`;

      //console.log("[DEBUG] Query param date:", date);
      //console.log("[DEBUG] Server timezone offset (minutes):", new Date().getTimezoneOffset());
      //console.log("[DEBUG] Normalized reportDate string:", reportDate);
      //console.log("[DEBUG] Using reportDateISO for Prisma query:", reportDateISO);

      where.date = new Date(reportDateISO);
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
    const reportDateOnly = new Date(reportDate);
    reportDateOnly.setHours(0, 0, 0, 0);

    // Ensure date is valid
    if (isNaN(reportDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    // Check for existing report
    const reportDateObj = new Date(reportData.date);
    const reportDateStr = reportDateObj.toISOString().split('T')[0]; // 'YYYY-MM-DD'

    //console.log("[DEBUG] Duplicate check normalized reportDate string:", reportDateStr);

    const reportDateISO = `${reportDateStr}T00:00:00.000Z`;

    const existing = await prisma.report.findMany({
      where: {
        branchId: reportData.branchId,
        reportType: reportData.reportType,
        date: new Date(reportDateISO),
      },
    });

    // //console.log('DEBUG: existing report:', existing);



    if (Array.isArray(existing) && existing.length > 0) {
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
      // reportDate: reportDateStr,
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
          // date: {
          //   gte: planStartOfDay.toISOString(),
          //   lt: planEndOfDay.toISOString(),
          // },
          date: reportDate.toISOString(),
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

        // Notify relevant users
        const targetUsers = await getUsersForNotification(NotificationType.REPORT_SUBMITTED, { branchId: report.branchId, submittedBy: token.sub as string, reportId: report.id });

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

// PATCH /api/reports - Update an existing report (e.g., status change, content edit)
export async function PATCH(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    const body: UpdateReportData = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Report ID is required for update" },
        { status: 400 }
      );
    }

    // Fetch the existing report to check ownership/permissions
    const existingReport = await prisma.report.findUnique({
      where: { id },
      include: { branch: true }, // Include branch for permission checks
    });

    if (!existingReport) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Permission Check: Can the user edit this specific report?
    const userRole = token.role as UserRole;
    const accessibleBranches = await getAccessibleBranches(token.sub as string);
    const canAccessBranch = accessibleBranches.some(b => b.id === existingReport.branchId);

    // Basic check: User must have access to the report's branch
    if (!canAccessBranch) {
      return NextResponse.json(
        { error: "Forbidden - You do not have access to this branch's reports" },
        { status: 403 }
      );
    }

    // More granular check: Can the user edit reports in general?
    // Or, if it's their own report and they have edit permission for own reports?
    // (Add more specific logic based on your RBAC rules if needed)
    console.log("[REPORT PATCH] User:", token.sub, "Role:", userRole, "Has EDIT_REPORTS:", checkPermission(userRole, Permission.EDIT_REPORTS));
    if (!checkPermission(userRole, Permission.EDIT_REPORTS)) {
      // Allow editing own report if they have that specific permission
      if (!checkPermission(userRole, Permission.EDIT_OWN_REPORTS) || existingReport.submittedBy !== token.sub) {
        console.log("[REPORT PATCH] Forbidden edit attempt. User:", token.sub, "Role:", userRole, "Report ID:", id, "SubmittedBy:", existingReport.submittedBy);
        return NextResponse.json(
          { error: "Forbidden - You do not have permission to edit reports" },
          { status: 403 }
        );
      }
    }

    // --- Handle Status Change (Approval/Rejection) --- Requires specific permission
    let statusChangeNotificationType: NotificationType | null = null;

    // If the report is rejected and the owner is resubmitting (not an approver), force status to pending_approval
    if (
      existingReport.status === "rejected" &&
      existingReport.submittedBy === token.sub &&
      !checkPermission(userRole, Permission.APPROVE_REPORTS)
    ) {
      updateData.status = "pending_approval";
    }

    if (updateData.status && updateData.status !== existingReport.status) {
      // Allow submitter to change status from 'rejected' to 'pending_approval'
      if (!(
        existingReport.status === "rejected" &&
        updateData.status === "pending_approval" &&
        existingReport.submittedBy === token.sub
      )) {
        // Only ADMIN can approve/reject reports, regardless of permissions
        if (userRole !== "ADMIN") {
          return NextResponse.json(
            { error: "Forbidden - Only admins can approve/reject reports" },
            { status: 403 }
          );
        }
      }
      // Determine notification type based on status change
      if (updateData.status === 'approved') {
        statusChangeNotificationType = NotificationType.REPORT_APPROVED;
      } else if (updateData.status === 'rejected') {
        statusChangeNotificationType = NotificationType.REPORT_REJECTED;
      }
    }

    // Prepare data for update (handle potential Decimal conversion if needed)
    const prismaUpdateData: any = { ...updateData };
    if (prismaUpdateData.writeOffs !== undefined) {
      prismaUpdateData.writeOffs = Number(prismaUpdateData.writeOffs);
    }
    if (prismaUpdateData.ninetyPlus !== undefined) {
      prismaUpdateData.ninetyPlus = Number(prismaUpdateData.ninetyPlus);
    }

    // Update the report
    const updatedReport = await prisma.report.update({
      where: { id },
      data: prismaUpdateData,
      include: {
        branch: true, // Include for notifications
      },
    });

    // Broadcast the update via SSE after successful update
    broadcastDashboardUpdate(
      DashboardEventTypes.REPORT_UPDATED,
      {
        reportId: updatedReport.id,
        branchId: updatedReport.branchId,
        status: updatedReport.status,
        // Include other fields that might affect dashboard aggregates
        writeOffs: Number(updatedReport.writeOffs),
        ninetyPlus: Number(updatedReport.ninetyPlus),
        date: updatedReport.date.toISOString().split('T')[0],
        reportType: updatedReport.reportType,
      }
    );

    // --- Send Notifications for Status Change ---
    if (statusChangeNotificationType) {
      try {
        const targetUsers = await getUsersForNotification(
          statusChangeNotificationType,
          updatedReport.branch
        );

        if (targetUsers.length > 0) {
          const notificationData = {
            reportId: updatedReport.id,
            reportDate: updatedReport.date.toISOString().split('T')[0],
            branchName: updatedReport.branch.name,
            status: updatedReport.status,
            actorName: token.name || 'System',
            // Add comments if rejection includes them
            comments: updateData.comments || undefined
          };

          await sendToNotificationQueue({
            type: statusChangeNotificationType,
            data: notificationData,
            userIds: targetUsers,
          });
        }
      } catch (notificationError) {
        console.error("Error sending status change notifications (non-critical):", notificationError);
      }
    }

    // Convert Decimal fields to numbers for the response
    const responseReport = {
      ...updatedReport,
      writeOffs: Number(updatedReport.writeOffs),
      ninetyPlus: Number(updatedReport.ninetyPlus),
    };

    return NextResponse.json(responseReport);
  } catch (error) {
    console.error("Error updating report:", error);
    // Check for specific Prisma errors if needed (e.g., P2025 Record not found)
    return NextResponse.json(
      { error: "Failed to update report" },
      { status: 500 }
    );
  }
}

