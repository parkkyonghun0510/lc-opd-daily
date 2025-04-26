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
import { broadcastDashboardUpdate } from "@/lib/events/dashboard-broadcaster";
import { DashboardEventTypes } from "@/lib/events/dashboard-events";
import { format } from "date-fns";
import { sanitizeString } from "@/utils/sanitize";

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

    // Get approver's name for notifications
    const approver = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, id: true }
    });

    const approverName = approver?.name || 'A manager';

    // Format the comment for legacy support in conversation style
    const timestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");
    const commentWithMeta = status === "approved"
      ? `[COMMENT ${timestamp} by ${approverName}]: ${comments || "Report approved"}`
      : `[REJECTION ${timestamp}]: ${comments || "Report rejected"}`;

    // Add the comment to existing comments or create new comments (legacy format)
    const updatedComments = report.comments
      ? `${report.comments}\n\n${commentWithMeta}`
      : commentWithMeta;

    // Update the report status
    const updatedReport = await prisma.report.update({
      where: { id: reportId },
      data: {
        status,
        // Store approval/rejection comments if provided
        comments: sanitizeString(updatedComments),
      },
    });

    // Also create a record in the ReportComment model (new approach)
    try {
      // Create a more descriptive comment message
      let commentMessage = "";
      if (status === "approved") {
        commentMessage = comments ?
          `Approved: ${comments}` :
          "Report has been approved";
      } else {
        commentMessage = comments ?
          `Rejected: ${comments}` :
          "Report has been rejected";
      }

      const sanitizedContent = sanitizeString(commentMessage) || '';

      await prisma.reportComment.create({
        data: {
          reportId,
          userId: session.user.id,
          content: sanitizedContent,
        }
      });
      console.log("[INFO] Created ReportComment record for report approval/rejection");
    } catch (commentError) {
      console.error("Error creating ReportComment record (non-critical):", commentError);
      // We don't want to fail the approval process if this fails
    }

    // Transform Decimal fields to numbers before returning to client
    const transformedReport = {
      ...updatedReport,
      writeOffs: Number(updatedReport.writeOffs),
      ninetyPlus: Number(updatedReport.ninetyPlus),
    };

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
        //console.log(`Preparing to send notifications for report ${report.id}, status: ${status}`);

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

        //console.log(`Found ${targetUsers.length} target users for notification`);
        if (targetUsers.length > 0) {
          //console.log(`Target users: ${targetUsers.join(', ')}`);

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

          //console.log(`Sending to notification queue:`, JSON.stringify(queueData, null, 2));

          let sqsSent = false;
          try {
            const result = await sendToNotificationQueue(queueData);
            //console.log(`Notification sent to queue successfully:`, result);
            sqsSent = true;
          } catch (sqsError) {
            console.error("Error sending to SQS queue:", sqsError);
            // Continue to fallback method
          }

          // Fallback: Create notifications directly in database if SQS fails
          if (!sqsSent) {
            //console.log("Using fallback: Creating notifications directly in database");

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

              //console.log(`Successfully created ${result.count} direct notifications as fallback`);
            } catch (dbError) {
              console.error("Error creating direct notifications:", dbError);
            }
          }
        } else {
          //console.log(`No target users found, skipping notification`);
        }
      } catch (notificationError) {
        console.error("Error sending notifications (non-critical):", notificationError);
      }
    }

    // Broadcast the status change via SSE for real-time updates
    try {
      const eventType = status === "approved"
        ? DashboardEventTypes.REPORT_STATUS_UPDATED
        : DashboardEventTypes.REPORT_STATUS_UPDATED;

      broadcastDashboardUpdate(
        eventType,
        {
          reportId: report.id,
          branchId: report.branchId,
          branchName: report.branch.name,
          status: status,
          previousStatus: report.status,
          writeOffs: Number(report.writeOffs),
          ninetyPlus: Number(report.ninetyPlus),
          date: new Date(report.date).toISOString().split('T')[0],
          reportType: report.reportType,
          approvedBy: session.user.id,
          approverName: approverName,
          comments: comments || "",
          timestamp: new Date().toISOString()
        }
      );
    } catch (sseError) {
      console.error("Error broadcasting SSE event (non-critical):", sseError);
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
 * Server action to fetch reports for approval with flexible status filtering
 */
export async function fetchPendingReportsAction(status?: string, includeRejected: boolean = true) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized - Authentication required"
      };
    }

    // Define statuses to include based on the status parameter
    let statusFilter: any = {};

    if (status === "all") {
      // Include all relevant statuses for the approvals page
      statusFilter = {
        in: ["pending", "pending_approval", "approved", "rejected"]
      };
    } else if (status && status !== "pending") {
      // Use the specific status if provided
      statusFilter = status;
    } else {
      // Default behavior - include pending and pending_approval
      const statuses = ["pending", "pending_approval"];

      // Include rejected reports if requested
      if (includeRejected) {
        statuses.push("rejected");
      }

      statusFilter = {
        in: statuses
      };
    }

    const filter: any = {
      status: statusFilter
    };

    // Get reports based on the filter
    const reports = await prisma.report.findMany({
      where: filter,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        ReportComment: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        planReport: true,
        actualReports: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get all unique submitter IDs
    const submitterIds = [...new Set(reports.map(report => report.submittedBy))];

    // Fetch all users in a single query for efficiency
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: submitterIds
        }
      },
      select: {
        id: true,
        name: true,
        username: true
      }
    });

    // Create a map for quick user lookup
    const userMap = new Map(users.map(user => [user.id, user]));

    // Transform Decimal fields to numbers for each report and add user data
    const transformedReports = reports.map(report => {
      // Get user data from the map
      const userData = userMap.get(report.submittedBy) || null;

      // Process planReport if it exists
      const processedPlanReport = report.planReport ? {
        ...report.planReport,
        writeOffs: Number(report.planReport.writeOffs),
        ninetyPlus: Number(report.planReport.ninetyPlus),
      } : null;

      // Process actualReports if they exist
      const processedActualReports = report.actualReports ?
        report.actualReports.map(actualReport => ({
          ...actualReport,
          writeOffs: Number(actualReport.writeOffs),
          ninetyPlus: Number(actualReport.ninetyPlus),
        })) : null;

      return {
        ...report,
        writeOffs: Number(report.writeOffs),
        ninetyPlus: Number(report.ninetyPlus),
        // Ensure dates are properly formatted as strings for consistent handling
        date: report.date.toString(),
        submittedAt: report.createdAt,
        // Add user data to the report
        user: userData,
        // Add processed related reports
        planReport: processedPlanReport,
        actualReports: processedActualReports
      };
    });

    return {
      success: true,
      reports: transformedReports
    };
  } catch (error) {
    console.error("Error fetching reports:", error);
    return {
      success: false,
      error: "Failed to fetch reports"
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
        branch: true,
        ReportComment: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        planReport: true,
        actualReports: true
      }
    });

    // Transform Decimal fields to numbers if report exists
    const transformedReport = report ? {
      ...report,
      writeOffs: Number(report.writeOffs),
      ninetyPlus: Number(report.ninetyPlus),
      // Process related reports if they exist
      planReport: report.planReport ? {
        ...report.planReport,
        writeOffs: Number(report.planReport.writeOffs),
        ninetyPlus: Number(report.planReport.ninetyPlus),
      } : null,
      actualReports: report.actualReports ?
        report.actualReports.map(actualReport => ({
          ...actualReport,
          writeOffs: Number(actualReport.writeOffs),
          ninetyPlus: Number(actualReport.ninetyPlus),
        })) : null,
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

/**
 * Server action to fetch approval history from audit logs
 */
export async function fetchApprovalHistoryAction({
  page = 1,
  limit = 10,
  branchId,
  reportType,
  status,
  dateRange,
  searchTerm
}: {
  page?: number;
  limit?: number;
  branchId?: string;
  reportType?: string;
  status?: string;
  dateRange?: { from?: Date; to?: Date };
  searchTerm?: string;
}) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized - Authentication required"
      };
    }

    // Check if user has permission to view approval history
    const userRole = session.user.role as UserRole;
    if (!checkPermission(userRole, Permission.APPROVE_REPORTS)) {
      return {
        success: false,
        error: "Forbidden - You don't have permission to view approval history"
      };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build the where condition for UserActivity
    const where: any = {
      action: {
        in: [AuditAction.REPORT_APPROVED, AuditAction.REPORT_REJECTED]
      }
    };

    // Add search filter if provided
    if (searchTerm) {
      where.OR = [
        {
          details: {
            path: ['branchName'],
            string_contains: searchTerm
          }
        },
        {
          user: {
            name: {
              contains: searchTerm,
              mode: 'insensitive'
            }
          }
        }
      ];
    }

    // Add branch filter if provided
    if (branchId) {
      where.details = {
        ...where.details,
        path: ['branchId'],
        equals: branchId
      };
    }

    // Add report type filter if provided
    if (reportType) {
      where.details = {
        ...where.details,
        path: ['reportType'],
        equals: reportType
      };
    }

    // Add status filter if provided
    if (status) {
      where.action = status === 'approved'
        ? AuditAction.REPORT_APPROVED
        : AuditAction.REPORT_REJECTED;
    }

    // Add date range filter if provided
    if (dateRange?.from || dateRange?.to) {
      where.createdAt = {};

      if (dateRange.from) {
        where.createdAt.gte = dateRange.from;
      }

      if (dateRange.to) {
        where.createdAt.lte = dateRange.to;
      }
    }

    // Get approval history from UserActivity
    const [activities, totalCount] = await Promise.all([
      prisma.userActivity.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.userActivity.count({ where }),
    ]);

    // Process the activities to extract report details
    const approvalHistory = activities.map(activity => {
      const details = activity.details as any;
      return {
        id: activity.id,
        reportId: details.reportId || '',
        branchId: details.branchId || '',
        branchName: details.branchName || 'Unknown Branch',
        reportDate: details.reportDate || '',
        reportType: details.reportType || '',
        status: activity.action === AuditAction.REPORT_APPROVED ? 'approved' : 'rejected',
        comments: details.comments || '',
        approvedBy: activity.userId,
        approverName: activity.user?.name || 'Unknown User',
        timestamp: activity.createdAt,
      };
    });

    return {
      success: true,
      approvalHistory,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  } catch (error) {
    console.error("Error fetching approval history:", error);
    return {
      success: false,
      error: "Failed to fetch approval history"
    };
  }
}