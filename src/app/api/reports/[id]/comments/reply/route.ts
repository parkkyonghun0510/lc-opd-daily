import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { CommentItem } from "@/types/reports";
import { v4 as uuidv4 } from "uuid";
import { NotificationType } from "@/utils/notificationTemplates";
import { createDirectNotifications } from "@/utils/createDirectNotification";
import { sanitizeString } from "@/utils/sanitize";

// POST /api/reports/[id]/comments/reply - Add a reply to a comment
// @deprecated - This endpoint is deprecated. Use /api/reports/[id]/report-comments instead with a parentId parameter.
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    // Extract the ID from the URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const reportId = pathParts[pathParts.length - 3]; // Get the report ID from the URL path

    if (!reportId) {
      return NextResponse.json(
        { error: "Report ID is required" },
        { status: 400 },
      );
    }

    // Get the request body
    const body = await request.json();
    const { comment, parentId } = body;

    if (!comment || typeof comment !== "string" || comment.trim() === "") {
      return NextResponse.json(
        { error: "Comment text is required" },
        { status: 400 },
      );
    }

    if (!parentId) {
      return NextResponse.json(
        { error: "Parent comment ID is required" },
        { status: 400 },
      );
    }

    // Check if report exists
    const report = await prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Get commenter's name for better display
    const user = await prisma.user.findUnique({
      where: { id: token.sub as string },
      select: { name: true },
    });

    const commenterName = user?.name || token.email || "User";
    const timestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");

    // Sanitize the comment text
    const sanitizedComment = sanitizeString(comment) || "";

    // Format the reply for legacy support
    const replyWithMeta = `[COMMENT ${timestamp} by ${commenterName}]: ${comment} (Reply)`;

    // Add the reply to existing comments or create new comments (legacy format)
    const updatedComments = report.comments
      ? `${report.comments}\n\n${replyWithMeta}`
      : replyWithMeta;

    // Update the report with the legacy comments
    // This is for backward compatibility
    const updatedReport = await prisma.report.update({
      where: { id: reportId },
      data: {
        comments: sanitizeString(updatedComments), // Sanitize legacy comments
      },
      include: {
        branch: true,
      },
    });

    // Also create a record in the ReportComment model (new approach)
    try {
      await prisma.reportComment.create({
        data: {
          reportId,
          userId: token.sub as string,
          content:
            sanitizeString(`Reply to comment ${parentId}: ${comment}`) || "",
        },
      });
      console.log(
        "[INFO] Created ReportComment record for reply (backward compatibility)",
      );
    } catch (commentError) {
      console.error(
        "Error creating ReportComment record for reply (non-critical):",
        commentError,
      );
      // We don't want to fail the reply creation if this fails
    }

    // Since we're removing commentArray, we can't find the parent comment
    // We'll just skip the notification for now
    if (false) {
      try {
        // Get the report details for the notification
        const reportDate = format(new Date(updatedReport.date), "yyyy-MM-dd");
        const branchName = updatedReport.branch.name;

        // Since we're removing commentArray, we'll skip the notification for now
      } catch (error) {
        console.error("Error sending notification:", error);
        // Don't fail the request if notification fails
      }
    }

    return NextResponse.json({
      success: true,
      message:
        "Reply added successfully. Note: This endpoint is deprecated, please use /api/reports/[id]/report-comments instead.",
    });
  } catch (error) {
    console.error("Error adding reply:", error);
    return NextResponse.json({ error: "Failed to add reply" }, { status: 500 });
  }
}
