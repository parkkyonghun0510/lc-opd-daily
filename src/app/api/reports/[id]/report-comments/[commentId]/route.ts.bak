import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { sanitizeString } from "@/utils/sanitize";
import { Permission, UserRole, checkPermission } from "@/lib/auth/roles";

// GET /api/reports/[id]/report-comments/[commentId] - Get a specific comment
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    const { id: reportId, commentId } = params;

    // Get the comment with user information
    const comment = await prisma.reportComment.findUnique({
      where: { id: commentId },
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

    if (!comment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    // Verify the comment belongs to the specified report
    if (comment.reportId !== reportId) {
      return NextResponse.json(
        { error: "Comment does not belong to the specified report" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      comment,
    });
  } catch (error) {
    console.error("Error fetching report comment:", error);
    return NextResponse.json(
      { error: "Failed to fetch report comment" },
      { status: 500 }
    );
  }
}

// PATCH /api/reports/[id]/report-comments/[commentId] - Update a comment
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    const { id: reportId, commentId } = params;
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

    // Verify the comment belongs to the specified report
    if (existingComment.reportId !== reportId) {
      return NextResponse.json(
        { error: "Comment does not belong to the specified report" },
        { status: 400 }
      );
    }

    // Check if the user is the author of the comment or has admin privileges
    const userRole = token.role as UserRole;
    const isAdmin = userRole === "ADMIN";
    const isAuthor = existingComment.userId === token.sub;

    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { error: "You do not have permission to edit this comment" },
        { status: 403 }
      );
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

// DELETE /api/reports/[id]/report-comments/[commentId] - Delete a comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    const { id: reportId, commentId } = params;

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

    // Verify the comment belongs to the specified report
    if (existingComment.reportId !== reportId) {
      return NextResponse.json(
        { error: "Comment does not belong to the specified report" },
        { status: 400 }
      );
    }

    // Check if the user is the author of the comment or has admin privileges
    const userRole = token.role as UserRole;
    const isAdmin = userRole === "ADMIN";
    const isAuthor = existingComment.userId === token.sub;

    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { error: "You do not have permission to delete this comment" },
        { status: 403 }
      );
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
