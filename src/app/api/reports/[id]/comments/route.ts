import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

// POST /api/reports/[id]/comments - Add a comment to a report
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    const reportId = params.id;
    if (!reportId) {
      return NextResponse.json(
        { error: "Report ID is required" },
        { status: 400 }
      );
    }

    // Get the request body
    const body = await request.json();
    const { comment } = body;

    if (!comment || typeof comment !== "string" || comment.trim() === "") {
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

    // Get commenter's name for better display
    const user = await prisma.user.findUnique({
      where: { id: token.sub as string },
      select: { name: true }
    });

    const commenterName = user?.name || token.email || "User";
    const timestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");
    
    // Format the new comment with timestamp and username
    const commentWithMeta = `[COMMENT ${timestamp} by ${commenterName}]: ${comment}`;
    
    // Add the comment to existing comments or create new comments
    const updatedComments = report.comments 
      ? `${report.comments}\n\n${commentWithMeta}`
      : commentWithMeta;
      
    // Update the report with the new comments
    const updatedReport = await prisma.report.update({
      where: { id: reportId },
      data: {
        comments: updatedComments,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Comment added successfully"
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    return NextResponse.json(
      { error: "Failed to add comment" },
      { status: 500 }
    );
  }
} 