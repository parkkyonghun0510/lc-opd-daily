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
import { CommentItem } from "@/types/reports";
import { v4 as uuidv4 } from "uuid";
import { sanitizeString } from "@/utils/sanitize";

// POST /api/reports/[id]/approve - Approve or reject a report
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    // Check if user has permission to approve reports
    const userRole = token.role as UserRole;
    if (!checkPermission(userRole, Permission.APPROVE_REPORTS)) {
      return NextResponse.json(
        { error: "Forbidden - You don't have permission to approve reports" },
        { status: 403 },
      );
    }

    // Extract the ID from the URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const reportId = pathParts[pathParts.length - 2]; // Get the ID from the URL path

    const { status, comments, notifyUsers = true } = await request.json();

    if (!reportId) {
      return NextResponse.json(
        { error: "Report ID is required" },
        { status: 400 },
      );
    }

    if (!status || !["approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Valid status (approved or rejected) is required" },
        { status: 400 },
      );
    }

    // If rejecting, comments are required
    if (status === "rejected" && !comments) {
      return NextResponse.json(
        { error: "Comments are required when rejecting a report" },
        { status: 400 },
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
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Only allow pending reports to be approved/rejected
    if (report.status !== "pending" && report.status !== "pending_approval") {
      return NextResponse.json(
        {
          error: `Report cannot be ${status}. Current status is: ${report.status}`,
        },
        { status: 400 },
      );
    }

    // Check if user has access to this branch
    const hasAccess = await hasBranchAccess(
      token.sub as string,
      report.branchId,
    );
    if (!hasAccess) {
      return NextResponse.json(
        {
          error: "You don't have permission to approve reports for this branch",
        },
        { status: 403 },
      );
    }

    // Get approver's name for notifications
    const approver = await prisma.user.findUnique({
      where: { id: token.sub as string },
      select: { name: true, id: true },
    });

    const approverName = approver?.name || "A manager";

    // Create timestamp for the comment
    const timestamp = new Date().toISOString();
    const formattedTimestamp = new Date().toLocaleString();

    // Format the comment for legacy support in conversation style
    const commentWithMeta =
      status === "approved"
        ? `[COMMENT ${formattedTimestamp} by ${approverName}]: ${comments || "Report approved"}`
        : `[REJECTION ${formattedTimestamp}]: ${comments || "Report rejected"}`;

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
        comments: sanitizeString(updatedComments), // Sanitize legacy comments
      },
    });

    // Create an audit log entry for the approval/rejection
    try {
      const actionType =
        status === "approved"
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
        type: "userActivity",
      });
    } catch (auditError) {
      console.error("Error creating audit log (non-critical):", auditError);
    }

    // Send notifications if enabled
    if (notifyUsers) {
      try {
        //console.log(`Preparing to send notifications for report ${report.id}, status: ${status}`);

        const notificationType =
          status === "approved"
            ? NotificationType.REPORT_APPROVED
            : NotificationType.REPORT_REJECTED;

        // Notify relevant users
        const targetUsers = await getUsersForNotification(notificationType, {
          reportId: updatedReport.id,
          submittedBy: updatedReport.submittedBy,
          branchId: updatedReport.branchId,
          approverName,
          comments,
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
              comments: comments || "",
            },
            userIds: targetUsers,
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
              let title =
                status === "approved" ? "Report Approved" : "Report Rejected";
              let body =
                status === "approved"
                  ? `Your report has been approved by ${approverName}.`
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
                  method: "fallback-api",
                },
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
        console.error(
          "Error sending notifications (non-critical):",
          notificationError,
        );
      }
    }

    // Broadcast the status change via SSE for real-time updates
    try {
      const eventType =
        status === "approved"
          ? DashboardEventTypes.REPORT_STATUS_UPDATED
          : DashboardEventTypes.REPORT_STATUS_UPDATED;

      broadcastDashboardUpdate(eventType, {
        reportId: report.id,
        branchId: report.branchId,
        branchName: report.branch.name,
        status: status,
        previousStatus: report.status,
        writeOffs: Number(report.writeOffs),
        ninetyPlus: Number(report.ninetyPlus),
        date: new Date(report.date).toISOString().split("T")[0],
        reportType: report.reportType,
        approvedBy: token.sub,
        approverName: approverName,
        comments: comments || "",
        timestamp: new Date().toISOString(),
      });
    } catch (sseError) {
      console.error("Error broadcasting SSE event (non-critical):", sseError);
    }

    return NextResponse.json({
      success: true,
      message: `Report ${status} successfully`,
      data: updatedReport,
    });
  } catch (error) {
    console.error("Error processing report approval:", error);
    return NextResponse.json(
      { error: "Failed to process report approval" },
      { status: 500 },
    );
  }
}
