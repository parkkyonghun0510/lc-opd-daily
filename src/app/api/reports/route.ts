import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { Permission, UserRole, checkPermission } from "@/lib/auth/roles";
import { getAccessibleBranches } from "@/lib/auth/branch-access";
import { sendToNotificationQueue } from "@/lib/queue/sqs";
import { getUsersForNotification } from "@/utils/notificationTargeting";
import { NotificationType } from "@/utils/notificationTemplates";
import {
  AuthError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
  ConflictError,
  handleApiError,
  tryNonCritical
} from "@/lib/errors";

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
      throw new AuthError("Authentication required");
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

    // Get accessible branches for the user - use a single query to get all branch IDs
    const accessibleBranches = await getAccessibleBranches(token.sub as string);
    const accessibleBranchIds = accessibleBranches.map(branch => branch.id);

    // Build where clause with optimized branch filtering
    const where: any = {
      branchId: {
        in: accessibleBranchIds
      }
    };

    if (branchId) {
      // If specific branch is requested, verify access
      if (!accessibleBranchIds.includes(branchId)) {
        throw new ForbiddenError("You don't have access to this branch");
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
      // If a specific date is provided, use equals for exact date match
      const targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        throw new ValidationError("Invalid date format");
      }

      // Since the date field in the database is a Date type (without time),
      // we should use equals instead of a range query
      where.date = targetDate;
    } else if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        // For date range queries with date-only fields, we can use direct date objects
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          throw new ValidationError("Invalid start date format");
        }
        where.date.gte = start;
      }
      if (endDate) {
        // For date range queries with date-only fields, we can use direct date objects
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          throw new ValidationError("Invalid end date format");
        }
        where.date.lte = end;
      }
    }

    if (reportType) {
      where.reportType = reportType;
    }

    // Combine count and data fetch in a single transaction for better performance
    const [total, reports] = await prisma.$transaction([
      prisma.report.count({ where }),
      prisma.report.findMany({
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
        ...(page && limit ? {
          skip: (page - 1) * limit,
          take: limit,
        } : {})
      })
    ]);

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
    return handleApiError(error);
  }
}

// POST /api/reports - Create a new report
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      throw new AuthError("Authentication required");
    }

    // Check if user has permission to create reports
    const userRole = token.role as UserRole;
    if (!checkPermission(userRole, Permission.CREATE_REPORTS)) {
      throw new ForbiddenError("You don't have permission to create reports");
    }

    const reportData = await request.json() as ReportData;

    // Validate required fields
    if (!reportData.branchId || !reportData.date || !reportData.reportType) {
      throw new ValidationError("Missing required fields", "VALIDATION_ERROR", 400, {
        fields: ["branchId", "date", "reportType"]
      });
    }

    // Check if user has access to the branch
    const accessibleBranches = await getAccessibleBranches(token.sub as string);
    const hasAccess = accessibleBranches.some(branch => branch.id === reportData.branchId);

    if (!hasAccess) {
      throw new ForbiddenError("You don't have permission to create reports for this branch");
    }

    // Parse date properly for DateTime field
    const reportDate = new Date(reportData.date);

    // Ensure date is valid
    if (isNaN(reportDate.getTime())) {
      throw new ValidationError("Invalid date format");
    }

    // Check for existing report
    // Since the date field in the database is a Date type (without time),
    // we should use equals instead of a range query
    const existingReport = await prisma.report.findFirst({
      where: {
        date: reportDate, // Prisma will handle the conversion correctly
        branchId: reportData.branchId,
        reportType: reportData.reportType
      },
    });

    if (existingReport) {
      throw new ConflictError("A report already exists for this date, branch, and type");
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
      const planReport = await prisma.report.findFirst({
        where: {
          date: reportDate, // Prisma will handle the conversion correctly
          branchId: reportData.branchId,
          reportType: "plan"
        }
      });

      if (!planReport) {
        throw new ValidationError("A plan report must exist before submitting an actual report");
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
      await tryNonCritical(
        async () => {
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

          // Get users who should receive this notification - using optimized targeting
          const targetUsers = await getUsersForNotification(
            NotificationType.REPORT_SUBMITTED,
            notificationData
          );

          if (targetUsers.length > 0) {
            // Send notification in non-blocking way
            await sendToNotificationQueue({
              type: NotificationType.REPORT_SUBMITTED,
              data: notificationData,
              userIds: targetUsers
            });
          }

          return { sent: true };
        },
        { sent: false },
        { operation: 'send-notifications', reportId: report.id }
      );
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
    return handleApiError(error);
  }
}

// PATCH /api/reports - Update a report
export async function PATCH(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      throw new AuthError("Authentication required");
    }

    // Check if user has permission to edit reports
    const userRole = token.role as UserRole;
    if (!checkPermission(userRole, Permission.EDIT_REPORTS)) {
      throw new ForbiddenError("You don't have permission to edit reports");
    }

    const { id, ...updateData } = await request.json() as UpdateReportData;

    if (!id) {
      throw new ValidationError("Report ID is required");
    }

    // Get the report to check access
    const report = await prisma.report.findUnique({
      where: { id },
      include: { branch: true },
    });

    if (!report) {
      throw new NotFoundError("Report not found");
    }

    // Check if user has access to the branch
    const accessibleBranches = await getAccessibleBranches(token.sub as string);
    const hasAccess = accessibleBranches.some(branch => branch.id === report.branchId);

    if (!hasAccess) {
      throw new ForbiddenError("You don't have permission to edit reports for this branch");
    }

    // Only allow editing pending or rejected reports
    if (report.status !== "pending" && report.status !== "rejected") {
      throw new ValidationError("Only pending or rejected reports can be edited");
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

    // Send notifications if a rejected report is being resubmitted
    if (report.status === "rejected") {
      await tryNonCritical(
        async () => {
          // Get submitter name for notifications - use cached query if possible
          const submitter = await prisma.user.findUnique({
            where: { id: token.sub as string },
            select: { name: true }
          });

          const notificationData = {
            reportId: updatedReport.id,
            branchId: updatedReport.branchId,
            branchName: updatedReport.branch.name || "a branch",
            submitterName: submitter?.name || "A user",
            date: new Date(updatedReport.date).toISOString().split('T')[0],
            writeOffs: Number(updatedReport.writeOffs),
            ninetyPlus: Number(updatedReport.ninetyPlus),
            reportType: updatedReport.reportType,
            isResubmission: true
          };

          // Get users who should receive this notification - using optimized targeting
          const targetUsers = await getUsersForNotification(
            NotificationType.REPORT_SUBMITTED,
            notificationData
          );

          if (targetUsers.length > 0) {
            // Send notification in non-blocking way
            await sendToNotificationQueue({
              type: NotificationType.REPORT_SUBMITTED,
              data: notificationData,
              userIds: targetUsers
            });
            console.log(`Sent resubmission notifications to ${targetUsers.length} users`);
          }

          return { sent: true };
        },
        { sent: false },
        { operation: 'send-resubmission-notifications', reportId: updatedReport.id }
      );
    }

    return NextResponse.json({
      message: "Report updated successfully",
      data: updatedReport,
      notificationsSent: report.status === "rejected"
    });
  } catch (error) {
    return handleApiError(error);
  }
}
