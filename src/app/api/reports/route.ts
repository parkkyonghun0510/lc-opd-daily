import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ReportType = "plan" | "actual";

interface ReportData {
  branchId: string;
  date: string;
  writeOffs: number;
  ninetyPlus: number;
  comments?: string;
  reportType: ReportType;
}

// GET /api/reports - Get all reports or filter by date with pagination
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const date = searchParams.get("date");
    const type = (searchParams.get("type") || "actual") as ReportType;
    const branchId = searchParams.get("branchId");

    const skip = (page - 1) * limit;

    // Build where clause based on filters and permissions
    const where: {
      reportType: ReportType;
      date?: string;
      branchId?: string;
    } = {
      reportType: type,
    };

    // Add date filter if provided
    if (date) {
      where.date = date;
    }

    // Handle branch filtering based on user role and provided branchId
    if (branchId) {
      // If a specific branch is requested, use it (assuming user has access)
      where.branchId = branchId;
    } else if (session.user.role !== "admin" && session.user.branchId) {
      // For non-admin users without a specific branch request, default to their branch
      where.branchId = session.user.branchId;
    }

    // Get total count for pagination
    const total = await prisma.report.count({ where });

    // Fetch reports with pagination
    const reports = await prisma.report.findMany({
      where,
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
      skip,
      take: limit,
    });

    // For actual reports, fetch corresponding plan reports
    if (type === "actual") {
      const reportDates = reports.map((report) => report.date);
      const planReports = await prisma.report.findMany({
        where: {
          date: { in: reportDates },
          reportType: "plan",
          branchId: { in: reports.map((r) => r.branchId) },
        },
      });

      // Merge plan data into actual reports
      const reportsWithPlan = reports.map((report) => {
        const planReport = planReports.find(
          (pr) => pr.date === report.date && pr.branchId === report.branchId
        );
        return {
          ...report,
          writeOffsPlan: planReport?.writeOffs || null,
          ninetyPlusPlan: planReport?.ninetyPlus || null,
        };
      });

      return NextResponse.json({
        reports: reportsWithPlan,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

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
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}

// POST /api/reports - Create a new report
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = (await request.json()) as ReportData;
    const { branchId, date, writeOffs, ninetyPlus, comments, reportType } =
      data;

    // Validate report type
    if (!["plan", "actual"].includes(reportType)) {
      return NextResponse.json(
        { error: "Invalid report type" },
        { status: 400 }
      );
    }

    // Check if user has permission to submit for this branch
    if (session.user.role !== "admin" && session.user.branchId !== branchId) {
      return NextResponse.json(
        { error: "You can only submit reports for your own branch" },
        { status: 403 }
      );
    }

    // For actual reports, check if plan exists
    if (reportType === "actual") {
      const planExists = await prisma.report.findFirst({
        where: {
          date,
          branchId,
          reportType: "plan",
        },
      });

      if (!planExists) {
        return NextResponse.json(
          {
            error:
              "Morning plan must be submitted before evening actual report",
          },
          { status: 400 }
        );
      }
    }

    // Check for existing report
    const existingReport = await prisma.report.findFirst({
      where: {
        date,
        branchId,
        reportType,
      },
    });

    if (existingReport) {
      return NextResponse.json(
        { error: "Report already exists for this date and type" },
        { status: 400 }
      );
    }

    const report = await prisma.report.create({
      data: {
        date,
        branchId,
        writeOffs,
        ninetyPlus,
        comments,
        reportType,
        status: "pending",
        submittedBy: session.user.email!,
        submittedAt: new Date().toISOString(),
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

    return NextResponse.json(report);
  } catch (error) {
    console.error("Error creating report:", error);
    return NextResponse.json(
      { error: "Failed to create report" },
      { status: 500 }
    );
  }
}
