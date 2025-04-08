"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { AuditAction, createServerAuditLog } from "@/lib/audit";
import { NotificationType, sendReportStatusNotification } from "@/utils";
import { hasBranchAccess, getAccessibleBranches, checkBranchesAccess, getEnhancedBranchMaps } from "@/lib/auth/branch-access";
import { Permission, UserRole, checkPermission } from "@/lib/auth/roles";
import { isManager, isAdmin } from "@/lib/auth/helpers";

import {
  AuthError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
  tryCatch,
  tryNonCritical,
  handleActionError
} from "@/lib/errors";

/**
 * Server action to approve or reject a report
 * @param reportId The ID of the report to approve or reject
 * @param status The new status for the report ('approved' or 'rejected')
 * @param comments Optional comments to include with the approval/rejection
 * @param notifyUsers Whether to send notifications about this action
 * @returns Object containing success status, updated report data, and a message
 */
export async function approveReportAction(
  reportId: string,
  status: 'approved' | 'rejected',
  comments?: string,
  notifyUsers: boolean = true
) {
  return tryCatch(async () => {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      throw new AuthError("Authentication required");
    }

    // Check if user has permission to approve reports
    const userRole = session.user.role as UserRole;
    if (!checkPermission(userRole, Permission.APPROVE_REPORTS)) {
      throw new ForbiddenError("You don't have permission to approve reports");
    }

    if (!reportId) {
      throw new ValidationError("Report ID is required");
    }

    if (!status || !["approved", "rejected"].includes(status)) {
      throw new ValidationError("Valid status (approved or rejected) is required");
    }

    // If rejecting, comments are required
    if (status === "rejected" && !comments) {
      throw new ValidationError("Comments are required when rejecting a report");
    }

    // Check if report exists
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        branch: true,
      },
    });

    if (!report) {
      throw new NotFoundError("Report not found");
    }

    // Only allow pending reports to be approved/rejected
    if (report.status !== "pending" && report.status !== "pending_approval") {
      throw new ValidationError(
        `Report cannot be ${status}. Current status is: ${report.status}`
      );
    }

    // Check if user has access to this branch
    const hasAccess = await hasBranchAccess(session.user.id, report.branchId);
    if (!hasAccess) {
      throw new ForbiddenError("You don't have permission to approve reports for this branch");
    }

    // Update the report status
    const updatedReport = await prisma.report.update({
      where: { id: reportId },
      data: {
        status,
        // Store approval/rejection comments if provided
        comments: comments || report.comments,
      },
    });

    // Get approver's name and create audit log in parallel
    const [approver, auditLogResult] = await Promise.all([
      // Get approver's name for notifications
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, id: true }
      }),

      // Create an audit log entry for the approval/rejection (wrapped in a try-catch)
      tryNonCritical(
        async () => {
          const actionType = status === "approved"
            ? AuditAction.REPORT_APPROVED
            : AuditAction.REPORT_REJECTED;

          return await createServerAuditLog({
            userId: session.user.id,
            action: actionType,
            details: {
              reportId: report.id,
              branchId: report.branchId,
              branchName: report.branch.name,
              reportDate: report.date,
              reportType: report.reportType,
              comments: comments || "",
              previousStatus: report.status,
              newStatus: status,
            },
            requestInfo: {
              ipAddress: "server-action",
              userAgent: "server-action",
            },
            type: "userActivity"
          });
        },
        null,
        { operation: 'audit-log', reportId }
      )
    ]);

    const approverName = approver?.name || 'A manager';

    // Send notifications if enabled - using the specialized helper function
    if (notifyUsers) {
      await tryNonCritical(
        async () => {
          console.log(`Preparing to send notifications for report ${report.id}, status: ${status}`);

          // Use the specialized helper function for sending report status notifications
          const result = await sendReportStatusNotification(
            report.id,
            status as 'approved' | 'rejected',
            approverName,
            comments
          );

          console.log(`Notification result: ${result.success ? 'Success' : 'Failed'}, sent to ${result.count} users`);

          return { sent: result.success, count: result.count };
        },
        { sent: false, count: 0 },
        { operation: 'send-notifications', reportId }
      );
    }

    // Revalidate paths to update UI
    revalidatePath("/dashboard/reports");
    revalidatePath("/dashboard/reports/pending");
    revalidatePath(`/reports/${reportId}`);

    return {
      success: true,
      data: updatedReport,
      message: `Report ${status} successfully`
    };
  }, handleActionError);
}

