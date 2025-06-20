import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { CommentItem } from "@/types/reports";
import { v4 as uuidv4 } from "uuid";
import { sanitizeString } from "@/utils/sanitize";

// POST /api/reports/[id]/comments - Add a comment to a report
// @deprecated - This endpoint is deprecated. Use /api/reports/[id]/report-comments instead.
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
    const reportId = pathParts[pathParts.length - 2]; // Get the ID from the URL path

    if (!reportId) {
      return NextResponse.json(
        { error: "Report ID is required" },
        { status: 400 },
      );
    }

    // Get the request body
    const body = await request.json();
    const { comment } = body;

    if (!comment || typeof comment !== "string" || comment.trim() === "") {
      return NextResponse.json(
        { error: "Comment text is required" },
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

    // Format the new comment with timestamp and username for legacy support
    const commentWithMeta = `[COMMENT ${timestamp} by ${commenterName}]: ${comment}`;

    // Add the comment to existing comments or create new comments (legacy format)
    const updatedComments = report.comments
      ? `${report.comments}\n\n${commentWithMeta}`
      : commentWithMeta;

    // Sanitize the comment text
    const sanitizedComment = sanitizeString(comment) || "";

    // Update the report with the legacy comments
    // This is for backward compatibility
    const updatedReport = await prisma.report.update({
      where: { id: reportId },
      data: {
        comments: sanitizeString(updatedComments), // Sanitize legacy comments
      },
    });

    // Also create a record in the ReportComment model (new approach)
    try {
      await prisma.reportComment.create({
        data: {
          reportId,
          userId: token.sub as string,
          content: sanitizeString(comment) || "",
        },
      });
      console.log(
        "[INFO] Created ReportComment record for backward compatibility",
      );
    } catch (commentError) {
      console.error(
        "Error creating ReportComment record (non-critical):",
        commentError,
      );
      // We don't want to fail the comment creation if this fails
    }

    return NextResponse.json({
      success: true,
      message:
        "Comment added successfully. Note: This endpoint is deprecated, please use /api/reports/[id]/report-comments instead.",
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    return NextResponse.json(
      { error: "Failed to add comment" },
      { status: 500 },
    );
  }
}
