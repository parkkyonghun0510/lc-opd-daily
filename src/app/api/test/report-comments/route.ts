import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { sanitizeString } from "@/utils/sanitize";

// This is a test endpoint to verify that the ReportComment model works correctly
// GET /api/test/report-comments - Test the ReportComment implementation
export async function GET(request: NextRequest) {
  try {
    // For testing purposes, we'll use a hardcoded user ID
    const testUserId = "cm9wuvcl9000etqtkvqj1ol2q"; // Use the ID of the user we created

    // Step 1: First create a test branch if it doesn't exist
    console.log("Creating test branch if needed...");
    let branch;
    try {
      // Try to find an existing branch
      branch = await prisma.branch.findFirst();

      // If no branch exists, create one
      if (!branch) {
        branch = await prisma.branch.create({
          data: {
            code: "TEST",
            name: "Test Branch",
            isActive: true
          }
        });
        console.log("Created test branch:", branch.id);
      } else {
        console.log("Using existing branch:", branch.id);
      }
    } catch (error) {
      console.error("Error creating/finding branch:", error);
      throw error;
    }

    // Step 2: Create a test report using the branch
    console.log("Creating test report...");
    // Generate a random date to avoid unique constraint errors
    const randomDate = new Date();
    randomDate.setDate(randomDate.getDate() + Math.floor(Math.random() * 365));

    const testReport = await prisma.report.create({
      data: {
        date: randomDate,
        branchId: branch.id,
        writeOffs: 0,
        ninetyPlus: 0,
        reportType: "plan",
        status: "pending",
        submittedBy: testUserId,
        submittedAt: new Date(),
      },
    });
    console.log("Test report created:", testReport.id);

    // Step 3: Add a comment using the ReportComment model
    console.log("Adding test comment...");
    const comment = await prisma.reportComment.create({
      data: {
        reportId: testReport.id,
        userId: testUserId,
        content: "This is a test comment using the ReportComment model",
      },
    });
    console.log("Test comment added:", comment.id);

    // Step 3: Fetch the report with comments
    console.log("Fetching report with comments...");
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
    console.log("Report fetched with comments:", reportWithComments?.ReportComment?.length);

    // Step 4: Add a comment with special characters to test UTF-8 handling
    console.log("Testing UTF-8 handling with special characters...");
    try {
      const specialCharsComment = await prisma.reportComment.create({
        data: {
          reportId: testReport.id,
          userId: testUserId,
          content: "Testing special characters: 😀 🌟 ñ é ü ç 你好 こんにちは",
        },
      });
      console.log("Special characters comment added successfully:", specialCharsComment.id);
    } catch (error) {
      console.error("Error adding special characters comment:", error);
      return NextResponse.json({
        success: false,
        message: "Test failed at special characters step",
        error: error instanceof Error ? error.message : "Unknown error",
        report: reportWithComments,
      });
    }

    // Step 5: Fetch the report again to verify all comments
    console.log("Fetching report with all comments...");
    const finalReport = await prisma.report.findUnique({
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
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });
    console.log("Final report fetched with comments:", finalReport?.ReportComment?.length);

    return NextResponse.json({
      success: true,
      message: "Test completed successfully",
      report: finalReport,
    });
  } catch (error) {
    console.error("Error in test endpoint:", error);
    return NextResponse.json(
      { error: "Test failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
