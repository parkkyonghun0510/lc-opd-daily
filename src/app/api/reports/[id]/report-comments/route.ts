import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { sanitizeString } from "@/utils/sanitize";
import { processCommentNotification } from "@/lib/notifications/reportCommentNotifications";
import { rateLimiter } from "@/lib/rate-limit";

// GET /api/reports/[id]/report-comments - Get all comments for a report
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    const { id: reportId } = await params;

    // Check if the report exists
    const report = await prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Get all comments for the report
    const comments = await prisma.reportComment.findMany({
      where: { reportId },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      comments,
    });
  } catch (error) {
    console.error("Error fetching report comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 },
    );
  }
}

// POST /api/reports/[id]/report-comments - Add a comment to a report
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    const { id: reportId } = await params;
    const { content, parentId } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: "Comment content is required" },
        { status: 400 },
      );
    }

    // Check if the report exists
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        branch: true,
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Apply rate limiting
    const userId = token.sub as string;
    const rateLimitResponse = await rateLimiter.applyRateLimit(request, {
      identifier: `comment_${userId}`,
      limit: 10, // Maximum 10 comments per minute
      window: 60, // Within a 60-second window
    });

    // If rate limited, return the response
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Sanitize the comment content
    const sanitizedContent = sanitizeString(content);

    if (!sanitizedContent) {
      return NextResponse.json(
        { error: "Comment content cannot be empty after sanitization" },
        { status: 400 },
      );
    }

    // Create a new comment
    const comment = await prisma.reportComment.create({
      data: {
        reportId,
        userId,
        content: sanitizedContent,
        parentId: parentId || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });

    // For backward compatibility, also update the legacy comments field
    // Format the new comment with timestamp and username
    const commenterName = comment.user?.name || token.email || "User";
    const timestamp = new Date().toISOString();
    const commentWithMeta = `[COMMENT ${timestamp} by ${commenterName}]: ${sanitizedContent}`;

    // Add the comment to existing comments or create new comments (legacy format)
    const updatedComments = report.comments
      ? `${report.comments}\n\n${commentWithMeta}`
      : commentWithMeta;

    // Update the report with the legacy comments
    await prisma.report.update({
      where: { id: reportId },
      data: {
        comments: sanitizeString(updatedComments), // Sanitize legacy comments
      },
    });

    // Process notification for the new comment
    try {
      // Convert Date objects to strings for the notification system
      const commentForNotification = {
        ...comment,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
      };

      const notificationId = await processCommentNotification(
        commentForNotification,
        reportId,
      );
      if (notificationId) {
        console.log(`Notification sent for comment: ${notificationId}`);
      }
    } catch (notificationError) {
      console.error("Error sending comment notification:", notificationError);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      success: true,
      message: "Comment added successfully",
      comment,
    });
  } catch (error) {
    console.error("Error adding report comment:", error);

    // Check for specific PostgreSQL error codes
    if (error instanceof Error) {
      const errorMessage = error.message || "";

      // Check for UTF-8 encoding issues (PostgreSQL error code 22021)
      if (
        errorMessage.includes("22021") ||
        errorMessage.includes("invalid byte sequence for encoding")
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid characters detected in the comment. Please remove any special characters or emojis and try again.",
            details:
              "The system detected invalid UTF-8 characters that cannot be stored in the database.",
          },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to add comment" },
      { status: 500 },
    );
  }
}
