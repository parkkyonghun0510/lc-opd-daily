import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { getUserFromToken } from "@/lib/jwt";

const prisma = new PrismaClient();

// Validation schema for report update
const updateReportSchema = z.object({
  writeOffs: z.number().min(0),
  ninetyPlus: z.number().min(0),
  comments: z.string().optional(),
});

// GET /api/reports/[id] - Get a specific report by ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getUserFromToken(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const report = await prisma.report.findUnique({
      where: {
        id: params.id,
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
        userId: authUser.userId,
        details: `Viewed report for branch: ${report.branch.code} on ${
          new Date(report.date).toISOString().split("T")[0]
        }`,
      },
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error("Error fetching report:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PUT /api/reports/[id] - Update a specific report
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Get the user from the auth token
    const authUser = await getUserFromToken(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the existing report
    const existingReport = await prisma.report.findUnique({
      where: {
        id: params.id,
      },
    });

    if (!existingReport) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Parse and validate the request body
    const body = await request.json();
    const validatedData = updateReportSchema.parse(body);

    // Update the report
    const updatedReport = await prisma.report.update({
      where: {
        id: params.id,
      },
      data: {
        writeOffs: validatedData.writeOffs,
        ninetyPlus: validatedData.ninetyPlus,
        comments: validatedData.comments,
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

    // Create activity log
    await prisma.activityLog.create({
      data: {
        action: "UPDATE_REPORT",
        userId: authUser.userId,
        details: `Updated report for branch: ${updatedReport.branch.code} on ${
          new Date(updatedReport.date).toISOString().split("T")[0]
        }`,
      },
    });

    return NextResponse.json(updatedReport);
  } catch (error) {
    console.error("Error updating report:", error);
    return NextResponse.json(
      {
        error: "Failed to update report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/reports/[id] - Delete a specific report
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Get the user from the auth token
    const authUser = await getUserFromToken(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the existing report for logging
    const existingReport = await prisma.report.findUnique({
      where: {
        id: params.id,
      },
      include: {
        branch: {
          select: {
            code: true,
          },
        },
      },
    });

    if (!existingReport) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Delete the report
    await prisma.report.delete({
      where: {
        id: params.id,
      },
    });

    // Create activity log
    await prisma.activityLog.create({
      data: {
        action: "DELETE_REPORT",
        userId: authUser.userId,
        details: `Deleted report for branch: ${existingReport.branch.code} on ${
          new Date(existingReport.date).toISOString().split("T")[0]
        }`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting report:", error);
    return NextResponse.json(
      {
        error: "Failed to delete report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
