import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { Permission, UserRole, checkPermission } from "@/lib/auth/roles";
import { AuditAction, createServerAuditLog } from "@/lib/audit";
import { NotificationType } from "@/utils/notificationTemplates";
import { sendToNotificationQueue } from "@/lib/queue/sqs";
import { getUsersForNotification } from "@/utils/notificationTargeting";
import { hasBranchAccess } from "@/lib/auth/branch-access";
import { createDirectNotifications } from "@/utils/createDirectNotification";
import { broadcastDashboardUpdate } from "@/lib/events/dashboard-broadcaster";
import { DashboardEventTypes } from "@/lib/events/dashboard-events";

import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";
import { sanitizeString } from "@/utils/sanitize";

// POST /api/reports/[id]/approve-hybrid - Approve or reject a report using hybrid realtime approach
export async function POST(
  request: NextRequest
) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    // Check if user has permission to approve reports
    const userRole = token.role as UserRole;
    if (!checkPermission(userRole, Permission.APPROVE_REPORTS)) {
      return NextResponse.json(
        { error: "Forbidden - You don't have permission to approve reports" },
        { status: 403 }
      );
    }

    // Extract the ID from the URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const reportId = pathParts[pathParts.length - 2]; // Get the ID from the URL path

    const { status, comments, notifyUsers = true } = await request.json();

    if (!reportId) {
      return NextResponse.json(
        { error: "Report ID is required" },
        { status: 400 }
      );
    }

    if (!status || !["approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Valid status (approved or rejected) is required" },
        { status: 400 }
      );
    }

    // If rejecting, comments are required
    if (status === "rejected" && !comments) {
      return NextResponse.json(
        { error: "Comments are required when rejecting a report" },
        { status: 400 }
      );
    }

    // Check if report exists
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        branch: true,
      },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    // Only allow pending reports to be approved/rejected
    if (report.status !== "pending" && report.status !== "pending_approval") {
      return NextResponse.json(
        {
          error: `Report cannot be ${status}. Current status is: ${report.status}`
        },
        { status: 400 }
      );
    }

    // Check if user has access to this branch
    const hasAccess = await hasBranchAccess(token.sub as string, report.branchId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "You don't have permission to approve reports for this branch" },
        { status: 403 }
      );
    }

    // Get approver name for the comment
    const approver = await prisma.user.findUnique({
      where: { id: token.sub as string },
      select: { name: true },
    });

    const approverName = approver?.name || "Unknown Approver";

    // Format the comment with metadata in conversation style
    const timestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");
    const commentWithMeta = status === "approved"
      ? `[COMMENT ${timestamp} by ${approverName}]: ${comments || "Report approved"}`
      : `[REJECTION ${timestamp}]: ${comments || "Report rejected"}`;

    // Create a structured comment for the commentArray
    const commentItem = {
      id: uuidv4(),
      text: comments || `Report ${status}`,
      userId: token.sub as string,
      userName: approverName,
      timestamp: new Date().toISOString(),
      type: status === "approved" ? "comment" : "rejection",
    };

    // Since we're removing commentArray, we'll just use the new comment
    const commentArray = [commentItem];

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
          userId: token.sub as string,
          content: sanitizedContent,
        }
      });
      console.log("[INFO] Created ReportComment record for report approval/rejection in hybrid mode");
    } catch (commentError) {
      console.error("Error creating ReportComment record (non-critical):", commentError);
      // We don't want to fail the approval process if this fails
    }

    // Create an audit log entry for the approval/rejection
    try {
      const actionType = status === "approved"
        ? AuditAction.REPORT_APPROVED
        : AuditAction.REPORT_REJECTED;

      await createServerAuditLog({
        userId: token.sub as string,
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
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
          userAgent: request.headers.get("user-agent") || "unknown",
        },
        type: "userActivity"
      });
    } catch (auditError) {
      console.error("Error creating audit log (non-critical):", auditError);
    }

    // Send notifications if enabled
    if (notifyUsers) {
      try {
        // Determine notification type based on status
        const notificationType = status === "approved"
          ? NotificationType.REPORT_APPROVED
          : NotificationType.REPORT_REJECTED;

        // Get users who should be notified
        const targetUsers = await getUsersForNotification(notificationType, {
          reportId: report.id,
          branchId: report.branchId,
          submitterId: report.submittedBy,
        });

        if (targetUsers.length > 0) {
          const queueData = {
            type: notificationType,
            data: {
              title: status === "approved" ? "Report Approved" : "Report Rejected",
              body: status === "approved"
                ? `Your report has been approved by ${approverName}.`
                : `Your report has been rejected${comments ? ` with reason: ${comments}` : ""} by ${approverName}.`,
              url: `/reports/${report.id}`,
              senderName: approverName,
              metadata: {
                reportId: report.id,
                branchId: report.branchId,
                branchName: report.branch.name,
                approverName,
                comments: comments || "",
                status: status,
                previousStatus: report.status,
                timestamp: new Date().toISOString(),
                reportDate: new Date(report.date).toISOString().split('T')[0],
                reportType: report.reportType,
                writeOffs: Number(report.writeOffs),
                ninetyPlus: Number(report.ninetyPlus)
              }
            },
            userIds: targetUsers,
            priority: "normal" as const,
            timestamp: new Date().toISOString()
          };

          let sqsSent = false;
          try {
            const result = await sendToNotificationQueue(queueData);
            sqsSent = true;
          } catch (sqsError) {
            console.error("Error sending to SQS queue:", sqsError);
            // Continue to fallback method
          }

          // If SQS failed, create direct notifications
          if (!sqsSent) {
            try {
              // Generate title and body based on notification type
              let title = status === "approved" ? "Report Approved" : "Report Rejected";
              let body = status === "approved"
                ? `Your report has been approved by a manager.`
                : `Your report has been rejected${comments ? ` with reason: ${comments}` : ""}.`;
              let actionUrl = `/reports/${report.id}`;

              await createDirectNotifications(
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
                  status: status,
                  previousStatus: report.status,
                  timestamp: new Date().toISOString(),
                  reportDate: new Date(report.date).toISOString().split('T')[0],
                  reportType: report.reportType,
                  writeOffs: Number(report.writeOffs),
                  ninetyPlus: Number(report.ninetyPlus),
                  method: "fallback-hybrid-route"
                }
              );
            } catch (directError) {
              console.error("Error creating direct notifications:", directError);
            }
          }
        }
      } catch (notificationError) {
        console.error("Error sending notifications (non-critical):", notificationError);
      }
    }

    // Broadcast the status change via hybrid realtime for real-time updates
    try {
      const eventType = DashboardEventTypes.REPORT_STATUS_UPDATED;

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
          approvedBy: token.sub,
          approverName: approverName,
          comments: comments || "",
          timestamp: new Date().toISOString()
        }
      );
    } catch (realtimeError) {
      console.error("Error broadcasting realtime event (non-critical):", realtimeError);
    }

    return NextResponse.json({
      success: true,
      message: `Report ${status} successfully`,
      data: updatedReport
    });
  } catch (error) {
    console.error("Error processing report approval:", error);
    return NextResponse.json(
      { error: "Failed to process report approval" },
      { status: 500 }
    );
  }
}
