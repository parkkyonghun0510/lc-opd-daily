import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { sanitizeString } from "@/utils/sanitize";
import { rateLimiter } from "@/lib/rate-limit";

// DELETE /api/reports/[id]/report-comments/[commentId] - Delete a comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    const { id: reportId, commentId } = await params;

    // Get the existing comment
    const existingComment = await prisma.reportComment.findUnique({
      where: { id: commentId },
    });

    if (!existingComment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    // Check if the user is the comment author or an admin
    const isAuthor = existingComment.userId === token.sub;
    const isAdmin = token.role === "ADMIN";

    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { error: "You can only delete your own comments" },
        { status: 403 }
      );
    }

    // Apply rate limiting
    const userId = token.sub as string;
    const rateLimitResponse = await rateLimiter.applyRateLimit(request, {
      identifier: `delete_comment_${userId}`,
      limit: 10, // Maximum 10 comment deletions per minute
      window: 60 // Within a 60-second window
    });

    // If rate limited, return the response
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Delete the comment
    await prisma.reportComment.delete({
      where: { id: commentId },
    });

    return NextResponse.json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting report comment:", error);
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 }
    );
  }
}

// PATCH /api/reports/[id]/report-comments/[commentId] - Update a comment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    const { id: reportId, commentId } = await params;
    const { content } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: "Comment content is required" },
        { status: 400 }
      );
    }

    // Get the existing comment
    const existingComment = await prisma.reportComment.findUnique({
      where: { id: commentId },
    });

    if (!existingComment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    // Check if the user is the comment author or an admin
    const isAuthor = existingComment.userId === token.sub;
    const isAdmin = token.role === "ADMIN";

    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { error: "You can only edit your own comments" },
        { status: 403 }
      );
    }

    // Apply rate limiting
    const userId = token.sub as string;
    const rateLimitResponse = await rateLimiter.applyRateLimit(request, {
      identifier: `edit_comment_${userId}`,
      limit: 10, // Maximum 10 comment edits per minute
      window: 60 // Within a 60-second window
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
        { status: 400 }
      );
    }

    // Update the comment
    const updatedComment = await prisma.reportComment.update({
      where: { id: commentId },
      data: {
        content: sanitizedContent,
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

    return NextResponse.json({
      success: true,
      message: "Comment updated successfully",
      comment: updatedComment,
    });
  } catch (error) {
    console.error("Error updating report comment:", error);

    // Check for specific PostgreSQL error codes
    if (error instanceof Error) {
      const errorMessage = error.message || '';

      // Check for UTF-8 encoding issues (PostgreSQL error code 22021)
      if (errorMessage.includes('22021') || errorMessage.includes('invalid byte sequence for encoding')) {
        return NextResponse.json(
          {
            error: "Invalid characters detected in the comment. Please remove any special characters or emojis and try again.",
            details: "The system detected invalid UTF-8 characters that cannot be stored in the database."
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to update comment" },
      { status: 500 }
    );
  }
}
