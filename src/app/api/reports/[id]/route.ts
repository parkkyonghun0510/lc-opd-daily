import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { checkPermission, Permission, UserRole } from "@/lib/auth/roles";
import { getAccessibleBranches } from "@/lib/auth/branch-access";
import { broadcastDashboardUpdate } from "@/lib/events/dashboard-broadcaster";
import { z } from "zod";
import { DashboardEventTypes } from "@/lib/events/dashboard-events";

// Validation schema for report update
const updateReportSchema = z.object({
  writeOffs: z.number().min(0),
  ninetyPlus: z.number().min(0),
  comments: z.string().optional(),
});

// GET /api/reports/[id] - Get a specific report by ID
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    // Use NextAuth for authentication
    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    // Get the ID from the context params
    const { id } = await context.params;

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
            id: true,
          },
        },
        // Include ReportComment records
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

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // If this is an actual report, use the planReport relation
    // Convert Decimal objects to numbers
    const responseData = {
      ...report,
      writeOffs:
        typeof report.writeOffs === "object"
          ? Number(report.writeOffs)
          : report.writeOffs,
      ninetyPlus:
        typeof report.ninetyPlus === "object"
          ? Number(report.ninetyPlus)
          : report.ninetyPlus,
    } as Record<string, unknown>;

    if (report.reportType === "actual") {
      if (report.planReport) {
        // Add plan data with proper type conversion
        responseData.writeOffsPlan =
          typeof report.planReport.writeOffs === "object"
            ? Number(report.planReport.writeOffs)
            : typeof report.planReport.writeOffs === "number"
              ? report.planReport.writeOffs
              : 0;
        responseData.ninetyPlusPlan =
          typeof report.planReport.ninetyPlus === "object"
            ? Number(report.planReport.ninetyPlus)
            : typeof report.planReport.ninetyPlus === "number"
              ? report.planReport.ninetyPlus
              : 0;
        responseData.planReportId = report.planReport.id;
      } else {
        // If no plan report is linked, try to find one (for backwards compatibility)
        const planReport = await prisma.report.findFirst({
          where: {
            date: report.date,
            branchId: report.branchId,
            reportType: "plan",
          },
        });

        if (planReport) {
          // Add plan data with proper type conversion
          responseData.writeOffsPlan =
            typeof planReport.writeOffs === "object"
              ? Number(planReport.writeOffs)
              : typeof planReport.writeOffs === "number"
                ? planReport.writeOffs
                : 0;
          responseData.ninetyPlusPlan =
            typeof planReport.ninetyPlus === "object"
              ? Number(planReport.ninetyPlus)
              : typeof planReport.ninetyPlus === "number"
                ? planReport.ninetyPlus
                : 0;
          responseData.planReportId = planReport.id;

          // Update the actual report to link it to the plan report
          await prisma.report.update({
            where: { id: report.id },
            data: { planReportId: planReport.id },
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
        details: `Viewed report for branch: ${report.branch.code} on ${new Date(
          report.date,
        ).toLocaleDateString()}`,
      },
    });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error retrieving report:", error);
    return NextResponse.json(
      { error: "Failed to retrieve report" },
      { status: 500 },
    );
  }
}

// PUT /api/reports/[id] - Update a specific report
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    // Get the ID from the context params
    const { id } = await context.params;

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
        { status: 400 },
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
        details: `Updated report for branch: ${existingReport.branch.code} on ${new Date(
          existingReport.date,
        ).toLocaleDateString()}`,
      },
    });

    return NextResponse.json(updatedReport);
  } catch (error) {
    console.error("Error updating report:", error);
    return NextResponse.json(
      { error: "Failed to update report" },
      { status: 500 },
    );
  }
}

// DELETE /api/reports/[id] - Delete a report
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const token = await getToken({ req: request });
    const { id: reportId } = await context.params;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    if (!reportId) {
      return NextResponse.json(
        { error: "Report ID is required" },
        { status: 400 },
      );
    }

    // Fetch the report to check ownership/permissions before deleting
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true, submittedBy: true, branchId: true, status: true }, // Select necessary fields
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Permission Check
    const userRole = token.role as UserRole;
    const accessibleBranches = await getAccessibleBranches(token.sub as string);
    const canAccessBranch = accessibleBranches.some(
      (b) => b.id === report.branchId,
    );

    // Check if user has general delete permission OR delete own permission and owns the report
    const hasGeneralDeletePermission = checkPermission(
      userRole,
      Permission.DELETE_REPORTS,
    );
    const isOwner = report.submittedBy === token.sub;
    const hasDeleteOwnPermission = checkPermission(
      userRole,
      Permission.DELETE_OWN_REPORTS,
    );

    if (
      !canAccessBranch ||
      !(hasGeneralDeletePermission || (isOwner && hasDeleteOwnPermission))
    ) {
      return NextResponse.json(
        {
          error: "Forbidden - You do not have permission to delete this report",
        },
        { status: 403 },
      );
    }

    // Optional: Add logic to prevent deletion of approved reports if needed
    // if (report.status === 'approved') {
    //   return NextResponse.json({ error: "Cannot delete an approved report" }, { status: 400 });
    // }

    // Perform the deletion
    await prisma.report.delete({
      where: { id: reportId },
    });

    // Broadcast the update via SSE after successful deletion
    broadcastDashboardUpdate(DashboardEventTypes.REPORT_DELETED, {
      reportId: reportId,
      branchId: report.branchId, // Include branchId if needed for filtering on client
      // Add any other relevant details needed by the dashboard
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        action: "DELETE_REPORT",
        userId: token.id as string, // Cast to string since we know it exists
        // Use 'report' variable which is available in this scope
        details: `Deleted report ID: ${report.id} for branch ID: ${report.branchId}`,
      },
    });

    return NextResponse.json({ message: "Report deleted successfully" });
  } catch (error) {
    console.error(`Error deleting report:`, error);
    // Handle potential Prisma errors (e.g., record not found if deleted concurrently)
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Report not found or already deleted" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Failed to delete report" },
      { status: 500 },
    );
  }
}
