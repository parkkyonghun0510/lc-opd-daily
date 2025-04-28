import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { sanitizeString } from "@/utils/sanitize";

// GET /api/reports/[id]/report-comments - Get all comments for a report
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    const reportId = await params.id;

    // Check if the report exists
    const report = await prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    // Get all comments for the report, including user information
    const comments = await prisma.reportComment.findMany({
      where: { reportId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      comments,
    });
  } catch (error) {
    console.error("Error fetching report comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch report comments" },
      { status: 500 }
    );
  }
}

// POST /api/reports/[id]/report-comments - Add a comment to a report
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    const reportId = params.id;
    const { content } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: "Comment content is required" },
        { status: 400 }
      );
    }

    // Check if the report exists
    const report = await prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
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

    // Create a new comment
    const comment = await prisma.reportComment.create({
      data: {
        reportId,
        userId: token.sub as string,
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
      message: "Comment added successfully",
      comment,
    });
  } catch (error) {
    console.error("Error adding report comment:", error);

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
      { error: "Failed to add comment" },
      { status: 500 }
    );
  }
}
