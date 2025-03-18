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
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // Access the id from the context params
    const id = context.params.id;

    // Use NextAuth for authentication
    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    await prisma.activityLog.create({
      data: {
        action: "VIEW_REPORT",
        userId: token.id as string, // Cast to string since we know it exists
        details: `Viewed report for branch: ${report.branch.code} on ${
          new Date(report.date).toISOString().split("T")[0]
        }`,
      },
    });

    return NextResponse.json(report);
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
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // Get the report ID from the URL
    const id = context.params.id;

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
          new Date(existingReport.date).toISOString().split("T")[0]
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
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // Get the report ID from the URL
    const id = context.params.id;

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
          new Date(existingReport.date).toISOString().split("T")[0]
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
