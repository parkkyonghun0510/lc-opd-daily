import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { Permission, UserRole, checkPermission } from "@/lib/auth/roles";
import { getAccessibleBranches } from "@/lib/auth/branch-access";
import { sendToNotificationQueue } from "@/lib/queue/sqs";
import { getUsersForNotification } from "@/utils/notificationTargeting";
import { NotificationType } from "@/utils/notificationTemplates";
// Import the broadcast function
import { broadcastDashboardUpdate } from "@/lib/events/dashboard-broadcaster";
import { DashboardEventTypes } from "@/lib/events/dashboard-events";
import { sanitizeString } from "@/utils/sanitize";

interface ReportData {
  branchId: string;
  date: string;
  reportType: "plan" | "actual";
  writeOffs: number;
  ninetyPlus: number;
  comments?: string; // @deprecated - Use initialComment instead
  initialComment?: string; // Field for initial comment to be stored in ReportComment
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
        { status: 401 },
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
    const accessibleBranchIds = accessibleBranches.map((branch) => branch.id);

    // Build where clause
    const where: any = {};

    // Handle branch filtering
    if (branchId && branchId.trim() !== "") {
      // If specific branch is requested, verify access
      if (!accessibleBranchIds.includes(branchId)) {
        return NextResponse.json(
          { error: "You don't have access to this branch" },
          { status: 403 },
        );
      }
      where.branchId = branchId;
    } else {
      // If no branch ID is provided or it's empty (All My Branches option),
      // filter by all accessible branches
      where.branchId = {
        in: accessibleBranchIds,
      };
    }

    if (status) {
      where.status = status;
    }

    if (submittedBy) {
      where.submittedBy = submittedBy;
    }

