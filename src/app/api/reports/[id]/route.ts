import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { getToken } from "next-auth/jwt";

const prisma = new PrismaClient();

// Validation schema for report update
const updateReportSchema = z.object({
  writeOffs: z.number().min(0),
  ninetyPlus: z.number().min(0),
  comments: z.string().optional(),
});

// GET /api/reports/[id] - Get a specific report by ID
export async function GET(
  request: NextRequest
) {
  try {
    // Use NextAuth for authentication
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
    const id = pathParts[pathParts.length - 1]; // Get the ID from the URL path

    const report = await prisma.report.findUnique({
      where: {
        id,
      },
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        planReport: {
          select: {
            writeOffs: true,
            ninetyPlus: true,
            id: true
          }
        }
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // If this is an actual report, use the planReport relation
    const responseData = { ...report } as any;

    if (report.reportType === "actual") {
      if (report.planReport) {
        // Add plan data with proper type conversion
        responseData.writeOffsPlan = typeof report.planReport.writeOffs === 'number' ? report.planReport.writeOffs : 0;
        responseData.ninetyPlusPlan = typeof report.planReport.ninetyPlus === 'number' ? report.planReport.ninetyPlus : 0;
        responseData.planReportId = report.planReport.id;
      } else {
        // If no plan report is linked, try to find one (for backwards compatibility)
        const planReport = await prisma.report.findFirst({
          where: {
            date: report.date,
            branchId: report.branchId,
            reportType: "plan"
          }
        });

        if (planReport) {
          // Add plan data with proper type conversion
          responseData.writeOffsPlan = typeof planReport.writeOffs === 'number' ? planReport.writeOffs : 0;
          responseData.ninetyPlusPlan = typeof planReport.ninetyPlus === 'number' ? planReport.ninetyPlus : 0;
          responseData.planReportId = planReport.id;
          
          // Update the actual report to link it to the plan report
          await prisma.report.update({
            where: { id: report.id },
            data: { planReportId: planReport.id }
          });
        } else {
          // Set to null if no plan report found
          responseData.writeOffsPlan = null;
          responseData.ninetyPlusPlan = null;
          responseData.planReportId = null;
        }
      }
    }

    await prisma.activityLog.create({
      data: {
        action: "VIEW_REPORT",
        userId: token.id as string, // Cast to string since we know it exists
        details: `Viewed report for branch: ${report.branch.code} on ${
          report.date.toLocaleDateString()
        }`,
      },
    });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error retrieving report:", error);
    return NextResponse.json(
      { error: "Failed to retrieve report" },
      { status: 500 }
    );
  }
}

// PUT /api/reports/[id] - Update a specific report
export async function PUT(
  request: NextRequest
) {
  try {
    // Extract the ID from the URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1]; // Get the ID from the URL path

    // Get the user from the auth token
    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if the report exists
    const existingReport = await prisma.report.findUnique({
      where: { id },
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!existingReport) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Parse and validate the request body
    const body = await request.json();
    const validationResult = updateReportSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { writeOffs, ninetyPlus, comments } = validationResult.data;

    // Update the report
    const updatedReport = await prisma.report.update({
      where: { id },
      data: {
        writeOffs,
        ninetyPlus,
        comments,
        updatedAt: new Date(),
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        action: "UPDATE_REPORT",
        userId: token.id as string, // Cast to string since we know it exists
        details: `Updated report for branch: ${existingReport.branch.code} on ${
          existingReport.date.toLocaleDateString()
        }`,
      },
    });

    return NextResponse.json(updatedReport);
  } catch (error) {
    console.error("Error updating report:", error);
    return NextResponse.json(
      { error: "Failed to update report" },
      { status: 500 }
    );
  }
}

// DELETE /api/reports/[id] - Delete a specific report
export async function DELETE(
  request: NextRequest
) {
  try {
    // Extract the ID from the URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1]; // Get the ID from the URL path

    // Get the user from the auth token
    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if the report exists
    const existingReport = await prisma.report.findUnique({
      where: { id },
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!existingReport) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Delete the report
    await prisma.report.delete({
      where: { id },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        action: "DELETE_REPORT",
        userId: token.id as string, // Cast to string since we know it exists
        details: `Deleted report for branch: ${existingReport.branch.code} on ${
          existingReport.date.toLocaleDateString()
        }`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting report:", error);
    return NextResponse.json(
      { error: "Failed to delete report" },
      { status: 500 }
    );
  }
}
