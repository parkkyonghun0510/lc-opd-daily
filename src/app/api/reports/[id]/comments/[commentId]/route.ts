import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { CommentItem } from "@/types/reports";
import { sanitizeString, sanitizeCommentArray } from "@/utils/sanitize";

// Helper function to find and update a comment in the array
const findAndUpdateComment = (
  comments: CommentItem[],
  commentId: string,
  updateFn: (comment: CommentItem) => CommentItem | null
): { updatedComments: CommentItem[]; found: boolean; updatedComment: CommentItem | null } => {
  let found = false;
  let updatedComment: CommentItem | null = null;

  // Create a deep copy of the comments array
  const updatedComments = [...comments];

  // Helper function to recursively search and update comments
  const searchAndUpdate = (items: CommentItem[]): CommentItem[] => {
    return items.reduce((acc: CommentItem[], comment) => {
      if (comment.id === commentId) {
        found = true;
        const result = updateFn(comment);
        if (result) {
          updatedComment = result;
          acc.push(result);
        }
      } else {
        const updatedComment = { ...comment };
        if (updatedComment.replies && updatedComment.replies.length > 0) {
          updatedComment.replies = searchAndUpdate(updatedComment.replies);
        }
        acc.push(updatedComment);
      }
      return acc;
    }, []);
  };

  const result = searchAndUpdate(updatedComments);
  return { updatedComments: result, found, updatedComment };
};

// PATCH /api/reports/[id]/comments/[commentId] - Edit a comment
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

    if (!reportId || !commentId) {
      return NextResponse.json(
        { error: "Report ID and Comment ID are required" },
        { status: 400 }
      );
    }

    // Get the request body
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string" || text.trim() === "") {
      return NextResponse.json(
        { error: "Comment text is required" },
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

    // Get existing comment array
    let commentArray = report.commentArray as CommentItem[] || [];

    // If commentArray is a string (JSON stringified), parse it
    if (typeof commentArray === 'string') {
      try {
        commentArray = JSON.parse(commentArray);
      } catch (e) {
        commentArray = [];
      }
    }

    // Find and update the comment
    const { updatedComments, found, updatedComment } = findAndUpdateComment(
      commentArray,
      commentId,
      (comment) => {
        // Check if the user is the author of the comment
        if (comment.userId !== token.sub) {
          return null; // Not authorized to edit this comment
        }

        // Update the comment text
        return {
          ...comment,
          text: sanitizeString(text) || '', // Sanitize comment text
          // Add an edited flag or timestamp if desired
          edited: true,
          editedAt: format(new Date(), "yyyy-MM-dd HH:mm:ss")
        };
      }
    );

    if (!found) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    if (!updatedComment) {
      return NextResponse.json(
        { error: "You are not authorized to edit this comment" },
        { status: 403 }
      );
    }

    // Update the report with the modified comment array
    const updatedReport = await prisma.report.update({
      where: { id: reportId },
      data: {
        commentArray: sanitizeCommentArray(updatedComments), // Sanitize comment array
      },
    });

    return NextResponse.json({
      success: true,
      message: "Comment updated successfully",
      comment: updatedComment
    });
  } catch (error) {
    console.error("Error updating comment:", error);
    return NextResponse.json(
      { error: "Failed to update comment" },
      { status: 500 }
    );
  }
}

// DELETE /api/reports/[id]/comments/[commentId] - Delete a comment
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

    if (!reportId || !commentId) {
      return NextResponse.json(
        { error: "Report ID and Comment ID are required" },
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

    // Get existing comment array
    let commentArray = report.commentArray as CommentItem[] || [];

    // If commentArray is a string (JSON stringified), parse it
    if (typeof commentArray === 'string') {
      try {
        commentArray = JSON.parse(commentArray);
      } catch (e) {
        commentArray = [];
      }
    }

    // Find and remove the comment
    const { updatedComments, found, updatedComment } = findAndUpdateComment(
      commentArray,
      commentId,
      (comment) => {
        // Check if the user is the author of the comment
        if (comment.userId !== token.sub) {
          return null; // Not authorized to delete this comment
        }

        // Return null to remove the comment
        return null;
      }
    );

    if (!found) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    if (updatedComments.length === commentArray.length) {
      return NextResponse.json(
        { error: "You are not authorized to delete this comment" },
        { status: 403 }
      );
    }

    // Update the report with the modified comment array
    const updatedReport = await prisma.report.update({
      where: { id: reportId },
      data: {
        commentArray: sanitizeCommentArray(updatedComments), // Sanitize comment array
      },
    });

    return NextResponse.json({
      success: true,
      message: "Comment deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 }
    );
  }
}