    if (date) {
      const targetDate = new Date(date);
      const reportDate = targetDate.toISOString().split("T")[0]; // 'YYYY-MM-DD'
      const reportDateISO = `${reportDate}T00:00:00.000Z`;

      //console.log("[DEBUG] Query param date:", date);
      //console.log("[DEBUG] Server timezone offset (minutes):", new Date().getTimezoneOffset());
      //console.log("[DEBUG] Normalized reportDate string:", reportDate);
      //console.log("[DEBUG] Using reportDateISO for Prisma query:", reportDateISO);

      // Pass date as a string to match Prisma query expectations
      where.date = reportDateISO;
    } else if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        // Ensure startDate is interpreted as the beginning of the day
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        // Pass as string instead of DateTime
        where.date.gte = start.toISOString(); // Convert to ISO 8601 string
      }
      if (endDate) {
        // Ensure endDate is interpreted as the end of the day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        // Pass as string instead of DateTime
        where.date.lte = end.toISOString(); // Convert to ISO 8601 string
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
    const transformedReports = reports.map((report) => {
      // Create a new object with the original report properties
      const transformed = {
        ...report,
        // Convert Decimal to number for JSON serialization
        writeOffs: Number(report.writeOffs),
        ninetyPlus: Number(report.ninetyPlus),
      } as any;

      // If this is an actual report and has planReport data
      if (report.reportType === "actual" && report.planReport) {
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
      { status: 500 },
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
        { status: 401 },
      );
    }

    // Check if user has permission to create reports
    const userRole = token.role as UserRole;
    if (!checkPermission(userRole, Permission.CREATE_REPORTS)) {
      return NextResponse.json(
        { error: "Forbidden - You don't have permission to create reports" },
        { status: 403 },
      );
    }

    const reportData = (await request.json()) as ReportData;

    // Validate required fields
    if (!reportData.branchId || !reportData.date || !reportData.reportType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Check if user has access to the branch
    const accessibleBranches = await getAccessibleBranches(token.sub as string);
    const hasAccess = accessibleBranches.some(
      (branch) => branch.id === reportData.branchId,
    );

    if (!hasAccess) {
      return NextResponse.json(
        {
          error: "You don't have permission to create reports for this branch",
        },
        { status: 403 },
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
        { status: 400 },
      );
    }

    // Check for existing report
    const reportDateObj = new Date(reportData.date);
    const reportDateStr = reportDateObj.toISOString().split("T")[0]; // 'YYYY-MM-DD'

    //console.log("[DEBUG] Duplicate check normalized reportDate string:", reportDateStr);

    const reportDateISO = `${reportDateStr}T00:00:00.000Z`;

    const existing = await prisma.report.findMany({
      where: {
        branchId: reportData.branchId,
        reportType: reportData.reportType,
        date: reportDateISO, // Pass as string to match Prisma query expectations
      },
    });

    // //console.log('DEBUG: existing report:', existing);

    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json(
        { error: "A report already exists for this date, branch, and type" },
        { status: 400 },
      );
    }

    // Get validation rules
    const rules = await prisma.organizationSettings.findFirst({
      where: { organizationId: "default" },
      select: { validationRules: true },
    });

    let reportStatus = "pending";
    if (rules?.validationRules) {
      const validationRules = rules.validationRules as any;

      // Check if write-offs or 90+ days require approval
      if (
        (validationRules.writeOffs?.requireApproval &&
          reportData.writeOffs > 0) ||
        (validationRules.ninetyPlus?.requireApproval &&
          reportData.ninetyPlus > 0)
      ) {
        reportStatus = "pending_approval";
      }
    }

    // Get branch name for notifications
    const branch = await prisma.branch.findUnique({
      where: { id: reportData.branchId },
      select: { name: true, id: true },
    });

    // Get submitter name for notifications
    const submitter = await prisma.user.findUnique({
      where: { id: token.sub as string },
      select: { name: true },
    });

    // We're going to skip handling comments in the report creation
    // and instead use the ReportComment model to add comments separately
    // This avoids UTF-8 encoding issues with the comments field
    console.log(
      "[DEBUG] Using ReportComment model for comments instead of storing in Report.",
    );

    // Store any comments temporarily to add after report creation
    // Use initialComment field if available, fall back to comments for backward compatibility
    const initialComment = reportData.initialComment || reportData.comments;

    // Set comments to null in the report data
    const sanitizedComments = null;

    // Validate that all data is in the correct format before proceeding
    const baseReportData: any = {
      date: reportDateISO, // Pass as string to match Prisma query expectations
      branchId: reportData.branchId,
      writeOffs: reportData.writeOffs || 0,
      ninetyPlus: reportData.ninetyPlus || 0,
      reportType: reportData.reportType,
      status: reportStatus,
      submittedBy: token.sub as string,
      submittedAt: new Date().toISOString(),
      comments: sanitizedComments, // Already sanitized comments
    };

    // IMPORTANT: We're completely disabling commentArray for now due to persistent UTF-8 encoding issues
    // Do not include commentArray in the baseReportData at all
    console.log(
      "[DEBUG] commentArray field is disabled for report creation to avoid UTF-8 encoding issues",
    );

    let report;

    try {
      // For actual reports, find and validate corresponding plan report
      if (reportData.reportType === "actual") {
        // Find the corresponding plan report for the same day
        const planStartOfDay = new Date(reportDate);
        planStartOfDay.setHours(0, 0, 0, 0);
        const planEndOfDay = new Date(reportDate);
        planEndOfDay.setHours(23, 59, 59, 999);

        const planReport = await prisma.report.findFirst({
          where: {
            date: reportDateISO, // Pass as string to match Prisma query expectations
            branchId: reportData.branchId,
            reportType: "plan",
          },
        });

        if (!planReport) {
          return NextResponse.json(
            {
              error:
                "A plan report must exist before submitting an actual report",
            },
            { status: 400 },
          );
        }

        // Check if the plan report is approved
        if (planReport.status !== "approved") {
          return NextResponse.json(
            {
              error:
                "The plan report must be approved before submitting an actual report",
            },
            { status: 400 },
          );
        }

        // Double-check data before inserting
        console.log(
          "[DEBUG] Creating actual report with plan report ID:",
          planReport.id,
        );

        // Create the report with additional error handling
        report = await prisma.report.create({
          data: {
            ...baseReportData,
            planReportId: planReport.id,
          },
          include: {
            branch: true,
            planReport: true,
            actualReports: true,
          },
        });
      } else {
        // Double-check data before inserting
        console.log(
          "[DEBUG] Creating plan report with data:",
          JSON.stringify({
            date: baseReportData.date,
            branchId: baseReportData.branchId,
            reportType: baseReportData.reportType,
            // Don't log sensitive data
          }),
        );

        // Debug log: Check for null bytes and unexpected nulls in baseReportData
        const hasNullByte = JSON.stringify(baseReportData).includes("\u0000");

        // More thorough check for null bytes in all fields
        const stringFields = Object.entries(baseReportData)
          .filter(([_, v]) => typeof v === "string")
          .map(([k, v]) => ({
            field: k,
            hasNullByte: (v as string).includes("\u0000"),
            value: v,
          }));

        // We've disabled commentArray to avoid UTF-8 encoding issues
        const commentArrayCheck = {
          disabled: true,
          reason: "Disabled to avoid UTF-8 encoding issues",
        };

        console.log("DEBUG: baseReportData before create", {
          ...baseReportData,
          hasNullByte,
          nullFields: Object.entries(baseReportData).filter(
            ([_, v]) => v === null,
          ),
          stringFieldsCheck: stringFields,
          commentArrayCheck,
        });

        // Create the report with additional error handling
        report = await prisma.report.create({
          data: baseReportData,
          include: {
            branch: true,
            planReport: true,
            actualReports: true,
          },
        });
      }
    } catch (createError) {
      console.error("Error during report creation:", createError);

      // Debug log: Check error payload type and value
      if (typeof createError === "object" && createError !== null) {
        console.error("DEBUG: createError keys", Object.keys(createError));
        if ("payload" in createError) {
          console.error("DEBUG: createError.payload", createError.payload);
        }
      } else {
        console.error(
          "DEBUG: createError is not an object or is null",
          createError,
        );
      }

      // Check for specific PostgreSQL error codes
      if (createError instanceof Error) {
        const errorMessage = createError.message || "";

        // Check for UTF-8 encoding issues (PostgreSQL error code 22021)
        if (
          errorMessage.includes("22021") ||
          errorMessage.includes("invalid byte sequence for encoding")
        ) {
          console.error("UTF-8 encoding error detected in report data");

          // Try to identify which field has the issue
          let problematicField = "unknown";
          if (errorMessage.includes("comments")) {
            problematicField = "comments";
          } else if (errorMessage.includes("commentArray")) {
            problematicField = "commentArray";
          }

          return NextResponse.json(
            {
              error:
                "Invalid characters detected in the report data. Please remove any special characters or emojis and try again.",
              details: `The system detected invalid UTF-8 characters that cannot be stored in the database. The issue may be in the ${problematicField} field.`,
              field: problematicField,
            },
            { status: 400 },
          );
        }
      }

      // Re-throw to be caught by the outer catch block
      throw createError;
    }

    // Send notifications if report needs approval
    if (reportStatus === "pending_approval") {
      try {
        const notificationData = {
          reportId: report.id,
          branchId: report.branchId,
          branchName: branch?.name || "a branch",
          submitterName: submitter?.name || "A user",
          date: reportDate.toISOString().split("T")[0],
          writeOffs: Number(report.writeOffs),
          ninetyPlus: Number(report.ninetyPlus),
          reportType: report.reportType,
        };

        // Notify relevant users
        const targetUsers = await getUsersForNotification(
          NotificationType.REPORT_SUBMITTED,
          {
            branchId: report.branchId,
            submittedBy: token.sub as string,
            reportId: report.id,
          },
        );

        if (targetUsers.length > 0) {
          await sendToNotificationQueue({
            type: NotificationType.REPORT_SUBMITTED,
            data: notificationData,
            userIds: targetUsers,
          });
        }
      } catch (notificationError) {
        console.error(
          "Error sending notifications (non-critical):",
          notificationError,
        );
      }
    }

    // If there was an initial comment, create a ReportComment record
    if (initialComment) {
      try {
        // Sanitize the comment text to avoid UTF-8 encoding issues
        const sanitizedContent = sanitizeString(initialComment);

        if (sanitizedContent) {
          // Create a comment using the ReportComment model
          await prisma.reportComment.create({
            data: {
              reportId: report.id,
              userId: token.sub as string,
              content: sanitizedContent,
            },
          });

          console.log("[DEBUG] Created ReportComment for the initial comment");
        }
      } catch (commentError) {
        console.error(
          "Error creating initial ReportComment (non-critical):",
          commentError,
        );
        // We don't want to fail the report creation if the comment creation fails
      }
    }

    // Convert Decimal to number for JSON serialization
    const serializedReport: any = {
      ...report,
      writeOffs: Number(report.writeOffs),
      ninetyPlus: Number(report.ninetyPlus),
    };

    // Handle nested planReport if it exists
    if (report.planReport) {
      serializedReport.planReport = {
        ...report.planReport,
        writeOffs: Number(report.planReport.writeOffs),
        ninetyPlus: Number(report.planReport.ninetyPlus),
      };
    }

    // Broadcast the report submission via SSE for real-time updates
    if (reportStatus === "pending_approval") {
      try {
        broadcastDashboardUpdate(DashboardEventTypes.REPORT_SUBMITTED, {
          reportId: report.id,
          branchId: report.branchId,
          branchName: branch?.name || "Unknown Branch",
          status: reportStatus,
          writeOffs: Number(report.writeOffs),
          ninetyPlus: Number(report.ninetyPlus),
          date: reportDate.toISOString().split("T")[0],
          reportType: report.reportType,
          submittedBy: token.sub,
          submitterName: submitter?.name || "Unknown User",
        });
      } catch (sseError) {
        console.error("Error broadcasting SSE event (non-critical):", sseError);
      }
    }

    return NextResponse.json({
      message: "Report created successfully",
      data: serializedReport,
      notificationsSent: reportStatus === "pending_approval",
    });
  } catch (error) {
    console.error("Error creating report:", error);

    // Check for specific PostgreSQL error codes
    if (error instanceof Error) {
      const errorMessage = error.message || "";

      // Check for UTF-8 encoding issues (PostgreSQL error code 22021)
      if (
        errorMessage.includes("22021") ||
        errorMessage.includes("invalid byte sequence for encoding")
      ) {
        console.error("UTF-8 encoding error detected in report data");

        // Try to identify which field has the issue
        let problematicField = "unknown";
        if (errorMessage.includes("comments")) {
          problematicField = "comments";
        } else if (errorMessage.includes("commentArray")) {
          problematicField = "commentArray";
        }

        return NextResponse.json(
          {
            error:
              "Invalid characters detected in the report data. Please remove any special characters or emojis and try again.",
            details: `The system detected invalid UTF-8 characters that cannot be stored in the database. The issue may be in the ${problematicField} field.`,
            field: problematicField,
          },
          { status: 400 },
        );
      }

      // Check for unique constraint violations (PostgreSQL error code 23505)
      if (
        errorMessage.includes("23505") ||
        errorMessage.includes("unique constraint")
      ) {
        return NextResponse.json(
          { error: "A report already exists for this date, branch, and type" },
          { status: 400 },
        );
      }
    }

    // Generic error response for other cases
    return NextResponse.json(
      {
        error:
          "Failed to create report. Please try again or contact support if the issue persists.",
      },
      { status: 500 },
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
        { status: 401 },
      );
    }

    const body: UpdateReportData = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Report ID is required for update" },
        { status: 400 },
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
    const canAccessBranch = accessibleBranches.some(
      (b) => b.id === existingReport.branchId,
    );

    // Check if this is the user's own rejected report
    const isOwnReport = existingReport.submittedBy === token.sub;
    const isRejectedReport = existingReport.status === "rejected";
    const isOwnRejectedReport = isOwnReport && isRejectedReport;

    // Basic check: User must have access to the report's branch OR it must be their own rejected report
    if (!canAccessBranch && !isOwnRejectedReport) {
      console.log(
        "[REPORT PATCH] Branch access denied. User:",
        token.sub,
        "Role:",
        userRole,
        "Report Branch:",
        existingReport.branchId,
        "Accessible Branches:",
        accessibleBranches.map((b) => b.id),
        "Is Own Report:",
        isOwnReport,
        "Is Rejected Report:",
        isRejectedReport,
      );

      return NextResponse.json(
        {
          error: "Forbidden - You do not have access to this branch's reports",
        },
        { status: 403 },
      );
    }

    // More granular check: Can the user edit reports in general?
    // Or, if it's their own report and has edit permission for own reports?
    // Or if it's their own rejected report (users can always edit their rejected reports)
    console.log(
      "[REPORT PATCH] User:",
      token.sub,
      "Role:",
      userRole,
      "Has EDIT_REPORTS:",
      checkPermission(userRole, Permission.EDIT_REPORTS),
    );

    // Allow edit if:
    // 1. User has general EDIT_REPORTS permission, OR
    // 2. User has EDIT_OWN_REPORTS permission AND it's their own report, OR
    // 3. It's their own rejected report (special case)
    const canEditGenerally = checkPermission(userRole, Permission.EDIT_REPORTS);
    const canEditOwnReports =
      checkPermission(userRole, Permission.EDIT_OWN_REPORTS) && isOwnReport;
    const canEditRejectedReport = isOwnRejectedReport;

    if (!canEditGenerally && !canEditOwnReports && !canEditRejectedReport) {
      console.log(
        "[REPORT PATCH] Forbidden edit attempt. User:",
        token.sub,
        "Role:",
        userRole,
        "Report ID:",
        id,
        "SubmittedBy:",
        existingReport.submittedBy,
        "Status:",
        existingReport.status,
      );
      return NextResponse.json(
        { error: "Forbidden - You do not have permission to edit this report" },
        { status: 403 },
      );
    }

    // --- Handle Status Change (Approval/Rejection) --- Requires specific permission
    let statusChangeNotificationType: NotificationType | null = null;

    // If the report is rejected and the owner is editing it (not an approver),
    // automatically set status to pending_approval when they save changes
    if (
      existingReport.status === "rejected" &&
      existingReport.submittedBy === token.sub &&
      !checkPermission(userRole, Permission.APPROVE_REPORTS)
    ) {
      // Force status to pending_approval when user edits a rejected report
      updateData.status = "pending_approval";
      console.log("[REPORT PATCH] Auto-resubmitting rejected report:", id);
    }

    if (updateData.status && updateData.status !== existingReport.status) {
      // Special case: Allow users to resubmit their rejected reports
      const isResubmittingRejectedReport =
        existingReport.status === "rejected" &&
        updateData.status === "pending_approval" &&
        existingReport.submittedBy === token.sub;

      if (!isResubmittingRejectedReport) {
        // For all other status changes, only ADMIN can approve/reject reports
        if (userRole !== "ADMIN") {
          return NextResponse.json(
            { error: "Forbidden - Only admins can approve/reject reports" },
            { status: 403 },
          );
        }
      }

      // Determine notification type based on status change
      if (updateData.status === "approved") {
        statusChangeNotificationType = NotificationType.REPORT_APPROVED;
      } else if (updateData.status === "rejected") {
        statusChangeNotificationType = NotificationType.REPORT_REJECTED;
      } else if (isResubmittingRejectedReport) {
        // Add notification for resubmitted reports
        statusChangeNotificationType = NotificationType.REPORT_SUBMITTED;
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

    // Remove legacy comment fields from update data
    // Comments should now be handled through the ReportComment model
    if (prismaUpdateData.comments !== undefined) {
      console.log(
        "[DEPRECATED] Removing 'comments' field from update data. Use ReportComment model instead.",
      );
      delete prismaUpdateData.comments;
    }
    if (prismaUpdateData.commentArray !== undefined) {
      console.log(
        "[DEPRECATED] Removing 'commentArray' field from update data. Use ReportComment model instead.",
      );
      delete prismaUpdateData.commentArray;
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
    broadcastDashboardUpdate(DashboardEventTypes.REPORT_UPDATED, {
      reportId: updatedReport.id,
      branchId: updatedReport.branchId,
      status: updatedReport.status,
      // Include other fields that might affect dashboard aggregates
      writeOffs: Number(updatedReport.writeOffs),
      ninetyPlus: Number(updatedReport.ninetyPlus),
      date: new Date(updatedReport.date).toISOString().split("T")[0], // Convert Date to string
      reportType: updatedReport.reportType,
    });

    // --- Send Notifications for Status Change ---
    if (statusChangeNotificationType) {
      try {
        const targetUsers = await getUsersForNotification(
          statusChangeNotificationType,
          updatedReport.branch,
        );

        if (targetUsers.length > 0) {
          const notificationData = {
            reportId: updatedReport.id,
            reportDate: new Date(updatedReport.date)
              .toISOString()
              .split("T")[0], // Convert Date to string
            branchName: updatedReport.branch.name,
            status: updatedReport.status,
            actorName: token.name || "System",
            // Don't include comments in notification data anymore
            // Comments should be fetched from ReportComment model if needed
          };

          await sendToNotificationQueue({
            type: statusChangeNotificationType,
            data: notificationData,
            userIds: targetUsers,
          });
        }
      } catch (notificationError) {
        console.error(
          "Error sending status change notifications (non-critical):",
          notificationError,
        );
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
      { status: 500 },
    );
  }
}
