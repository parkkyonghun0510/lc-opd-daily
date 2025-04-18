"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { AuditAction, createServerAuditLog } from "@/lib/audit";
import { NotificationType } from "@/utils/notificationTemplates";
import { sendToNotificationQueue } from "@/lib/queue/sqs";
import { getUsersForNotification } from "@/utils/notificationTargeting";
import { hasBranchAccess } from "@/lib/auth/branch-access";
import { createDirectNotifications } from "@/utils/createDirectNotification";
import { Permission, UserRole, checkPermission } from "@/lib/auth/roles";

/**
 * Server action to approve or reject a report
 */
export async function approveReportAction(
  reportId: string,
  status: 'approved' | 'rejected',
  comments?: string,
  notifyUsers: boolean = true
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized - Authentication required"
      };
    }

    // Check if user has permission to approve reports
    const userRole = session.user.role as UserRole;
    if (!checkPermission(userRole, Permission.APPROVE_REPORTS)) {
      return {
        success: false,
        error: "Forbidden - You don't have permission to approve reports"
      };
    }

    if (!reportId) {
      return {
        success: false,
        error: "Report ID is required"
      };
    }

    if (!status || !["approved", "rejected"].includes(status)) {
      return {
        success: false,
        error: "Valid status (approved or rejected) is required"
      };
    }

    // If rejecting, comments are required
    if (status === "rejected" && !comments) {
      return {
        success: false,
        error: "Comments are required when rejecting a report"
      };
    }

    // Check if report exists
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        branch: true,
      },
    });

    if (!report) {
      return {
        success: false,
        error: "Report not found"
      };
    }

    // Only allow pending reports to be approved/rejected
    if (report.status !== "pending" && report.status !== "pending_approval") {
      return {
        success: false,
        error: `Report cannot be ${status}. Current status is: ${report.status}`
      };
    }

    // Check if user has access to this branch
    const hasAccess = await hasBranchAccess(session.user.id, report.branchId);
    if (!hasAccess) {
      return {
        success: false,
        error: "You don't have permission to approve reports for this branch"
      };
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

    // Transform Decimal fields to numbers before returning to client
    const transformedReport = {
      ...updatedReport,
      writeOffs: Number(updatedReport.writeOffs),
      ninetyPlus: Number(updatedReport.ninetyPlus),
    };

    // Get approver's name for notifications
    const approver = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, id: true }
    });

    const approverName = approver?.name || 'A manager';

    // Create an audit log entry for the approval/rejection
    try {
      const actionType = status === "approved"
        ? AuditAction.REPORT_APPROVED
        : AuditAction.REPORT_REJECTED;

      await createServerAuditLog({
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
    } catch (auditError) {
      console.error("Error creating audit log (non-critical):", auditError);
    }

    // Send notifications if enabled
    if (notifyUsers) {
      try {
        console.log(`Preparing to send notifications for report ${report.id}, status: ${status}`);

        const notificationType = status === "approved"
          ? NotificationType.REPORT_APPROVED
          : NotificationType.REPORT_REJECTED;
        const targetUsers = await getUsersForNotification(notificationType, {
          reportId: report.id,
          submittedBy: report.submittedBy,
          branchId: report.branchId,
          approverName,
          comments: comments || ""
        });

        console.log(`Found ${targetUsers.length} target users for notification`);
        if (targetUsers.length > 0) {
          console.log(`Target users: ${targetUsers.join(', ')}`);

          const queueData = {
            type: notificationType,
            data: {
              reportId: report.id,
              branchId: report.branchId,
              branchName: report.branch.name,
              approverName,
              comments: comments || ""
            },
            userIds: targetUsers
          };

          console.log(`Sending to notification queue:`, JSON.stringify(queueData, null, 2));

          let sqsSent = false;
          try {
            const result = await sendToNotificationQueue(queueData);
            console.log(`Notification sent to queue successfully:`, result);
            sqsSent = true;
          } catch (sqsError) {
            console.error("Error sending to SQS queue:", sqsError);
            // Continue to fallback method
          }

          // Fallback: Create notifications directly in database if SQS fails
          if (!sqsSent) {
            console.log("Using fallback: Creating notifications directly in database");

            try {
              // Generate title and body based on notification type
              let title = status === "approved" ? "Report Approved" : "Report Rejected";
              let body = status === "approved"
                ? `Your report has been approved by a manager.`
                : `Your report has been rejected${comments ? ` with reason: ${comments}` : ""}.`;
              let actionUrl = `/reports/${report.id}`;

              // Use the utility function to create direct notifications
              const result = await createDirectNotifications(
                notificationType,
                title,
                body,
                targetUsers,
                actionUrl,
                {
                  reportId: report.id,
                  branchId: report.branchId,
                  branchName: report.branch.name,
                  approverName,
                  comments: comments || "",
                  method: "fallback-server-action"
                }
              );

              console.log(`Successfully created ${result.count} direct notifications as fallback`);
            } catch (dbError) {
              console.error("Error creating direct notifications:", dbError);
            }
          }
        } else {
          console.log(`No target users found, skipping notification`);
        }
      } catch (notificationError) {
        console.error("Error sending notifications (non-critical):", notificationError);
      }
    }

    // Revalidate paths to update UI
    revalidatePath("/dashboard/reports");
    revalidatePath("/dashboard/reports/pending");
    revalidatePath(`/reports/${reportId}`);

    return {
      success: true,
      data: transformedReport,
      message: `Report ${status} successfully`
    };
  } catch (error) {
    console.error("Error processing report approval:", error);
    return {
      success: false,
      error: "Failed to process report approval"
    };
  }
}

/**
 * Server action to fetch pending reports for approval
 */
export async function fetchPendingReportsAction(type?: string) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized - Authentication required"
      };
    }

    const filter: any = {
      status: {
        in: ["pending", "pending_approval"]
      }
    };

    // Add type filter if specified
    if (type) {
      filter.reportType = type;
    }

    // Get all pending reports
    const reports = await prisma.report.findMany({
      where: filter,
      include: {
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

    // Transform Decimal fields to numbers for each report
    const transformedReports = reports.map(report => ({
      ...report,
      writeOffs: Number(report.writeOffs),
      ninetyPlus: Number(report.ninetyPlus),
    }));

    return {
      success: true,
      reports: transformedReports
    };
  } catch (error) {
    console.error("Error fetching pending reports:", error);
    return {
      success: false,
      error: "Failed to fetch pending reports"
    };
  }
}

/**
 * Server action to get report details
 */
export async function getReportDetailsAction(id: string) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        branch: true
      }
    });

    // Transform Decimal fields to numbers if report exists
    const transformedReport = report ? {
      ...report,
      writeOffs: Number(report.writeOffs),
      ninetyPlus: Number(report.ninetyPlus),
    } : null;

    if (!report) {
      return {
        success: false,
        error: "Report not found"
      };
    }

    return {
      success: true,
      report: transformedReport
    };
  } catch (error) {
    console.error("Error fetching report details:", error);
    return {
      success: false,
      error: "Failed to fetch report details"
    };
  }
}