/**
 * Server action to fetch pending reports for approval
 * Optimized to use efficient queries and in-memory branch access checks
 * @param type Optional report type filter
 * @returns Object containing success status and array of pending reports
 */
export async function fetchPendingReportsAction(type?: string) {
  return tryCatch(async () => {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      throw new AuthError("Authentication required");
    }

    // Get all branches the user has access to in a single optimized query
    const accessibleBranches = await getAccessibleBranches(session.user.id);

    // Extract branch IDs for filtering
    const branchIds = accessibleBranches.map((branch: { id: string }) => branch.id);

    if (branchIds.length === 0) {
      // User doesn't have access to any branches
      return {
        success: true,
        reports: []
      };
    }

    // Build filter with branch access and status conditions
    const filter: any = {
      status: {
        in: ["pending", "pending_approval"]
      },
      branchId: {
        in: branchIds
      }
    };

    // Add type filter if specified
    if (type) {
      filter.reportType = type;
    }

    // Get all pending reports with a single optimized query
    // Use select instead of include where possible to reduce data transfer
    const reports = await prisma.report.findMany({
      where: filter,
      select: {
        id: true,
        date: true,
        reportType: true,
        status: true,
        writeOffs: true,
        ninetyPlus: true,
        submittedBy: true,
        submittedAt: true,
        comments: true,
        branchId: true,
        branch: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return {
      success: true,
      reports
    };
  }, handleActionError);
}

/**
 * Server action to fetch multiple reports with batch access checking
 * Uses optimized in-memory branch access checks for efficient processing
 * @param reportIds Array of report IDs to fetch
 * @returns Object containing success status, accessible reports, and count information
 */
export async function fetchMultipleReportsAction(reportIds: string[]) {
  return tryCatch(async () => {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      throw new AuthError("Authentication required");
    }

    if (!reportIds || reportIds.length === 0) {
      return {
        success: true,
        reports: []
      };
    }

    // Get all reports in a single query
    const reports = await prisma.report.findMany({
      where: {
        id: {
          in: reportIds
        }
      },
      select: {
        id: true,
        date: true,
        reportType: true,
        status: true,
        writeOffs: true,
        ninetyPlus: true,
        submittedBy: true,
        submittedAt: true,
        comments: true,
        branchId: true,
        branch: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    if (reports.length === 0) {
      return {
        success: true,
        reports: []
      };
    }

    // Extract all branch IDs from the reports
    const branchIds = [...new Set(reports.map(report => report.branchId))];

    // Check access to all branches in a single operation
    const branchAccessMap = await checkBranchesAccess(session.user.id, branchIds);

    // Filter reports based on branch access
    const accessibleReports = reports.filter(report =>
      branchAccessMap.get(report.branchId) === true
    );

    return {
      success: true,
      reports: accessibleReports,
      totalFound: reports.length,
      accessibleCount: accessibleReports.length
    };
  }, handleActionError);
}

/**
 * Server action to get report details
 * Optimized to use efficient queries and in-memory branch access checks
 * @param id The ID of the report to fetch details for
 * @returns Object containing success status and report details
 */
export async function getReportDetailsAction(id: string) {
  return tryCatch(async () => {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      throw new AuthError("Authentication required");
    }

    // Use select instead of include to only get the fields we need
    const report = await prisma.report.findUnique({
      where: { id },
      select: {
        id: true,
        date: true,
        reportType: true,
        status: true,
        writeOffs: true,
        ninetyPlus: true,
        submittedBy: true,
        submittedAt: true,
        comments: true,
        branchId: true,
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            parentId: true
          }
        }
      }
    });

    if (!report) {
      throw new NotFoundError("Report not found");
    }

    // Check if user has access to this branch using optimized in-memory check
    const hasAccess = await hasBranchAccess(session.user.id, report.branchId);
    if (!hasAccess) {
      throw new ForbiddenError("You don't have permission to view this report");
    }

    return {
      success: true,
      report
    };
  }, handleActionError);
}
