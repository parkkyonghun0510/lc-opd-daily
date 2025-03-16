import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getToken } from "next-auth/jwt";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, format } from "date-fns";

const prisma = new PrismaClient();

// GET /api/reports/consolidated - Get consolidated report data
export async function GET(request: NextRequest) {
  try {
    // Verify user authentication using NextAuth
    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Parse date parameters
    const dateParam = searchParams.get("date");
    const periodParam = searchParams.get("period") || "day"; // 'day', 'week', 'month'

    let startDate: Date;
    let endDate: Date;

    if (dateParam) {
      const date = new Date(dateParam);

      if (periodParam === "week") {
        startDate = startOfWeek(date, { weekStartsOn: 1 }); // Week starts on Monday
        endDate = endOfWeek(date, { weekStartsOn: 1 });
      } else if (periodParam === "month") {
        startDate = new Date(date.getFullYear(), date.getMonth(), 1);
        endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      } else {
        // day
        startDate = startOfDay(date);
        endDate = endOfDay(date);
      }
    } else {
      // Default to today
      const today = new Date();
      startDate = startOfDay(today);
      endDate = endOfDay(today);
    }

    // Get all branches for counting
    const allBranches = await prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
    });

    // Get reports for the period
    const reports = await prisma.report.findMany({
      where: {
        date: {
          gte: startDate.toISOString(),
          lte: endDate.toISOString(),
        },
        // Filter by report type if provided
        ...(searchParams.has("type")
          ? { reportType: searchParams.get("type") as "plan" | "actual" }
          : {}),
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

    // Calculate aggregated metrics
    const totalWriteOffs = reports.reduce(
      (sum, report) => sum + report.writeOffs,
      0
    );
    const totalNinetyPlus = reports.reduce(
      (sum, report) => sum + report.ninetyPlus,
      0
    );

    // Get branch coverage
    const reportedBranchIds = [
      ...new Set(reports.map((report) => report.branchId)),
    ];
    const reportedBranches = reportedBranchIds.length;
    const totalBranches = allBranches.length;

    // Missing branches
    const missingBranchIds = allBranches
      .filter((branch) => !reportedBranchIds.includes(branch.id))
      .map((branch) => ({
        id: branch.id,
        code: branch.code,
        name: branch.name,
      }));

    // Get historical data for trends (last 7 periods)
    const historicalData = [];

    if (periodParam === "day") {
      // Get daily data for the past 7 days
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() - i);

        const dayStart = startOfDay(currentDate);
        const dayEnd = endOfDay(currentDate);

        const dayReports = await prisma.report.findMany({
          where: {
            date: {
              gte: dayStart.toISOString(),
              lte: dayEnd.toISOString(),
            },
            ...(searchParams.has("type")
              ? { reportType: searchParams.get("type") as "plan" | "actual" }
              : {}),
          },
        });

        const dayWriteOffs = dayReports.reduce(
          (sum, report) => sum + report.writeOffs,
          0
        );
        const dayNinetyPlus = dayReports.reduce(
          (sum, report) => sum + report.ninetyPlus,
          0
        );

        historicalData.push({
          date: format(currentDate, "yyyy-MM-dd"),
          writeOffs: dayWriteOffs,
          ninetyPlus: dayNinetyPlus,
          count: dayReports.length,
        });
      }
    } else if (periodParam === "week") {
      // Get weekly data for the past 7 weeks
      for (let i = 0; i < 7; i++) {
        const currentWeekStart = new Date(startDate);
        currentWeekStart.setDate(currentWeekStart.getDate() - i * 7);

        const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });

        const weekReports = await prisma.report.findMany({
          where: {
            date: {
              gte: weekStart.toISOString(),
              lte: weekEnd.toISOString(),
            },
            ...(searchParams.has("type")
              ? { reportType: searchParams.get("type") as "plan" | "actual" }
              : {}),
          },
        });

        const weekWriteOffs = weekReports.reduce(
          (sum, report) => sum + report.writeOffs,
          0
        );
        const weekNinetyPlus = weekReports.reduce(
          (sum, report) => sum + report.ninetyPlus,
          0
        );

        historicalData.push({
          date: `${format(weekStart, "MMM d")} - ${format(
            weekEnd,
            "MMM d, yyyy"
          )}`,
          writeOffs: weekWriteOffs,
          ninetyPlus: weekNinetyPlus,
          count: weekReports.length,
        });
      }
    } else if (periodParam === "month") {
      // Get monthly data for the past 7 months
      for (let i = 0; i < 7; i++) {
        const currentMonth = new Date(startDate);
        currentMonth.setMonth(currentMonth.getMonth() - i);

        const monthStart = new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth(),
          1
        );
        const monthEnd = new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth() + 1,
          0
        );

        const monthReports = await prisma.report.findMany({
          where: {
            date: {
              gte: monthStart.toISOString(),
              lte: monthEnd.toISOString(),
            },
            ...(searchParams.has("type")
              ? { reportType: searchParams.get("type") as "plan" | "actual" }
              : {}),
          },
        });

        const monthWriteOffs = monthReports.reduce(
          (sum, report) => sum + report.writeOffs,
          0
        );
        const monthNinetyPlus = monthReports.reduce(
          (sum, report) => sum + report.ninetyPlus,
          0
        );

        historicalData.push({
          date: format(monthStart, "MMMM yyyy"),
          writeOffs: monthWriteOffs,
          ninetyPlus: monthNinetyPlus,
          count: monthReports.length,
        });
      }
    }

    // Group data by branch
    const branchData = allBranches.map((branch) => {
      const branchReports = reports.filter(
        (report) => report.branchId === branch.id
      );
      const branchWriteOffs = branchReports.reduce(
        (sum, report) => sum + report.writeOffs,
        0
      );
      const branchNinetyPlus = branchReports.reduce(
        (sum, report) => sum + report.ninetyPlus,
        0
      );

      return {
        branchId: branch.id,
        branchCode: branch.code,
        branchName: branch.name,
        writeOffs: branchWriteOffs,
        ninetyPlus: branchNinetyPlus,
        reportsCount: branchReports.length,
        hasReports: branchReports.length > 0,
      };
    });

    return NextResponse.json({
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        type: periodParam,
      },
      metrics: {
        totalWriteOffs,
        totalNinetyPlus,
        reportedBranches,
        totalBranches,
        coveragePercentage: (reportedBranches / totalBranches) * 100,
      },
      missingBranches: missingBranchIds,
      branchData,
      historicalData,
    });
  } catch (error) {
    console.error("Error fetching consolidated report data:", error);
    return NextResponse.json(
      { error: "Failed to fetch consolidated report data" },
      { status: 500 }
    );
  }
}
