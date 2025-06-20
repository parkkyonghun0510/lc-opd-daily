import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { sanitizeString } from "@/utils/sanitize";

// This is a test endpoint to verify that the ReportComment model works correctly
// GET /api/test-report-comments - Test creating a report and adding a comment
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    // Create a test report
    const testReport = await prisma.report.create({
      data: {
        date: new Date().toISOString(), // Convert Date to string
        branchId: "clsqnvnxs0000ufwxgxvx9yjl", // Replace with a valid branch ID
        writeOffs: 0,
        ninetyPlus: 0,
        reportType: "plan",
        status: "pending",
        submittedBy: token.sub as string,
        submittedAt: new Date().toISOString(), // Convert Date to string
      },
    });

    // Add a comment using the ReportComment model
    const comment = await prisma.reportComment.create({
      data: {
        reportId: testReport.id,
        userId: token.sub as string,
        content: "This is a test comment",
      },
    });

    // Fetch the report with comments
    const reportWithComments = await prisma.report.findUnique({
      where: { id: testReport.id },
      include: {
        ReportComment: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Test completed successfully",
      report: reportWithComments,
    });
  } catch (error) {
    console.error("Error in test endpoint:", error);
    return NextResponse.json(
      {
        error: "Test failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
