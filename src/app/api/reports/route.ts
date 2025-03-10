import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { getUserFromToken } from "@/lib/jwt";

const prisma = new PrismaClient();

// Validation schema for report creation
const reportSchema = z.object({
  date: z.string().datetime(),
  branchId: z.string(),
  writeOffs: z.number().min(0),
  ninetyPlus: z.number().min(0),
  submittedBy: z.string(),
  comments: z.string().optional(),
});

// GET /api/reports - Get all reports or filter by date with pagination
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const skip = (page - 1) * limit;

  try {
    let where = {};

    if (date) {
      const dateObj = new Date(date);
      where = {
        date: {
          gte: new Date(dateObj.setHours(0, 0, 0, 0)),
          lt: new Date(dateObj.setHours(23, 59, 59, 999)),
        },
      };
    }

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          branch: true,
        },
        orderBy: {
          submittedAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.report.count({ where }),
    ]);

    return NextResponse.json({
      reports,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch reports",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST /api/reports - Create a new report
export async function POST(request: Request) {
  try {
    // Get user from token
    const authUser = await getUserFromToken();
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate input data
    const validatedData = reportSchema.parse({
      ...body,
      submittedBy: authUser?.username, // Set submittedBy from the authenticated user
    });

    // Check if report already exists for this date and branch
    const existingReport = await prisma.report.findFirst({
      where: {
        date: new Date(validatedData.date),
        branchId: validatedData.branchId,
      },
    });

    if (existingReport) {
      return NextResponse.json(
        { error: "A report already exists for this date and branch" },
        { status: 409 }
      );
    }

    // Create the report
    const report = await prisma.report.create({
      data: {
        date: new Date(validatedData.date),
        branchId: validatedData.branchId,
        writeOffs: validatedData.writeOffs,
        ninetyPlus: validatedData.ninetyPlus,
        submittedBy: validatedData.submittedBy,
        comments: validatedData.comments,
        status: "pending",
      },
      include: {
        branch: true,
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        userId: authUser.userId,
        action: "CREATE_REPORT",
        details: `Created report for branch ${report.branch.name} on ${
          report.date.toISOString().split("T")[0]
        }`,
      },
    });

    // TODO: Send Telegram notification

    return NextResponse.json(report, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating report:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to create report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
