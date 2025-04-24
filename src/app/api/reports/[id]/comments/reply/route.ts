import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { CommentItem } from "@/types/reports";
import { v4 as uuidv4 } from "uuid";
import { NotificationType } from "@/utils/notificationTemplates";
import { createDirectNotifications } from "@/utils/createDirectNotification";

// POST /api/reports/[id]/comments/reply - Add a reply to a comment
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

    // Extract the ID from the URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const reportId = pathParts[pathParts.length - 3]; // Get the report ID from the URL path

    if (!reportId) {
      return NextResponse.json(
        { error: "Report ID is required" },
        { status: 400 }
      );
    }

    // Get the request body
    const body = await request.json();
    const { comment, parentId } = body;

    if (!comment || typeof comment !== "string" || comment.trim() === "") {
      return NextResponse.json(
        { error: "Comment text is required" },
        { status: 400 }
      );
    }

    if (!parentId) {
      return NextResponse.json(
        { error: "Parent comment ID is required" },
        { status: 400 }
      );
    }

    // Check if report exists
    const report = await prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    // Get commenter's name for better display
    const user = await prisma.user.findUnique({
      where: { id: token.sub as string },
      select: { name: true }
    });

    const commenterName = user?.name || token.email || "User";
    const timestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");

    // Create a new reply object
    const newReply: CommentItem = {
      id: uuidv4(),
      type: 'reply',
      text: comment,
      timestamp: timestamp,
      userId: token.sub as string,
      userName: commenterName,
      parentId: parentId
    };

    // Get existing comment array or create a new one
    let commentArray = report.commentArray as CommentItem[] || [];

    // If commentArray is a string (JSON stringified), parse it
    if (typeof commentArray === 'string') {
      try {
        commentArray = JSON.parse(commentArray);
      } catch (e) {
        commentArray = [];
      }
    }

    // Add the new reply to the array
    commentArray.push(newReply);

    // Format the reply for legacy support
    const replyWithMeta = `[COMMENT ${timestamp} by ${commenterName}]: ${comment} (Reply)`;

    // Add the reply to existing comments or create new comments (legacy format)
    const updatedComments = report.comments
      ? `${report.comments}\n\n${replyWithMeta}`
      : replyWithMeta;

    // Update the report with both the legacy comments and the new comment array
    const updatedReport = await prisma.report.update({
      where: { id: reportId },
      data: {
        comments: updatedComments,
        commentArray: commentArray,
      },
      include: {
        branch: true
      }
    });

    // Find the parent comment to get the original commenter's ID
    const parentComment = commentArray.find(c => c.id === parentId);

    // Send notification to the original commenter if it's not the same user
    if (parentComment && parentComment.userId !== token.sub) {
      try {
        // Get the report details for the notification
        const reportDate = format(new Date(updatedReport.date), "yyyy-MM-dd");
        const branchName = updatedReport.branch.name;

        // Create a notification for the original commenter
        await createDirectNotifications({
          type: NotificationType.COMMENT_REPLY,
          targetUserIds: [parentComment.userId],
          metadata: {
            reportId: reportId,
            reportDate: reportDate,
            branchName: branchName,
            commenterName: commenterName,
            commentText: comment.substring(0, 50) + (comment.length > 50 ? '...' : '')
          }
        });
      } catch (error) {
        console.error("Error sending notification:", error);
        // Don't fail the request if notification fails
      }
    }

    return NextResponse.json({
      success: true,
      message: "Reply added successfully",
      reply: newReply
    });
  } catch (error) {
    console.error("Error adding reply:", error);
    return NextResponse.json(
      { error: "Failed to add reply" },
      { status: 500 }
    );
  }
}
